use crate::models::*;
use crate::storage::Database;

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
                insight_block.push_str(&format!("\n- {} [{}]", content, date));
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
        blocks.push((format!("\n\n## Training Load Stats\n{}", stats_json), false));
    }

    if let Ok(Some(zones_json)) = db.get_athlete_zones() {
        blocks.push((format!("\n\n## Heart Rate Zones\n{}", zones_json), false));
    }

    if let Ok(gear) = db.get_all_gear() {
        if !gear.is_empty() {
            let mut gear_block = String::from("\n\n## Gear");
            for g in &gear {
                let dist_km = g.distance.unwrap_or(0.0) / 1000.0;
                gear_block.push_str(&format!(
                    "\n- {}: {:.0} km",
                    g.name.as_deref().unwrap_or("Unknown"),
                    dist_km
                ));
            }
            blocks.push((gear_block, false));
        }
    }

    let training_summary = build_training_summary(db);
    if !training_summary.is_empty() {
        blocks.push((training_summary, false));
    }

    assemble_within_budget(blocks, budget_chars)
}

fn assemble_within_budget(blocks: Vec<(String, bool)>, budget_chars: usize) -> String {
    let mut result = String::new();
    let mut remaining = budget_chars;

    for (block, is_pinned) in &blocks {
        if *is_pinned {
            result.push_str(block);
            remaining = remaining.saturating_sub(block.len());
        } else if block.len() <= remaining {
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
        parts.push(format!("- Age: {}", age));
    }
    if let Some(hr) = p.max_hr {
        parts.push(format!("- Max HR: {} bpm", hr));
    }
    if let Some(rhr) = p.resting_hr {
        parts.push(format!("- Resting HR: {} bpm", rhr));
    }
    if let Some(tp) = p.threshold_pace_secs {
        let mins = tp / 60;
        let secs = tp % 60;
        parts.push(format!("- Threshold pace: {}:{:02}/km", mins, secs));
    }
    if let Some(wm) = p.weekly_mileage_target {
        parts.push(format!("- Weekly mileage target: {:.0} km", wm));
    }
    if let Some(ref exp) = p.experience_level {
        parts.push(format!("- Experience: {}", exp));
    }
    if let Some(days) = p.training_days_per_week {
        parts.push(format!("- Training days/week: {}", days));
    }
    if let Some(ref terrain) = p.preferred_terrain {
        parts.push(format!("- Preferred terrain: {}", terrain));
    }
    if let Some(ref goals) = p.race_goals {
        parts.push(format!("- Race goals: {}", goals));
    }
    if let Some(ref injuries) = p.injury_history {
        parts.push(format!("- Injury history: {}", injuries));
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
        block.push_str(&format!(
            "\n### Week {} ({})",
            wws.week.week_number, wws.week.week_start
        ));
        for s in &wws.sessions {
            let dur = s
                .duration_min
                .map(|d| format!(" {}min", d))
                .unwrap_or_default();
            let dist = s
                .distance_km
                .map(|d| format!(" {:.1}km", d))
                .unwrap_or_default();
            block.push_str(&format!(
                "\n- Day {}: {} {}{}",
                s.day_of_week, s.session_type, dur, dist
            ));
        }
    }

    if block.len() > 1600 {
        block.truncate(1600);
        block.push_str("...");
    }

    block
}

fn build_training_summary(db: &Database) -> String {
    let now = chrono::Utc::now();
    let four_weeks_ago = (now - chrono::Duration::days(28))
        .format("%Y-%m-%dT00:00:00+00:00")
        .to_string();

    let activities = match db.get_activities_since(&four_weeks_ago) {
        Ok(a) => a,
        Err(_) => return String::new(),
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
                    .map_or(false, |d| d >= week_start.as_str() && d < week_end.as_str())
            })
            .collect();

        if week_activities.is_empty() {
            continue;
        }

        match week_idx {
            0 => {
                summary.push_str(&format!("\n### This Week ({} runs)", week_activities.len()));
                for a in &week_activities {
                    let dist = a.distance.unwrap_or(0.0) / 1000.0;
                    let time_min = a.moving_time.unwrap_or(0) as f64 / 60.0;
                    let hr = a
                        .average_heartrate
                        .map(|h| format!(" HR:{:.0}", h))
                        .unwrap_or_default();
                    let pace = if dist > 0.0 {
                        let pace_s_km = (a.moving_time.unwrap_or(0) as f64) / dist;
                        let pm = (pace_s_km / 60.0).floor() as i64;
                        let ps = (pace_s_km % 60.0) as i64;
                        format!(" {}:{:02}/km", pm, ps)
                    } else {
                        String::new()
                    };
                    summary.push_str(&format!(
                        "\n- {}: {:.1}km {:.0}min{}{}",
                        a.name.as_deref().unwrap_or("Run"),
                        dist,
                        time_min,
                        pace,
                        hr
                    ));
                }
            }
            1 => {
                summary.push_str(&format!("\n### Last Week ({} runs)", week_activities.len()));
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                let total_time: i64 = week_activities
                    .iter()
                    .map(|a| a.moving_time.unwrap_or(0))
                    .sum();
                summary.push_str(&format!(
                    "\n- Total: {:.1}km, {}min",
                    total_dist,
                    total_time / 60
                ));
            }
            2 => {
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                summary.push_str(&format!(
                    "\n### 2 Weeks Ago: {} runs, {:.1}km",
                    week_activities.len(),
                    total_dist
                ));
            }
            3 => {
                let total_dist: f64 = week_activities
                    .iter()
                    .map(|a| a.distance.unwrap_or(0.0))
                    .sum::<f64>()
                    / 1000.0;
                summary.push_str(&format!(
                    "\n### 3 Weeks Ago: {} runs, {:.1}km",
                    week_activities.len(),
                    total_dist
                ));
            }
            _ => {}
        }
    }

    summary
}
