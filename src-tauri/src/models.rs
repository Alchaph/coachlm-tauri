use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WebAugmentationMode {
    #[default]
    Off,
    Simple,
    Agent,
    Auto,
}

impl WebAugmentationMode {
    pub fn from_setting(value: &str) -> Self {
        match value.to_lowercase().as_str() {
            "simple" => Self::Simple,
            "agent" => Self::Agent,
            "auto" => Self::Auto,
            _ => Self::Off,
        }
    }
}

impl fmt::Display for WebAugmentationMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Off => write!(f, "off"),
            Self::Simple => write!(f, "simple"),
            Self::Agent => write!(f, "agent"),
            Self::Auto => write!(f, "auto"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsData {
    pub active_llm: String,
    pub ollama_endpoint: String,
    pub ollama_model: String,
    pub custom_system_prompt: String,
    pub cloud_api_key: Option<String>,
    pub cloud_model: Option<String>,
    #[serde(default)]
    pub web_search_enabled: bool,
    #[serde(default = "default_web_search_provider")]
    pub web_search_provider: String,
    #[serde(default = "default_web_augmentation_mode")]
    pub web_augmentation_mode: String,
}

impl SettingsData {
    /// Resolves the effective web mode, with backward compat for the old bool toggle.
    #[must_use]
    pub fn effective_web_mode(&self) -> WebAugmentationMode {
        // If the new field is set to something other than "off", use it directly.
        if !self.web_augmentation_mode.is_empty() && self.web_augmentation_mode != "off" {
            return WebAugmentationMode::from_setting(&self.web_augmentation_mode);
        }
        // Backward compat: old bool toggle
        if self.web_search_enabled {
            WebAugmentationMode::Simple
        } else {
            WebAugmentationMode::from_setting(&self.web_augmentation_mode)
        }
    }
}

fn default_web_search_provider() -> String {
    "duckduckgo".to_string()
}

fn default_web_augmentation_mode() -> String {
    "off".to_string()
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
    pub custom_notes: Option<String>,
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
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiChoice {
    pub message: ChatMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiChatResponse {
    pub choices: Vec<OpenAiChoice>,
}

// For Ollama streaming chunks (line-delimited JSON)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStreamChunk {
    pub message: Option<OllamaMessage>,
    pub done: bool,
}

// For OpenAI-compatible streaming chunks (SSE)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiStreamChoice {
    pub delta: OpenAiDelta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiDelta {
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAiStreamChunk {
    pub choices: Vec<OpenAiStreamChoice>,
}

pub struct CloudProvider;

impl CloudProvider {
    pub fn base_url(provider: &str) -> Option<&'static str> {
        match provider {
            "groq" => Some("https://api.groq.com/openai/v1"),
            "openrouter" => Some("https://openrouter.ai/api/v1"),
            _ => None,
        }
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLap {
    pub id: Option<i64>,
    pub activity_id: String,
    pub lap_index: i64,
    pub distance: f64,
    pub elapsed_time: i64,
    pub moving_time: i64,
    pub average_speed: f64,
    pub max_speed: Option<f64>,
    pub average_heartrate: Option<f64>,
    pub max_heartrate: Option<f64>,
    pub average_cadence: Option<f64>,
    pub total_elevation_gain: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityZoneDistribution {
    pub activity_id: String,
    pub zone_index: i64,
    pub zone_min: i64,
    pub zone_max: i64,
    pub time_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityZoneSummary {
    pub zone_index: i64,
    pub zone_min: i64,
    pub zone_max: i64,
    pub total_time_seconds: i64,
    pub percentage: f64,
}
