use std::time::Duration;

const MAX_BODY_BYTES: usize = 512_000;
const FETCH_TIMEOUT_SECS: u64 = 10;

pub async fn fetch_page_text(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(FETCH_TIMEOUT_SECS))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (compatible; CoachLM/1.0)")
        .header("Accept", "text/html,text/plain")
        .send()
        .await
        .map_err(|e| format!("Fetch failed for {url}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {} for {url}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read body from {url}: {e}"))?;

    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BODY_BYTES)]);
    Ok(strip_html_to_text(&body))
}

fn strip_html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 3);
    let mut inside_tag = false;
    let mut inside_script = false;
    let mut inside_style = false;
    let lower = html.to_lowercase();
    let chars: Vec<char> = html.chars().collect();
    let lower_chars: Vec<char> = lower.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if !inside_tag && chars[i] == '<' {
            inside_tag = true;
            let rest: String = lower_chars[i..].iter().take(20).collect();
            if rest.starts_with("<script") {
                inside_script = true;
            } else if rest.starts_with("<style") {
                inside_style = true;
            } else if rest.starts_with("</script") {
                inside_script = false;
            } else if rest.starts_with("</style") {
                inside_style = false;
            }
            i += 1;
            continue;
        }
        if inside_tag {
            if chars[i] == '>' {
                inside_tag = false;
            }
            i += 1;
            continue;
        }
        if inside_script || inside_style {
            i += 1;
            continue;
        }
        if chars[i] == '&' {
            let rest: String = chars[i..].iter().take(10).collect();
            if let Some(decoded) = decode_entity(&rest) {
                out.push_str(decoded.0);
                i += decoded.1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }

    collapse_whitespace(&out)
}

fn decode_entity(s: &str) -> Option<(&'static str, usize)> {
    let entities: &[(&str, &str)] = &[
        ("&amp;", "&"),
        ("&nbsp;", " "),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", "\""),
        ("&#x27;", "'"),
        ("&apos;", "'"),
        ("&#39;", "'"),
    ];
    for (entity, replacement) in entities {
        if s.starts_with(entity) {
            return Some((replacement, entity.len()));
        }
    }
    None
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_was_whitespace = false;
    let mut last_was_newline = false;

    for ch in s.chars() {
        if ch == '\n' || ch == '\r' {
            if !last_was_newline {
                out.push('\n');
                last_was_newline = true;
            }
            last_was_whitespace = true;
        } else if ch.is_whitespace() {
            if !last_was_whitespace {
                out.push(' ');
            }
            last_was_whitespace = true;
        } else {
            out.push(ch);
            last_was_whitespace = false;
            last_was_newline = false;
        }
    }

    out.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_basic_html_tags() {
        let html = "<h1>Title</h1><p>Hello <b>world</b>.</p>";
        let text = strip_html_to_text(html);
        assert!(text.contains("Title"), "text: {text}");
        assert!(text.contains("Hello"), "text: {text}");
        assert!(text.contains("world"), "text: {text}");
        assert!(!text.contains('<'), "should not contain angle brackets: {text}");
    }

    #[test]
    fn removes_script_content() {
        let html = "<p>Before</p><script>alert('xss')</script><p>After</p>";
        let text = strip_html_to_text(html);
        assert!(text.contains("Before"), "text: {text}");
        assert!(text.contains("After"), "text: {text}");
        assert!(!text.contains("alert"), "script content should be removed: {text}");
    }

    #[test]
    fn removes_style_content() {
        let html = "<style>body { color: red; }</style><p>Content</p>";
        let text = strip_html_to_text(html);
        assert!(text.contains("Content"), "text: {text}");
        assert!(!text.contains("color"), "style content should be removed: {text}");
    }

    #[test]
    fn decodes_html_entities() {
        let html = "fish &amp; chips &lt;3 &quot;hello&quot;";
        let text = strip_html_to_text(html);
        assert_eq!(text, "fish & chips <3 \"hello\"");
    }

    #[test]
    fn collapses_whitespace() {
        let html = "<p>  lots   of   spaces  </p>  <p>  more  </p>";
        let text = strip_html_to_text(html);
        assert!(!text.contains("  "), "should not have consecutive spaces: {text:?}");
    }

    #[test]
    fn empty_input_returns_empty() {
        assert!(strip_html_to_text("").is_empty());
    }

    #[test]
    fn plain_text_passes_through() {
        let text = strip_html_to_text("Just plain text, no HTML.");
        assert_eq!(text, "Just plain text, no HTML.");
    }
}
