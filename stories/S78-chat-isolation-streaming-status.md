---
id: S78
title: Chat session isolation and streaming progress steps
status: in-progress
created: 2026-03-22
updated: 2026-03-22
---

# S78 — Chat session isolation and streaming progress steps

## User story

As a **runner**,
I want chat responses to stay in the session they belong to, and see a step-by-step progress log while the coach is thinking,
so that **switching tabs does not corrupt other sessions, and I can see how long each step takes**.

## Acceptance criteria

- [ ] Streaming LLM chunks only appear in the session that initiated the request
- [ ] Opening a new chat tab while coach is answering does not inject text into the new tab
- [ ] Progress events (web search, gathering context, querying model) only appear in the active session
- [ ] Progress display shows each step on its own line as it happens (not overwriting previous steps)
- [ ] Each completed step shows elapsed time (e.g. "Searching the web... 2.1s")
- [ ] The current (in-progress) step shows a live elapsed timer
- [ ] Progress steps reset when a new message is sent

## Technical notes

### Root cause of chat interference

The Rust backend emits global Tauri events (`chat:send:chunk`, `chat:send:progress`) via `app_handle.emit()`. The frontend listener blindly appends chunks regardless of which session initiated the request. When a user switches sessions mid-stream, chunks from the old request bleed into the new session's message list.

### Fix: session-scoped events

1. Pass `session_id` through `emit_chat_progress()`, `chat_stream()`, and chunk emitters
2. Include `session_id` in every `chat:send:chunk` and `chat:send:progress` event payload
3. Frontend listeners filter events by comparing `event.payload.session_id` to `currentSessionId`

### Streaming progress steps

Replace the single `loadingStatus: string` state with a `progressSteps: Array<{label, startedAt}>` state. Each new progress event appends a step. The UI renders them vertically with computed elapsed time.

## Tests required

- Rust: existing tests must still pass (no new Rust tests needed since this is a payload shape change)
- TypeScript: `npx tsc --noEmit` must pass
- ESLint: `npm run lint` must pass
- Manual: send a message, switch session mid-stream, verify no bleed

## Out of scope

- Per-session streaming state in the Rust backend (the backend already processes one request at a time)
- Queuing multiple concurrent LLM requests

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | in-progress | Created |
