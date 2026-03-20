use crate::models::{ActivityData, PlanWeekWithSessions, ProfileData, TrainingPlan};
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
                    format!("{}...", &insight.content[..497])
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
            result.push_str(&block[..remaining]);
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
            0 => {
                let _ = write!(summary, "\n### This Week ({} runs)", week_activities.len());
                for a in &week_activities {
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
                    let _ = write!(
                        summary,
                        "\n- {}: {dist:.1}km {time_min:.0}min{pace}{hr}",
                        a.name.as_deref().unwrap_or("Run"),
                    );
                }
            }
            1 => {
                let _ = write!(summary, "\n### Last Week ({} runs)", week_activities.len());
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                let total_time: i64 = week_activities
                    .iter()
                    .map(|a| a.moving_time.unwrap_or(0))
                    .sum();
                let _ = write!(
                    summary,
                    "\n- Total: {total_dist:.1}km, {}min",
                    total_time / 60
                );
            }
            2 => {
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                let _ = write!(
                    summary,
                    "\n### 2 Weeks Ago: {} runs, {total_dist:.1}km",
                    week_activities.len(),
                );
            }
            3 => {
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                let _ = write!(
                    summary,
                    "\n### 3 Weeks Ago: {} runs, {total_dist:.1}km",
                    week_activities.len(),
                );
            }
            _ => {}
        }
    }

    summary
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
}
