use crate::models::{
    ActivityData, ActivityZoneSummary, PlanWeekWithSessions, ProfileData, TrainingPlan,
};
use crate::storage::Database;
use std::fmt::Write;

const DEFAULT_TOKEN_BUDGET: usize = 4000;
const CHARS_PER_TOKEN: usize = 4;

const SYSTEM_PREAMBLE: &str = r#"# CoachLM — Running Coach

## Role
You are CoachLM, a direct and knowledgeable running coach.
You have the athlete's profile, training log, and pinned coaching
insights below. Use them.

## Response Rules
- Lead with the answer. No preamble, no restating the question.
- Reference the athlete's actual numbers (pace, mileage, HR).
- Default to ≤150 words. Only go longer for detailed plans explicitly requested.
- Prescribe specific paces/distances derived from threshold pace and recent volume.
- Skip generic safety disclaimers unless user reports pain or injury.
- No motivational filler unless asked.
- If data is missing, say so briefly and ask what they need.

## Honesty Rules
- NEVER fabricate data, statistics, research, or facts. If you do not know something, say "I don't know" or "I don't have that information."
- Only reference numbers that appear in the athlete's profile or training log below. Do not invent metrics the athlete has not recorded.
- If the athlete asks about something outside your knowledge (e.g. specific race courses, weather, product reviews), say you cannot help with that and suggest where they might find the answer.
- When giving advice that depends on data you do not have (e.g. VO2max, lactate threshold test results), state your assumption explicitly so the athlete can correct it.
- It is always better to say "I'm not sure" than to guess.

## When to Generate Training Plans
- Do NOT generate a full plan unless:
  1. User explicitly asks ("Give me a plan", "Create a schedule")
  2. User clicks "Generate Training Plan" button
  3. Coach determines plan is needed and asks permission first
- Default to direct, principle-based advice.

## Output Format
- Bullet points or short paragraphs.
- For workouts: warmup, main set (pace + distance/time), cooldown.
- For questions: answer directly, add brief reasoning if helpful."#;

pub fn build_context(db: &Database) -> String {
    let budget_chars = DEFAULT_TOKEN_BUDGET * CHARS_PER_TOKEN;
    let mut blocks: Vec<(String, bool)> = Vec::new();

    blocks.push((SYSTEM_PREAMBLE.to_string(), false));

    if let Ok(Some(settings)) = db.get_settings() {
        if !settings.custom_system_prompt.is_empty() {
            blocks.push((
                format!(
                    "\n\n## Your Custom Instructions\n{}",
                    settings.custom_system_prompt
                ),
                false,
            ));
        }
    }

    if let Ok(insights) = db.get_pinned_insights() {
        if !insights.is_empty() {
            let mut insight_block = String::from("\n\n## Saved Coaching Insights");
            for insight in &insights {
                let date = insight.created_at.chars().take(10).collect::<String>();
                let content = if insight.content.len() > 500 {
                    let boundary = insight.content.floor_char_boundary(497);
                    format!("{}...", &insight.content[..boundary])
                } else {
                    insight.content.clone()
                };
                let _ = write!(insight_block, "\n- {content} [{date}]");
            }
            blocks.push((insight_block, true));
        }
    }

    if let Ok(Some(profile)) = db.get_profile() {
        blocks.push((format_profile_block(&profile), false));
    }

    if let Ok(Some(plan)) = db.get_active_plan() {
        if let Ok(weeks) = db.get_plan_weeks(&plan.id) {
            let plan_block = format_plan_block(&plan, &weeks);
            if !plan_block.is_empty() {
                blocks.push((plan_block, false));
            }
        }
    }

    if let Ok(Some(stats_json)) = db.get_athlete_stats() {
        blocks.push((format!("\n\n## Training Load Stats\n{stats_json}"), false));
    }

    if let Ok(Some(zones_json)) = db.get_athlete_zones() {
        blocks.push((format!("\n\n## Heart Rate Zones\n{zones_json}"), false));
    }

    if let Ok(gear) = db.get_all_gear() {
        if !gear.is_empty() {
            let mut gear_block = String::from("\n\n## Gear");
            for g in &gear {
                let dist_km = g.distance.unwrap_or(0.0) / 1000.0;
                let _ = write!(
                    gear_block,
                    "\n- {}: {dist_km:.0} km",
                    g.name.as_deref().unwrap_or("Unknown"),
                );
            }
            blocks.push((gear_block, false));
        }
    }

    let training_summary = build_training_summary(db);
    if !training_summary.is_empty() {
        blocks.push((training_summary, false));
    }

    if let Ok(zones) = db.get_aggregated_zone_distribution(Some(7)) {
        if !zones.is_empty() {
            let zone_block = format_zone_distribution_block(&zones);
            blocks.push((zone_block, false));
        }
    }

    assemble_within_budget(&blocks, budget_chars)
}

fn assemble_within_budget(blocks: &[(String, bool)], budget_chars: usize) -> String {
    let mut result = String::new();
    let mut remaining = budget_chars;

    for (block, is_pinned) in blocks {
        if *is_pinned || block.len() <= remaining {
            result.push_str(block);
            remaining = remaining.saturating_sub(block.len());
        } else if remaining > 100 {
            let boundary = block.floor_char_boundary(remaining);
            result.push_str(&block[..boundary]);
            break;
        }
    }

    result
}

fn format_profile_block(p: &ProfileData) -> String {
    let mut parts = vec!["\n\n## Athlete Profile".to_string()];

    if let Some(age) = p.age {
        parts.push(format!("- Age: {age}"));
    }
    if let Some(hr) = p.max_hr {
        parts.push(format!("- Max HR: {hr} bpm"));
    }
    if let Some(rhr) = p.resting_hr {
        parts.push(format!("- Resting HR: {rhr} bpm"));
    }
    if let Some(tp) = p.threshold_pace_secs {
        let mins = tp / 60;
        let secs = tp % 60;
        parts.push(format!("- Threshold pace: {mins}:{secs:02}/km"));
    }
    if let Some(wm) = p.weekly_mileage_target {
        parts.push(format!("- Weekly mileage target: {wm:.0} km"));
    }
    if let Some(ref exp) = p.experience_level {
        parts.push(format!("- Experience: {exp}"));
    }
    if let Some(days) = p.training_days_per_week {
        parts.push(format!("- Training days/week: {days}"));
    }
    if let Some(ref terrain) = p.preferred_terrain {
        parts.push(format!("- Preferred terrain: {terrain}"));
    }
    if let Some(ref goals) = p.race_goals {
        parts.push(format!("- Race goals: {goals}"));
    }
    if let Some(ref injuries) = p.injury_history {
        parts.push(format!("- Injury history: {injuries}"));
    }
    if let Some(ref notes) = p.custom_notes {
        parts.push(format!("- Custom notes: {notes}"));
    }

    parts.join("\n")
}

fn format_plan_block(plan: &TrainingPlan, weeks: &[PlanWeekWithSessions]) -> String {
    let mut block = format!(
        "\n\n## Active Training Plan\nGenerated: {}",
        plan.generated_at.chars().take(10).collect::<String>()
    );

    let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let current_and_next: Vec<&PlanWeekWithSessions> = weeks
        .iter()
        .filter(|w| w.week.week_start >= now || w.sessions.iter().any(|s| s.status == "planned"))
        .take(2)
        .collect();

    for wws in current_and_next {
        let _ = write!(
            block,
            "\n### Week {} ({})",
            wws.week.week_number, wws.week.week_start
        );
        for s in &wws.sessions {
            let dur = s
                .duration_min
                .map(|d| format!(" {d}min"))
                .unwrap_or_default();
            let dist = s
                .distance_km
                .map(|d| format!(" {d:.1}km"))
                .unwrap_or_default();
            let _ = write!(
                block,
                "\n- Day {}: {} {dur}{dist}",
                s.day_of_week, s.session_type,
            );
        }
    }

    if block.len() > 1600 {
        block.truncate(1600);
        block.push_str("...");
    }

    block
}

#[allow(clippy::too_many_lines)]
fn build_training_summary(db: &Database) -> String {
    let now = chrono::Utc::now();
    let four_weeks_ago = (now - chrono::Duration::days(28))
        .format("%Y-%m-%dT00:00:00+00:00")
        .to_string();

    let Ok(activities) = db.get_activities_since(&four_weeks_ago) else {
        return String::new();
    };

    if activities.is_empty() {
        return String::new();
    }

    let mut summary = String::from("\n\n## Recent Training (Last 4 Weeks)");

    let week_boundaries: Vec<String> = (0..4)
        .map(|i| {
            (now - chrono::Duration::days((i + 1) * 7))
                .format("%Y-%m-%dT00:00:00+00:00")
                .to_string()
        })
        .collect();

    for week_idx in 0..4u32 {
        let week_start = &week_boundaries[week_idx as usize];
        let week_end = if week_idx == 0 {
            now.to_rfc3339()
        } else {
            week_boundaries[(week_idx - 1) as usize].clone()
        };

        let week_activities: Vec<&ActivityData> = activities
            .iter()
            .filter(|a| {
                a.start_date
                    .as_deref()
                    .is_some_and(|d| d >= week_start.as_str() && d < week_end.as_str())
            })
            .collect();

        if week_activities.is_empty() {
            continue;
        }

        match week_idx {
            0 => summary.push_str(&format_this_week_summary(&week_activities, db)),
            1 => summary.push_str(&format_last_week_summary(&week_activities)),
            2 => summary.push_str(&format_older_week_summary("2 Weeks Ago", &week_activities)),
            3 => summary.push_str(&format_older_week_summary("3 Weeks Ago", &week_activities)),
            _ => {}
        }
    }

    summary
}

fn format_this_week_summary(activities: &[&ActivityData], db: &Database) -> String {
    let mut out = format!("\n### This Week ({} runs)", activities.len());
    for a in activities {
        let dist = a.distance.unwrap_or(0.0) / 1000.0;
        #[allow(clippy::cast_precision_loss)]
        let time_min = a.moving_time.unwrap_or(0) as f64 / 60.0;
        let hr = a
            .average_heartrate
            .map(|h| format!(" HR:{h:.0}"))
            .unwrap_or_default();
        let pace = if dist > 0.0 {
            #[allow(clippy::cast_precision_loss)]
            let pace_s_km = (a.moving_time.unwrap_or(0) as f64) / dist;
            #[allow(clippy::cast_possible_truncation)]
            let pm = (pace_s_km / 60.0).floor() as i64;
            #[allow(clippy::cast_possible_truncation)]
            let ps = (pace_s_km % 60.0) as i64;
            format!(" {pm}:{ps:02}/km")
        } else {
            String::new()
        };
        let cv = if db.has_activity_laps(&a.activity_id).unwrap_or(false) {
            db.get_activity_laps(&a.activity_id)
                .ok()
                .and_then(|laps| crate::strava::compute_pace_variance(&laps))
                .map(|cv| format!(" | CV:{cv:.0}%"))
                .unwrap_or_default()
        } else {
            String::new()
        };
        let _ = write!(
            out,
            "\n- {}: {dist:.1}km {time_min:.0}min{pace}{hr}{cv}",
            a.name.as_deref().unwrap_or("Run"),
        );
    }
    out
}

fn format_last_week_summary(activities: &[&ActivityData]) -> String {
    let total_dist: f64 = activities
        .iter()
        .map(|a| a.distance.unwrap_or(0.0))
        .sum::<f64>()
        / 1000.0;
    let total_time: i64 = activities.iter().map(|a| a.moving_time.unwrap_or(0)).sum();
    let mut out = format!("\n### Last Week ({} runs)", activities.len());
    let _ = write!(out, "\n- Total: {total_dist:.1}km, {}min", total_time / 60);
    out
}

fn format_older_week_summary(label: &str, activities: &[&ActivityData]) -> String {
    let total_dist: f64 = activities
        .iter()
        .map(|a| a.distance.unwrap_or(0.0))
        .sum::<f64>()
        / 1000.0;
    format!(
        "\n### {label}: {} runs, {total_dist:.1}km",
        activities.len(),
    )
}

fn format_zone_distribution_block(zones: &[ActivityZoneSummary]) -> String {
    let mut block = String::from("\n\n## HR Zone Distribution (Last 7 Days)\n");
    let entries: Vec<String> = zones
        .iter()
        .enumerate()
        .map(|(i, z)| {
            let n = i + 1;
            let range = if z.zone_min == 0 {
                format!("<{}", z.zone_max)
            } else if z.zone_max == -1 || z.zone_max == 999 {
                format!(">{}", z.zone_min)
            } else {
                format!("{}-{}", z.zone_min, z.zone_max)
            };
            let pct = z.percentage.round();
            #[allow(clippy::cast_possible_truncation)]
            let pct_i = pct as i64;
            format!("Z{n}({range}): {pct_i}%")
        })
        .collect();
    block.push_str(&entries.join(" | "));
    if block.len() > 200 {
        let boundary = block.floor_char_boundary(200);
        block.truncate(boundary);
    }
    block
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ActivityData, ActivityLap, ActivityZoneDistribution};

    fn temp_db() -> (Database, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("coachlm_ctx_test_{}", uuid::Uuid::new_v4()));
        let db = Database::new(&dir).expect("Failed to create test database");
        (db, dir)
    }

    fn cleanup(dir: &std::path::PathBuf) {
        std::fs::remove_dir_all(dir).ok();
    }

    fn minimal_activity(
        activity_id: &str,
        strava_id: &str,
        dist_m: f64,
        moving_secs: i64,
    ) -> ActivityData {
        ActivityData {
            activity_id: activity_id.to_string(),
            strava_id: Some(strava_id.to_string()),
            name: Some("Test Run".to_string()),
            activity_type: Some("Run".to_string()),
            start_date: None,
            distance: Some(dist_m),
            moving_time: Some(moving_secs),
            average_speed: None,
            average_heartrate: None,
            max_heartrate: None,
            average_cadence: None,
            gear_id: None,
            elapsed_time: Some(moving_secs),
            total_elevation_gain: None,
            max_speed: None,
            workout_type: None,
            sport_type: None,
            start_date_local: None,
        }
    }

    fn make_lap(
        activity_id: &str,
        lap_index: i64,
        distance: f64,
        elapsed_time: i64,
    ) -> ActivityLap {
        ActivityLap {
            id: None,
            activity_id: activity_id.to_string(),
            lap_index,
            distance,
            elapsed_time,
            moving_time: elapsed_time,
            average_speed: {
                #[allow(clippy::cast_precision_loss)]
                let et = elapsed_time as f64;
                distance / et
            },
            max_speed: None,
            average_heartrate: None,
            max_heartrate: None,
            average_cadence: None,
            total_elevation_gain: None,
        }
    }

    #[test]
    fn test_context_pace_variance() {
        let (db, dir) = temp_db();

        let activity = minimal_activity("act-1", "strava-1", 10_000.0, 3000);
        db.insert_activity(&activity)
            .expect("insert_activity failed");

        let laps = vec![
            make_lap("act-1", 1, 1000.0, 300),
            make_lap("act-1", 2, 1000.0, 360),
        ];
        db.save_activity_laps("act-1", &laps)
            .expect("save_activity_laps failed");

        let result = format_this_week_summary(&[&activity], &db);

        assert!(
            result.contains("CV:"),
            "expected CV in output, got: {result}"
        );
        assert!(
            result.contains('%'),
            "expected percent sign in output, got: {result}"
        );

        cleanup(&dir);
    }

    #[test]
    fn test_context_no_laps_no_cv() {
        let (db, dir) = temp_db();

        let activity = minimal_activity("act-2", "strava-2", 5_000.0, 1500);
        db.insert_activity(&activity)
            .expect("insert_activity failed");

        let result = format_this_week_summary(&[&activity], &db);

        assert!(
            !result.contains("CV:"),
            "expected no CV when no laps, got: {result}"
        );

        cleanup(&dir);
    }

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

    #[test]
    fn assemble_within_budget_all_fit() {
        let blocks = vec![("Hello ".to_string(), false), ("World".to_string(), false)];
        let result = assemble_within_budget(&blocks, 1000);
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn assemble_within_budget_skip_oversized_unpinned() {
        let blocks = vec![("short".to_string(), false), ("x".repeat(500), false)];
        let result = assemble_within_budget(&blocks, 50);
        assert_eq!(result, "short");
    }

    #[test]
    fn assemble_within_budget_pinned_always_included() {
        let blocks = vec![
            ("small".to_string(), false),
            ("PINNED_BLOCK".to_string(), true),
        ];
        let result = assemble_within_budget(&blocks, 10);
        assert!(
            result.contains("small"),
            "non-pinned block should be included"
        );
        assert!(
            result.contains("PINNED_BLOCK"),
            "pinned block must always be included"
        );
    }

    #[test]
    fn assemble_within_budget_truncate_when_over_100_remaining() {
        let long_block = "a".repeat(300);
        let blocks = vec![(long_block, false)];
        let result = assemble_within_budget(&blocks, 200);
        assert_eq!(result.len(), 200, "should truncate to budget size");
        assert!(result.chars().all(|c| c == 'a'));
    }

    #[test]
    fn assemble_within_budget_no_truncate_when_remaining_100_or_less() {
        let blocks = vec![("a".repeat(60), false), ("b".repeat(200), false)];
        let result = assemble_within_budget(&blocks, 100);
        assert_eq!(result, "a".repeat(60));
        assert!(!result.contains('b'));
    }

    #[test]
    fn assemble_within_budget_empty_blocks() {
        let blocks: Vec<(String, bool)> = vec![];
        let result = assemble_within_budget(&blocks, 1000);
        assert!(result.is_empty());
    }

    #[test]
    fn assemble_within_budget_zero_budget_pinned_still_included() {
        let blocks = vec![("important".to_string(), true)];
        let result = assemble_within_budget(&blocks, 0);
        assert_eq!(
            result, "important",
            "pinned blocks must be included even with zero budget"
        );
    }

    #[test]
    fn system_preamble_contains_honesty_rules() {
        assert!(
            SYSTEM_PREAMBLE.contains("## Honesty Rules"),
            "SYSTEM_PREAMBLE must contain Honesty Rules section"
        );
        assert!(
            SYSTEM_PREAMBLE.contains("NEVER fabricate"),
            "SYSTEM_PREAMBLE must instruct model to never fabricate data"
        );
        assert!(
            SYSTEM_PREAMBLE.contains("I don't know"),
            "SYSTEM_PREAMBLE must instruct model to say 'I don't know'"
        );
    }

    #[test]
    fn format_profile_block_empty_profile() {
        let result = format_profile_block(&empty_profile());
        assert!(result.contains("## Athlete Profile"), "should have header");
        assert!(!result.contains("Age:"));
        assert!(!result.contains("Max HR:"));
        assert!(!result.contains("Experience:"));
    }

    #[test]
    fn format_profile_block_full_profile() {
        let profile = ProfileData {
            age: Some(35),
            max_hr: Some(185),
            resting_hr: Some(50),
            threshold_pace_secs: Some(270),
            weekly_mileage_target: Some(60.0),
            race_goals: Some("Sub-3 marathon".to_string()),
            injury_history: Some("IT band 2024".to_string()),
            experience_level: Some("advanced".to_string()),
            training_days_per_week: Some(6),
            preferred_terrain: Some("road".to_string()),
            heart_rate_zones: None,
            custom_notes: None,
        };
        let result = format_profile_block(&profile);
        assert!(result.contains("- Age: 35"));
        assert!(result.contains("- Max HR: 185 bpm"));
        assert!(result.contains("- Resting HR: 50 bpm"));
        assert!(result.contains("- Threshold pace: 4:30/km"));
        assert!(result.contains("- Weekly mileage target: 60 km"));
        assert!(result.contains("- Experience: advanced"));
        assert!(result.contains("- Training days/week: 6"));
        assert!(result.contains("- Preferred terrain: road"));
        assert!(result.contains("- Race goals: Sub-3 marathon"));
        assert!(result.contains("- Injury history: IT band 2024"));
    }

    #[test]
    fn format_profile_block_partial_profile() {
        let mut profile = empty_profile();
        profile.age = Some(28);
        profile.experience_level = Some("beginner".to_string());

        let result = format_profile_block(&profile);
        assert!(result.contains("- Age: 28"));
        assert!(result.contains("- Experience: beginner"));
        assert!(
            !result.contains("Max HR:"),
            "unset fields should be omitted"
        );
        assert!(
            !result.contains("Threshold pace:"),
            "unset fields should be omitted"
        );
        assert!(
            !result.contains("Weekly mileage"),
            "unset fields should be omitted"
        );
    }

    #[test]
    fn format_profile_block_threshold_pace_formatting() {
        let mut profile = empty_profile();
        profile.threshold_pace_secs = Some(300);
        let result = format_profile_block(&profile);
        assert!(
            result.contains("- Threshold pace: 5:00/km"),
            "result was: {result}"
        );

        let mut profile2 = empty_profile();
        profile2.threshold_pace_secs = Some(305);
        let result2 = format_profile_block(&profile2);
        assert!(
            result2.contains("- Threshold pace: 5:05/km"),
            "result was: {result2}"
        );
    }

    #[test]
    fn test_context_zone_summary() {
        use chrono::Utc;
        let (db, dir) = temp_db();

        let mut activity = minimal_activity("act-z1", "strava-z1", 10_000.0, 3600);
        activity.start_date = Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
        db.insert_activity(&activity)
            .expect("insert_activity failed");

        let zones = vec![
            ActivityZoneDistribution {
                activity_id: "act-z1".to_string(),
                zone_index: 0,
                zone_min: 0,
                zone_max: 120,
                time_seconds: 600,
            },
            ActivityZoneDistribution {
                activity_id: "act-z1".to_string(),
                zone_index: 1,
                zone_min: 120,
                zone_max: 150,
                time_seconds: 1200,
            },
            ActivityZoneDistribution {
                activity_id: "act-z1".to_string(),
                zone_index: 2,
                zone_min: 150,
                zone_max: 999,
                time_seconds: 1800,
            },
        ];
        db.save_activity_zone_distribution("act-z1", &zones)
            .expect("save_activity_zone_distribution failed");

        let result = build_context(&db);

        assert!(
            result.contains("## HR Zone Distribution (Last 7 Days)"),
            "expected zone header, got: {result}"
        );
        assert!(
            result.contains("Z1(<120)"),
            "expected Z1 with <120 format, got: {result}"
        );
        assert!(
            result.contains("Z2(120-150)"),
            "expected Z2 range format, got: {result}"
        );
        assert!(
            result.contains("Z3(>150)"),
            "expected Z3 with >150 format, got: {result}"
        );

        cleanup(&dir);
    }

    #[test]
    fn test_context_no_zone_data() {
        let (db, dir) = temp_db();

        let result = build_context(&db);

        assert!(
            !result.contains("## HR Zone Distribution"),
            "expected no zone block when no data, got: {result}"
        );

        cleanup(&dir);
    }

    #[test]
    fn test_context_zone_summary_under_200_chars() {
        use chrono::Utc;
        let (db, dir) = temp_db();

        let mut activity = minimal_activity("act-len", "strava-len", 10_000.0, 3600);
        activity.start_date = Some(Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
        db.insert_activity(&activity)
            .expect("insert_activity failed");

        let zones = vec![
            ActivityZoneDistribution {
                activity_id: "act-len".to_string(),
                zone_index: 0,
                zone_min: 0,
                zone_max: 115,
                time_seconds: 600,
            },
            ActivityZoneDistribution {
                activity_id: "act-len".to_string(),
                zone_index: 1,
                zone_min: 115,
                zone_max: 152,
                time_seconds: 1200,
            },
            ActivityZoneDistribution {
                activity_id: "act-len".to_string(),
                zone_index: 2,
                zone_min: 152,
                zone_max: 999,
                time_seconds: 1800,
            },
        ];
        db.save_activity_zone_distribution("act-len", &zones)
            .expect("save_activity_zone_distribution failed");

        let zone_summaries = db
            .get_aggregated_zone_distribution(Some(7))
            .expect("get_aggregated_zone_distribution failed");
        assert!(!zone_summaries.is_empty(), "expected zone data");

        let zone_block = format_zone_distribution_block(&zone_summaries);
        assert!(
            zone_block.len() <= 200,
            "zone block should be ≤200 chars, got {} chars: {zone_block}",
            zone_block.len()
        );

        cleanup(&dir);
    }
}
