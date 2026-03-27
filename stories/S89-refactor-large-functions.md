---
id: S89
title: Refactor large Rust functions
status: in-progress
created: 2026-03-27
updated: 2026-03-27
---

# S89 — Refactor large Rust functions

## User story

As a **developer**,
I want large functions broken into smaller, well-named helpers
so that **the codebase is easier to read, maintain, and test**.

## Acceptance criteria

- [ ] `run_migrations` in `storage/mod.rs` (219+ lines) is broken into per-table or per-version helper functions
- [ ] `run_research` in `research/orchestrator.rs` (208+ lines) is broken into logical phases
- [ ] `build_training_summary` in `context/mod.rs` (120+ lines) is broken into smaller helpers
- [ ] No behavioral changes — all existing tests still pass
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes

## Technical notes

### `run_migrations` (storage/mod.rs, line 114)
This function contains all CREATE TABLE statements and ALTER TABLE migrations in one block. Break it into:
- `create_core_tables()` — settings, oauth_tokens, athlete_profile, activities, pinned_insights
- `create_chat_tables()` — chat_sessions, chat_messages
- `create_plan_tables()` — races, training_plans, plan_weeks, plan_sessions
- `run_alter_migrations()` — all ALTER TABLE additions with IF NOT EXISTS checks

### `run_research` (research/orchestrator.rs, line 44)
Break into phases: query planning, search execution, result synthesis, response generation.

### `build_training_summary` (context/mod.rs, line 227)
Break into: data fetching, summary formatting, token budget enforcement.

## Tests required

- All existing 171+ tests pass unchanged
- No new tests required (refactoring, not new behavior)

## Out of scope

- Changing function signatures or return types
- Adding new features
- Modifying the migration strategy (versioned table is S90)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
