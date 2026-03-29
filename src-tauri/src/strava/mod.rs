use crate::error::AppError;
use crate::models::{ActivityData, ActivityLap, ActivityZoneDistribution, AuthStatus};
use crate::storage::Database;
use std::sync::Arc;
use tauri::Emitter;

const STRAVA_AUTH_URL: &str = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL: &str = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE: &str = "https://www.strava.com/api/v3";
const REDIRECT_PORT: u16 = 9876;
const REQUIRED_SCOPE: &str = "read,activity:read_all,profile:read_all";

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

pub async fn start_auth(db: Arc<Database>, app_handle: tauri::AppHandle) -> Result<(), AppError> {
    let client_id = get_client_id().ok_or_else(|| AppError::Config("Strava client ID not configured".into()))?;
    let client_secret = get_client_secret().ok_or_else(|| AppError::Config("Strava client secret not configured".into()))?;
    let redirect_uri = format!("http://localhost:{REDIRECT_PORT}/callback");

    let auth_url = format!(
        "{STRAVA_AUTH_URL}?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={REQUIRED_SCOPE}",
    );

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{REDIRECT_PORT}"))
        .await
        .map_err(|e| AppError::Strava(format!("Failed to start callback server: {e}")))?;

    open::that(&auth_url).map_err(|e| AppError::Strava(format!("Failed to open browser: {e}")))?;

    let (stream, _) = listener.accept().await?;
    let mut buf = vec![0u8; 4096];
    stream.readable().await?;
    let n = stream.try_read(&mut buf)?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let code = extract_code_from_request(&request)
        .ok_or_else(|| AppError::Strava("No authorization code received".into()))?;

    let success_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h2>Connected to Strava!</h2><p>You can close this tab.</p></body></html>";
    stream.writable().await?;
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
        .map_err(|e| AppError::Strava(format!("Token exchange failed: {e}")))?;

    let token_data: serde_json::Value = token_response.json().await?;

    let access_token = token_data["access_token"].as_str().ok_or_else(|| AppError::Strava("Missing access_token".into()))?;
    let refresh_token = token_data["refresh_token"].as_str().ok_or_else(|| AppError::Strava("Missing refresh_token".into()))?;
    let expires_at = token_data["expires_at"].as_i64().ok_or_else(|| AppError::Strava("Missing expires_at".into()))?;

    db.save_oauth_tokens_with_scope(access_token, refresh_token, expires_at, Some(REQUIRED_SCOPE))?;

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

pub fn get_auth_status(db: &Database) -> Result<AuthStatus, AppError> {
    match db.get_oauth_tokens()? {
        Some((_, _, expires_at)) => {
            let needs_reauth = scope_is_stale(db);
            Ok(AuthStatus {
                connected: true,
                expires_at: Some(expires_at),
                needs_reauth,
            })
        }
        None => Ok(AuthStatus {
            connected: false,
            expires_at: None,
            needs_reauth: false,
        }),
    }
}

/// Returns `true` when the stored `granted_scope` is missing any
/// of the scopes listed in [`REQUIRED_SCOPE`].
fn scope_is_stale(db: &Database) -> bool {
    let Ok(Some(stored)) = db.get_oauth_granted_scope() else {
        return true; // no scope stored → assume stale (pre-upgrade token)
    };
    if stored.is_empty() {
        return true;
    }
    let stored_parts: std::collections::HashSet<&str> = stored.split(',').collect();
    REQUIRED_SCOPE
        .split(',')
        .any(|required| !stored_parts.contains(required))
}

pub(crate) async fn get_valid_token(db: &Database) -> Result<String, AppError> {
    let (access, refresh, expires_at) = db
        .get_oauth_tokens()?
        .ok_or_else(|| AppError::Strava("Not connected to Strava".into()))?;

    let now = chrono::Utc::now().timestamp();
    if now < expires_at - 60 {
        return Ok(access);
    }

    let client_id = get_client_id().ok_or_else(|| AppError::Config("Strava client ID not configured".into()))?;
    let client_secret = get_client_secret().ok_or_else(|| AppError::Config("Strava client secret not configured".into()))?;

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
        .map_err(|e| AppError::Strava(format!("Token refresh failed: {e}")))?;

    let data: serde_json::Value = response.json().await?;
    let new_access = data["access_token"].as_str().ok_or_else(|| AppError::Strava("Missing access_token".into()))?;
    let new_refresh = data["refresh_token"].as_str().unwrap_or(&refresh);
    let new_expires = data["expires_at"].as_i64().ok_or_else(|| AppError::Strava("Missing expires_at".into()))?;

    db.save_oauth_tokens(new_access, new_refresh, new_expires)?;

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

pub async fn sync_activities(db: Arc<Database>, app_handle: tauri::AppHandle) -> Result<(), AppError> {
    let token = get_valid_token(&db).await.inspect_err(|e| {
        emit_sync_error(&app_handle, &e.to_string());
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
                AppError::Http(e)
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
            return Err(AppError::Strava(msg));
        }

        let activities: Vec<serde_json::Value> = response.json().await.map_err(|e| {
            let msg = format!("Failed to parse activities: {e}");
            emit_sync_error(&app_handle, &msg);
            AppError::Http(e)
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
        AppError::Database(e)
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

    backfill_activity_zones(&db, &token).await;

    let context_preview = crate::context::build_context(&db);
    app_handle.emit("strava:sync:context-ready", context_preview).ok();

    Ok(())
}

async fn get_athlete_id(token: &str) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athlete");
    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| AppError::Strava(format!("Failed to fetch athlete: {e}")))?;
    let data: serde_json::Value = response.json().await?;
    data["id"]
        .as_i64()
        .map(|id| id.to_string())
        .ok_or_else(|| AppError::Strava("Missing athlete ID in response".into()))
}

pub async fn fetch_athlete_zones(db: &Database) -> Result<(), AppError> {
    let token = get_valid_token(db).await?;
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athlete/zones");
    let response = client.get(&url).bearer_auth(&token).send().await?;
    if response.status().is_success() {
        let data: serde_json::Value = response.json().await?;
        db.save_athlete_zones(&data.to_string())?;
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Strava(format!(
            "Failed to fetch athlete zones: HTTP {status} — {body}"
        )));
    }
    Ok(())
}

pub async fn fetch_athlete_stats(db: &Database, athlete_id: &str) -> Result<(), AppError> {
    let token = get_valid_token(db).await?;
    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/athletes/{athlete_id}/stats");
    let response = client.get(&url).bearer_auth(&token).send().await?;
    if response.status().is_success() {
        let data: serde_json::Value = response.json().await?;
        db.save_athlete_stats(&data.to_string())?;
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Strava(format!(
            "Failed to fetch athlete stats: HTTP {status} — {body}"
        )));
    }
    Ok(())
}

pub async fn fetch_activity_laps(
    db: &Database,
    strava_id: &str,
    activity_id: &str,
    token: &str,
) -> Result<Vec<ActivityLap>, AppError> {
    if db
        .has_activity_laps(activity_id)
        .map_err(AppError::Database)?
    {
        return db
            .get_activity_laps(activity_id)
            .map_err(AppError::Database);
    }

    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/activities/{strava_id}/laps");

    let response = loop {
        let resp = client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(AppError::Http)?;

        if resp.status() == 429 {
            let retry_after: u64 = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(60);
            tokio::time::sleep(tokio::time::Duration::from_secs(retry_after)).await;
            continue;
        }

        break resp;
    };

    if response.status() == 403 {
        return Err(AppError::Strava(format!(
            "Access denied fetching laps for activity {strava_id}: insufficient permissions"
        )));
    }

    if !response.status().is_success() {
        return Err(AppError::Strava(format!(
            "Strava API error fetching laps for activity {strava_id}: {}",
            response.status()
        )));
    }

    let raw: Vec<serde_json::Value> = response.json().await.map_err(AppError::Http)?;

    if raw.is_empty() {
        db.save_activity_laps(activity_id, &[])
            .map_err(AppError::Database)?;
        return Ok(Vec::new());
    }

    let laps: Vec<ActivityLap> = raw
        .into_iter()
        .enumerate()
        .map(|(i, r)| {
            #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
            let fallback_index = i as i64 + 1;
            ActivityLap {
                id: None,
                activity_id: activity_id.to_string(),
                lap_index: r["index"].as_i64().unwrap_or(fallback_index),
                distance: r["distance"].as_f64().unwrap_or(0.0),
                elapsed_time: r["elapsed_time"].as_i64().unwrap_or(0),
                moving_time: r["moving_time"].as_i64().unwrap_or(0),
                average_speed: r["average_speed"].as_f64().unwrap_or(0.0),
                max_speed: r["max_speed"].as_f64(),
                average_heartrate: r["average_heartrate"].as_f64(),
                max_heartrate: r["max_heartrate"].as_f64(),
                average_cadence: r["average_cadence"].as_f64(),
                total_elevation_gain: r["total_elevation_gain"].as_f64(),
            }
        })
        .collect();

    db.save_activity_laps(activity_id, &laps)
        .map_err(AppError::Database)?;

    Ok(laps)
}

/// Fetch heart-rate zone time-in-zone data from the Strava zones endpoint for a single activity.
///
/// Returns an empty `Vec` when the activity has no heart-rate zone data (e.g. the response is
/// empty or contains no `"heartrate"` type entry). Returns `AppError::Strava` for 403 responses
/// (Strava Premium requirement). 429 responses are retried after the `Retry-After` header delay.
/// Results are cached to the database before returning.
pub async fn fetch_activity_zones(
    db: &Database,
    strava_id: &str,
    activity_id: &str,
    token: &str,
) -> Result<Vec<ActivityZoneDistribution>, AppError> {
    if db
        .has_activity_zone_distribution(activity_id)
        .map_err(AppError::Database)?
    {
        return db
            .get_activity_zone_distribution(activity_id)
            .map_err(AppError::Database);
    }

    let client = reqwest::Client::new();
    let url = format!("{STRAVA_API_BASE}/activities/{strava_id}/zones");

    let response = loop {
        let resp = client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(AppError::Http)?;

        if resp.status() == 429 {
            let retry_after: u64 = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse().ok())
                .unwrap_or(60);
            tokio::time::sleep(tokio::time::Duration::from_secs(retry_after)).await;
            continue;
        }

        break resp;
    };

    if response.status() == 403 {
        return Err(AppError::Strava(
            "HR zone data requires Strava Premium or is unavailable for this activity".into(),
        ));
    }

    if !response.status().is_success() {
        return Err(AppError::Strava(format!(
            "Strava API error fetching zones for activity {strava_id}: {}",
            response.status()
        )));
    }

    let raw: serde_json::Value = response.json().await.map_err(AppError::Http)?;

    // Response is an array of zone-type objects; extract only the "heartrate" entry.
    let zones = if let Some(zone_types) = raw.as_array() {
        let hr_entry = zone_types
            .iter()
            .find(|z| z["type"].as_str() == Some("heartrate"));

        match hr_entry.and_then(|z| z["distribution_buckets"].as_array()) {
            Some(buckets) => buckets
                .iter()
                .enumerate()
                .map(|(i, b)| {
                    #[allow(clippy::cast_possible_wrap, clippy::cast_possible_truncation)]
                    let zone_index = i as i64;
                    ActivityZoneDistribution {
                        activity_id: activity_id.to_string(),
                        zone_index,
                        zone_min: b["min"].as_i64().unwrap_or(0),
                        zone_max: b["max"].as_i64().unwrap_or(0),
                        time_seconds: b["time"].as_i64().unwrap_or(0),
                    }
                })
                .collect(),
            None => Vec::new(),
        }
    } else {
        Vec::new()
    };

    db.save_activity_zone_distribution(activity_id, &zones)
        .map_err(AppError::Database)?;

    Ok(zones)
}

async fn backfill_activity_zones(db: &std::sync::Arc<crate::storage::Database>, token: &str) {
    let missing = match db.get_activities_missing_zones() {
        Ok(m) => m,
        Err(e) => {
            log::warn!("Failed to query activities missing zones: {e}");
            return;
        }
    };

    for (activity_id, strava_id) in &missing {
        match fetch_activity_zones(db, strava_id, activity_id, token).await {
            Ok(_) => {}
            Err(AppError::Strava(msg)) if msg.contains("Premium") => {
                log::info!("Zone data requires Strava Premium — skipping activity {activity_id}");
            }
            Err(e) => {
                log::warn!("Failed to fetch zones for activity {activity_id}: {e}");
            }
        }
    }
}

/// Compute the pace coefficient of variation (CV = stddev/mean * 100) across laps.
/// Pace per lap is `elapsed_time / distance` (seconds per metre). Zero-distance laps skipped.
/// Returns `None` when fewer than two valid laps exist.
#[allow(dead_code)]
#[must_use]
pub fn compute_pace_variance(laps: &[ActivityLap]) -> Option<f64> {
    let paces: Vec<f64> = laps
        .iter()
        .filter(|l| l.distance > 0.0)
        .map(|l| {
            #[allow(clippy::cast_precision_loss)]
            let elapsed = l.elapsed_time as f64;
            elapsed / l.distance
        })
        .collect();

    if paces.len() < 2 {
        return None;
    }

    #[allow(clippy::cast_precision_loss)]
    let count = paces.len() as f64;
    let mean = paces.iter().sum::<f64>() / count;

    if mean == 0.0 {
        return None;
    }

    let variance = paces.iter().map(|p| (p - mean).powi(2)).sum::<f64>() / count;
    let stddev = variance.sqrt();

    Some(stddev / mean * 100.0)
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

    fn make_lap(activity_id: &str, lap_index: i64, elapsed_time: i64, distance: f64) -> ActivityLap {
        ActivityLap {
            id: None,
            activity_id: activity_id.to_string(),
            lap_index,
            distance,
            elapsed_time,
            moving_time: elapsed_time,
            average_speed: if distance > 0.0 { distance / elapsed_time as f64 } else { 0.0 },
            max_speed: None,
            average_heartrate: None,
            max_heartrate: None,
            average_cadence: None,
            total_elevation_gain: None,
        }
    }

    #[test]
    fn pace_variance_returns_none_for_empty_laps() {
        assert!(compute_pace_variance(&[]).is_none());
    }

    #[test]
    fn pace_variance_returns_none_for_single_lap() {
        let laps = vec![make_lap("a1", 1, 300, 1000.0)];
        assert!(compute_pace_variance(&laps).is_none());
    }

    #[test]
    fn pace_variance_returns_none_when_all_laps_zero_distance() {
        let laps = vec![
            make_lap("a1", 1, 300, 0.0),
            make_lap("a1", 2, 300, 0.0),
        ];
        assert!(compute_pace_variance(&laps).is_none());
    }

    #[test]
    fn pace_variance_zero_for_identical_paces() {
        let laps = vec![
            make_lap("a1", 1, 300, 1000.0),
            make_lap("a1", 2, 300, 1000.0),
            make_lap("a1", 3, 300, 1000.0),
        ];
        let cv = compute_pace_variance(&laps).expect("should return Some");
        assert!(cv.abs() < 1e-9, "identical paces should give CV near zero, got {cv}");
    }

    #[test]
    fn pace_variance_positive_for_varying_paces() {
        let laps = vec![
            make_lap("a1", 1, 300, 1000.0),
            make_lap("a1", 2, 360, 1000.0),
            make_lap("a1", 3, 240, 1000.0),
        ];
        let cv = compute_pace_variance(&laps).expect("should return Some");
        assert!(cv > 0.0, "varying paces should give positive CV, got {cv}");
    }

    #[test]
    fn pace_variance_skips_zero_distance_laps() {
        let laps = vec![
            make_lap("a1", 1, 300, 1000.0),
            make_lap("a1", 2, 0, 0.0),
            make_lap("a1", 3, 300, 1000.0),
        ];
        let cv = compute_pace_variance(&laps).expect("should return Some");
        assert!(cv.abs() < 1e-9, "identical valid laps should give CV near zero after skipping zero-distance, got {cv}");
    }

    #[test]
    fn test_compute_pace_variance_multi_lap() {
        let laps = vec![
            make_lap("a1", 1, 300, 1000.0),
            make_lap("a1", 2, 360, 1000.0),
            make_lap("a1", 3, 240, 1000.0),
        ];
        let cv = compute_pace_variance(&laps);
        assert!(cv.is_some(), "should return Some for 3 laps with variance");
        let cv_val = cv.expect("already checked Some");
        assert!(!cv_val.is_nan(), "CV should not be NaN");
        assert!(cv_val > 0.0, "CV should be positive for varying paces, got {cv_val}");
    }

    #[test]
    fn test_compute_pace_variance_zero_distance_laps_excluded() {
        let laps = vec![
            make_lap("a1", 1, 300, 1000.0),
            make_lap("a1", 2, 300, 0.0),
            make_lap("a1", 3, 300, 0.0),
        ];
        let cv = compute_pace_variance(&laps);
        assert!(
            cv.is_none(),
            "only one nonzero-distance lap remains — should return None, got {cv:?}"
        );
    }
}
