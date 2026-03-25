use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum AgentAction {
    Search { query: String },
    OpenResults { result_ids: Vec<usize> },
    Finish { answer_outline: String },
}

#[derive(Debug, Clone)]
pub struct SearchHit {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub url: String,
    pub title: String,
}

#[derive(Debug, Clone)]
pub struct ResearchResult {
    pub brief: String,
    #[allow(dead_code)]
    pub citations: Vec<Citation>,
}

#[allow(clippy::struct_field_names)]
#[derive(Debug, Clone, Copy)]
pub struct ResearchLimits {
    pub max_iterations: u8,
    pub max_searches: u8,
    pub max_page_fetches: u8,
    pub max_duration_secs: u8,
}

impl Default for ResearchLimits {
    fn default() -> Self {
        Self {
            max_iterations: 4,
            max_searches: 2,
            max_page_fetches: 3,
            max_duration_secs: 45,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchProgress {
    pub step: String,
    pub detail: String,
    pub iteration: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_action_search_round_trips() {
        let action = AgentAction::Search {
            query: "marathon training plan".to_string(),
        };
        let json = serde_json::to_string(&action).expect("serialize");
        let parsed: AgentAction = serde_json::from_str(&json).expect("deserialize");
        match parsed {
            AgentAction::Search { query } => assert_eq!(query, "marathon training plan"),
            other => panic!("expected Search, got {other:?}"),
        }
    }

    #[test]
    fn agent_action_open_results_round_trips() {
        let action = AgentAction::OpenResults {
            result_ids: vec![0, 2],
        };
        let json = serde_json::to_string(&action).expect("serialize");
        let parsed: AgentAction = serde_json::from_str(&json).expect("deserialize");
        match parsed {
            AgentAction::OpenResults { result_ids } => assert_eq!(result_ids, vec![0, 2]),
            other => panic!("expected OpenResults, got {other:?}"),
        }
    }

    #[test]
    fn agent_action_finish_round_trips() {
        let action = AgentAction::Finish {
            answer_outline: "Use 80/20 polarised approach".to_string(),
        };
        let json = serde_json::to_string(&action).expect("serialize");
        let parsed: AgentAction = serde_json::from_str(&json).expect("deserialize");
        match parsed {
            AgentAction::Finish { answer_outline } => {
                assert_eq!(answer_outline, "Use 80/20 polarised approach");
            }
            other => panic!("expected Finish, got {other:?}"),
        }
    }

    #[test]
    fn agent_action_parses_from_llm_style_json() {
        let llm_json = r#"{"action": "search", "query": "best shoes for trail running"}"#;
        let parsed: AgentAction = serde_json::from_str(llm_json).expect("parse LLM output");
        match parsed {
            AgentAction::Search { query } => {
                assert_eq!(query, "best shoes for trail running");
            }
            other => panic!("expected Search, got {other:?}"),
        }
    }

    #[test]
    fn research_limits_default_values() {
        let limits = ResearchLimits::default();
        assert_eq!(limits.max_iterations, 4);
        assert_eq!(limits.max_searches, 2);
        assert_eq!(limits.max_page_fetches, 3);
        assert_eq!(limits.max_duration_secs, 45);
    }

    #[test]
    fn citation_round_trips() {
        let citation = Citation {
            url: "https://example.com".to_string(),
            title: "Example".to_string(),
        };
        let json = serde_json::to_string(&citation).expect("serialize");
        let parsed: Citation = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.url, "https://example.com");
        assert_eq!(parsed.title, "Example");
    }

    #[test]
    fn research_progress_round_trips() {
        let progress = ResearchProgress {
            step: "Searching".to_string(),
            detail: "marathon pacing strategy".to_string(),
            iteration: 1,
        };
        let json = serde_json::to_string(&progress).expect("serialize");
        let parsed: ResearchProgress = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.step, "Searching");
        assert_eq!(parsed.iteration, 1);
    }
}
