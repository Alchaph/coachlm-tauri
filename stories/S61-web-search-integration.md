---
id: S61
title: Web search integration with DuckDuckGo RAG toggle
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S61 — Web search integration with DuckDuckGo RAG toggle

## User story

As a **runner using CoachLM**,
I want to **enable web search so the AI can include current information from the internet in its answers**
so that **I can ask about recent race results, current training research, weather conditions, or anything that requires up-to-date information**.

## Acceptance criteria

### Backend — web search module

- [ ] New Rust module `src-tauri/src/web_search/mod.rs` that performs DuckDuckGo web searches
- [ ] Search function takes a query string and returns a vector of results (title, URL, snippet)
- [ ] Results are limited to top 5 hits
- [ ] Search has a timeout (10 seconds) to prevent hanging if DuckDuckGo is unreachable
- [ ] Errors are handled gracefully — if search fails, chat continues without search results (log warning, do not error out)

### Backend — settings integration

- [ ] `SettingsData` gains two new fields: `web_search_enabled: bool` (default false), `web_search_provider: String` (default "duckduckgo")
- [ ] Database migration adds `web_search_enabled` and `web_search_provider` columns to `settings` table
- [ ] `get_settings` and `save_settings` handle the new columns

### Backend — chat integration

- [ ] When `web_search_enabled` is true in settings, `send_message` performs a web search using the user's message as the query
- [ ] Search results are formatted and prepended to the system context as a `## Web Search Results` section
- [ ] A progress event `chat:send:progress` with `{ "status": "Searching the web..." }` is emitted before the search (requires S60 event infrastructure)
- [ ] Search results are injected AFTER the system preamble but BEFORE the athlete context, so the model sees them as supplementary information
- [ ] The web search results section respects the token budget (truncated if needed)

### Frontend — chat toggle

- [ ] Chat.tsx shows a small toggle button (globe icon from lucide-react) next to the send button
- [ ] Toggle reflects and updates the `web_search_enabled` setting
- [ ] When web search is on, the globe icon is highlighted (accent color)
- [ ] Tooltip on hover: "Web search enabled" / "Web search disabled"

### Frontend — settings page

- [ ] Settings page has a "Web Search" section
- [ ] Toggle to enable/disable web search
- [ ] Provider dropdown (currently only "DuckDuckGo" — extensible for future providers)
- [ ] Brief description: "When enabled, the AI will search the web for current information before answering. Results are added to the conversation context."

## Technical notes

### DuckDuckGo search implementation

Use the DuckDuckGo HTML endpoint (`https://html.duckduckgo.com/html/`) with reqwest. Parse the HTML response to extract result titles, URLs, and snippets. This approach requires no API key and has no strict rate limits for casual desktop app usage.

Alternative: Use the DuckDuckGo Lite endpoint (`https://lite.duckduckgo.com/lite/`) which is simpler to parse.

The search module should define a trait or common result type so adding providers (Tavily, Brave, SearXNG) later is straightforward:

```rust
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

pub async fn search_duckduckgo(query: &str, max_results: usize) -> Result<Vec<SearchResult>, String>
```

### Context injection format

```
## Web Search Results
The following are recent web search results for the user's query. Use them if relevant.

[1] Title of first result
Snippet text from the search result
Source: https://example.com/article

[2] Title of second result
...
```

### Settings schema migration

Add columns with safe `ALTER TABLE` pattern (same as existing migrations in `storage/mod.rs`):

```rust
let new_settings_cols = [
    ("web_search_enabled", "INTEGER DEFAULT 0"),
    ("web_search_provider", "TEXT DEFAULT 'duckduckgo'"),
];
```

### Files to create

- `src-tauri/src/web_search/mod.rs` — search provider implementation

### Files to modify

**Rust backend:**
- `src-tauri/src/lib.rs` — import web_search module, modify send_message to include search step
- `src-tauri/src/models.rs` — add fields to `SettingsData`
- `src-tauri/src/storage/mod.rs` — migration + update get_settings/save_settings queries

**Frontend:**
- `src/components/Chat.tsx` — add globe toggle button
- `src/components/Settings.tsx` — add web search settings section

## Tests required

- Unit: `search_duckduckgo` returns results for a known query (integration test, may need network)
- Unit: `search_duckduckgo` returns empty vec on timeout (mock or short timeout)
- Unit: Web search results are correctly formatted as context string
- Unit: Settings round-trip (save with web_search_enabled=true, load it back)
- Unit: `send_message` with web search disabled does not call search (existing behavior unchanged)
- Edge cases:
  - DuckDuckGo returns no results — chat continues normally
  - DuckDuckGo is unreachable — chat continues normally with warning logged
  - Very long search results are truncated to fit token budget
  - Toggle state persists across app restarts

## Out of scope

- Agentic/tool-calling approach (model decides when to search) — separate story
- Additional search providers (Tavily, Brave, SearXNG) — separate story, but architecture should support them
- Caching search results in SQLite
- Content scraping (fetching full page content from URLs)
- Per-message search toggle (this story uses a global setting toggled from chat)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
