use std::fmt::Write as _;

use super::types::Citation;

const DEFAULT_CHAR_BUDGET: usize = 3500;

pub struct Notebook {
    entries: Vec<String>,
    citations: Vec<Citation>,
    char_budget: usize,
    used_chars: usize,
}

impl Notebook {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            citations: Vec::new(),
            char_budget: DEFAULT_CHAR_BUDGET,
            used_chars: 0,
        }
    }

    pub fn remaining_chars(&self) -> usize {
        self.char_budget.saturating_sub(self.used_chars)
    }

    pub fn add_entry(&mut self, text: &str) {
        let remaining = self.remaining_chars();
        if remaining == 0 {
            return;
        }
        let truncated: String = text.chars().take(remaining).collect();
        self.used_chars += truncated.len();
        self.entries.push(truncated);
    }

    pub fn add_citation(&mut self, url: &str, title: &str) {
        if self.citations.iter().any(|c| c.url == url) {
            return;
        }
        self.citations.push(Citation {
            url: url.to_string(),
            title: title.to_string(),
        });
    }

    pub fn to_brief(&self) -> String {
        if self.entries.is_empty() {
            return String::new();
        }

        let mut brief = String::from("## Research Findings\n");
        for entry in &self.entries {
            brief.push_str(entry);
            brief.push('\n');
        }

        if !self.citations.is_empty() {
            brief.push_str("\nSources:\n");
            for (i, c) in self.citations.iter().enumerate() {
                let _ = writeln!(brief, "[{}] {} — {}", i + 1, c.title, c.url);
            }
        }

        brief
    }

    pub fn citations(&self) -> &[Citation] {
        &self.citations
    }

    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_notebook_is_empty() {
        let nb = Notebook::new();
        assert_eq!(nb.entry_count(), 0);
        assert!(nb.citations().is_empty());
        assert_eq!(nb.remaining_chars(), DEFAULT_CHAR_BUDGET);
        assert!(nb.to_brief().is_empty());
    }

    #[test]
    fn add_entry_tracks_budget() {
        let mut nb = Notebook::new();
        nb.add_entry("hello");
        assert_eq!(nb.remaining_chars(), DEFAULT_CHAR_BUDGET - 5);
        assert_eq!(nb.entry_count(), 1);
    }

    #[test]
    fn entry_truncated_when_budget_exceeded() {
        let mut nb = Notebook::new();
        let long_text = "a".repeat(DEFAULT_CHAR_BUDGET + 100);
        nb.add_entry(&long_text);
        assert_eq!(nb.remaining_chars(), 0);
        nb.add_entry("this should be ignored");
        assert_eq!(nb.entry_count(), 1, "no more entries when budget is 0");
    }

    #[test]
    fn duplicate_citations_ignored() {
        let mut nb = Notebook::new();
        nb.add_citation("https://example.com", "Example");
        nb.add_citation("https://example.com", "Example Again");
        assert_eq!(nb.citations().len(), 1);
    }

    #[test]
    fn to_brief_includes_entries_and_citations() {
        let mut nb = Notebook::new();
        nb.add_entry("Key finding about marathon training.");
        nb.add_citation("https://source.com/article", "Marathon Guide");
        let brief = nb.to_brief();
        assert!(brief.contains("## Research Findings"), "brief: {brief}");
        assert!(brief.contains("Key finding"), "brief: {brief}");
        assert!(brief.contains("[1] Marathon Guide"), "brief: {brief}");
        assert!(
            brief.contains("https://source.com/article"),
            "brief: {brief}"
        );
    }

    #[test]
    fn to_brief_omits_sources_when_no_citations() {
        let mut nb = Notebook::new();
        nb.add_entry("Some finding.");
        let brief = nb.to_brief();
        assert!(!brief.contains("Sources:"), "brief: {brief}");
    }

    #[test]
    fn multiple_entries_appear_in_order() {
        let mut nb = Notebook::new();
        nb.add_entry("First finding.");
        nb.add_entry("Second finding.");
        let brief = nb.to_brief();
        let pos1 = brief.find("First").expect("first");
        let pos2 = brief.find("Second").expect("second");
        assert!(pos1 < pos2, "entries should appear in insertion order");
    }
}
