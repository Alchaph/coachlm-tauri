use std::fmt::Write as _;

use crate::models::{OllamaMessage, SettingsData};
use super::notebook::Notebook;
use super::types::{AgentAction, SearchHit};

pub fn build_action_prompt(
    user_query: &str,
    notebook: &Notebook,
    search_hits: &[SearchHit],
    searches_left: u8,
    fetches_left: u8,
) -> Vec<OllamaMessage> {
    let mut system = String::from(
        "You are a research assistant. Your job is to decide the next research action.\n\
         Respond with ONLY a JSON object. No explanation, no markdown.\n\n\
         Available actions:\n"
    );

    if searches_left > 0 {
        system.push_str("- {\"action\": \"search\", \"query\": \"<search query>\"}\n");
    }
    if fetches_left > 0 && !search_hits.is_empty() {
        system.push_str(
            "- {\"action\": \"open_results\", \"result_ids\": [0, 1]}\n\
             (result_ids are zero-indexed into the search results list)\n"
        );
    }
    system.push_str("- {\"action\": \"finish\", \"answer_outline\": \"<brief outline>\"}\n");

    if notebook.entry_count() > 0 {
        system.push_str("\nResearch gathered so far:\n");
        system.push_str(&notebook.to_brief());
    }

    if !search_hits.is_empty() {
        system.push_str("\nCurrent search results:\n");
        for (i, hit) in search_hits.iter().enumerate() {
            let _ = write!(system, "[{i}] {} — {}\n    {}\n", hit.title, hit.url, hit.snippet);
        }
    }

    vec![
        OllamaMessage {
            role: "system".to_string(),
            content: system,
        },
        OllamaMessage {
            role: "user".to_string(),
            content: format!("Research question: {user_query}\n\nWhat is the next action?"),
        },
    ]
}

pub async fn select_action(
    settings: &SettingsData,
    user_query: &str,
    notebook: &Notebook,
    search_hits: &[SearchHit],
    searches_left: u8,
    fetches_left: u8,
) -> Result<AgentAction, String> {
    let messages = build_action_prompt(
        user_query,
        notebook,
        search_hits,
        searches_left,
        fetches_left,
    );

    crate::llm::chat_json::<AgentAction>(settings, messages).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_includes_user_query() {
        let nb = Notebook::new();
        let messages = build_action_prompt("marathon pacing", &nb, &[], 2, 3);
        assert_eq!(messages.len(), 2);
        assert!(
            messages[1].content.contains("marathon pacing"),
            "user message should contain query"
        );
    }

    #[test]
    fn prompt_hides_search_when_none_left() {
        let nb = Notebook::new();
        let messages = build_action_prompt("test", &nb, &[], 0, 3);
        assert!(
            !messages[0].content.contains("\"search\""),
            "should not offer search when searches_left=0"
        );
    }

    #[test]
    fn prompt_hides_open_when_no_hits() {
        let nb = Notebook::new();
        let messages = build_action_prompt("test", &nb, &[], 2, 3);
        assert!(
            !messages[0].content.contains("\"open_results\""),
            "should not offer open_results when no search hits"
        );
    }

    #[test]
    fn prompt_shows_search_hits() {
        let nb = Notebook::new();
        let hits = vec![SearchHit {
            title: "Trail Running Guide".to_string(),
            url: "https://example.com/trail".to_string(),
            snippet: "Best tips for trail running".to_string(),
        }];
        let messages = build_action_prompt("test", &nb, &hits, 1, 2);
        assert!(
            messages[0].content.contains("Trail Running Guide"),
            "should include search hit titles"
        );
    }

    #[test]
    fn prompt_includes_notebook_when_non_empty() {
        let mut nb = Notebook::new();
        nb.add_entry("Important finding about VO2 max.");
        let messages = build_action_prompt("test", &nb, &[], 1, 2);
        assert!(
            messages[0].content.contains("Important finding about VO2 max"),
            "should include notebook content"
        );
    }

    #[test]
    fn prompt_always_offers_finish() {
        let nb = Notebook::new();
        let messages = build_action_prompt("test", &nb, &[], 0, 0);
        assert!(
            messages[0].content.contains("\"finish\""),
            "finish should always be available"
        );
    }
}
