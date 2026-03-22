---
id: S73
title: Add activity pagination to Dashboard
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S73 — Add activity pagination to Dashboard

## User story

As a **runner**,
I want to **page through my activity history**
so that **I can see older activities beyond the initial 50**.

## Acceptance criteria

- [x] Rust `get_recent_activities` accepts an `offset` parameter alongside `limit`
- [x] Dashboard shows a "Load More" button below the activity table
- [x] Clicking "Load More" appends the next page of activities
- [x] "Load More" disappears when there are no more activities
- [x] All existing callers of `get_recent_activities` continue to work (pass offset=0)
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes
- [x] `npm run lint` passes with zero errors
- [x] `npx tsc --noEmit` passes

## Technical notes

- Add `offset: u32` parameter to `get_recent_activities` in storage/mod.rs and lib.rs
- SQL: Add `OFFSET ?2` after `LIMIT ?1`
- Frontend: Track page offset, increment by page size (50) on each click
- The context engine call at line ~404 in lib.rs uses `get_recent_activities(10000)` — update to pass offset=0
- Weekly volume chart already uses all loaded activities

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Server-side filtering
- Infinite scroll

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | All acceptance criteria met |
