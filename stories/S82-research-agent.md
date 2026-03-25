---
id: S82
title: LLM-driven research agent with web search
status: done
created: 2026-03-24
updated: 2026-03-24
---

# S82 — LLM-driven research agent with web search

## User story

As a **runner**,
I want the coach to **automatically research relevant topics on the web before answering**
so that **responses include current, sourced information** beyond the LLM's training data.

## Acceptance criteria

- [x] Settings offer three web augmentation modes: Off, Simple (existing DDG inject), Agent (LLM-driven)
- [x] Agent mode runs a host-owned research loop: LLM selects `search`, `open_results`, or `finish`
- [x] Research loop has circuit breakers: max 4 iterations, 2 searches, 3 page fetches, 45s total
- [x] Smart mode (LLM picks actions via JSON) falls back to Dumb mode after 2 JSON parse failures
- [x] Dumb mode: host searches the user query, opens top 2 results, injects snippets
- [x] DDG requests are rate-limited (1 search per 5 seconds via Mutex<Instant>)
- [x] Search results and fetched pages are cached in SQLite (12h search TTL, 7d page TTL)
- [x] Research output has a separate char budget (3000-3500 chars) that does not compete with athlete context
- [x] Research progress events are emitted to frontend (research:progress)
- [x] Chat UI shows research timeline steps during agent execution
- [x] Existing Simple mode (DDG inject) continues to work unchanged
- [x] All new Rust modules have unit tests
- [x] cargo clippy -- -D warnings passes with zero warnings
- [x] cargo test passes
- [x] npm run lint passes
- [x] npx tsc --noEmit passes

## Technical notes

### Architecture

The research agent lives in `src-tauri/src/research/` with these sub-modules:

| File | Purpose |
|---|---|
| `mod.rs` | Module root, re-exports public API |
| `types.rs` | `AgentAction`, `ResearchResult`, `ResearchNotebook`, `ResearchLimits`, `ResearchProgress` |
| `orchestrator.rs` | Main loop: smart mode -> dumb fallback, circuit breakers |
| `planner.rs` | LLM action selection via `chat_json` |
| `notebook.rs` | Rolling digest, citation tracking, char budget enforcement |
| `rate_limit.rs` | `Mutex<Instant>` rate limiter for DDG |
| `cache.rs` | SQLite lookup/store with TTL |
| `fetch.rs` | reqwest GET + HTML text extraction |

### Key types

```rust
enum WebAugmentationMode { Off, Simple, Agent }

enum AgentAction {
    Search { query: String },
    OpenResults { result_ids: Vec<usize> },
    Finish { answer_outline: String },
}

struct ResearchLimits {
    max_iterations: u8,    // 4
    max_searches: u8,      // 2
    max_page_fetches: u8,  // 3
    max_duration_secs: u8, // 45
}

struct ResearchNotebook {
    digest: String,
    citations: Vec<Citation>,
    char_budget: usize,    // 3500
}

struct ResearchResult {
    brief: String,          // injected before athlete context
    citations: Vec<Citation>,
}
```

### Integration point

`lib.rs::query_and_save_response()` dispatches based on `WebAugmentationMode`:
- `Off` -> skip web search entirely
- `Simple` -> existing `web_search::search_duckduckgo()` + `format_search_results()`
- `Agent` -> `research::run_research()` which returns `ResearchResult`

### LLM helper

A new `llm::chat_json<T>()` function wraps the existing `chat()` with:
- JSON extraction from markdown-wrapped responses (```json ... ```)
- `serde_json::from_str::<T>()` deserialization
- Up to 2 retries on parse failure

### Backward compatibility

- `web_search_enabled: bool` is replaced by `web_augmentation_mode: String`
- Migration maps `true` -> `"simple"`, `false` -> `"off"`
- Frontend Settings.tsx updates from On/Off toggle to Off/Simple/Agent selector

### Token budget

Research brief is injected BEFORE the athlete context in the system message,
with its own 3500 char cap. The athlete context budget (4000 tokens / 16000 chars)
is unchanged.

## Tests required

- Unit: rate_limit.rs — enforces minimum interval between calls
- Unit: notebook.rs — digest stays within char budget, citations tracked
- Unit: cache.rs — TTL expiry, cache hit/miss
- Unit: fetch.rs — HTML tag stripping, text extraction
- Unit: planner.rs — JSON parsing of AgentAction variants
- Unit: types.rs — serialization/deserialization of all types
- Unit: orchestrator.rs — circuit breaker limits respected
- Integration: query_and_save_response dispatches correctly per mode

## Out of scope

- Headless browser / JavaScript rendering
- Multiple search providers (only DDG for now)
- Streaming research results (progress events only, not streamed content)
- Configurable circuit breaker limits in UI (hardcoded for now)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-24 | draft | Created |
| 2026-03-24 | in-progress | Implementation started |
| 2026-03-24 | done | All Rust modules implemented and wired; frontend updated; all checks pass |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
