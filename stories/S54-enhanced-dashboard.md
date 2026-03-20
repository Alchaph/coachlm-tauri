---
id: S54
title: Enhanced dashboard with richer Strava data
status: done
created: 2026-03-20
updated: 2026-03-20
---

# S54 — Enhanced dashboard with richer Strava data

## User story

As a **runner**,
I want to **see detailed training metrics, weekly summaries, and elevation data on my dashboard**
so that **I can monitor my training load, pacing trends, and workout variety at a glance**.

## Acceptance criteria

### Backend — Expanded activity data

- [ ] Add new fields to `ActivityData` model: `elapsed_time`, `total_elevation_gain`, `max_speed`, `workout_type`, `sport_type`, `start_date_local`
- [ ] Add corresponding columns to `activities` table via migration (ALTER TABLE with defaults)
- [ ] Update `parse_activity` in strava/mod.rs to extract new fields from Strava JSON
- [ ] Update `insert_activity` in storage/mod.rs to persist new fields
- [ ] Update `get_recent_activities` and `get_activities_since` to return new fields
- [ ] Add new Tauri command `get_athlete_summary` that returns aggregated stats from `athlete_stats` JSON (recent 4-week totals, YTD, all-time) plus computed weekly stats from activities
- [ ] Add new Tauri command `get_athlete_zones_data` that returns parsed athlete zones
- [ ] All existing tests continue to pass
- [ ] New unit tests for migration, new parse fields, and new commands

### Frontend — Dashboard redesign

- [ ] Summary section: 6 metric cards (Total Activities, Total Distance, Total Elevation, Total Time, Avg Pace, This Week km)
- [ ] Weekly volume bar or sparkline showing last 8 weeks of mileage
- [ ] Activity table expanded with columns: Date, Name, Type badge, Distance, Duration, Pace, Elevation, Avg HR, Max Speed
- [ ] Workout type shown as colored badge (Race, Workout, Long Run, default)
- [ ] Activity type filter (Run, Trail Run, Walk, all)
- [ ] Elapsed vs moving time tooltip or secondary display
- [ ] Empty state and error state preserved
- [ ] Dark theme, inline styles with CSS variables per frontend rules
- [ ] No `console.log`, no `any` types, no floating promises

## Technical notes

### Strava fields available from list endpoint (no extra API calls)

From `GET /api/v3/athlete/activities`:
- `elapsed_time` (integer, seconds) — total time including stops
- `total_elevation_gain` (float, meters)
- `max_speed` (float, m/s)
- `workout_type` (integer) — 0=default, 1=race, 2=long run, 3=workout, 10=default run, 11=race, 12=long run, 13=workout (running subtypes)
- `sport_type` (string) — "Run", "TrailRun", "Walk", etc.
- `start_date_local` (string, ISO 8601)

Not available from Strava API: relative effort/suffer score, perceived exertion, weather, calories (detail-only).

### Athlete stats (already stored as JSON in `athlete_stats` table)

The `athlete_stats` JSON from Strava contains:
- `recent_run_totals` — last 4 weeks: count, distance, moving_time, elapsed_time, elevation_gain
- `ytd_run_totals` — year to date totals
- `all_run_totals` — lifetime totals

These are already fetched during sync but not exposed to the frontend.

### Athlete zones (already stored as JSON in `athlete_zones` table)

HR zones data already fetched, can be displayed as context on dashboard.

### Migration strategy

SQLite `ALTER TABLE ADD COLUMN` for each new field with NULL defaults. Existing rows keep NULL for new fields. New syncs populate them. Re-sync populates via upsert logic update.

### Files to modify

**Rust backend:**
- `src-tauri/src/models.rs` — extend `ActivityData`, add `AthleteSummary` and `AthleteZonesData` structs
- `src-tauri/src/storage/mod.rs` — migration, updated queries, new query methods
- `src-tauri/src/strava/mod.rs` — updated `parse_activity`
- `src-tauri/src/lib.rs` — new Tauri commands, register in handler

**TypeScript frontend:**
- `src/components/Dashboard.tsx` — full redesign

### Workout type mapping (running)

| Value | Label |
|-------|-------|
| 0 / 10 | Run |
| 1 / 11 | Race |
| 2 / 12 | Long Run |
| 3 / 13 | Workout |

### Upsert for re-sync

Current `insert_activity` skips duplicates. Need to add an `update_activity` path: if `strava_id` exists, UPDATE the row with new fields instead of skipping. This lets users re-sync to populate new fields for old activities.

## Tests required

- Unit: `parse_activity` extracts new fields from sample Strava JSON
- Unit: `insert_activity` + `update_activity` persist and update new columns
- Unit: `get_athlete_summary` returns correct aggregated data
- Unit: migration adds columns without breaking existing data
- Integration: full sync flow stores new fields
- TypeScript: `npx tsc --noEmit` and `npm run lint` pass

## Out of scope

- Charts/graphs (future story)
- Route maps
- Per-activity detail view
- Splits (requires detail API calls)
- Calories (detail-only endpoint)
- Power meter data (cycling-focused)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-20 | draft | Created |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
