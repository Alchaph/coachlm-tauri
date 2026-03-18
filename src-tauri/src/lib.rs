mod context;
mod fit;
mod llm;
mod models;
mod plan;
mod storage;
mod strava;

use models::*;
use std::sync::Arc;
use storage::Database;
use tauri::Manager;

pub struct AppState {
    pub db: Arc<Database>,
    pub current_session_id: std::sync::Mutex<Option<String>>,
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Option<SettingsData>, String> {
    state.db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(state: tauri::State<'_, AppState>, data: SettingsData) -> Result<(), String> {
    state.db.save_settings(&data).map_err(|e| e.to_string())
}

#[tauri::command]
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
fn get_strava_auth_status(state: tauri::State<'_, AppState>) -> Result<AuthStatus, String> {
    strava::get_auth_status(&state.db)
}

#[tauri::command]
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
fn get_recent_activities(
    state: tauri::State<'_, AppState>,
    limit: u32,
) -> Result<Vec<ActivityData>, String> {
    state.db.get_recent_activities(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_activity_stats(state: tauri::State<'_, AppState>) -> Result<StatsData, String> {
    state.db.get_activity_stats().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_profile_data(state: tauri::State<'_, AppState>) -> Result<Option<ProfileData>, String> {
    state.db.get_profile().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_profile_data(
    state: tauri::State<'_, AppState>,
    data: ProfileData,
) -> Result<(), String> {
    state.db.save_profile(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_context_preview(state: tauri::State<'_, AppState>) -> Result<String, String> {
    Ok(context::build_context(&state.db))
}

#[tauri::command]
fn save_pinned_insight(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<(), String> {
    let session_id = state.current_session_id.lock().unwrap().clone();
    state
        .db
        .save_pinned_insight(&content, session_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_pinned_insights(state: tauri::State<'_, AppState>) -> Result<Vec<InsightData>, String> {
    state.db.get_pinned_insights().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_pinned_insight(state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_pinned_insight(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_message(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<String, String> {
    let session_id = {
        let mut sid = state.current_session_id.lock().unwrap();
        if sid.is_none() {
            let session = state.db.create_chat_session().map_err(|e| e.to_string())?;
            *sid = Some(session.id.clone());
        }
        sid.clone().unwrap()
    };

    state
        .db
        .insert_chat_message(&session_id, "user", &content)
        .map_err(|e| e.to_string())?;

    let settings = state
        .db
        .get_settings()
        .map_err(|e| e.to_string())?
        .ok_or("Settings not configured. Complete the setup wizard first.")?;

    let context = context::build_context(&state.db);
    let history = state.db.get_chat_messages(&session_id).map_err(|e| e.to_string())?;

    let mut messages = vec![OllamaMessage {
        role: "system".to_string(),
        content: context,
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
fn get_chat_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<SessionData>, String> {
    state.db.get_chat_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chat_messages(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<Vec<MessageData>, String> {
    state.db.get_chat_messages(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_chat_session(state: tauri::State<'_, AppState>) -> Result<SessionData, String> {
    let session = state.db.create_chat_session().map_err(|e| e.to_string())?;
    let mut sid = state.current_session_id.lock().unwrap();
    *sid = Some(session.id.clone());
    Ok(session)
}

#[tauri::command]
fn delete_chat_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.db.delete_chat_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ollama_models(endpoint: String) -> Result<Vec<String>, String> {
    llm::get_ollama_models(&endpoint).await
}

#[tauri::command]
fn import_fit_file(_file_path: String) -> Result<(), String> {
    Err("FIT file import not yet implemented".to_string())
}

#[tauri::command]
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
            active_llm: settings.map(|s| s.active_llm).unwrap_or_else(|| "local".to_string()),
        },
    };

    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_context(
    state: tauri::State<'_, AppState>,
    file_path: String,
    replace_all: bool,
) -> Result<(), String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let data: ExportData = serde_json::from_str(&content).map_err(|e| format!("Invalid file: {}", e))?;

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

    for activity in data.training_summaries {
        state.db.insert_activity(&activity).ok();
    }

    Ok(())
}

#[tauri::command]
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
fn update_race(state: tauri::State<'_, AppState>, race: Race) -> Result<(), String> {
    state.db.update_race(&race).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_race(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_race(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_races(state: tauri::State<'_, AppState>) -> Result<Vec<Race>, String> {
    state.db.list_races().map_err(|e| e.to_string())
}

#[tauri::command]
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
fn get_active_plan(state: tauri::State<'_, AppState>) -> Result<Option<TrainingPlan>, String> {
    state.db.get_active_plan().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_plan_weeks(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<Vec<PlanWeekWithSessions>, String> {
    state.db.get_plan_weeks(&plan_id).map_err(|e| e.to_string())
}

#[tauri::command]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let db = Database::new(&app_data_dir).expect("Failed to initialize database");
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
            get_plan_weeks,
            update_session_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
