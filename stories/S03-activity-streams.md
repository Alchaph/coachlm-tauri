---
id: S03
title: Activity stream ingestion
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S03 — Activity stream ingestion

## User story

As a **runner**,
I want **my detailed activity data (heart rate, pace, cadence) stored locally**
so that **the coaching AI can analyze my training patterns**.

## Acceptance criteria

- [ ] Fetch HR, pace, and cadence streams from Strava API
- [ ] Store per-second data points in SQLite `activity_streams` table
- [ ] Handle activities with missing streams gracefully
- [ ] Map to consistent schema usable by Strava sync and FIT import (S17)
- [ ] Store activity summary metadata in `activities` table
- [ ] Support non-running activity types without crashing
- [ ] Table `activities` includes `activity_id` and `strava_id` columns

## Technical notes

Lives in `src-tauri/src/strava/mod.rs` for fetch and `src-tauri/src/storage/mod.rs` for persistence.
Tables: `activities` (summary) and `activity_streams` (per-second).
Schema maps to same structure as S17 (FIT import).
Depends on S01 (tokens). Streams are fetched during manual sync (S30) or after paginated activity list fetch.

## Tests required

- Unit: `#[cfg(test)]` for stream parsing, schema mapping, missing field handling
- Integration: `cargo test` for fetch → store with mock API
- Edge cases: no HR data, 10+ hour activity, zero-length activity, non-running types

## Out of scope

Activity analysis/statistics, dashboard display (S15), FIT parsing (S17)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Implementation started |
| 2026-03-18 | done | Implemented in Rust/Tauri and all tests passing |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
