---
id: S90
title: Add migration versioning table
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S90 — Add migration versioning table

## User story

As a **developer**,
I want database migrations tracked by version number
so that **migrations run exactly once and new migrations are easy to add**.

## Acceptance criteria

- [ ] A `schema_migrations` table exists with columns: `version INTEGER PRIMARY KEY`, `applied_at TEXT`
- [ ] Each migration has a unique version number
- [ ] `run_migrations` checks which versions have been applied and only runs new ones
- [ ] Existing databases get all current migrations marked as applied (bootstrap)
- [ ] New tables still get created correctly on fresh databases
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes

## Technical notes

### Current state
`run_migrations()` in `storage/mod.rs` uses `CREATE TABLE IF NOT EXISTS` and tries `ALTER TABLE` wrapped in error-swallowing `.ok()` calls. This is fragile — there's no way to know which migrations have actually run.

### Implementation
1. Create `schema_migrations` table in `Database::new()` before calling `run_migrations()`
2. Each migration is a `(version, description, sql)` tuple
3. `run_migrations()` queries `schema_migrations` for applied versions, skips those, runs remaining in order
4. After each migration, insert the version into `schema_migrations`
5. For existing databases: CREATE TABLE IF NOT EXISTS won't fail, so all existing migrations can safely re-run once to seed the version table

### Migration numbering
Start at version 1 for the initial schema. Each subsequent ALTER TABLE or schema change gets the next number.

## Tests required

- Fresh database gets all migrations applied and all versions recorded
- Existing database (with tables already present) bootstraps without errors
- Running migrations twice is idempotent
- New migration added after bootstrap runs only the new one

## Out of scope

- Down migrations (rollback)
- Migration files on disk (keep them inline for now)
- Async migrations

## Dependencies

- Should run AFTER S89 (refactor large functions) since both modify `storage/mod.rs`

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
