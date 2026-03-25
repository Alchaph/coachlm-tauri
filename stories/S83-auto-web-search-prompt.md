---
id: S83
title: Auto web search with per-prompt detection and inline confirmation
status: done
created: 2026-03-25
updated: 2026-03-25
---

# S83 — Auto web search with per-prompt detection and inline confirmation

## User story

As a **runner using CoachLM**,
I want the app to **automatically detect when my question might benefit from web search and ask me before searching**
so that **I get current information when needed without unnecessary internet requests on every message**.

## Acceptance criteria

### Backend — classifier module

- [ ] New file `src-tauri/src/web_search/classifier.rs` with keyword heuristic + optional LLM fallback
- [ ] Keyword heuristic checks for temporal markers ("latest", "recent", "news", "2025", "2026", "current", "today", "this week", "this month"), URLs, event-related patterns, comparison phrases ("vs", "better than"), and product/race names
- [ ] Heuristic returns a three-valued result: `SearchRecommended`, `SearchNotNeeded`, `Uncertain`
- [ ] When `Uncertain`, a lightweight LLM classification call determines the answer (single yes/no question, minimal tokens)
- [ ] Classifier function signature: `pub async fn should_suggest_search(settings: &SettingsData, user_message: &str) -> Result<bool, String>`
- [ ] Unit tests for heuristic keyword matching

### Backend — oneshot channel for frontend confirmation

- [ ] `AppState` gains a field: `web_search_pending: Mutex<Option<tokio::sync::oneshot::Sender<bool>>>`
- [ ] New Tauri command `respond_web_search_suggestion(approved: bool)` that resolves the pending oneshot sender
- [ ] When the classifier recommends search in Auto mode, backend emits event `web-search:suggest` to frontend, then awaits the oneshot receiver with a 30-second timeout
- [ ] If timeout expires or channel errors, default to skipping search (fail-safe)

### Backend — Auto mode integration

- [ ] `WebAugmentationMode` enum gains an `Auto` variant
- [ ] `from_setting` maps `"auto"` to `Self::Auto`
- [ ] `Display` impl maps `Auto` to `"auto"`
- [ ] In `query_and_save_response`, the `Auto` branch: runs classifier, emits event if recommended, waits for user response, then proceeds with Simple search or skips
- [ ] Progress event emitted: "Analyzing message..." during classification

### Frontend — inline confirmation banner

- [ ] Chat.tsx listens for `web-search:suggest` event
- [ ] When received, renders an inline banner above the input area with text: "This question may benefit from a web search." and two buttons: "Search" (accent) and "Skip" (ghost)
- [ ] Clicking either button calls `invoke("respond_web_search_suggestion", { approved: true/false })`
- [ ] Banner auto-dismisses after the user responds
- [ ] Banner also auto-dismisses after 30 seconds (matches backend timeout)
- [ ] While banner is visible, the send button remains disabled (user should respond first)

### Frontend — settings update

- [ ] Settings dropdown gains a fourth option: `<option value="auto">Auto (ask before searching)</option>`
- [ ] Description text updated to mention the auto mode
- [ ] Chat.tsx web augmentation chip shows "Auto search" when mode is "auto"

### Storage

- [ ] `from_setting` already handles unknown values as Off, so "auto" mapping in the enum is sufficient
- [ ] No schema migration needed (field is TEXT, "auto" is just a new valid value)

## Technical notes

### Keyword heuristic patterns

```rust
const TEMPORAL_KEYWORDS: &[&str] = &[
    "latest", "recent", "current", "today", "yesterday",
    "this week", "this month", "this year", "right now",
    "2025", "2026", "news", "update",
];

const SEARCH_INDICATORS: &[&str] = &[
    "http://", "https://", "www.",
    "what is", "who is", "where is",
    "how much", "how many",
    "compare", "vs", "versus", "better than",
    "recommend", "best",
    "race results", "marathon results", "race calendar",
    "weather", "forecast",
];
```

Heuristic returns `SearchRecommended` if 2+ temporal/search keywords found, `SearchNotNeeded` if message is clearly about personal training ("my pace", "my run", "yesterday's workout"), `Uncertain` otherwise.

### LLM classification prompt (for Uncertain cases)

```
You are a classification assistant. Answer ONLY "yes" or "no".
Does the following user message require current information from the internet to answer well?
Message: "{user_message}"
Answer:
```

### Oneshot channel pattern

```rust
// In AppState:
pub web_search_pending: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<bool>>>,

// In Auto branch:
let (tx, rx) = tokio::sync::oneshot::channel();
state.web_search_pending.lock().map_err(...)?.replace(tx);
app_handle.emit("web-search:suggest", session_id)?;
let approved = tokio::time::timeout(Duration::from_secs(30), rx)
    .await
    .unwrap_or(Ok(false))
    .unwrap_or(false);

// New command:
#[tauri::command]
fn respond_web_search_suggestion(state: State<AppState>, approved: bool) -> Result<(), String> {
    if let Some(tx) = state.web_search_pending.lock().map_err(...)?.take() {
        tx.send(approved).ok();
    }
    Ok(())
}
```

### Files to create

- `src-tauri/src/web_search/classifier.rs`

### Files to modify

**Rust backend:**
- `src-tauri/src/models.rs` — Add `Auto` to `WebAugmentationMode`
- `src-tauri/src/web_search/mod.rs` — Add `pub mod classifier;`
- `src-tauri/src/lib.rs` — Add `web_search_pending` to AppState, new command, Auto branch in query_and_save_response
- `src-tauri/src/llm/mod.rs` — (no changes needed, `chat` already exists for classification call)

**Frontend:**
- `src/components/Chat.tsx` — Listen for event, render inline banner, call respond command
- `src/components/Settings.tsx` — Add auto option to dropdown
- `src/styles/global.css` — Add banner CSS class

## Tests required

- Unit: heuristic detects temporal keywords (returns SearchRecommended)
- Unit: heuristic detects personal training queries (returns SearchNotNeeded)
- Unit: heuristic returns Uncertain for ambiguous messages
- Unit: `WebAugmentationMode::from_setting("auto")` returns `Auto`
- Unit: `WebAugmentationMode::Auto` displays as "auto"
- Edge cases:
  - Backend timeout (30s) defaults to skipping search
  - Double-response to oneshot (second call is no-op)
  - Classifier LLM failure defaults to skipping search

## Out of scope

- Per-message mode override (always uses global setting)
- Remembering past decisions for similar queries
- Custom keyword lists in settings
- Agent mode auto-detection (Auto only triggers Simple search)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-25 | draft | Created |
