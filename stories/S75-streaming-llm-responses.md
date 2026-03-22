---
id: S75
title: Implement streaming LLM responses via Tauri events
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S75 — Implement streaming LLM responses via Tauri events

## User story

As a **runner**,
I want to **see the coach's response appear word by word**
so that **I get immediate feedback instead of waiting for the full reply**.

## Acceptance criteria

- [x] LLM client has a new `chat_stream` function that streams tokens
- [x] Ollama streaming works (stream: true, parse line-delimited JSON chunks)
- [x] Cloud provider streaming works (stream: true, parse SSE chunks)
- [x] Backend emits `chat:send:chunk` events with `{ content: string, done: boolean }` payload
- [x] `query_and_save_response` uses streaming and accumulates full response for DB save
- [x] Frontend Chat.tsx listens for `chat:send:chunk` and displays partial responses
- [x] Frontend creates a provisional assistant message on first chunk and appends subsequent chunks
- [x] Loading state clears when `done: true` chunk is received
- [x] Existing `chat:send:progress` events still work for status messages
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes
- [x] `npm run lint` passes with zero errors
- [x] `npx tsc --noEmit` passes

## Technical notes

- Add `pub async fn chat_stream(settings, messages, app_handle) -> Result<String, String>` to llm/mod.rs
- For Ollama: set `stream: true` in request, use `response.bytes_stream()` from reqwest, parse each line as JSON with `{ message: { content: "token" }, done: bool }`
- For cloud (OpenAI-compatible): set `stream: true`, parse SSE format (`data: {...}` lines), extract `choices[0].delta.content`
- Emit `app_handle.emit("chat:send:chunk", payload)` for each token
- In `query_and_save_response`: call `chat_stream` instead of `chat`, accumulate tokens into full response string, save to DB after stream completes
- Frontend: add `listen("chat:send:chunk")` in Chat.tsx, create assistant message placeholder on first chunk, append content on each subsequent chunk
- Keep `chat()` (non-streaming) as fallback for plan generation

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Streaming for plan generation
- Cancel/abort mid-stream
- Token count display

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | All linters pass, 55 tests pass |
