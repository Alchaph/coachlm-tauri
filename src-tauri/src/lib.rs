mod context;
mod error;
mod fit;
mod llm;
mod models;
mod plan;
mod research;
mod storage;
mod strava;
mod web_search;

use error::AppError;
use models::{
    ActivityData, ActivityLap, ActivityZoneDistribution, ActivityZoneSummary, AuthStatus,
    ExportData, InsightData, MessageData, OllamaMessage, PlanWeekWithSessions, ProfileData, Race,
    SessionData, SessionStatus, SettingsData, SettingsMeta, StatsData, TrainingPlan,
    TrainingPlanSummary, WebAugmentationMode,
};
use std::sync::Arc;
use storage::Database;
use tauri::{Emitter, Manager};

pub struct AppState {
    pub db: Arc<Database>,
    pub current_session_id: std::sync::Mutex<Option<String>>,
    pub cached_context: std::sync::Mutex<Option<String>>,
    pub web_search_pending: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<bool>>>,
}

fn get_or_build_context(state: &AppState) -> String {
    if let Ok(cache) = state.cached_context.lock() {
        if let Some(ref ctx) = *cache {
            return ctx.clone();
        }
    }
    let ctx = context::build_context(&state.db);
    if let Ok(mut cache) = state.cached_context.lock() {
        if cache.is_none() {
            *cache = Some(ctx.clone());
        }
    }
    ctx
}

fn invalidate_context_cache(state: &AppState) {
    if let Ok(mut cache) = state.cached_context.lock() {
        *cache = None;
    }
}

fn validate_file_path(path: &str, allowed_extensions: &[&str]) -> Result<std::path::PathBuf, AppError> {
    let path_buf = std::path::PathBuf::from(path);

    // Reject path traversal
    for component in path_buf.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err(AppError::Validation("Path must not contain '..\' components".into()));
        }
    }

    // Validate extension
    let ext = path_buf
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase);

    let has_valid_ext = allowed_extensions.iter().any(|&allowed| {
        ext.as_deref() == Some(allowed.trim_start_matches('.'))
    });

    if !has_valid_ext {
        return Err(AppError::Validation(format!(
            "Invalid file extension. Allowed: {}",
            allowed_extensions.join(", ")
        )));
    }

    Ok(path_buf)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_settings(state: tauri::State<'_, AppState>) -> Result<Option<SettingsData>, AppError> {
    state.db.get_settings().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_settings(state: tauri::State<'_, AppState>, data: SettingsData) -> Result<(), AppError> {
    state.db.save_settings(&data)?;
    invalidate_context_cache(&state);
    Ok(())
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
) -> Result<(), AppError> {
    strava::start_auth(state.db.clone(), app_handle).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_strava_auth_status(state: tauri::State<'_, AppState>) -> Result<AuthStatus, AppError> {
    strava::get_auth_status(&state.db)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn disconnect_strava(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    state.db.delete_oauth_tokens().map_err(AppError::Database)
}

#[tauri::command]
async fn sync_strava_activities(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    strava::sync_activities(state.db.clone(), app_handle).await?;
    let db_for_ctx = state.db.clone();
    let fresh_ctx = tokio::task::spawn_blocking(move || context::build_context(&db_for_ctx))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if let Ok(mut cache) = state.cached_context.lock() {
        *cache = Some(fresh_ctx);
    }
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_recent_activities(
    state: tauri::State<'_, AppState>,
    limit: u32,
    offset: u32,
) -> Result<Vec<ActivityData>, AppError> {
    state.db.get_recent_activities(limit, offset).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_activity_stats(state: tauri::State<'_, AppState>) -> Result<StatsData, AppError> {
    state.db.get_activity_stats().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_profile_data(state: tauri::State<'_, AppState>) -> Result<Option<ProfileData>, AppError> {
    state.db.get_profile().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_profile_data(
    state: tauri::State<'_, AppState>,
    data: ProfileData,
) -> Result<(), AppError> {
    state.db.save_profile(&data)?;
    invalidate_context_cache(&state);
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_context_preview(state: tauri::State<'_, AppState>) -> String {
    get_or_build_context(&state)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn save_pinned_insight(
    state: tauri::State<'_, AppState>,
    content: String,
) -> Result<(), AppError> {
    let session_id = state
        .current_session_id
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();
    state
        .db
        .save_pinned_insight(&content, session_id.as_deref())?;
    invalidate_context_cache(&state);
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_pinned_insights(state: tauri::State<'_, AppState>) -> Result<Vec<InsightData>, AppError> {
    state.db.get_pinned_insights().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_pinned_insight(state: tauri::State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state.db.delete_pinned_insight(id)?;
    invalidate_context_cache(&state);
    Ok(())
}

fn generate_session_title_fallback(content: &str) -> String {
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

async fn generate_session_title(settings: &models::SettingsData, content: &str) -> String {
    let messages = vec![models::OllamaMessage {
        role: "system".to_string(),
        content: "You are a concise title generator. Given a user message, produce a short title (3-6 words) that summarizes the topic. Reply with ONLY the title, no quotes, no punctuation at the end, no explanation.".to_string(),
    }, models::OllamaMessage {
        role: "user".to_string(),
        content: content.to_string(),
    }];

    match llm::chat(settings, messages).await {
        Ok(title) => {
            let cleaned = title.trim().trim_matches('"').trim().to_string();
            if cleaned.is_empty() || cleaned.len() > 80 {
                generate_session_title_fallback(content)
            } else {
                cleaned
            }
        }
        Err(_) => generate_session_title_fallback(content),
    }
}

fn emit_chat_progress(app_handle: &tauri::AppHandle, session_id: &str, status: &str) {
    app_handle
        .emit("chat:send:progress", serde_json::json!({ "session_id": session_id, "status": status }))
        .ok();
}

async fn query_and_save_response(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    settings: &models::SettingsData,
    session_id: &str,
    user_content: &str,
    llm_ctx: &str,
    web_search_pending: &std::sync::Mutex<Option<tokio::sync::oneshot::Sender<bool>>>,
) -> Result<String, AppError> {
    let mut web_search_context = String::new();
    match settings.effective_web_mode() {
        WebAugmentationMode::Off => {}
        WebAugmentationMode::Simple => {
            emit_chat_progress(app_handle, session_id, "Searching the web...");
            match web_search::search_duckduckgo(user_content, 5).await {
                Ok(results) => {
                    web_search_context = web_search::format_search_results(&results);
                }
                Err(e) => {
                    log::warn!("Web search failed, continuing without results: {e}");
                }
            }
        }
        WebAugmentationMode::Agent => {
            emit_chat_progress(app_handle, session_id, "Researching...");
            match research::run_research(db, app_handle, settings, session_id, user_content).await {
                Ok(result) => {
                    web_search_context = result.brief;
                }
                Err(e) => {
                    log::warn!("Research agent failed, continuing without results: {e}");
                }
            }
        }
        WebAugmentationMode::Auto => {
            emit_chat_progress(app_handle, session_id, "Analyzing message...");
            let should_search = web_search::classifier::should_suggest_search(settings, user_content)
                .await
                .unwrap_or(false);

            if should_search {
                let (tx, rx) = tokio::sync::oneshot::channel();
                if let Ok(mut pending) = web_search_pending.lock() {
                    *pending = Some(tx);
                }
                app_handle
                    .emit("web-search:suggest", serde_json::json!({ "session_id": session_id }))
                    .ok();

                emit_chat_progress(app_handle, session_id, "Waiting for confirmation...");
                let approved = tokio::time::timeout(
                    std::time::Duration::from_secs(30),
                    rx,
                )
                .await
                .unwrap_or(Ok(false))
                .unwrap_or(false);

                if let Ok(mut pending) = web_search_pending.lock() {
                    *pending = None;
                }

                if approved {
                    emit_chat_progress(app_handle, session_id, "Searching the web...");
                    match web_search::search_duckduckgo(user_content, 5).await {
                        Ok(results) => {
                            web_search_context = web_search::format_search_results(&results);
                        }
                        Err(e) => {
                            log::warn!("Web search failed, continuing without results: {e}");
                        }
                    }
                }
            }
        }
    }

    emit_chat_progress(app_handle, session_id, "Gathering context...");
    let db_clone = db.clone();
    let session_id_owned = session_id.to_string();
    let history = tokio::task::spawn_blocking(move || db_clone.get_chat_messages(&session_id_owned))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;

    let mut system_content = llm_ctx.to_string();
    if !web_search_context.is_empty() {
        system_content = format!("{web_search_context}\n\n{system_content}");
    }

    let mut messages = vec![OllamaMessage {
        role: "system".to_string(),
        content: system_content,
    }];

    for msg in &history {
        messages.push(OllamaMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    emit_chat_progress(app_handle, session_id, "Querying model...");
    let response = llm::chat_stream(settings, messages, app_handle, session_id).await?;

    emit_chat_progress(app_handle, session_id, "Saving response...");
    let db_clone2 = db.clone();
    let session_id_owned2 = session_id.to_string();
    let response_clone = response.clone();
    tokio::task::spawn_blocking(move || {
        db_clone2.insert_chat_message(&session_id_owned2, "assistant", &response_clone)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))??;

    Ok(response)
}

#[tauri::command]
async fn send_message(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    content: String,
) -> Result<String, AppError> {
    emit_chat_progress(&app_handle, "", "Preparing session...");
    let existing_sid = state
        .current_session_id
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .clone();

    let session_id = if let Some(id) = existing_sid {
        id
    } else {
        let db_clone = state.db.clone();
        let new_session = tokio::task::spawn_blocking(move || db_clone.create_chat_session())
            .await
            .map_err(|e| AppError::Internal(e.to_string()))??;
        let new_id = new_session.id.clone();
        if let Ok(mut sid) = state.current_session_id.lock() {
            *sid = Some(new_id.clone());
        }
        new_id
    };

    let db_clone = state.db.clone();
    let session_id_clone = session_id.clone();
    let content_clone = content.clone();
    tokio::task::spawn_blocking(move || {
        db_clone.insert_chat_message(&session_id_clone, "user", &content_clone)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))??;

    let db_clone2 = state.db.clone();
    let session_id_clone2 = session_id.clone();
    let (settings, needs_title) =
        tokio::task::spawn_blocking(move || -> Result<_, AppError> {
            let settings = db_clone2
                .get_settings()?
                .ok_or_else(|| AppError::Config("Settings not configured. Complete the setup wizard first.".into()))?;
            let sessions = db_clone2.get_chat_sessions()?;
            let current = sessions.iter().find(|s| s.id == session_id_clone2);
            let needs_title = current.is_some_and(|s| s.title.is_none());
            Ok((settings, needs_title))
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;
    if needs_title {
        emit_chat_progress(&app_handle, &session_id, "Generating title...");
        let title_settings = settings.clone();
        let title_content = content.clone();
        let title_db = state.db.clone();
        let title_session_id = session_id.clone();
        tauri::async_runtime::spawn(async move {
            let title = generate_session_title(&title_settings, &title_content).await;
            title_db
                .update_chat_session_title(&title_session_id, &title)
                .ok();
        });
    }

    let llm_ctx = get_or_build_context(&state);
    query_and_save_response(&state.db, &app_handle, &settings, &session_id, &content, &llm_ctx, &state.web_search_pending).await
}

#[tauri::command]
async fn edit_and_resend(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    session_id: String,
    message_id: i64,
    content: String,
) -> Result<String, AppError> {
    emit_chat_progress(&app_handle, &session_id, "Updating message...");

    let db_clone = state.db.clone();
    let session_id_clone = session_id.clone();
    let content_clone = content.clone();
    let settings =
        tokio::task::spawn_blocking(move || -> Result<_, AppError> {
            db_clone.update_chat_message_content(&session_id_clone, message_id, &content_clone)?;
            db_clone.delete_chat_messages_after(&session_id_clone, message_id)?;
            let settings = db_clone
                .get_settings()?
                .ok_or_else(|| AppError::Config("Settings not configured. Complete the setup wizard first.".into()))?;
            Ok(settings)
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;

    let llm_ctx = get_or_build_context(&state);
    query_and_save_response(&state.db, &app_handle, &settings, &session_id, &content, &llm_ctx, &state.web_search_pending).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn respond_web_search_suggestion(
    state: tauri::State<'_, AppState>,
    approved: bool,
) {
    if let Ok(mut pending) = state.web_search_pending.lock() {
        if let Some(tx) = pending.take() {
            tx.send(approved).ok();
        }
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_chat_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<SessionData>, AppError> {
    state.db.get_chat_sessions().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_chat_messages(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<Vec<MessageData>, AppError> {
    state.db.get_chat_messages(&session_id).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn create_chat_session(state: tauri::State<'_, AppState>) -> Result<SessionData, AppError> {
    let session = state.db.create_chat_session()?;
    let mut sid = state
        .current_session_id
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    *sid = Some(session.id.clone());
    Ok(session)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_chat_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), AppError> {
    state.db.delete_chat_session(&session_id).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn rename_chat_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
    title: String,
) -> Result<(), AppError> {
    state
        .db
        .update_chat_session_title(&session_id, &title)
        .map_err(AppError::Database)
}

#[tauri::command]
async fn get_ollama_models(endpoint: String) -> Result<Vec<String>, AppError> {
    llm::get_ollama_models(&endpoint).await
}

#[tauri::command]
async fn check_ollama_status(endpoint: String) -> Result<bool, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()?;
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));
    match client.get(&url).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn import_fit_file(
    state: tauri::State<'_, AppState>,
    file_path: String,
) -> Result<u32, AppError> {
    let validated_path = validate_file_path(&file_path, &[".fit"])?;
    let activities = fit::import_fit_file(&validated_path.to_string_lossy())?;
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
) -> Result<(), AppError> {
    let profile = state.db.get_profile()?;
    let activities = state.db.get_recent_activities(10000, 0)?;
    let insights = state.db.get_pinned_insights()?;
    let settings = state.db.get_settings()?;

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

    let validated_path = validate_file_path(&file_path, &[".json"])?;
    let json = serde_json::to_string_pretty(&export)?;
    std::fs::write(&validated_path, json)?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn import_context(
    state: tauri::State<'_, AppState>,
    file_path: String,
    replace_all: bool,
) -> Result<(), AppError> {
    let validated_path = validate_file_path(&file_path, &[".json"])?;
    let content = std::fs::read_to_string(&validated_path)?;
    let data: ExportData = serde_json::from_str(&content)
        .map_err(|e| AppError::Validation(format!("Invalid file: {e}")))?;

    if data.schema_version != 1 {
        return Err(AppError::Validation(format!("Unsupported schema version: {}", data.schema_version)));
    }

    if replace_all {
        let conn = state.db.conn();
        conn.execute("DELETE FROM pinned_insights", []).map_err(AppError::Database)?;
        drop(conn);
    }

    if let Some(profile) = data.athlete_profile {
        state.db.save_profile(&profile)?;
    }

    for insight in data.pinned_insights {
        state
            .db
            .save_pinned_insight(&insight.content, insight.source_session_id.as_deref())?;
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
        return Err(AppError::Internal(format!("Failed to import {failed_count} activities")));
    }

    invalidate_context_cache(&state);
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn create_race(state: tauri::State<'_, AppState>, race: Race) -> Result<Race, AppError> {
    let mut r = race;
    if r.id.is_empty() {
        r.id = uuid::Uuid::new_v4().to_string();
    }
    if r.created_at.is_empty() {
        r.created_at = chrono::Utc::now().to_rfc3339();
    }
    state.db.create_race(&r)?;
    Ok(r)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn update_race(state: tauri::State<'_, AppState>, race: Race) -> Result<(), AppError> {
    state.db.update_race(&race).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_race(state: tauri::State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.db.delete_race(&id).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_races(state: tauri::State<'_, AppState>) -> Result<Vec<Race>, AppError> {
    state.db.list_races().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_active_race(state: tauri::State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.db.set_active_race(&id).map_err(AppError::Database)
}

#[tauri::command]
async fn generate_plan_cmd(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    race_id: String,
) -> Result<(), AppError> {
    let db = state.db.clone();
    let llm_ctx = get_or_build_context(&state);
    app_handle.emit("plan:generate:start", ()).ok();
    tauri::async_runtime::spawn(async move {
        match plan::generate_plan(db, &race_id, &app_handle, &llm_ctx).await {
            Ok(plan) => {
                app_handle.emit("plan:generate:complete", &plan).ok();
            }
            Err(e) => {
                app_handle.emit("plan:generate:error", serde_json::json!({ "message": e.to_string() })).ok();
            }
        }
    });
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_active_plan(state: tauri::State<'_, AppState>) -> Result<Option<TrainingPlan>, AppError> {
    state.db.get_active_plan().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn list_plans(state: tauri::State<'_, AppState>) -> Result<Vec<TrainingPlanSummary>, AppError> {
    state.db.list_plans().map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_active_plan(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<(), AppError> {
    state.db.set_active_plan(&plan_id)?;
    invalidate_context_cache(&state);
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn delete_plan(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<(), AppError> {
    state.db.delete_plan(&plan_id)?;
    invalidate_context_cache(&state);
    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_plan_weeks(
    state: tauri::State<'_, AppState>,
    plan_id: String,
) -> Result<Vec<PlanWeekWithSessions>, AppError> {
    state.db.get_plan_weeks(&plan_id).map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn update_session_status(
    state: tauri::State<'_, AppState>,
    session_id: String,
    status: SessionStatus,
) -> Result<(), AppError> {
    state
        .db
        .update_session_status(
            &session_id,
            &status.status,
            status.actual_duration_min,
            status.actual_distance_km,
        )
        .map_err(AppError::Database)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_athlete_summary(state: tauri::State<'_, AppState>) -> Result<Option<serde_json::Value>, AppError> {
    let raw = state.db.get_athlete_stats()?;
    match raw {
        Some(json_str) => {
            let val: serde_json::Value = serde_json::from_str(&json_str)?;
            Ok(Some(val))
        }
        None => Ok(None),
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_athlete_zones_data(state: tauri::State<'_, AppState>) -> Result<Option<serde_json::Value>, AppError> {
    let raw = state.db.get_athlete_zones()?;
    match raw {
        Some(json_str) => {
            let val: serde_json::Value = serde_json::from_str(&json_str)?;
            Ok(Some(val))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn get_activity_laps(
    state: tauri::State<'_, AppState>,
    activity_id: String,
) -> Result<Vec<ActivityLap>, AppError> {
    let db = state.db.clone();

    let activity_opt = tokio::task::spawn_blocking({
        let db = db.clone();
        let id = activity_id.clone();
        move || db.get_activity_by_id(&id)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .map_err(AppError::Database)?;

    let Some(strava_id) = activity_opt.and_then(|a| a.strava_id) else {
        return Ok(vec![]);
    };

    let token = strava::get_valid_token(&db).await?;
    strava::fetch_activity_laps(&db, &strava_id, &activity_id, &token).await
}

#[tauri::command]
async fn get_activity_zone_distribution(
    state: tauri::State<'_, AppState>,
    activity_id: String,
) -> Result<Vec<ActivityZoneDistribution>, AppError> {
    let db = state.db.clone();

    let activity_opt = tokio::task::spawn_blocking({
        let db = db.clone();
        let id = activity_id.clone();
        move || db.get_activity_by_id(&id)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .map_err(AppError::Database)?;

    let Some(strava_id) = activity_opt.and_then(|a| a.strava_id) else {
        return Ok(vec![]);
    };

    let token = strava::get_valid_token(&db).await?;
    strava::fetch_activity_zones(&db, &strava_id, &activity_id, &token).await
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get_aggregated_zone_distribution(
    state: tauri::State<'_, AppState>,
    days: Option<u32>,
) -> Result<Vec<ActivityZoneSummary>, AppError> {
    state
        .db
        .get_aggregated_zone_distribution(days)
        .map_err(AppError::Database)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

            let db = Database::new(&app_data_dir)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;
            let state = AppState {
                db: Arc::new(db),
                current_session_id: std::sync::Mutex::new(None),
                cached_context: std::sync::Mutex::new(None),
                web_search_pending: std::sync::Mutex::new(None),
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
            edit_and_resend,
            respond_web_search_suggestion,
            get_chat_sessions,
            get_chat_messages,
            create_chat_session,
            delete_chat_session,
            rename_chat_session,
            get_ollama_models,
            check_ollama_status,
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
            delete_plan,
            get_plan_weeks,
            update_session_status,
            get_athlete_summary,
            get_athlete_zones_data,
            get_activity_laps,
            get_activity_zone_distribution,
            get_aggregated_zone_distribution,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("Error while running tauri application: {e}"));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_fallback_short_text_returned_as_is() {
        assert_eq!(generate_session_title_fallback("Hello"), "Hello");
    }

    #[test]
    fn title_fallback_exactly_50_chars_returned_as_is() {
        let text = "a".repeat(50);
        assert_eq!(generate_session_title_fallback(&text), text);
    }

    #[test]
    fn title_fallback_long_text_truncates_at_word_boundary() {
        let text = "This is a somewhat long message that exceeds the fifty character limit by a lot";
        let result = generate_session_title_fallback(text);
        assert!(result.ends_with("..."));
        assert!(result.len() <= 53);
        assert!(!result.contains("limit"));
    }

    #[test]
    fn title_fallback_long_text_without_space_truncates_at_50() {
        let text = "a".repeat(100);
        let result = generate_session_title_fallback(&text);
        assert_eq!(result, format!("{}...", "a".repeat(50)));
    }

    #[test]
    fn title_fallback_trims_whitespace() {
        assert_eq!(generate_session_title_fallback("  Hello  "), "Hello");
    }

    #[test]
    fn title_fallback_empty_string() {
        assert_eq!(generate_session_title_fallback(""), "");
    }

    #[test]
    fn invalidate_context_cache_clears_cached_value() {
        let db_dir = std::env::temp_dir().join(format!("coachlm_test_{}", uuid::Uuid::new_v4()));
        let db = storage::Database::new(&db_dir).expect("db creation failed");
        let state = AppState {
            db: std::sync::Arc::new(db),
            current_session_id: std::sync::Mutex::new(None),
            cached_context: std::sync::Mutex::new(Some("cached".to_string())),
            web_search_pending: std::sync::Mutex::new(None),
        };

        invalidate_context_cache(&state);

        let cache = state.cached_context.lock().expect("lock failed");
        assert!(cache.is_none());
        std::fs::remove_dir_all(&db_dir).ok();
    }

    #[test]
    fn get_or_build_context_caches_result() {
        let db_dir = std::env::temp_dir().join(format!("coachlm_test_{}", uuid::Uuid::new_v4()));
        let db = storage::Database::new(&db_dir).expect("db creation failed");
        let state = AppState {
            db: std::sync::Arc::new(db),
            current_session_id: std::sync::Mutex::new(None),
            cached_context: std::sync::Mutex::new(None),
            web_search_pending: std::sync::Mutex::new(None),
        };

        let ctx1 = get_or_build_context(&state);
        let ctx2 = get_or_build_context(&state);
        assert_eq!(ctx1, ctx2);
        assert!(state.cached_context.lock().expect("lock failed").is_some());
        std::fs::remove_dir_all(&db_dir).ok();
    }

    #[test]
    fn validate_file_path_accepts_valid_fit_extension() {
        let result = validate_file_path("/some/path/activity.fit", &[".fit"]);
        assert!(result.is_ok());
    }

    #[test]
    fn validate_file_path_accepts_valid_json_extension() {
        let result = validate_file_path("/some/path/export.json", &[".json"]);
        assert!(result.is_ok());
    }

    #[test]
    fn validate_file_path_rejects_path_traversal() {
        let result = validate_file_path("/some/../etc/passwd", &[".json"]);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains(".."));
    }

    #[test]
    fn validate_file_path_rejects_wrong_extension() {
        let result = validate_file_path("/some/path/file.exe", &[".fit"]);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("extension"));
    }

    #[test]
    fn validate_file_path_rejects_no_extension() {
        let result = validate_file_path("/some/path/noext", &[".json"]);
        assert!(result.is_err());
    }

    #[test]
    fn validate_file_path_case_insensitive_extension() {
        let result = validate_file_path("/some/path/file.FIT", &[".fit"]);
        assert!(result.is_ok());
    }
}
