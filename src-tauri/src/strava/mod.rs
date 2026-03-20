use crate::models::{ActivityData, AuthStatus};
use crate::storage::Database;
use std::sync::Arc;
use tauri::Emitter;

const STRAVA_AUTH_URL: &str = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL: &str = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE: &str = "https://www.strava.com/api/v3";
const REDIRECT_PORT: u16 = 9876;

fn get_client_id() -> Option<String> {
    option_env!("STRAVA_CLIENT_ID")
        .map(String::from)
        .or_else(|| std::env::var("STRAVA_CLIENT_ID").ok())
}

fn get_client_secret() -> Option<String> {
    option_env!("STRAVA_CLIENT_SECRET")
        .map(String::from)
        .or_else(|| std::env::var("STRAVA_CLIENT_SECRET").ok())
}

pub fn credentials_available() -> bool {
    get_client_id().is_some() && get_client_secret().is_some()
}

pub async fn start_auth(db: Arc<Database>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let client_id = get_client_id().ok_or("Strava client ID not configured")?;
    let client_secret = get_client_secret().ok_or("Strava client secret not configured")?;
    let redirect_uri = format!("http://localhost:{REDIRECT_PORT}/callback");

    let auth_url = format!(
        "{STRAVA_AUTH_URL}?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=read,activity:read_all",
    );

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{REDIRECT_PORT}"))
        .await
        .map_err(|e| format!("Failed to start callback server: {e}"))?;

    open::that(&auth_url).map_err(|e| format!("Failed to open browser: {e}"))?;

    let (stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 4096];
    stream.readable().await.map_err(|e| e.to_string())?;
    let n = stream.try_read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let code = extract_code_from_request(&request)
        .ok_or("No authorization code received")?;

    let success_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h2>Connected to Strava!</h2><p>You can close this tab.</p></body></html>";
    stream.writable().await.map_err(|e| e.to_string())?;
    stream.try_write(success_html.as_bytes()).ok();

    let client = reqwest::Client::new();
    let token_response = client
        .post(STRAVA_TOKEN_URL)
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", &code),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {e}"))?;

    let token_data: serde_json::Value = token_response.json().await.map_err(|e| e.to_string())?;

    let access_token = token_data["access_token"].as_str().ok_or("Missing access_token")?;
    let refresh_token = token_data["refresh_token"].as_str().ok_or("Missing refresh_token")?;
    let expires_at = token_data["expires_at"].as_i64().ok_or("Missing expires_at")?;

    db.save_oauth_tokens(access_token, refresh_token, expires_at)
        .map_err(|e| e.to_string())?;

    app_handle.emit("strava:auth:complete", ()).ok();

    let db_clone = db.clone();
    let handle_clone = app_handle.clone();
    tokio::spawn(async move {
        if let Err(e) = sync_activities(db_clone, handle_clone).await {
            log::warn!("Auto-sync after auth failed: {e}");
        }
    });

    Ok(())
}

fn extract_code_from_request(request: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for param in query.split('&') {
        let mut parts = param.splitn(2, '=');
        if parts.next() == Some("code") {
            return parts.next().map(String::from);
        }
    }
    None
}

pub fn get_auth_status(db: &Database) -> Result<AuthStatus, String> {
    match db.get_oauth_tokens().map_err(|e| e.to_string())? {
        Some((_, _, expires_at)) => Ok(AuthStatus {
            connected: true,
            expires_at: Some(expires_at),
        }),
        None => Ok(AuthStatus {
            connected: false,
            expires_at: None,
        }),
    }
}

async fn get_valid_token(db: &Database) -> Result<String, String> {
    let (access, refresh, expires_at) = db
        .get_oauth_tokens()
        .map_err(|e| e.to_string())?
        .ok_or("Not connected to Strava")?;

    let now = chrono::Utc::now().timestamp();
    if now < expires_at - 60 {
        return Ok(access);
    }

    let client_id = get_client_id().ok_or("Strava client ID not configured")?;
    let client_secret = get_client_secret().ok_or("Strava client secret not configured")?;

    let client = reqwest::Client::new();
    let response = client
        .post(STRAVA_TOKEN_URL)
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh failed: {e}"))?;

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let new_access = data["access_token"].as_str().ok_or("Missing access_token")?;
    let new_refresh = data["refresh_token"].as_str().unwrap_or(&refresh);
    let new_expires = data["expires_at"].as_i64().ok_or("Missing expires_at")?;

    db.save_oauth_tokens(new_access, new_refresh, new_expires)
        .map_err(|e| e.to_string())?;

    Ok(new_access.to_string())
}

fn parse_activity(act: &serde_json::Value) -> ActivityData {
    ActivityData {
        activity_id: uuid::Uuid::new_v4().to_string(),
        strava_id: act["id"].as_i64().map(|id| id.to_string()),
        name: act["name"].as_str().map(String::from),
        activity_type: act["type"].as_str().map(String::from),
        start_date: act["start_date"].as_str().map(String::from),
        distance: act["distance"].as_f64(),
        moving_time: act["moving_time"].as_i64(),
        average_speed: act["average_speed"].as_f64(),
        average_heartrate: act["average_heartrate"].as_f64(),
        max_heartrate: act["max_heartrate"].as_f64(),
        average_cadence: act["average_cadence"].as_f64(),
        gear_id: act["gear_id"].as_str().map(String::from),
        elapsed_time: act["elapsed_time"].as_i64(),
        total_elevation_gain: act["total_elevation_gain"].as_f64(),
        max_speed: act["max_speed"].as_f64(),
        workout_type: act["workout_type"].as_i64(),
        sport_type: act["sport_type"].as_str().map(String::from),
        start_date_local: act["start_date_local"].as_str().map(String::from),
    }
}

fn emit_sync_error(app_handle: &tauri::AppHandle, msg: &str) {
    app_handle.emit("strava:sync:error", serde_json::json!({ "message": msg })).ok();
}

pub async fn sync_activities(db: Arc<Database>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let token = get_valid_token(&db).await.inspect_err(|e| {
        emit_sync_error(&app_handle, e);
    })?;
    let client = reqwest::Client::new();

    app_handle.emit("strava:sync:start", ()).ok();

    let mut page = 1u32;
    let mut new_count = 0i64;
    let mut total_fetched = 0i64;

    loop {
        let url = format!("{STRAVA_API_BASE}/athlete/activities?page={page}&per_page=30");
        let response = client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| {
                let msg = format!("Failed to fetch activities: {e}");
                emit_sync_error(&app_handle, &msg);
                msg
            })?;

        if response.status() == 429 {
            let retry_after: u64 = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(60);
            tokio::time::sleep(tokio::time::Duration::from_secs(retry_after)).await;
            continue;
        }

        if !response.status().is_success() {
            let msg = format!("Strava API error: {}", response.status());
            emit_sync_error(&app_handle, &msg);
            return Err(msg);
        }

        let activities: Vec<serde_json::Value> = response.json().await.map_err(|e| {
            let msg = format!("Failed to parse activities: {e}");
            emit_sync_error(&app_handle, &msg);
            msg
        })?;
        if activities.is_empty() {
            break;
        }

        for act in &activities {
            let activity = parse_activity(act);

            match db.insert_activity(&activity) {
                Ok(true) => new_count += 1,
                Ok(false) => {}
                Err(e) => log::warn!("Failed to insert activity: {e}"),
            }
            total_fetched += 1;
        }

        app_handle
            .emit("strava:sync:progress", serde_json::json!({
                "current": total_fetched,
                "total": total_fetched
            }))
            .ok();

        if activities.len() < 30 {
            break;
        }
        page += 1;
    }

    let stats = db.get_activity_stats().map_err(|e| {
        let msg = e.to_string();
        emit_sync_error(&app_handle, &msg);
        msg
    })?;
    app_handle
        .emit("strava:sync:complete", serde_json::json!({
            "new_count": new_count,
            "total_count": stats.total_activities,
        }))
        .ok();

    if let Err(e) = fetch_athlete_zones(&db).await {
        log::warn!("Failed to fetch athlete zones: {e}");
    }
    if let Ok(athlete_id) = get_athlete_id(&token).await {
        if let Err(e) = fetch_athlete_stats(&db, &athlete_id).await {
            log::warn!("Failed to fetch athlete stats: {e}");
        }
    }

    let context_preview = crate::context::build_context(&db);
    app_handle.emit("strava:sync:context-ready", context_preview).ok();

    Ok(())
}

async fn get_athlete_id(token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athlete");
    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch athlete: {e}"))?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    data["id"]
        .as_i64()
        .map(|id| id.to_string())
        .ok_or_else(|| "Missing athlete ID in response".to_string())
}

pub async fn fetch_athlete_zones(db: &Database) -> Result<(), String> {
    let token = get_valid_token(db).await?;
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athlete/zones");
    let response = client.get(&url).bearer_auth(&token).send().await.map_err(|e| e.to_string())?;
    if response.status().is_success() {
        let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        db.save_athlete_zones(&data.to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn fetch_athlete_stats(db: &Database, athlete_id: &str) -> Result<(), String> {
    let token = get_valid_token(db).await?;
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athletes/{athlete_id}/stats");
    let response = client.get(&url).bearer_auth(&token).send().await.map_err(|e| e.to_string())?;
    if response.status().is_success() {
        let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        db.save_athlete_stats(&data.to_string()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_code_valid_request() {
        let request = "GET /callback?code=abc123&scope=read HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert_eq!(result.as_deref(), Some("abc123"));
    }

    #[test]
    fn extract_code_no_code_param() {
        let request = "GET /callback?state=xyz&scope=read HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert!(result.is_none(), "should be None when no code param");
    }

    #[test]
    fn extract_code_empty_string() {
        let result = extract_code_from_request("");
        assert!(result.is_none(), "should be None for empty string");
    }

    #[test]
    fn extract_code_no_query_string() {
        let request = "GET /callback HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert!(result.is_none(), "should be None with no query string");
    }

    #[test]
    fn extract_code_code_is_first_param() {
        let request = "GET /callback?code=first_param&other=val HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert_eq!(result.as_deref(), Some("first_param"));
    }

    #[test]
    fn extract_code_code_is_last_param() {
        let request = "GET /callback?state=xyz&scope=read&code=last_one HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert_eq!(result.as_deref(), Some("last_one"));
    }

    #[test]
    fn extract_code_only_code_param() {
        let request = "GET /callback?code=solo HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert_eq!(result.as_deref(), Some("solo"));
    }

    #[test]
    fn extract_code_empty_code_value() {
        let request = "GET /callback?code=&other=val HTTP/1.1\r\nHost: localhost";
        let result = extract_code_from_request(request);
        assert_eq!(result.as_deref(), Some(""));
    }
}
