use crate::models::{OllamaMessage, PlanSession, PlanWeek, ProfileData, Race, TrainingPlan};
use crate::storage::Database;
use std::fmt::Write;
use std::sync::Arc;
use tauri::Emitter;

pub async fn generate_plan(
    db: Arc<Database>,
    race_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<TrainingPlan, String> {
    let races = db.list_races().map_err(|e| e.to_string())?;
    let race = races.iter().find(|r| r.id == race_id)
        .ok_or("Race not found")?;

    let settings = db.get_settings().map_err(|e| e.to_string())?
        .ok_or("Settings not configured")?;

    app_handle.emit("plan:generate:progress", serde_json::json!({ "status": "Loading athlete profile..." })).ok();

    let profile = db.get_profile().map_err(|e| e.to_string())?.unwrap_or(ProfileData {
        age: None, max_hr: None, resting_hr: None, threshold_pace_secs: None,
        weekly_mileage_target: None, race_goals: None, injury_history: None,
        experience_level: None, training_days_per_week: None, preferred_terrain: None,
        heart_rate_zones: None, custom_notes: None,
    });

    let now = chrono::Utc::now();
    let race_date = chrono::NaiveDate::parse_from_str(&race.race_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid race date: {e}"))?;
    #[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]
    let weeks_to_race = ((race_date - now.date_naive()).num_days() as f64 / 7.0).ceil() as i64;

    if weeks_to_race <= 0 {
        return Err("Race date is in the past".to_string());
    }

    app_handle.emit("plan:generate:progress", serde_json::json!({ "status": "Building training context..." })).ok();

    let prompt = build_plan_prompt(&profile, race, weeks_to_race);

    let llm_context = crate::context::build_context(&db);
    let messages = vec![
        OllamaMessage { role: "system".to_string(), content: llm_context },
        OllamaMessage { role: "user".to_string(), content: prompt },
    ];

    let mut last_error = String::new();
    for attempt in 0..3u8 {
        app_handle.emit("plan:generate:progress", serde_json::json!({
            "status": format!("Generating plan with AI... (attempt {}/3)", attempt + 1)
        })).ok();

        let response = crate::llm::chat(
            &settings,
            messages.clone(),
        ).await?;

        match parse_plan_response(&response, race, weeks_to_race) {
            Ok(parsed) => {
                app_handle.emit("plan:generate:progress", serde_json::json!({ "status": "Parsing plan structure..." })).ok();

                let plan_id = uuid::Uuid::new_v4().to_string();
                let plan = TrainingPlan {
                    id: plan_id.clone(),
                    race_id: race.id.clone(),
                    generated_at: now.to_rfc3339(),
                    llm_backend: settings.cloud_model.as_deref()
                        .filter(|_| settings.active_llm != "local" && settings.active_llm != "ollama")
                        .unwrap_or(&settings.ollama_model)
                        .to_string(),
                    prompt_hash: format!("{:x}", sha2::Sha256::digest(messages[1].content.as_bytes()))[..16].to_string(),
                    is_active: true,
                };

                db.deactivate_all_plans().map_err(|e| e.to_string())?;
                app_handle.emit("plan:generate:progress", serde_json::json!({ "status": "Saving plan..." })).ok();
                db.save_training_plan(&plan).map_err(|e| e.to_string())?;

                for (week_num, sessions) in parsed {
                    let week_id = uuid::Uuid::new_v4().to_string();
                    let week_start = (now + chrono::Duration::weeks(i64::from(week_num) - 1))
                        .format("%Y-%m-%d").to_string();
                    let week = PlanWeek {
                        id: week_id.clone(),
                        plan_id: plan_id.clone(),
                        week_number: i64::from(week_num),
                        week_start,
                    };
                    db.save_plan_week(&week).map_err(|e| e.to_string())?;

                    for session in sessions {
                        let mut s = session;
                        s.id = uuid::Uuid::new_v4().to_string();
                        s.week_id.clone_from(&week_id);
                        db.save_plan_session(&s).map_err(|e| e.to_string())?;
                    }
                }

                return Ok(plan);
            }
            Err(e) => {
                last_error = e;
            }
        }
    }

    Err(format!("Failed to generate plan after 3 attempts: {last_error}"))
}

fn build_plan_prompt(profile: &ProfileData, race: &Race, weeks: i64) -> String {
    let mut prompt = format!(
        "Generate a {} training plan for a {} race ({:.1}km).\n",
        weeks, race.name, race.distance_km
    );
    let _ = writeln!(prompt, "Race date: {}, Terrain: {}", race.race_date, race.terrain);

    if let Some(ref exp) = profile.experience_level {
        let _ = writeln!(prompt, "Experience: {exp}");
    }
    if let Some(days) = profile.training_days_per_week {
        let _ = writeln!(prompt, "Available training days: {days}/week");
    }
    if let Some(tp) = profile.threshold_pace_secs {
        let _ = writeln!(prompt, "Threshold pace: {}:{:02}/km", tp / 60, tp % 60);
    }

    prompt.push_str("\nRespond with a JSON array of weeks. Each week has sessions:\n");
    prompt.push_str(r#"[{"week": 1, "sessions": [{"day": 1, "type": "easy", "duration_min": 40, "distance_km": 6.0, "hr_zone": 2, "notes": "Easy recovery"}]}]"#);
    prompt.push_str("\nSession types: easy, tempo, intervals, long_run, strength, rest, race");
    prompt.push_str("\nInclude rest days. Day 1 = Monday, Day 7 = Sunday.");

    prompt
}

use sha2::Digest;

fn parse_plan_response(
    response: &str,
    _race: &Race,
    _weeks: i64,
) -> Result<Vec<(u32, Vec<PlanSession>)>, String> {
    let json_start = response.find('[').ok_or("No JSON array found in response")?;
    let json_end = response.rfind(']').ok_or("No closing bracket found")? + 1;
    let json_str = &response[json_start..json_end];

    let weeks: Vec<serde_json::Value> = serde_json::from_str(json_str)
        .map_err(|e| format!("Invalid JSON: {e}"))?;

    let mut result = Vec::new();
    for week_val in &weeks {
        #[allow(clippy::cast_possible_truncation)]
        let week_num = week_val["week"].as_u64().ok_or("Missing week number")? as u32;
        let sessions_val = week_val["sessions"].as_array().ok_or("Missing sessions array")?;

        let mut sessions = Vec::new();
        for s in sessions_val {
            sessions.push(PlanSession {
                id: String::new(),
                week_id: String::new(),
                day_of_week: s["day"].as_i64().unwrap_or(1),
                session_type: s["type"].as_str().unwrap_or("easy").to_string(),
                duration_min: s["duration_min"].as_i64(),
                distance_km: s["distance_km"].as_f64(),
                hr_zone: s["hr_zone"].as_i64(),
                pace_min_low: s["pace_min_low"].as_f64(),
                pace_min_high: s["pace_min_high"].as_f64(),
                notes: s["notes"].as_str().map(|n| n.chars().take(300).collect()),
                status: "planned".to_string(),
                actual_duration_min: None,
                actual_distance_km: None,
                completed_at: None,
            });
        }
        result.push((week_num, sessions));
    }

    if result.is_empty() {
        return Err("Empty plan generated".to_string());
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_profile() -> ProfileData {
        ProfileData {
            age: None,
            max_hr: None,
            resting_hr: None,
            threshold_pace_secs: None,
            weekly_mileage_target: None,
            race_goals: None,
            injury_history: None,
            experience_level: None,
            training_days_per_week: None,
            preferred_terrain: None,
            heart_rate_zones: None,
            custom_notes: None,
        }
    }

    fn sample_race() -> Race {
        Race {
            id: "r1".to_string(),
            name: "Spring Marathon".to_string(),
            distance_km: 42.2,
            race_date: "2026-04-15".to_string(),
            terrain: "road".to_string(),
            elevation_m: Some(150.0),
            goal_time_s: Some(12600),
            priority: "A".to_string(),
            is_active: true,
            created_at: "2026-01-01".to_string(),
        }
    }

    #[test]
    fn build_plan_prompt_includes_race_info() {
        let prompt = build_plan_prompt(&empty_profile(), &sample_race(), 12);
        assert!(prompt.contains("12"), "should contain week count");
        assert!(prompt.contains("Spring Marathon"), "should contain race name");
        assert!(prompt.contains("42.2km"), "should contain distance");
        assert!(prompt.contains("2026-04-15"), "should contain race date");
        assert!(prompt.contains("road"), "should contain terrain");
    }

    #[test]
    fn build_plan_prompt_empty_profile_omits_optional_fields() {
        let prompt = build_plan_prompt(&empty_profile(), &sample_race(), 8);
        assert!(!prompt.contains("Experience:"), "empty profile should not have experience");
        assert!(!prompt.contains("training days"), "empty profile should not have training days");
        assert!(!prompt.contains("Threshold pace:"), "empty profile should not have threshold pace");
    }

    #[test]
    fn build_plan_prompt_full_profile_includes_all_fields() {
        let mut profile = empty_profile();
        profile.experience_level = Some("intermediate".to_string());
        profile.training_days_per_week = Some(5);
        profile.threshold_pace_secs = Some(270);

        let prompt = build_plan_prompt(&profile, &sample_race(), 16);
        assert!(prompt.contains("Experience: intermediate"));
        assert!(prompt.contains("Available training days: 5/week"));
        assert!(prompt.contains("Threshold pace: 4:30/km"));
    }

    #[test]
    fn build_plan_prompt_includes_json_format_instructions() {
        let prompt = build_plan_prompt(&empty_profile(), &sample_race(), 4);
        assert!(prompt.contains("JSON array"), "should instruct JSON format");
        assert!(prompt.contains("sessions"), "should mention sessions");
        assert!(prompt.contains("Day 1 = Monday"), "should specify day numbering");
    }

    #[test]
    fn parse_plan_response_valid_json() {
        let response = r#"Here is your plan:
[{"week": 1, "sessions": [{"day": 1, "type": "easy", "duration_min": 40, "distance_km": 6.0, "hr_zone": 2, "notes": "Recovery run"}]},
 {"week": 2, "sessions": [{"day": 3, "type": "tempo", "duration_min": 50, "distance_km": 8.0, "hr_zone": 4, "notes": "Tempo effort"}]}]
Good luck!"#;

        let result = parse_plan_response(response, &sample_race(), 2);
        assert!(result.is_ok(), "should parse valid JSON");
        let weeks = result.expect("already checked is_ok");
        assert_eq!(weeks.len(), 2);
        assert_eq!(weeks[0].0, 1);
        assert_eq!(weeks[0].1.len(), 1);
        assert_eq!(weeks[0].1[0].session_type, "easy");
        assert_eq!(weeks[0].1[0].day_of_week, 1);
        assert_eq!(weeks[0].1[0].duration_min, Some(40));
        assert_eq!(weeks[0].1[0].distance_km, Some(6.0));
        assert_eq!(weeks[0].1[0].hr_zone, Some(2));
        assert_eq!(weeks[0].1[0].notes.as_deref(), Some("Recovery run"));
        assert_eq!(weeks[1].0, 2);
        assert_eq!(weeks[1].1[0].session_type, "tempo");
    }

    #[test]
    fn parse_plan_response_no_json() {
        let result = parse_plan_response("No JSON here at all", &sample_race(), 1);
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err");
        assert!(err.contains("No JSON array found"), "error: {err}");
    }

    #[test]
    fn parse_plan_response_empty_array() {
        let result = parse_plan_response("[]", &sample_race(), 1);
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err");
        assert!(err.contains("Empty plan"), "error: {err}");
    }

    #[test]
    fn parse_plan_response_malformed_json() {
        let result = parse_plan_response("[{broken json}]", &sample_race(), 1);
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err");
        assert!(err.contains("Invalid JSON"), "error: {err}");
    }

    #[test]
    fn parse_plan_response_missing_week_number() {
        let response = r#"[{"sessions": [{"day": 1, "type": "easy"}]}]"#;
        let result = parse_plan_response(response, &sample_race(), 1);
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err");
        assert!(err.contains("Missing week number"), "error: {err}");
    }

    #[test]
    fn parse_plan_response_missing_sessions_array() {
        let response = r#"[{"week": 1}]"#;
        let result = parse_plan_response(response, &sample_race(), 1);
        assert!(result.is_err());
        let err = result.expect_err("already checked is_err");
        assert!(err.contains("Missing sessions array"), "error: {err}");
    }

    #[test]
    fn parse_plan_response_session_defaults() {
        let response = r#"[{"week": 1, "sessions": [{"day": 2, "type": "long_run"}]}]"#;
        let result = parse_plan_response(response, &sample_race(), 1);
        assert!(result.is_ok());
        let weeks = result.expect("already checked is_ok");
        let session = &weeks[0].1[0];
        assert_eq!(session.day_of_week, 2);
        assert_eq!(session.session_type, "long_run");
        assert!(session.duration_min.is_none(), "optional field should be None");
        assert!(session.distance_km.is_none());
        assert!(session.hr_zone.is_none());
        assert!(session.pace_min_low.is_none());
        assert!(session.pace_min_high.is_none());
        assert!(session.notes.is_none());
        assert_eq!(session.status, "planned");
    }

    #[test]
    fn parse_plan_response_notes_truncated_at_300_chars() {
        let long_notes = "a".repeat(400);
        let response = format!(
            r#"[{{"week": 1, "sessions": [{{"day": 1, "type": "easy", "notes": "{long_notes}"}}]}}]"#
        );
        let result = parse_plan_response(&response, &sample_race(), 1);
        assert!(result.is_ok());
        let weeks = result.expect("already checked is_ok");
        let notes = weeks[0].1[0].notes.as_ref().expect("notes should exist");
        assert_eq!(notes.len(), 300, "notes should be truncated to 300 chars");
    }
}
