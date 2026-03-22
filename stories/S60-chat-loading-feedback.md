---
id: S60
title: Enhanced loading feedback for chat and plan generation
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S60 — Enhanced loading feedback for chat and plan generation

## User story

As a **runner using CoachLM**,
I want to **see what the app is doing while it processes my chat message or generates a training plan**
so that **I know the app is working and roughly how far along it is, instead of staring at a static "Thinking..." label**.

## Acceptance criteria

### Chat loading feedback

- [ ] Backend emits Tauri events at each phase of `send_message`:
  - `chat:send:progress` with `{ "status": "Preparing session..." }` — after session creation
  - `chat:send:progress` with `{ "status": "Generating title..." }` — before title LLM call (first message only)
  - `chat:send:progress` with `{ "status": "Gathering context..." }` — before `build_context`
  - `chat:send:progress` with `{ "status": "Querying model..." }` — before main LLM call
  - `chat:send:progress` with `{ "status": "Saving response..." }` — after LLM returns, before DB write
- [ ] `send_message` is refactored to accept `app_handle: tauri::AppHandle` so it can emit events
- [ ] `send_message` is converted from a synchronous Tauri command to an async-spawned pattern (like `generate_plan_cmd`) so the frontend can receive progress events while the command runs
- [ ] Title generation (`generate_session_title`) is moved off the critical path — spawned as a background task so it does not block the main LLM response
- [ ] Chat.tsx listens for `chat:send:progress` events and displays the current status message instead of static "Thinking..."
- [ ] The loading indicator in Chat.tsx cycles through the status messages as they arrive from the backend
- [ ] App.tsx banner also shows the current progress status (not just "Coach is thinking...")

### Plan generation loading feedback

- [ ] PlanCreator.tsx listens for `plan:generate:start`, `plan:generate:progress`, and `plan:generate:error` events
- [ ] When generation is in progress, PlanCreator shows a progress indicator with the current status message
- [ ] The "Generate Training Plan" button is disabled while generation is in progress
- [ ] Errors from `plan:generate:error` are displayed in PlanCreator (currently they are silently lost)

## Technical notes

### Chat flow refactor

The current `send_message` command signature is:
```rust
async fn send_message(state: tauri::State<'_, AppState>, content: String) -> Result<String, String>
```

It needs `app_handle` added. The function currently runs 7 sequential phases but emits zero events. The plan generation already has the exact pattern to follow — see `plan/mod.rs` which emits `plan:generate:progress` events.

Key change: `send_message` currently awaits `generate_session_title` before the main LLM call. This should be spawned as a fire-and-forget task to reduce latency. The title will update in the background; the frontend already calls `refreshSessions()` after the response arrives.

### Event naming convention

Follow existing patterns: `plan:generate:progress`, `strava:sync:progress`.
Use: `chat:send:progress` with payload `{ "status": "..." }`.

### Frontend pattern

The existing `listen()` from `@tauri-apps/api/event` is already used in PlanCreator and App.tsx. Follow the same `useEffect` + cleanup pattern.

### Files to modify

**Rust backend:**
- `src-tauri/src/lib.rs` — refactor `send_message` to accept `app_handle`, emit progress events, spawn title generation
- No changes needed to `llm/mod.rs`, `context/mod.rs`, or `storage/mod.rs`

**Frontend:**
- `src/components/Chat.tsx` — listen for `chat:send:progress`, replace static "Thinking..." with dynamic status
- `src/App.tsx` — update banner to show progress status
- `src/components/TrainingPlan/PlanCreator.tsx` — listen for `plan:generate:start`, `plan:generate:progress`, `plan:generate:error`

## Tests required

- Unit: Rust test that `send_message` still returns correct response (existing tests should pass unchanged)
- Integration: Verify all 5 progress events are emitted in correct order (manual verification via `npm run tauri dev`)
- Edge cases:
  - First message in session (title generation path) emits "Generating title..." then proceeds
  - Subsequent messages skip title generation event
  - LLM error does not leave loading state stuck (frontend resets on error)
  - Plan generation error is surfaced in PlanCreator UI

## Out of scope

- Token streaming (showing partial LLM response as it generates) — separate story
- Progress bar with percentage — this story uses text status messages only
- Changes to the LLM module or context engine internals

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
