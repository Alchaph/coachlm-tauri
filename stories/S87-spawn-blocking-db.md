---
id: S87
title: Wrap synchronous DB calls in spawn_blocking
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S87 — Wrap synchronous DB calls in spawn_blocking

## User story

As a **runner**,
I want database operations to not block the async runtime
so that **the UI stays responsive during heavy database operations and concurrent async tasks are not starved**.

## Acceptance criteria

- [ ] All synchronous `state.db.*` calls inside `async fn` Tauri commands are wrapped in `tokio::task::spawn_blocking`
- [ ] Synchronous (non-async) `fn` commands that are already blocking are left as-is (Tauri runs them on a thread pool)
- [ ] `Arc<Database>` is cloned before moving into `spawn_blocking` closures
- [ ] Error handling through `spawn_blocking` uses `map_err` for the `JoinError`
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes

## Technical notes

### Which commands need changes

Only `async fn` commands that call `state.db.*` need wrapping. Currently these are:

1. `sync_strava_activities` — calls `state.db` indirectly via `strava::sync_activities`
2. `send_message` — calls `state.db.create_chat_session()`, `insert_chat_message()`, `get_settings()`, `get_chat_sessions()`, `get_chat_messages()`
3. `edit_and_resend` — calls `state.db.update_chat_message_content()`, `delete_chat_messages_after()`, `get_settings()`
4. `generate_plan_cmd` — clones `state.db` and uses it in spawned task

### Which commands do NOT need changes

Non-async `fn` commands like `get_settings`, `save_settings`, `get_recent_activities`, etc. are already run on Tauri's blocking thread pool. No wrapping needed.

### Pattern

```rust
// Before:
let settings = state.db.get_settings().map_err(|e| e.to_string())?
    .ok_or("Settings not configured")?;

// After:
let db = state.db.clone();
let settings = tokio::task::spawn_blocking(move || db.get_settings())
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .map_err(AppError::from)?
    .ok_or(AppError::Config("Settings not configured".into()))?;
```

### Dependency

This story depends on S85 (AppError enum) because `spawn_blocking` introduces a new error type (`JoinError`) that needs a variant in `AppError`.

## Tests required

- Rust unit: existing 155+ tests still pass
- TypeScript: `npx tsc --noEmit` passes

## Out of scope

- Making the `Database` struct async internally
- Switching from `rusqlite` to an async SQLite driver
- Wrapping non-async command handlers

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
| 2026-03-27 | in-progress | Implementation started |
| 2026-03-27 | done | All spawn_blocking wrapping complete. clippy clean, 165 tests pass |
