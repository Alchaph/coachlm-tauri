use crate::llm;
use crate::models::{OllamaMessage, SettingsData};

/// Three-valued heuristic: determines how the keyword analysis maps to a search decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeuristicResult {
    SearchRecommended,
    SearchNotNeeded,
    /// Falls back to LLM classification when keyword signals are ambiguous.
    Uncertain,
}

const TEMPORAL_KEYWORDS: &[&str] = &[
    "latest",
    "recent",
    "recently",
    "current",
    "currently",
    "today",
    "yesterday",
    "this week",
    "this month",
    "this year",
    "right now",
    "2025",
    "2026",
    "news",
    "update",
    "updated",
    "new study",
    "new research",
];

const SEARCH_INDICATORS: &[&str] = &[
    "http://",
    "https://",
    "www.",
    "what is",
    "who is",
    "where is",
    "how much does",
    "how many",
    "compare",
    " vs ",
    "versus",
    "better than",
    "recommend a",
    "best ",
    "top ",
    "race results",
    "marathon results",
    "race calendar",
    "weather",
    "forecast",
    "sign up",
    "register for",
    "price",
    "cost",
    "schedule",
    "event",
    "review",
];

const PERSONAL_INDICATORS: &[&str] = &[
    "my pace",
    "my run",
    "my training",
    "my workout",
    "my heart rate",
    "my hr",
    "my mileage",
    "my plan",
    "my progress",
    "my activity",
    "my race",
    "my goal",
    "my injury",
    "my schedule",
    "yesterday's run",
    "yesterday's workout",
    "last run",
    "last workout",
    "this week's",
    "weekly mileage",
    "how did i",
    "how am i",
    "should i",
    "am i",
    "help me",
    "analyze my",
    "look at my",
];

/// Runs a fast keyword heuristic, falling back to LLM classification for ambiguous cases.
/// The decision tree: personal >= 2 → skip; search signals >= 2 or URL → recommend;
/// single signal + no personal → LLM decides; otherwise → skip.
#[must_use]
pub fn classify_heuristic(message: &str) -> HeuristicResult {
    let lower = message.to_lowercase();

    let personal_hits = PERSONAL_INDICATORS
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    if personal_hits >= 2 {
        return HeuristicResult::SearchNotNeeded;
    }

    let temporal_hits = TEMPORAL_KEYWORDS
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    let search_hits = SEARCH_INDICATORS
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    let total_search_signals = temporal_hits + search_hits;

    if total_search_signals >= 2 {
        return HeuristicResult::SearchRecommended;
    }

    if lower.contains("http://") || lower.contains("https://") || lower.contains("www.") {
        return HeuristicResult::SearchRecommended;
    }

    if total_search_signals == 1 && personal_hits == 0 {
        return HeuristicResult::Uncertain;
    }

    if personal_hits >= 1 && total_search_signals == 0 {
        return HeuristicResult::SearchNotNeeded;
    }

    HeuristicResult::SearchNotNeeded
}

async fn classify_with_llm(settings: &SettingsData, message: &str) -> Result<bool, String> {
    let system = OllamaMessage {
        role: "system".to_string(),
        content: "You are a classification assistant. Answer ONLY \"yes\" or \"no\". \
                  Do not explain or add any other text."
            .to_string(),
    };
    let user = OllamaMessage {
        role: "user".to_string(),
        content: format!(
            "Does the following user message require current information from the internet \
             to answer well? Consider that the app already has the user's personal training \
             data, activities, and profile. Only say \"yes\" if the question is about \
             external, real-world information the app would not have.\n\nMessage: \"{message}\""
        ),
    };

    let response = llm::chat(settings, vec![system, user]).await.map_err(|e| e.to_string())?;
    let trimmed = response.trim().to_lowercase();

    Ok(trimmed.starts_with("yes"))
}

pub async fn should_suggest_search(
    settings: &SettingsData,
    user_message: &str,
) -> Result<bool, String> {
    match classify_heuristic(user_message) {
        HeuristicResult::SearchRecommended => Ok(true),
        HeuristicResult::SearchNotNeeded => Ok(false),
        HeuristicResult::Uncertain => {
            match classify_with_llm(settings, user_message).await {
                Ok(result) => Ok(result),
                Err(e) => {
                    log::warn!("LLM classification failed, defaulting to no search: {e}");
                    Ok(false)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temporal_keywords_trigger_search() {
        assert_eq!(
            classify_heuristic("What is the latest marathon training news?"),
            HeuristicResult::SearchRecommended,
        );
    }

    #[test]
    fn multiple_search_indicators_trigger_search() {
        assert_eq!(
            classify_heuristic("Compare Nike Vaporfly vs Adidas Adios Pro"),
            HeuristicResult::SearchRecommended,
        );
    }

    #[test]
    fn url_triggers_search() {
        assert_eq!(
            classify_heuristic("What does this article say? https://example.com/running"),
            HeuristicResult::SearchRecommended,
        );
    }

    #[test]
    fn personal_training_question_skips_search() {
        assert_eq!(
            classify_heuristic("How did my run go yesterday? Analyze my pace"),
            HeuristicResult::SearchNotNeeded,
        );
    }

    #[test]
    fn personal_plan_question_skips_search() {
        assert_eq!(
            classify_heuristic("Should I increase my mileage this week based on my training?"),
            HeuristicResult::SearchNotNeeded,
        );
    }

    #[test]
    fn ambiguous_single_signal_is_uncertain() {
        assert_eq!(
            classify_heuristic("What is the ideal recovery strategy after a marathon?"),
            HeuristicResult::Uncertain,
        );
    }

    #[test]
    fn generic_coaching_question_skips_search() {
        assert_eq!(
            classify_heuristic("How many intervals should I do on Tuesday?"),
            HeuristicResult::SearchNotNeeded,
        );
    }

    #[test]
    fn news_with_temporal_triggers_search() {
        assert_eq!(
            classify_heuristic("Any news about the 2026 Boston Marathon?"),
            HeuristicResult::SearchRecommended,
        );
    }

    #[test]
    fn empty_message_skips_search() {
        assert_eq!(
            classify_heuristic(""),
            HeuristicResult::SearchNotNeeded,
        );
    }

    #[test]
    fn current_weather_triggers_search() {
        assert_eq!(
            classify_heuristic("What is the weather forecast for my race this weekend?"),
            HeuristicResult::SearchRecommended,
        );
    }
}
