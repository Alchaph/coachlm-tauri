---
id: S85
title: Typed error handling with thiserror
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S85 — Typed error handling with thiserror

## User story

As a **developer**,
I want all Tauri commands to return typed errors instead of `Result<T, String>`
so that **error sources are traceable, categories are machine-readable, and internal details are not leaked to the frontend**.

## Acceptance criteria

- [ ] New file `src-tauri/src/error.rs` with `AppError` enum using `#[derive(thiserror::Error, Debug)]`
- [ ] `AppError` variants cover: Database, Serialization, Http, Strava, Llm, Io, Config, NotFound, Fit
- [ ] `AppError` implements `serde::Serialize` so Tauri can send it to the frontend
- [ ] All `#[tauri::command]` functions in `lib.rs` return `Result<T, AppError>` instead of `Result<T, String>`
- [ ] All `.map_err(|e| e.to_string())` chains are replaced with `From` impls or `?` operator
- [ ] Functions in `strava/mod.rs`, `llm/mod.rs`, `plan/mod.rs`, `fit/mod.rs` that return `Result<T, String>` are updated to return `Result<T, AppError>`
- [ ] `cargo clippy -- -D warnings` passes with zero warnings
- [ ] `cargo test` passes (all existing tests)
- [ ] No use of `.to_string()` for error propagation in command handlers

## Technical notes

- `thiserror = "1"` is already in `Cargo.toml` (line 38) but unused
- Tauri v2 requires command return errors to implement `serde::Serialize`. The recommended pattern is a custom `impl Serialize` that serializes as a string (the Display impl) rather than exposing internal structure.
- The `storage/mod.rs` module already uses `rusqlite::Result` internally; `From<rusqlite::Error>` should cover the DB variant.
- Some commands like `get_context_preview` return plain `String` (no Result); these do not need changes.
- `is_first_run` returns `bool` — no change needed.
- `respond_web_search_suggestion` returns `()` — no change needed.

## Tests required

- Rust unit: `AppError` serialization produces expected string
- Rust unit: `From<rusqlite::Error>` conversion works
- Rust unit: existing 155+ tests still pass
- TypeScript: `npx tsc --noEmit` passes (frontend receives string errors unchanged)

## Out of scope

- Changing frontend error handling (still receives string errors via Tauri's invoke error mechanism)
- Adding error codes or structured error responses to the frontend
- Changing storage layer internal error types

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
