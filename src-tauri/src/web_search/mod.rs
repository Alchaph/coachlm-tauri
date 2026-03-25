pub mod classifier;

use std::fmt::Write;

/// A single web search result.
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

/// Extracts all non-overlapping substrings bounded by `open` and `close`.
fn extract_between<'a>(haystack: &'a str, open: &str, close: &str) -> Vec<&'a str> {
    let mut results = Vec::new();
    let mut rest = haystack;
    while let Some(start) = rest.find(open) {
        rest = &rest[start + open.len()..];
        if let Some(end) = rest.find(close) {
            results.push(&rest[..end]);
            rest = &rest[end + close.len()..];
        } else {
            break;
        }
    }
    results
}

/// Remove HTML tags from a string slice (naive strip — adequate for DDG snippets).
fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut inside = false;
    for ch in s.chars() {
        match ch {
            '<' => inside = true,
            '>' => inside = false,
            _ if !inside => out.push(ch),
            _ => {}
        }
    }
    // Collapse &amp; &nbsp; etc. — only the handful DDG uses.
    out.replace("&amp;", "&")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&apos;", "'")
}

/// Searches `DuckDuckGo` HTML endpoint and returns up to `max_results` results.
pub async fn search_duckduckgo(
    query: &str,
    max_results: usize,
) -> Result<Vec<SearchResult>, String> {
    // Encode query: space → +, everything else percent-encoded where needed.
    let encoded: String = query
        .chars()
        .flat_map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | '~') {
                vec![c]
            } else if c == ' ' {
                vec!['+']
            } else {
                // percent-encode the UTF-8 bytes
                let mut buf = [0u8; 4];
                let bytes = c.encode_utf8(&mut buf).as_bytes().to_owned();
                bytes
                    .iter()
                    .flat_map(|b| {
                        let hi = char::from_digit(u32::from(b >> 4), 16)
                            .unwrap_or('0')
                            .to_ascii_uppercase();
                        let lo = char::from_digit(u32::from(b & 0x0F), 16)
                            .unwrap_or('0')
                            .to_ascii_uppercase();
                        vec!['%', hi, lo]
                    })
                    .collect::<Vec<_>>()
            }
        })
        .collect();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let body_str = format!("q={encoded}");

    let response = client
        .post("https://html.duckduckgo.com/html/")
        .header("User-Agent", "Mozilla/5.0 (compatible; CoachLM/1.0)")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("DuckDuckGo request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "DuckDuckGo returned HTTP {}",
            response.status()
        ));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read DuckDuckGo response: {e}"))?;

    Ok(parse_results(&html, max_results))
}

/// Parse search results from the `DuckDuckGo` HTML response.
fn parse_results(html: &str, max_results: usize) -> Vec<SearchResult> {
    // Each result block is wrapped in a <div class="result ..."> ... </div> section.
    // Within it:
    //   Title + URL: <a class="result__a" href="...">title text</a>
    //   Snippet:     <a class="result__snippet" ...>snippet text</a>
    //
    // We split by the anchor class marker and extract from there.

    let mut results = Vec::new();

    // Collect all href values from result__a anchors.
    let title_anchors = extract_between(html, "class=\"result__a\"", "</a>");
    let snippet_anchors = extract_between(html, "class=\"result__snippet\"", "</a>");

    // For URLs, we need the href attribute. Re-scan for result__a to get href.
    let mut url_list: Vec<String> = Vec::new();
    {
        let mut rest = html;
        while let Some(pos) = rest.find("class=\"result__a\"") {
            // Walk backwards from pos to find the opening <a tag.
            let before = &rest[..pos];
            if let Some(a_start) = before.rfind('<') {
                let tag_slice = &rest[a_start..pos + 16];
                if let Some(href_pos) = tag_slice.find("href=\"") {
                    let after_href = &tag_slice[href_pos + 6..];
                    if let Some(end) = after_href.find('"') {
                        url_list.push(after_href[..end].to_string());
                    }
                }
            }
            rest = &rest[pos + 17..];
        }
    }

    let count = title_anchors
        .len()
        .min(url_list.len())
        .min(snippet_anchors.len())
        .min(max_results);

    for i in 0..count {
        let title = strip_tags(title_anchors[i]).trim().to_string();
        let url = url_list[i].clone();
        let snippet = strip_tags(snippet_anchors[i]).trim().to_string();

        if title.is_empty() || url.is_empty() {
            log::warn!("Skipping malformed search result at index {i}");
            continue;
        }

        results.push(SearchResult { title, url, snippet });
    }

    results
}

/// Formats a slice of `SearchResult` for injection into LLM context.
///
/// Returns an empty string when `results` is empty.
pub fn format_search_results(results: &[SearchResult]) -> String {
    if results.is_empty() {
        return String::new();
    }

    let mut out = String::from(
        "## Web Search Results\n\
         The following are recent web search results for the user's query. Use them if relevant.\n",
    );

    for (idx, r) in results.iter().enumerate() {
        let _ = write!(
            out,
            "\n[{}] {}\n{}\nSource: {}\n",
            idx + 1,
            r.title,
            r.snippet,
            r.url,
        );
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_result_can_be_constructed() {
        let r = SearchResult {
            title: "Example Title".to_string(),
            url: "https://example.com".to_string(),
            snippet: "A short snippet.".to_string(),
        };
        assert_eq!(r.title, "Example Title");
        assert_eq!(r.url, "https://example.com");
        assert_eq!(r.snippet, "A short snippet.");
    }

    #[test]
    fn format_search_results_empty_returns_empty_string() {
        let result = format_search_results(&[]);
        assert!(result.is_empty(), "expected empty string, got: {result:?}");
    }

    #[test]
    fn format_search_results_single_result_produces_expected_format() {
        let results = vec![SearchResult {
            title: "Title of first result".to_string(),
            url: "https://example.com/article".to_string(),
            snippet: "Snippet text from the search result".to_string(),
        }];
        let output = format_search_results(&results);

        assert!(
            output.contains("## Web Search Results"),
            "missing header: {output}"
        );
        assert!(
            output.contains("The following are recent web search results"),
            "missing preamble: {output}"
        );
        assert!(output.contains("[1] Title of first result"), "missing title: {output}");
        assert!(
            output.contains("Snippet text from the search result"),
            "missing snippet: {output}"
        );
        assert!(
            output.contains("Source: https://example.com/article"),
            "missing source: {output}"
        );
    }

    #[test]
    fn format_search_results_multiple_results_numbered_correctly() {
        let results = vec![
            SearchResult {
                title: "First".to_string(),
                url: "https://first.com".to_string(),
                snippet: "First snippet".to_string(),
            },
            SearchResult {
                title: "Second".to_string(),
                url: "https://second.com".to_string(),
                snippet: "Second snippet".to_string(),
            },
        ];
        let output = format_search_results(&results);
        assert!(output.contains("[1] First"), "missing [1]: {output}");
        assert!(output.contains("[2] Second"), "missing [2]: {output}");
    }

    #[test]
    fn strip_tags_removes_html() {
        assert_eq!(strip_tags("<b>Hello</b> <i>world</i>"), "Hello world");
    }

    #[test]
    fn strip_tags_decodes_entities() {
        assert_eq!(strip_tags("foo &amp; bar"), "foo & bar");
        assert_eq!(strip_tags("&lt;tag&gt;"), "<tag>");
    }

    #[test]
    fn extract_between_finds_all_occurrences() {
        let html = r#"<a class="foo">first</a> other <a class="foo">second</a>"#;
        let found = extract_between(html, "class=\"foo\">", "</a>");
        assert_eq!(found, vec!["first", "second"]);
    }

    #[test]
    fn extract_between_empty_when_no_match() {
        let found = extract_between("no markers here", "OPEN", "CLOSE");
        assert!(found.is_empty());
    }

    #[test]
    fn parse_results_respects_max_results() {
        // Build a minimal fake HTML with 3 results.
        let block = |n: u32| {
            format!(
                "<a class=\"result__a\" href=\"https://example.com/{n}\">Title {n}</a>\
                 <a class=\"result__snippet\" href=\"#\">Snippet {n}</a>"
            )
        };
        let html = format!("{}{}{}", block(1), block(2), block(3));
        let results = parse_results(&html, 2);
        assert!(results.len() <= 2, "should be capped at max_results");
    }
}
