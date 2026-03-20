mod context;
mod fit;
mod llm;
mod models;
mod plan;
mod storage;
mod strava;

use models::{
    ActivityData, AuthStatus, ExportData, InsightData, MessageData, OllamaMessage, PlanWeekWithSessions,
    ProfileData, Race, SessionData, SessionStatus, SettingsData, SettingsMeta, StatsData, TrainingPlan,
    TrainingPlanSummary,
};
use std::sync::Arc;
use storage::Database;
use tauri::Manager;

pub struct AppState {
    pub db: Arc<Database>,
    pub current_session_id: std::sync::Mutex<Option<String>>,
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Option<SettingsData>, String> {
    state.db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_settings(state: tauri::State<'_, AppState>, data: SettingsData) -> Result<(), String> {
    state.db.save_settings(&data).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn is_first_run(state: tauri::State<'_, AppState>) -> bool {
    state.db.is_first_run()
}

#[tauri::command]
fn get_strava_credentials_available() -> bool {
    strava::credentials_available()
}

#[tauri::command]
async fn start_strava_auth(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    strava::start_auth(state.db.clone(), app_handle).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_strava_auth_status(state: tauri::State<'_, AppState>) -> Result<AuthStatus, String> {
    strava::get_auth_status(&state.db)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn disconnect_strava(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.db.delete_oauth_tokens().map_err(|e| e.to_string())
}

#[tauri::command]
async fn sync_strava_activities(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    strava::sync_activities(state.db.clone(), app_handle).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_recent_activities(
    state: tauri::State<'_, AppState>,
    limit: u32,
) -> Result<Vec<ActivityData>, String> {
    state.db.get_recent_activities(limit).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_activity_stats(state: tauri::State<'_, AppState>) -> Result<StatsData, String> {
    state.db.get_activity_stats().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_profile_data(state: tauri::State<'_, AppState>) -> Result<Option<ProfileData>, String> {
    state.db.get_profile().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_profile_data(
    state: tauri::State<'_, AppState>,
    data: ProfileData,
) -> Result<(), String> {
    state.db.save_profile(&data).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_context_preview(state: tauri::State<'_, AppState>) -> String {
    context::build_context(&state.db)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_pinned_insight(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<(), String> {
    let session_id = state
        .current_session_id
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    state
        .db
        .save_pinned_insight(&content, session_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_pinned_insights(state: tauri::State<'_, AppState>) -> Result<Vec<InsightData>, String> {
    state.db.get_pinned_insights().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_pinned_insight(state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_pinned_insight(id).map_err(|e| e.to_string())
}

fn generate_session_title(content: &str) -> String {
    let trimmed = content.trim();
    if trimmed.len() <= 50 {
        return trimmed.to_string();
    }
    let truncated = &trimmed[..50];
    truncated
        .rfind(' ')
        .map_or_else(
            || format!("{truncated}..."),
            |pos| format!("{}...", &truncated[..pos]),
        )
}

#[tauri::command]
async fn send_message(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<String, String> {
    let session_id = {
        let mut sid = state
            .current_session_id
            .lock()
            .map_err(|e| e.to_string())?;
        if sid.is_none() {
            let session = state.db.create_chat_session().map_err(|e| e.to_string())?;
            *sid = Some(session.id.clone());
        }
        sid.clone().ok_or("Session ID missing after creation")?
    };

    state
        .db
        .insert_chat_message(&session_id, "user", &content)
        .map_err(|e| e.to_string())?;

    let sessions = state.db.get_chat_sessions().map_err(|e| e.to_string())?;
    let current = sessions.iter().find(|s| s.id == session_id);
    if current.is_some_and(|s| s.title.is_none()) {
        let title = generate_session_title(&content);
        state
            .db
            .update_chat_session_title(&session_id, &title)
            .map_err(|e| e.to_string())?;
    }

    let settings = state
        .db
        .get_settings()
        .map_err(|e| e.to_string())?
        .ok_or("Settings not configured. Complete the setup wizard first.")?;

    let llm_ctx = context::build_context(&state.db);
    let history = state.db.get_chat_messages(&session_id).map_err(|e| e.to_string())?;

    let mut messages = vec![OllamaMessage {
        role: "system".to_string(),
        content: llm_ctx,
    }];

    for msg in &history {
        messages.push(OllamaMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    let response = llm::chat_with_ollama(
        &settings.ollama_endpoint,
        &settings.ollama_model,
        messages,
    )
    .await?;

    state
        .db
        .insert_chat_message(&session_id, "assistant", &response)
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_chat_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<SessionData>, String> {
    state.db.get_chat_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_chat_messages(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<Vec<MessageData>, String> {
    state.db.get_chat_messages(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn create_chat_session(state: tauri::State<'_, AppState>) -> Result<SessionData, String> {
    let session = state.db.create_chat_session().map_err(|e| e.to_string())?;
    let mut sid = state
        .current_session_id
        .lock()
        .map_err(|e| e.to_string())?;
    *sid = Some(session.id.clone());
    Ok(session)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_chat_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.db.delete_chat_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn rename_chat_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    state
        .db
        .update_chat_session_title(&session_id, &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ollama_models(endpoint: String) -> Result<Vec<String>, String> {
    llm::get_ollama_models(&endpoint).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn import_fit_file(
    state: tauri::State<'_, AppState>,
    file_path: String,
) -> Result<u32, String> {
    let activities = fit::import_fit_file(&file_path)?;
    let mut imported = 0u32;
    for activity in activities {
        if state.db.insert_activity(&activity).is_ok() {
            imported += 1;
        }
    }
    Ok(imported)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn export_context(
    state: tauri::State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    let profile = state.db.get_profile().map_err(|e| e.to_string())?;
    let activities = state.db.get_recent_activities(10000).map_err(|e| e.to_string())?;
    let insights = state.db.get_pinned_insights().map_err(|e| e.to_string())?;
    let settings = state.db.get_settings().map_err(|e| e.to_string())?;

    let export = ExportData {
        schema_version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        athlete_profile: profile,
        training_summaries: activities,
        pinned_insights: insights,
        settings_meta: SettingsMeta {
            active_llm: settings.map_or_else(|| "local".to_string(), |s| s.active_llm),
        },
    };

    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn import_context(
    state: tauri::State<'_, AppState>,
    file_path: String,
    replace_all: bool,
) -> Result<(), String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let data: ExportData = serde_json::from_str(&content).map_err(|e| format!("Invalid file: {e}"))?;

    if data.schema_version != 1 {
        return Err(format!("Unsupported schema version: {}", data.schema_version));
    }

    if replace_all {
        let conn = state.db.conn();
        conn.execute("DELETE FROM pinned_insights", []).map_err(|e| e.to_string())?;
        drop(conn);
    }

    if let Some(profile) = data.athlete_profile {
        state.db.save_profile(&profile).map_err(|e| e.to_string())?;
    }

    for insight in data.pinned_insights {
        state
            .db
            .save_pinned_insight(&insight.content, insight.source_session_id.as_deref())
            .map_err(|e| e.to_string())?;
    }

    let mut failed_count: usize = 0;
    for activity in data.training_summaries {
        match state.db.insert_activity(&activity) {
            Ok(_) => {}
            Err(e) => {
                log::warn!("Failed to import activity: {e}");
                failed_count += 1;
            }
        }
    }

    if failed_count > 0 {
        return Err(format!("Failed to import {failed_count} activities"));
    }

    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn create_race(state: tauri::State<'_, AppState>, race: Race) -> Result<Race, String> {
    let mut r = race;
    if r.id.is_empty() {
        r.id = uuid::Uuid::new_v4().to_string();
    }
    if r.created_at.is_empty() {
        r.created_at = chrono::Utc::now().to_rfc3339();
    }
    state.db.create_race(&r).map_err(|e| e.to_string())?;
    Ok(r)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn update_race(state: tauri::State<'_, AppState>, race: Race) -> Result<(), String> {
    state.db.update_race(&race).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_race(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_race(&id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_races(state: tauri::State<'_, AppState>) -> Result<Vec<Race>, String> {
    state.db.list_races().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_active_race(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.set_active_race(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_plan_cmd(
    state: tauri::State<'_, AppState>,
    race_id: String,
) -> Result<TrainingPlan, String> {
    plan::generate_plan(state.db.clone(), &race_id).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_active_plan(state: tauri::State<'_, AppState>) -> Result<Option<TrainingPlan>, String> {
    state.db.get_active_plan().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_plans(state: tauri::State<'_, AppState>) -> Result<Vec<TrainingPlanSummary>, String> {
    state.db.list_plans().map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_active_plan(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<(), String> {
    state.db.set_active_plan(&plan_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_plan_weeks(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<Vec<PlanWeekWithSessions>, String> {
    state.db.get_plan_weeks(&plan_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn update_session_status(
    state: tauri::State<'_, AppState>,
    session_id: String,
    status: SessionStatus,
) -> Result<(), String> {
    state
        .db
        .update_session_status(
            &session_id,
            &status.status,
            status.actual_duration_min,
            status.actual_distance_km,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_athlete_summary(state: tauri::State<'_, AppState>) -> Result<Option<serde_json::Value>, String> {
    let raw = state.db.get_athlete_stats().map_err(|e| e.to_string())?;
    match raw {
        Some(json_str) => {
            let val: serde_json::Value =
                serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
            Ok(Some(val))
        }
        None => Ok(None),
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_athlete_zones_data(state: tauri::State<'_, AppState>) -> Result<Option<serde_json::Value>, String> {
    let raw = state.db.get_athlete_zones().map_err(|e| e.to_string())?;
    match raw {
        Some(json_str) => {
            let val: serde_json::Value =
                serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
            Ok(Some(val))
        }
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

            let db = Database::new(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;
            let state = AppState {
                db: Arc::new(db),
                current_session_id: std::sync::Mutex::new(None),
            };
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            is_first_run,
            get_strava_credentials_available,
            start_strava_auth,
            get_strava_auth_status,
            disconnect_strava,
            sync_strava_activities,
            get_recent_activities,
            get_activity_stats,
            get_profile_data,
            save_profile_data,
            get_context_preview,
            save_pinned_insight,
            get_pinned_insights,
            delete_pinned_insight,
            send_message,
            get_chat_sessions,
            get_chat_messages,
            create_chat_session,
            delete_chat_session,
            rename_chat_session,
            get_ollama_models,
            import_fit_file,
            export_context,
            import_context,
            create_race,
            update_race,
            delete_race,
            list_races,
            set_active_race,
            generate_plan_cmd,
            get_active_plan,
            list_plans,
            set_active_plan,
            get_plan_weeks,
            update_session_status,
            get_athlete_summary,
            get_athlete_zones_data,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("Error while running tauri application: {e}"));
}
