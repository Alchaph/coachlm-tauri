---
id: S74
title: Add context caching in Rust backend
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S74 — Add context caching in Rust backend

## User story

As a **runner**,
I want **chat responses to start faster**
so that **I don't wait for context to rebuild on every message**.

## Acceptance criteria

- [x] AppState has a `cached_context: std::sync::Mutex<Option<String>>` field
- [x] A `get_or_build_context` helper returns cached context or builds and caches it
- [x] `query_and_save_response` uses cached context instead of calling `build_context` directly
- [x] `get_context_preview` uses cached context
- [x] Cache is invalidated (set to None) when: profile saved, pinned insight saved/deleted, settings saved, sync completes, context imported, active plan changes
- [x] `plan::generate_plan` receives pre-built context string from caller instead of calling `build_context` directly
- [x] `strava::sync_activities` refreshes the cache after sync completes (stores new context)
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes
- [x] `npm run lint` passes with zero errors
- [x] `npx tsc --noEmit` passes

## Technical notes

- Add `cached_context: std::sync::Mutex<Option<String>>` to AppState (lib.rs line 19-22)
- Initialize as `std::sync::Mutex::new(None)` in run() setup
- Create helper `fn get_or_build_context(state: &AppState) -> String` that checks cache, builds if missing, stores and returns
- Replace `context::build_context(&state.db)` calls in:
  - `query_and_save_response` (lib.rs ~line 204)
  - `get_context_preview` (lib.rs ~line 109)
- For `plan::generate_plan` (plan/mod.rs ~line 42): change signature to accept `context: &str` instead of calling `build_context` internally. Update caller `generate_plan_cmd` in lib.rs to pass cached context.
- For `strava::sync_activities` (strava/mod.rs ~line 277): after sync, build fresh context and store in cache. Requires passing AppState or a cache handle.
- Invalidate cache in these commands: `save_profile_data`, `save_pinned_insight`, `delete_pinned_insight`, `save_settings`, `import_context`, `set_active_plan`, `save_training_plan`, `delete_plan`
- Keep lock scopes minimal — don't hold mutex across async awaits

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- TTL-based cache expiration
- Per-session context caching
- Frontend changes

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | All linters pass, 55 tests pass |
