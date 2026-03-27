use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::Emitter;

use crate::models::SettingsData;
use crate::storage::Database;
use crate::web_search;

use super::cache::ResearchCache;
use super::fetch::fetch_page_text;
use super::notebook::Notebook;
use super::planner;
use super::rate_limit::RateLimiter;
use super::types::{AgentAction, ResearchLimits, ResearchProgress, ResearchResult, SearchHit};

static RATE_LIMITER: std::sync::LazyLock<RateLimiter> =
    std::sync::LazyLock::new(|| RateLimiter::new(Duration::from_secs(5)));

fn emit_research_progress(
    app_handle: &tauri::AppHandle,
    session_id: &str,
    step: &str,
    detail: &str,
    iteration: u8,
) {
    let progress = ResearchProgress {
        step: step.to_string(),
        detail: detail.to_string(),
        iteration,
    };
    app_handle
        .emit(
            "research:progress",
            serde_json::json!({
                "session_id": session_id,
                "progress": progress,
            }),
        )
        .ok();
}

pub async fn run_research(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    settings: &SettingsData,
    session_id: &str,
    user_query: &str,
) -> Result<ResearchResult, String> {
    let limits = ResearchLimits::default();
    let deadline = Instant::now() + Duration::from_secs(u64::from(limits.max_duration_secs));

    let mut notebook = Notebook::new();
    let mut search_hits: Vec<SearchHit> = Vec::new();
    let mut searches_used: u8 = 0;
    let mut fetches_used: u8 = 0;
    let mut json_failures: u8 = 0;

    for iteration in 0..limits.max_iterations {
        if Instant::now() >= deadline {
            log::info!("Research hit time limit at iteration {iteration}");
            break;
        }

        let should_break = run_research_iteration(
            db,
            app_handle,
            settings,
            session_id,
            user_query,
            &limits,
            iteration,
            &mut notebook,
            &mut search_hits,
            &mut searches_used,
            &mut fetches_used,
            &mut json_failures,
        )
        .await;

        if should_break {
            break;
        }
    }

    Ok(ResearchResult {
        brief: notebook.to_brief(),
        citations: notebook.citations().to_vec(),
    })
}

#[allow(clippy::too_many_arguments)]
async fn run_research_iteration(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    settings: &SettingsData,
    session_id: &str,
    user_query: &str,
    limits: &ResearchLimits,
    iteration: u8,
    notebook: &mut Notebook,
    search_hits: &mut Vec<SearchHit>,
    searches_used: &mut u8,
    fetches_used: &mut u8,
    json_failures: &mut u8,
) -> bool {
    emit_research_progress(
        app_handle,
        session_id,
        "thinking",
        "Deciding next research action...",
        iteration,
    );

    if *json_failures >= 2 {
        run_dumb_fallback(
            db,
            app_handle,
            session_id,
            user_query,
            notebook,
            search_hits,
            searches_used,
            fetches_used,
            limits,
            iteration,
        )
        .await;
        return true;
    }

    let action = match planner::select_action(
        settings,
        user_query,
        notebook,
        search_hits,
        limits.max_searches.saturating_sub(*searches_used),
        limits.max_page_fetches.saturating_sub(*fetches_used),
    )
    .await
    {
        Ok(action) => action,
        Err(e) => {
            *json_failures += 1;
            log::warn!("Action selection failed ({json_failures}/2): {e}");
            return false;
        }
    };

    match action {
        AgentAction::Search { query } => {
            if *searches_used >= limits.max_searches {
                log::info!("Search limit reached, forcing finish");
                return true;
            }
            execute_search_action(
                db,
                app_handle,
                session_id,
                &query,
                search_hits,
                searches_used,
                iteration,
            )
            .await;
        }

        AgentAction::OpenResults { result_ids } => {
            execute_open_results_action(
                db,
                app_handle,
                session_id,
                &result_ids,
                search_hits,
                notebook,
                fetches_used,
                limits,
                iteration,
            )
            .await;
        }

        AgentAction::Finish { .. } => {
            emit_research_progress(app_handle, session_id, "done", "Research complete", iteration);
            return true;
        }
    }

    false
}

async fn execute_search_action(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
    query: &str,
    search_hits: &mut Vec<SearchHit>,
    searches_used: &mut u8,
    iteration: u8,
) {
    emit_research_progress(app_handle, session_id, "searching", query, iteration);

    let cache_key = format!("q:{}", query.to_lowercase());
    let cached = {
        let conn = db.conn();
        ResearchCache::lookup(&conn, &cache_key, "search")
    };

    let results = if let Some(cached_json) = cached {
        serde_json::from_str::<Vec<SearchHitJson>>(&cached_json)
            .map(|v| {
                v.into_iter()
                    .map(|h| SearchHit {
                        title: h.title,
                        url: h.url,
                        snippet: h.snippet,
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        RATE_LIMITER.wait().await;
        match web_search::search_duckduckgo(query, 5).await {
            Ok(ws_results) => {
                let hits: Vec<SearchHit> = ws_results
                    .into_iter()
                    .map(|r| SearchHit {
                        title: r.title,
                        url: r.url,
                        snippet: r.snippet,
                    })
                    .collect();
                let json_hits: Vec<SearchHitJson> = hits
                    .iter()
                    .map(|h| SearchHitJson {
                        title: h.title.clone(),
                        url: h.url.clone(),
                        snippet: h.snippet.clone(),
                    })
                    .collect();
                if let Ok(json) = serde_json::to_string(&json_hits) {
                    let conn = db.conn();
                    ResearchCache::store(&conn, &cache_key, &json, "search").ok();
                }
                hits
            }
            Err(e) => {
                log::warn!("Search failed: {e}");
                Vec::new()
            }
        }
    };

    *search_hits = results;
    *searches_used += 1;
}

#[allow(clippy::too_many_arguments)]
async fn execute_open_results_action(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
    result_ids: &[usize],
    search_hits: &[SearchHit],
    notebook: &mut Notebook,
    fetches_used: &mut u8,
    limits: &ResearchLimits,
    iteration: u8,
) {
    for &id in result_ids {
        if *fetches_used >= limits.max_page_fetches {
            break;
        }
        if id >= search_hits.len() {
            continue;
        }
        let hit = &search_hits[id];
        emit_research_progress(app_handle, session_id, "reading", &hit.title, iteration);

        let page_cache_key = format!("p:{}", hit.url);
        let cached_page = {
            let conn = db.conn();
            ResearchCache::lookup(&conn, &page_cache_key, "page")
        };

        let text = if let Some(cached) = cached_page {
            cached
        } else {
            match fetch_page_text(&hit.url).await {
                Ok(text) => {
                    let conn = db.conn();
                    ResearchCache::store(
                        &conn,
                        &page_cache_key,
                        &text[..text.len().min(50_000)],
                        "page",
                    )
                    .ok();
                    text
                }
                Err(e) => {
                    log::warn!("Fetch failed for {}: {e}", hit.url);
                    *fetches_used += 1;
                    continue;
                }
            }
        };

        let snippet: String = text.chars().take(2000).collect();
        notebook.add_entry(&format!("From \"{}\":\n{}", hit.title, snippet));
        notebook.add_citation(&hit.url, &hit.title);
        *fetches_used += 1;
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_dumb_fallback(
    db: &Arc<Database>,
    app_handle: &tauri::AppHandle,
    session_id: &str,
    user_query: &str,
    notebook: &mut Notebook,
    search_hits: &mut Vec<SearchHit>,
    searches_used: &mut u8,
    fetches_used: &mut u8,
    limits: &ResearchLimits,
    iteration: u8,
) {
    emit_research_progress(app_handle, session_id, "searching", user_query, iteration);

    if *searches_used < limits.max_searches {
        RATE_LIMITER.wait().await;
        if let Ok(results) = web_search::search_duckduckgo(user_query, 5).await {
            *search_hits = results
                .into_iter()
                .map(|r| SearchHit {
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet,
                })
                .collect();
            *searches_used += 1;
        }
    }

    let max_open = 2.min(search_hits.len());
    for hit in search_hits.iter().take(max_open) {
        if *fetches_used >= limits.max_page_fetches {
            break;
        }
        emit_research_progress(app_handle, session_id, "reading", &hit.title, iteration);

        let page_cache_key = format!("p:{}", hit.url);
        let cached_page = {
            let conn = db.conn();
            ResearchCache::lookup(&conn, &page_cache_key, "page")
        };

        let text = if let Some(cached) = cached_page {
            cached
        } else {
            match fetch_page_text(&hit.url).await {
                Ok(t) => {
                    let conn = db.conn();
                    ResearchCache::store(&conn, &page_cache_key, &t[..t.len().min(50_000)], "page")
                        .ok();
                    t
                }
                Err(e) => {
                    log::warn!("Dumb fallback fetch failed for {}: {e}", hit.url);
                    *fetches_used += 1;
                    continue;
                }
            }
        };

        let snippet: String = text.chars().take(2000).collect();
        notebook.add_entry(&format!("From \"{}\":\n{}", hit.title, snippet));
        notebook.add_citation(&hit.url, &hit.title);
        *fetches_used += 1;
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SearchHitJson {
    title: String,
    url: String,
    snippet: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn research_limits_defaults_are_sane() {
        let limits = ResearchLimits::default();
        assert!(limits.max_iterations <= 10);
        assert!(limits.max_searches <= 5);
        assert!(limits.max_page_fetches <= 10);
        assert!(limits.max_duration_secs <= 120);
    }

    #[test]
    fn research_result_empty_notebook_gives_empty_brief() {
        let nb = Notebook::new();
        let result = ResearchResult {
            brief: nb.to_brief(),
            citations: nb.citations().to_vec(),
        };
        assert!(result.brief.is_empty());
        assert!(result.citations.is_empty());
    }
}
