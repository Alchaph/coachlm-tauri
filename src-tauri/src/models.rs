use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsData {
    pub active_llm: String,
    pub ollama_endpoint: String,
    pub ollama_model: String,
    pub custom_system_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileData {
    pub age: Option<i64>,
    pub max_hr: Option<i64>,
    pub resting_hr: Option<i64>,
    pub threshold_pace_secs: Option<i64>,
    pub weekly_mileage_target: Option<f64>,
    pub race_goals: Option<String>,
    pub injury_history: Option<String>,
    pub experience_level: Option<String>,
    pub training_days_per_week: Option<i64>,
    pub preferred_terrain: Option<String>,
    pub heart_rate_zones: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityData {
    pub activity_id: String,
    pub strava_id: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub activity_type: Option<String>,
    pub start_date: Option<String>,
    pub distance: Option<f64>,
    pub moving_time: Option<i64>,
    pub average_speed: Option<f64>,
    pub average_heartrate: Option<f64>,
    pub max_heartrate: Option<f64>,
    pub average_cadence: Option<f64>,
    pub gear_id: Option<String>,
    pub elapsed_time: Option<i64>,
    pub total_elevation_gain: Option<f64>,
    pub max_speed: Option<f64>,
    pub workout_type: Option<i64>,
    pub sport_type: Option<String>,
    pub start_date_local: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsData {
    pub total_activities: i64,
    pub total_distance_km: f64,
    pub earliest_date: Option<String>,
    pub latest_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightData {
    pub id: i64,
    pub content: String,
    pub source_session_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub id: String,
    pub title: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageData {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GearData {
    pub gear_id: String,
    pub name: Option<String>,
    pub distance: Option<f64>,
    pub brand_name: Option<String>,
    pub model_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub connected: bool,
    pub expires_at: Option<i64>,
}

#[allow(clippy::struct_field_names)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Race {
    pub id: String,
    pub name: String,
    pub distance_km: f64,
    pub race_date: String,
    pub terrain: String,
    pub elevation_m: Option<f64>,
    pub goal_time_s: Option<i64>,
    pub priority: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingPlan {
    pub id: String,
    pub race_id: String,
    pub generated_at: String,
    pub llm_backend: String,
    pub prompt_hash: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingPlanSummary {
    pub id: String,
    pub race_id: String,
    pub race_name: String,
    pub generated_at: String,
    pub is_active: bool,
    pub total_sessions: i64,
    pub completed_sessions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanWeek {
    pub id: String,
    pub plan_id: String,
    pub week_number: i64,
    pub week_start: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanWeekWithSessions {
    pub week: PlanWeek,
    pub sessions: Vec<PlanSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanSession {
    pub id: String,
    pub week_id: String,
    pub day_of_week: i64,
    pub session_type: String,
    pub duration_min: Option<i64>,
    pub distance_km: Option<f64>,
    pub hr_zone: Option<i64>,
    pub pace_min_low: Option<f64>,
    pub pace_min_high: Option<f64>,
    pub notes: Option<String>,
    pub status: String,
    pub actual_duration_min: Option<i64>,
    pub actual_distance_km: Option<f64>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStatus {
    pub status: String,
    pub actual_duration_min: Option<i64>,
    pub actual_distance_km: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaChatRequest {
    pub model: String,
    pub messages: Vec<OllamaMessage>,
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaChatResponse {
    pub message: Option<OllamaMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub schema_version: i64,
    pub exported_at: String,
    pub athlete_profile: Option<ProfileData>,
    pub training_summaries: Vec<ActivityData>,
    pub pinned_insights: Vec<InsightData>,
    pub settings_meta: SettingsMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMeta {
    pub active_llm: String,
}
