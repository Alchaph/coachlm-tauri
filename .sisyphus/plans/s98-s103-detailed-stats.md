# S98 + S103 — HR Zone Analytics & Activity Pace Distribution

## TL;DR

> **Quick Summary**: Implement per-activity lap data fetching from Strava (lazy-loaded) with pace distribution charts, and HR zone time-in-zone analytics with aggregated weekly/monthly views. Both features add new SQLite tables, Rust models, Tauri commands, recharts-based UI in a new ActivityDetail modal, and enrich the LLM coaching context with pace variance and zone distribution data.
> 
> **Deliverables**:
> - New `activity_laps` and `activity_zone_distribution` SQLite tables (single migration v10)
> - Strava API integration for `/activities/{id}/laps` and `/activities/{id}/zones` (lazy-loaded)
> - `ActivityDetail` modal with pace distribution bar chart and HR zone breakdown (recharts)
> - Aggregated zone analytics panel on Dashboard with 7d/30d/90d/all time presets
> - Context engine enrichment: inline pace variance + zone distribution summary for LLM
> - Rust + TypeScript unit tests, E2E test coverage
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2/3 → Task 5/6 → Task 8 → Task 9/10 → Task 11 → F1-F4

---

## Context

### Original Request
Implement S103 (Activity pace distribution data — fetch Strava laps, store in SQLite, show pace distribution in activity detail view, feed pace variance into LLM context) and S98 (Heart rate zone analytics — time-in-zone per activity and aggregated, zone distribution charts, feed into LLM context).

### Interview Summary
**Key Discussions**:
- **Charting library**: recharts (user's explicit choice; not currently installed)
- **Lap data fetching**: Lazy-load on first activity detail view open (not during bulk sync) to respect Strava rate limits
- **Time range selection**: Preset buttons (7d / 30d / 90d / all time) for zone analytics

**Research Findings**:
- `parse_activity` only extracts list-level fields — no per-activity streams/laps
- `activity_streams` table exists (schema from S03) but is completely unused — no code reads/writes it
- `athlete_zones` stores raw Strava JSON blob, included verbatim in LLM context
- `build_training_summary` formats per-activity avg pace + avg HR only — no variance or zones
- No activity detail view exists — ActivityList rows have no click handlers
- No charting library installed; ActivityChart uses CSS bars
- Strava rate limits: 100 req/15min, 1000/day; existing 429 retry-after pattern in `sync_activities`
- Token budget: ~16,000 chars for context — new blocks must be compact

### Metis Review
**Identified Gaps** (addressed):
- `/activities/{id}/zones` endpoint gives pre-computed time-in-zone — use this instead of computing from HR streams
- Activities without strava_id (FIT imports) cannot fetch from Strava — show graceful "N/A" message
- Single-lap activities: pace variance is meaningless — show "1 lap (entire activity)" label
- Token budget: pace variance inline (+50 chars/activity), zone summary block ≤200 chars
- 403 handling: Strava Premium gating possible for zones endpoint — fallback gracefully
- Concurrent fetches: debounce/cancel when modal closes
- Migration must be version 10 (current is 9), single migration for both tables

---

## Work Objectives

### Core Objective
Add per-activity pace distribution and HR zone time-in-zone analytics to CoachLM, with Strava API lazy-loading, persistent storage, recharts visualization, and LLM context enrichment.

### Concrete Deliverables
- `src-tauri/src/models.rs`: `ActivityLap` and `ActivityZoneDistribution` structs
- `src-tauri/src/storage/mod.rs`: migration v10 (`activity_laps` + `activity_zone_distribution` tables), CRUD functions
- `src-tauri/src/strava/mod.rs`: `fetch_activity_laps()` and `fetch_activity_zones()` with 429/403 handling
- `src-tauri/src/lib.rs`: New Tauri commands registered in `generate_handler![]`
- `src-tauri/src/context/mod.rs`: Inline pace variance in training summary + zone distribution summary block
- `src/components/dashboard/ActivityDetailModal.tsx`: Modal with lap chart + zone chart
- `src/components/dashboard/LapPaceChart.tsx`: recharts bar chart for pace distribution
- `src/components/dashboard/ActivityZoneChart.tsx`: recharts zone breakdown per activity
- `src/components/dashboard/AggregateZonePanel.tsx`: Dashboard panel with preset time range buttons + stacked bar chart
- `src/components/dashboard/ActivityList.tsx`: onClick handler on rows to open detail modal
- Updated story files S98 and S103 marked `done`

### Definition of Done
- [ ] `cargo clippy -- -D warnings` passes with zero warnings
- [ ] `cargo test` passes (all existing + new tests)
- [ ] `npm run lint` passes with zero warnings
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run test` (vitest) passes
- [ ] App builds and runs with `npm run tauri dev`
- [ ] ActivityDetail modal opens on activity row click, shows lap + zone data
- [ ] Zone aggregate panel shows correct data for all time presets
- [ ] LLM context includes pace variance and zone summary when data exists

### Must Have
- Lazy-load laps and zones on ActivityDetail open (NOT during sync)
- Cache fetched data in SQLite — no re-fetch on subsequent opens
- 429 retry-after handling matching existing pattern
- 403 graceful fallback (toast error, show "unavailable" in UI)
- Preset time range buttons (7d / 30d / 90d / all time) for aggregate zones
- Inline pace variance in context training summary (≤50 chars/activity)
- Zone distribution summary block in context (≤200 chars)
- recharts for all new charts
- All new Tauri commands registered in `generate_handler![]`

### Must NOT Have (Guardrails)
- Do NOT fetch laps or zones during `sync_strava_activities` — lazy-load ONLY
- Do NOT add backfill/batch-fetch functionality for existing activities
- Do NOT fetch activity streams (velocity_smooth, heartrate arrays) — only laps and zones endpoints
- Do NOT replace or modify the existing `ActivityChart` CSS bars component
- Do NOT modify the `activity_streams` table (leave for future use)
- Do NOT add pace zones or power zones — HR zones only
- Do NOT add activity comparison features
- Do NOT add activity type filtering to zone analytics (V1 shows all types)
- Do NOT add zoom/pan/drill-down to charts — basic tooltip only
- Do NOT add VO2max estimation or any derived fitness metrics
- Do NOT add map/route display in ActivityDetail
- Do NOT use `as any`, `@ts-ignore`, or `unwrap()` in production paths
- Do NOT suppress lint rules without documented justification

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Rust: `#[cfg(test)]` + tempfile; TypeScript: Vitest + @testing-library; E2E: Playwright)
- **Automated tests**: YES (tests-after — matching existing project patterns)
- **Framework**: Rust: `cargo test`; TypeScript: `vitest`; E2E: `playwright`
- **Run commands**: `cargo clippy -- -D warnings && cargo test` (from src-tauri/), `npm run lint && npx tsc --noEmit && npm run test` (from root)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend (Rust)**: Use Bash — run `cargo test`, `cargo clippy`, verify output
- **Frontend UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **API/Commands**: Use Bash — `cargo test` for Tauri command tests
- **Integration**: Use Playwright + tmux — full app with `npm run tauri dev`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
├── Task 1: Models + Migration + Storage CRUD (both S103 and S98) [deep]
├── Task 2: Install recharts + TypeScript types/interfaces [quick]

Wave 2 (After Wave 1 — Strava API + context engine):
├── Task 3: Strava laps fetch with lazy-load and 429/403 handling (S103) [deep]
├── Task 4: Strava activity zones fetch with lazy-load and 429/403 handling (S98) [deep]
├── Task 5: Context engine: inline pace variance in training summary (S103) [unspecified-high]
├── Task 6: Context engine: zone distribution summary block (S98) [unspecified-high]

Wave 3 (After Wave 2 — Tauri commands + frontend):
├── Task 7: Tauri commands registration + lib.rs wiring [quick]
├── Task 8: ActivityDetail modal + ActivityList click handler [visual-engineering]
├── Task 9: Lap pace distribution chart (recharts) (S103) [visual-engineering]
├── Task 10: Per-activity HR zone chart (recharts) (S98) [visual-engineering]

Wave 4 (After Wave 3 — aggregate panel + tests + finalization):
├── Task 11: Aggregate zone analytics panel with time range presets (S98) [visual-engineering]
├── Task 12: Rust unit tests for all new backend code [unspecified-high]
├── Task 13: Vitest unit tests for all new frontend components [unspecified-high]
├── Task 14: E2E tests + story status updates [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 3, 4, 5, 6, 7, 12 |
| 2 | — | 9, 10, 11 |
| 3 | 1 | 5, 7, 9 |
| 4 | 1 | 6, 7, 10, 11 |
| 5 | 1, 3 | 12 |
| 6 | 1, 4 | 12 |
| 7 | 1, 3, 4 | 8 |
| 8 | 7 | 9, 10, 13 |
| 9 | 2, 3, 8 | 14 |
| 10 | 2, 4, 8 | 11, 14 |
| 11 | 2, 4, 10 | 14 |
| 12 | 1, 3, 4, 5, 6 | 14 |
| 13 | 8, 9, 10, 11 | 14 |
| 14 | 12, 13 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **2 tasks** — T1 → `deep`, T2 → `quick`
- **Wave 2**: **4 tasks** — T3 → `deep`, T4 → `deep`, T5 → `unspecified-high`, T6 → `unspecified-high`
- **Wave 3**: **4 tasks** — T7 → `quick`, T8 → `visual-engineering`, T9 → `visual-engineering`, T10 → `visual-engineering`
- **Wave 4**: **4 tasks** — T11 → `visual-engineering`, T12 → `unspecified-high`, T13 → `unspecified-high`, T14 → `unspecified-high`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Models + Migration + Storage CRUD (S103 + S98 foundation)

  **What to do**:
  - Add `ActivityLap` struct to `src-tauri/src/models.rs` with fields: `id: Option<i64>`, `activity_id: String`, `lap_index: i32`, `distance: f64`, `elapsed_time: i64`, `moving_time: i64`, `average_speed: f64`, `max_speed: Option<f64>`, `average_heartrate: Option<f64>`, `max_heartrate: Option<f64>`, `average_cadence: Option<f64>`, `total_elevation_gain: Option<f64>`. Derive `Serialize, Deserialize, Debug, Clone`.
  - Add `ActivityZoneDistribution` struct to `models.rs`: `activity_id: String`, `zone_index: i32`, `zone_min: i32`, `zone_max: i32`, `time_seconds: i64`. Derive same.
  - Add `ActivityZoneSummary` struct for aggregated zone data returned to frontend: `zone_index: i32`, `zone_min: i32`, `zone_max: i32`, `total_time_seconds: i64`, `percentage: f64`.
  - Add migration function `migration_10_laps_and_zones(conn: &Connection)` in `storage/mod.rs`:
    ```sql
    CREATE TABLE IF NOT EXISTS activity_laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id TEXT NOT NULL REFERENCES activities(activity_id),
      lap_index INTEGER NOT NULL,
      distance REAL NOT NULL,
      elapsed_time INTEGER NOT NULL,
      moving_time INTEGER NOT NULL,
      average_speed REAL NOT NULL,
      max_speed REAL,
      average_heartrate REAL,
      max_heartrate REAL,
      average_cadence REAL,
      total_elevation_gain REAL
    );
    CREATE TABLE IF NOT EXISTS activity_zone_distribution (
      activity_id TEXT NOT NULL REFERENCES activities(activity_id),
      zone_index INTEGER NOT NULL,
      zone_min INTEGER NOT NULL,
      zone_max INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      PRIMARY KEY (activity_id, zone_index)
    );
    ```
  - Register migration as version 10 in the `MIGRATIONS` array.
  - Add storage CRUD functions:
    - `save_activity_laps(activity_id: &str, laps: &[ActivityLap]) -> SqlResult<()>` — DELETE existing laps for activity_id, then INSERT all
    - `get_activity_laps(activity_id: &str) -> SqlResult<Vec<ActivityLap>>`
    - `has_activity_laps(activity_id: &str) -> SqlResult<bool>` — check if laps cached
    - `save_activity_zone_distribution(activity_id: &str, zones: &[ActivityZoneDistribution]) -> SqlResult<()>` — DELETE + INSERT
    - `get_activity_zone_distribution(activity_id: &str) -> SqlResult<Vec<ActivityZoneDistribution>>`
    - `has_activity_zone_distribution(activity_id: &str) -> SqlResult<bool>`
    - `get_aggregated_zone_distribution(days: Option<u32>) -> SqlResult<Vec<ActivityZoneSummary>>` — SQL aggregate across activities, filtered by start_date if days provided, computes total_time_seconds and percentage per zone

  **Must NOT do**:
  - Do NOT modify the `activity_streams` table
  - Do NOT add any columns to the existing `activities` table
  - Do NOT use `unwrap()` — use `?` operator throughout

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Database migration + multiple CRUD functions + model design requires careful SQL and Rust type alignment
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 12
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src-tauri/src/models.rs:94-114` — `ActivityData` struct pattern — follow same derive macros and Option<> patterns for new structs
  - `src-tauri/src/storage/mod.rs:1242-1261` — `migration_06_activity_columns` — follow this pattern for migration_10 function signature and registration
  - `src-tauri/src/storage/mod.rs:320-377` — `insert_activity` — reference for how activities are stored and deduplicated (DELETE + INSERT pattern for laps)
  - `src-tauri/src/storage/mod.rs:646-663` — `save_athlete_zones/get_athlete_zones` — simpler storage pattern to follow for zone distribution CRUD
  - `src-tauri/src/storage/mod.rs:440-471` — `get_activities_since` — reference for date-filtered queries (needed for aggregated zone query)

  **API/Type References**:
  - `src-tauri/src/storage/mod.rs:1058-1140` — `migration_01_core_tables` — shows all CREATE TABLE patterns and the MIGRATIONS array format

  **External References**:
  - Strava API laps response: `GET /activities/{id}/laps` returns array of `{lap_index, distance, elapsed_time, moving_time, average_speed, max_speed, average_heartrate, max_heartrate, average_cadence, total_elevation_gain}`
  - Strava API zones response: `GET /activities/{id}/zones` returns `{distribution_buckets: [{min, max, time}]}`

  **WHY Each Reference Matters**:
  - `models.rs:ActivityData` — Copy derive macros and serde patterns exactly for consistency
  - `migration_06` — Shows how to register a new migration version and add schema changes safely
  - `insert_activity` — Shows the existing row handling pattern; laps will use DELETE+INSERT for simplicity
  - `save_athlete_zones` — Simplest CRUD example to follow for new table functions
  - `get_activities_since` — Shows date-filtered SQL queries needed for aggregated zone distribution

  **Acceptance Criteria**:

  - [ ] `ActivityLap` and `ActivityZoneDistribution` structs defined in `models.rs`
  - [ ] Migration v10 creates both tables when DB is opened
  - [ ] All 7 storage CRUD functions compile and pass unit tests
  - [ ] `cargo clippy -- -D warnings` passes
  - [ ] `cargo test` passes (existing + new tests)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Migration creates activity_laps table
    Tool: Bash
    Preconditions: Fresh temp database (delete test DB if exists)
    Steps:
      1. Run `cargo test test_migration_10 -- --nocapture` in src-tauri/
      2. Verify test output shows table creation without errors
    Expected Result: Test passes, tables created with correct schema
    Failure Indicators: Test failure, SQL error in output
    Evidence: .sisyphus/evidence/task-1-migration-tables.txt

  Scenario: Save and retrieve activity laps round-trip
    Tool: Bash
    Preconditions: Temp database initialized with migrations
    Steps:
      1. Run `cargo test test_save_get_activity_laps -- --nocapture` in src-tauri/
      2. Verify laps are saved and retrieved with matching field values
    Expected Result: Test passes, all lap fields match after round-trip
    Failure Indicators: Field mismatch, empty result
    Evidence: .sisyphus/evidence/task-1-laps-roundtrip.txt

  Scenario: Aggregated zone distribution query
    Tool: Bash
    Preconditions: Temp DB with multiple activities and zone data
    Steps:
      1. Run `cargo test test_aggregated_zone_distribution -- --nocapture` in src-tauri/
      2. Verify aggregation sums time_seconds and computes percentages correctly
    Expected Result: Test passes, percentages sum to ~100%
    Failure Indicators: Incorrect totals, division errors
    Evidence: .sisyphus/evidence/task-1-zone-aggregation.txt

  Scenario: Clippy clean
    Tool: Bash
    Preconditions: All code changes saved
    Steps:
      1. Run `cargo clippy -- -D warnings` from src-tauri/
    Expected Result: Zero warnings, exit code 0
    Failure Indicators: Any warning or error
    Evidence: .sisyphus/evidence/task-1-clippy.txt
  ```

  **Commit**: YES
  - Message: `feat(S103,S98): add activity_laps and zone_distribution models, migration v10, storage CRUD`
  - Files: `src-tauri/src/models.rs`, `src-tauri/src/storage/mod.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 3. Strava laps fetch with lazy-load and 429/403 handling (S103)

  **What to do**:
  - Add `fetch_activity_laps(db: &Database, strava_id: &str, activity_id: &str, token: &str) -> Result<Vec<ActivityLap>, AppError>` to `src-tauri/src/strava/mod.rs`:
    - Call `GET {STRAVA_API_BASE}/activities/{strava_id}/laps` with Bearer token
    - Handle 429 with Retry-After (reuse existing pattern from `sync_activities` lines 204-212)
    - Handle 403 with `AppError::Strava("Activity zones require Strava Premium or are unavailable".into())`
    - Handle empty laps array (some activities have no laps) — return empty Vec
    - Parse JSON response into `Vec<ActivityLap>` using serde
    - Call `db.save_activity_laps(activity_id, &laps)` to cache
    - Return the laps
  - Add Tauri command `get_activity_laps(activity_id: String) -> Result<Vec<ActivityLap>, String>` in `lib.rs`:
    - First check `db.has_activity_laps(&activity_id)` — if cached, return `db.get_activity_laps(&activity_id)`
    - If not cached: look up strava_id from activities table, get valid token, call `fetch_activity_laps`, return result
    - If activity has no strava_id (FIT import), return empty Vec
  - Add `compute_pace_variance(laps: &[ActivityLap]) -> Option<f64>` helper function:
    - Calculate coefficient of variation (CV) of pace across laps: `stddev(pace) / mean(pace) * 100`
    - Return None if laps.len() < 2
    - Pace per lap = `elapsed_time / distance` (seconds per meter, convert as needed)
  - Register `get_activity_laps` in `generate_handler![]` macro in `lib.rs`

  **Must NOT do**:
  - Do NOT call `fetch_activity_laps` during `sync_strava_activities` — lazy-load ONLY
  - Do NOT fetch activity streams (velocity_smooth, heartrate arrays)
  - Do NOT add backfill functionality

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: HTTP API integration with error handling, token management, rate limit retry logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Tasks 5, 7, 9
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src-tauri/src/strava/mod.rs:204-212` — 429 Retry-After handling pattern — copy this exactly for laps fetch
  - `src-tauri/src/strava/mod.rs:192-197` — HTTP GET with Bearer token pattern — reuse for laps endpoint
  - `src-tauri/src/strava/mod.rs:116-150` — `get_valid_token` — call this before API request
  - `src-tauri/src/strava/mod.rs:297-307` — `fetch_athlete_zones` — similar pattern: GET endpoint → save to DB

  **API/Type References**:
  - `src-tauri/src/models.rs` — `ActivityLap` struct (created in Task 1) — this is the return type
  - `src-tauri/src/lib.rs` — `generate_handler![]` macro — where to register new command

  **External References**:
  - Strava API: `GET /activities/{id}/laps` — returns JSON array of lap objects

  **WHY Each Reference Matters**:
  - `sync_activities:204-212` — Exact 429 handling to replicate; reads Retry-After header, sleeps, retries
  - `sync_activities:192-197` — Shows how to construct URL and make authenticated GET request
  - `get_valid_token` — Must call before any Strava API request to ensure token is valid/refreshed
  - `fetch_athlete_zones` — Closest existing pattern to what we're building (fetch single resource → save to DB)

  **Acceptance Criteria**:

  - [ ] `fetch_activity_laps` successfully parses sample Strava laps JSON
  - [ ] 429 responses trigger retry with Retry-After delay
  - [ ] 403 responses return appropriate error
  - [ ] Empty laps response returns empty Vec (not error)
  - [ ] `get_activity_laps` Tauri command checks cache first, fetches if missing
  - [ ] Activities without strava_id return empty Vec
  - [ ] `compute_pace_variance` returns correct CV for sample data
  - [ ] `cargo clippy -- -D warnings` passes
  - [ ] `cargo test` passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Parse Strava laps JSON into ActivityLap structs
    Tool: Bash
    Preconditions: Sample Strava laps JSON fixture created in test
    Steps:
      1. Run `cargo test test_parse_strava_laps -- --nocapture` in src-tauri/
      2. Verify correct field mapping (distance, elapsed_time, avg_hr, etc.)
    Expected Result: All fields parsed correctly, test passes
    Failure Indicators: Serde deserialization error, field mismatch
    Evidence: .sisyphus/evidence/task-3-parse-laps.txt

  Scenario: Pace variance computation
    Tool: Bash
    Preconditions: Test with known lap paces
    Steps:
      1. Run `cargo test test_compute_pace_variance -- --nocapture` in src-tauri/
      2. Verify CV calculation matches expected value
      3. Verify returns None for single-lap or empty input
    Expected Result: CV correct for multi-lap, None for <2 laps
    Failure Indicators: Wrong CV value, panic on edge case
    Evidence: .sisyphus/evidence/task-3-pace-variance.txt

  Scenario: Lazy-load caching — second call reads from DB
    Tool: Bash
    Preconditions: Test with mocked DB
    Steps:
      1. Run `cargo test test_laps_caching -- --nocapture` in src-tauri/
      2. Verify has_activity_laps returns true after first save
      3. Verify second get_activity_laps returns cached data without API call
    Expected Result: Cache hit on second call
    Failure Indicators: Cache miss, duplicate API call
    Evidence: .sisyphus/evidence/task-3-laps-cache.txt
  ```

  **Commit**: YES
  - Message: `feat(S103): add Strava laps fetch with lazy-load and 429/403 retry`
  - Files: `src-tauri/src/strava/mod.rs`, `src-tauri/src/lib.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 4. Strava activity zones fetch with lazy-load and 429/403 handling (S98)

  **What to do**:
  - Add `fetch_activity_zones(db: &Database, strava_id: &str, activity_id: &str, token: &str) -> Result<Vec<ActivityZoneDistribution>, AppError>` to `strava/mod.rs`:
    - Call `GET {STRAVA_API_BASE}/activities/{strava_id}/zones` with Bearer token
    - Handle 429 with Retry-After (same pattern as Task 3)
    - Handle 403 gracefully — some accounts may not have this endpoint available; return `AppError::Strava` with descriptive message
    - Parse response JSON: extract `heart_rate` zone from response, iterate `distribution_buckets` array, map each `{min, max, time}` to `ActivityZoneDistribution`
    - Call `db.save_activity_zone_distribution(activity_id, &zones)` to cache
    - Return zones
  - Add Tauri command `get_activity_zone_distribution(activity_id: String) -> Result<Vec<ActivityZoneDistribution>, String>` in `lib.rs`:
    - Check cache with `db.has_activity_zone_distribution(&activity_id)` first
    - If cached, return from DB
    - If not: look up strava_id, get token, call `fetch_activity_zones`
    - If no strava_id (FIT import), return empty Vec
  - Add Tauri command `get_aggregated_zone_distribution(days: Option<u32>) -> Result<Vec<ActivityZoneSummary>, String>` in `lib.rs`:
    - Calls `db.get_aggregated_zone_distribution(days)` — pure SQL aggregation, no Strava API call
  - Register both commands in `generate_handler![]`

  **Must NOT do**:
  - Do NOT compute zones from HR streams — use Strava's pre-computed zones
  - Do NOT add custom zone editing UI
  - Do NOT call during `sync_strava_activities`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Similar complexity to Task 3 — HTTP API with response parsing and error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6)
  - **Blocks**: Tasks 6, 7, 10, 11
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src-tauri/src/strava/mod.rs:297-307` — `fetch_athlete_zones` — very similar: GET zones endpoint → save to DB; follow this pattern closely
  - `src-tauri/src/strava/mod.rs:204-212` — 429 retry pattern
  - `src-tauri/src/strava/mod.rs:192-197` — Authenticated GET pattern

  **API/Type References**:
  - `src-tauri/src/models.rs` — `ActivityZoneDistribution` and `ActivityZoneSummary` structs (created in Task 1)

  **External References**:
  - Strava API: `GET /activities/{id}/zones` — returns `[{"type":"heartrate","distribution_buckets":[{"min":0,"max":120,"time":600},...]},...]`

  **WHY Each Reference Matters**:
  - `fetch_athlete_zones` — This is the ATHLETE-level zones fetch; Task 4 adds ACTIVITY-level zones fetch. Very similar pattern, different endpoint and storage target.
  - `204-212` — Same 429 retry logic needed
  - `ActivityZoneDistribution` — Maps directly to the `distribution_buckets` items in the API response

  **Acceptance Criteria**:

  - [ ] `fetch_activity_zones` correctly parses Strava zones response with `distribution_buckets`
  - [ ] 429 and 403 handled gracefully
  - [ ] Zone data cached in DB — no re-fetch on subsequent calls
  - [ ] `get_aggregated_zone_distribution(Some(7))` returns correct 7-day aggregate
  - [ ] `get_aggregated_zone_distribution(None)` returns all-time aggregate
  - [ ] Percentages in `ActivityZoneSummary` sum to ~100%
  - [ ] `cargo clippy -- -D warnings` and `cargo test` pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Parse Strava activity zones JSON
    Tool: Bash
    Preconditions: Sample zones JSON fixture
    Steps:
      1. Run `cargo test test_parse_activity_zones -- --nocapture` in src-tauri/
      2. Verify zone_index, zone_min, zone_max, time_seconds mapping
    Expected Result: All zones parsed, correct field values
    Failure Indicators: Wrong zone count, mismatched boundaries
    Evidence: .sisyphus/evidence/task-4-parse-zones.txt

  Scenario: Aggregated zone distribution over 7 days
    Tool: Bash
    Preconditions: Multiple activities with zone data in temp DB
    Steps:
      1. Run `cargo test test_aggregated_zones_7d -- --nocapture` in src-tauri/
      2. Verify only activities from last 7 days are included
      3. Verify percentage calculation sums to ~100%
    Expected Result: Correct aggregation and filtering
    Failure Indicators: Wrong activity count, percentage sum != ~100
    Evidence: .sisyphus/evidence/task-4-zone-aggregation.txt

  Scenario: Empty zones for FIT-imported activity
    Tool: Bash
    Preconditions: Activity without strava_id in DB
    Steps:
      1. Run `cargo test test_zones_no_strava_id -- --nocapture` in src-tauri/
      2. Verify returns empty Vec (not error)
    Expected Result: Empty Vec returned
    Failure Indicators: Error/panic
    Evidence: .sisyphus/evidence/task-4-no-strava-id.txt
  ```

  **Commit**: YES
  - Message: `feat(S98): add Strava activity zones fetch with lazy-load and 429/403 retry`
  - Files: `src-tauri/src/strava/mod.rs`, `src-tauri/src/lib.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 5. Context engine: inline pace variance in training summary (S103)

  **What to do**:
  - In `src-tauri/src/context/mod.rs`, modify `format_this_week_summary` (lines 284-312) to include pace variance when laps are available:
    - After computing per-activity pace line, check if `db.has_activity_laps(&activity.activity_id)` is true
    - If yes, get laps and call `compute_pace_variance(&laps)` (from strava/mod.rs or a shared utility)
    - Append to existing activity line: e.g., ` | CV:12%` (if variance exists)
    - If no laps, omit — existing line unchanged
  - Keep inline addition to ≤50 chars per activity (just the CV percentage)
  - Also apply same logic in `format_last_week_summary` for consistency across all 4 weeks
  - Consider moving `compute_pace_variance` to a shared location (e.g., a `utils.rs` or keep in strava module) if context module needs it

  **Must NOT do**:
  - Do NOT add a separate context block for pace data — inline only
  - Do NOT increase per-activity line length beyond +50 chars
  - Do NOT change the overall structure of build_training_summary

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Targeted modification to existing context formatting logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 3 (needs storage functions + compute_pace_variance)

  **References**:

  **Pattern References**:
  - `src-tauri/src/context/mod.rs:284-312` — `format_this_week_summary` — this is the function to modify; shows how each activity line is formatted with distance, pace, HR
  - `src-tauri/src/context/mod.rs:314-336` — `format_last_week_summary` — similar formatting for older weeks
  - `src-tauri/src/context/mod.rs:227-282` — `build_training_summary` — overall structure; shows how weeks are bucketed

  **API/Type References**:
  - `src-tauri/src/strava/mod.rs` — `compute_pace_variance` function (created in Task 3)
  - `src-tauri/src/storage/mod.rs` — `has_activity_laps`, `get_activity_laps` (created in Task 1)

  **WHY Each Reference Matters**:
  - `format_this_week_summary:284-312` — Exact insertion point; each activity is formatted as a line with metrics, and we append pace CV
  - `format_last_week_summary` — Must apply same pattern for older weeks
  - `compute_pace_variance` — The calculation function to call per activity

  **Acceptance Criteria**:

  - [ ] Activities with laps show pace CV inline (e.g., `| CV:12%`)
  - [ ] Activities without laps show unchanged line (no CV)
  - [ ] Per-activity line increase ≤50 chars
  - [ ] `cargo test` passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Context includes pace variance for activity with laps
    Tool: Bash
    Preconditions: Temp DB with activity + laps data
    Steps:
      1. Run `cargo test test_context_pace_variance -- --nocapture` in src-tauri/
      2. Verify build_training_summary output contains "CV:" for the activity
    Expected Result: Output includes pace CV percentage
    Failure Indicators: CV missing, formatting broken
    Evidence: .sisyphus/evidence/task-5-context-pace.txt

  Scenario: Context omits pace variance when no laps
    Tool: Bash
    Preconditions: Temp DB with activity but no laps
    Steps:
      1. Run `cargo test test_context_no_laps_no_cv -- --nocapture` in src-tauri/
      2. Verify output does NOT contain "CV:"
    Expected Result: Activity line unchanged, no CV
    Failure Indicators: "CV:" appears when it shouldn't
    Evidence: .sisyphus/evidence/task-5-context-no-laps.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(S103,S98): enrich context engine with pace variance and zone summary`
  - Files: `src-tauri/src/context/mod.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 6. Context engine: zone distribution summary block (S98)

  **What to do**:
  - In `context/mod.rs`, add a zone distribution summary block in `build_context` after the training summary section (near line 117):
    - Call `db.get_aggregated_zone_distribution(Some(7))` to get last 7 days of zone data
    - If data exists and is non-empty, format a compact block:
      ```
      ## HR Zone Distribution (Last 7 Days)
      Z1(<120): 30% | Z2(120-150): 40% | Z3(150-165): 20% | Z4(165-180): 8% | Z5(>180): 2%
      ```
    - Use actual zone boundaries from the data (zone_min, zone_max)
    - Keep entire block ≤200 chars
    - If no zone data available, omit the block entirely (don't show empty section)

  **Must NOT do**:
  - Do NOT show all-time zone data in context (7-day window only for relevance)
  - Do NOT exceed 200 chars for the zone block
  - Do NOT modify the athlete_zones raw JSON inclusion (lines 95-97) — keep both

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Targeted context engine modification with formatting constraints
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 4 (needs aggregated zone query + zone data)

  **References**:

  **Pattern References**:
  - `src-tauri/src/context/mod.rs:95-97` — Existing athlete_zones inclusion — new block goes AFTER this, different data
  - `src-tauri/src/context/mod.rs:114-117` — Where training summary is added — zone distribution block goes after this

  **API/Type References**:
  - `src-tauri/src/storage/mod.rs` — `get_aggregated_zone_distribution(days)` (created in Task 1)
  - `src-tauri/src/models.rs` — `ActivityZoneSummary` struct (created in Task 1)

  **WHY Each Reference Matters**:
  - `context/mod.rs:95-97` — Shows how zones JSON is currently included; our block is DIFFERENT (computed distribution, not raw Strava zones)
  - `context/mod.rs:114-117` — Insertion point for new block; goes after training summary, before token truncation

  **Acceptance Criteria**:

  - [ ] Zone summary block appears in context when zone data exists
  - [ ] Block is ≤200 chars
  - [ ] Block omitted when no zone data available
  - [ ] Zone boundaries come from actual data (not hardcoded)
  - [ ] `cargo test` passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Context includes zone distribution summary
    Tool: Bash
    Preconditions: Temp DB with activities + zone distribution data in last 7 days
    Steps:
      1. Run `cargo test test_context_zone_summary -- --nocapture` in src-tauri/
      2. Verify build_context output contains "HR Zone Distribution"
      3. Verify block length ≤200 chars
    Expected Result: Zone block present, correctly formatted, within char limit
    Failure Indicators: Block missing, exceeds 200 chars, wrong percentages
    Evidence: .sisyphus/evidence/task-6-context-zones.txt

  Scenario: No zone block when no data
    Tool: Bash
    Preconditions: Temp DB with activities but no zone distribution data
    Steps:
      1. Run `cargo test test_context_no_zone_data -- --nocapture` in src-tauri/
      2. Verify build_context output does NOT contain "HR Zone Distribution"
    Expected Result: Block absent
    Failure Indicators: Empty or placeholder block appears
    Evidence: .sisyphus/evidence/task-6-no-zone-data.txt
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `feat(S103,S98): enrich context engine with pace variance and zone summary`
  - Files: `src-tauri/src/context/mod.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 2. Install recharts + TypeScript types/interfaces

  **What to do**:
  - Run `npm install recharts` to add recharts as a dependency
  - Add TypeScript interfaces in `src/components/dashboard/types.ts` (or create if not exists):
    - `ActivityLap`: matches Rust `ActivityLap` struct (camelCase field names)
    - `ActivityZoneDistribution`: matches Rust struct
    - `ActivityZoneSummary`: matches Rust struct (for aggregated data)
    - `ActivityDetail`: composite type containing `activity: ActivityItem`, `laps: ActivityLap[]`, `zones: ActivityZoneDistribution[]`
  - Verify recharts imports work with a simple type check

  **Must NOT do**:
  - Do NOT create any chart components yet (just types and install)
  - Do NOT modify existing components

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple npm install + type definition file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 9, 10, 11
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/components/dashboard/ActivityList.tsx` — Check for existing `types.ts` or inline type definitions in dashboard components
  - `src-tauri/src/models.rs:94-114` — `ActivityData` struct — TypeScript interfaces should mirror these Rust structs

  **API/Type References**:
  - `package.json` — Current dependencies list to verify recharts is added correctly

  **External References**:
  - recharts official docs: https://recharts.org/en-US/api

  **WHY Each Reference Matters**:
  - `ActivityList.tsx` — Shows where dashboard types are defined, whether there's an existing types file to extend
  - `models.rs:ActivityData` — TypeScript interfaces must match Rust struct fields for invoke() JSON serialization

  **Acceptance Criteria**:

  - [ ] `recharts` appears in `package.json` dependencies
  - [ ] TypeScript interfaces defined and importable
  - [ ] `npx tsc --noEmit` passes
  - [ ] `npm run lint` passes

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: recharts installed and importable
    Tool: Bash
    Preconditions: npm install completed
    Steps:
      1. Run `npx tsc --noEmit` from project root
      2. Check that `node_modules/recharts` exists
      3. Run `npm run lint`
    Expected Result: No type errors, recharts in node_modules, lint passes
    Failure Indicators: Import resolution errors, missing dependency
    Evidence: .sisyphus/evidence/task-2-recharts-install.txt

  Scenario: TypeScript interfaces compile
    Tool: Bash
    Preconditions: Interfaces file written
    Steps:
      1. Run `npx tsc --noEmit`
      2. Verify no errors related to new types file
    Expected Result: Zero type errors
    Failure Indicators: Type error in new file
    Evidence: .sisyphus/evidence/task-2-types-check.txt
  ```

  **Commit**: YES (groups with Task 9)
  - Message: `feat(S103,S98): install recharts and add TypeScript interfaces for laps and zones`
  - Files: `package.json`, `package-lock.json`, `src/components/dashboard/types.ts`
  - Pre-commit: `npm run lint && npx tsc --noEmit`

- [x] 7. Tauri commands registration + lib.rs wiring

  **What to do**:
  - Verify all new Tauri commands from Tasks 3 and 4 are registered in `generate_handler![]` in `src-tauri/src/lib.rs`:
    - `get_activity_laps`
    - `get_activity_zone_distribution`
    - `get_aggregated_zone_distribution`
  - Each command should:
    - Accept `State<AppState>` to access the database
    - Use `spawn_blocking` for DB operations (matching existing pattern in lib.rs)
    - Map errors to String with `map_err(|e| e.to_string())`
  - Verify the commands are callable from frontend (compile check)

  **Must NOT do**:
  - Do NOT add commands that trigger Strava API calls during sync

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward command registration following existing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 3, 4

  **References**:

  **Pattern References**:
  - `src-tauri/src/lib.rs` — `generate_handler![]` macro and existing command definitions — follow exact pattern for new commands
  - `src-tauri/src/lib.rs` — Existing Tauri commands like `get_recent_activities`, `get_activity_stats` — follow their function signature pattern

  **WHY Each Reference Matters**:
  - `generate_handler![]` — All commands MUST be registered here or they won't be callable from frontend
  - Existing commands — Show the exact function signature pattern: `#[tauri::command]`, State access, spawn_blocking, error mapping

  **Acceptance Criteria**:

  - [ ] All 3 commands registered in `generate_handler![]`
  - [ ] `cargo clippy -- -D warnings` passes
  - [ ] `cargo test` passes
  - [ ] Commands are invocable (compilation succeeds)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Commands compile and register
    Tool: Bash
    Preconditions: Tasks 3, 4 completed
    Steps:
      1. Run `cargo clippy -- -D warnings` from src-tauri/
      2. Run `cargo test` from src-tauri/
    Expected Result: Zero warnings, all tests pass
    Failure Indicators: Compilation error, missing command registration
    Evidence: .sisyphus/evidence/task-7-commands-compile.txt
  ```

  **Commit**: YES (groups with Tasks 3/4 if not already committed)
  - Message: `feat(S103,S98): register activity laps and zone Tauri commands`
  - Files: `src-tauri/src/lib.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 8. ActivityDetail modal + ActivityList click handler

  **What to do**:
  - Create `src/components/dashboard/ActivityDetailModal.tsx`:
    - Use `Dialog` from `@/components/ui/dialog` (follow Context.tsx Dialog pattern lines 345-356)
    - Props: `activity: ActivityItem | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`
    - When open and activity is set:
      - Fetch laps: `invoke<ActivityLap[]>("get_activity_laps", { activityId: activity.activity_id })`
      - Fetch zones: `invoke<ActivityZoneDistribution[]>("get_activity_zone_distribution", { activityId: activity.activity_id })`
      - Use `Promise.all` for parallel fetch (matching Dashboard.tsx loadData pattern)
    - Show `Skeleton` components while loading (matching StatsCards.tsx skeleton pattern)
    - Show error toast on fetch failure (using sonner `toast.error()`)
    - Show activity summary header (name, date, distance, duration)
    - Render `LapPaceChart` component (Task 9) with laps data
    - Render `ActivityZoneChart` component (Task 10) with zones data
    - If laps is empty, show "No lap data available" message in a muted text Card
    - If zones is empty, show "No heart rate zone data available" message
    - If activity has no strava_id, show "Detailed data available for Strava-synced activities only"
  - Modify `src/components/dashboard/ActivityList.tsx`:
    - Add `onActivityClick: (activity: ActivityItem) => void` prop
    - Add `onClick={() => onActivityClick(activity)}` to each `TableRow` (near lines 149-166)
    - Add `cursor-pointer hover:bg-muted/50` classes to TableRow for visual affordance
  - Wire up in parent Dashboard component (`src/components/dashboard/index.tsx` or `Dashboard.tsx`):
    - Add `selectedActivity` state and `detailOpen` state
    - Pass `onActivityClick` to ActivityList that sets selectedActivity and opens modal
    - Render `ActivityDetailModal` with props

  **Must NOT do**:
  - Do NOT implement the actual chart components (Tasks 9, 10)
  - Do NOT add any navigation or routing — modal only
  - Do NOT fetch laps/zones during sync
  - Do NOT add activity comparison

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Modal UI component with loading states, error handling, responsive layout
  - **Skills**: [`playwright`]
    - `playwright`: For verifying modal opens/closes correctly in browser

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9, 10)
  - **Blocks**: Tasks 9, 10, 13
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `src/components/Context.tsx:345-356` — Dialog usage pattern — follow this for modal structure
  - `src/components/dashboard/StatsCards.tsx:27-40` — Skeleton loading pattern — follow for loading state
  - `src/components/Dashboard.tsx:156-176` — Promise.all invoke pattern with try/catch and error handling
  - `src/components/dashboard/ActivityList.tsx:149-166` — TableRow rendering — add onClick here

  **API/Type References**:
  - `src/components/dashboard/types.ts` — `ActivityLap`, `ActivityZoneDistribution`, `ActivityItem` types (Task 2)
  - `src/components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription

  **External References**:
  - shadcn Dialog: https://ui.shadcn.com/docs/components/dialog

  **WHY Each Reference Matters**:
  - `Context.tsx:345-356` — Shows exactly how Dialog is used in this project; import pattern, props, content structure
  - `StatsCards.tsx:27-40` — Shows skeleton loading pattern to follow while data fetches
  - `Dashboard.tsx:156-176` — Shows Promise.all + try/catch pattern for parallel data fetching via invoke
  - `ActivityList.tsx:149-166` — Exact line where onClick needs to be added to TableRow

  **Acceptance Criteria**:

  - [ ] Clicking an activity row opens the ActivityDetail modal
  - [ ] Modal shows activity summary (name, date, distance, duration)
  - [ ] Skeleton loading shown while data fetches
  - [ ] Error toast on fetch failure
  - [ ] "No lap data" message when laps array is empty
  - [ ] "No HR zone data" message when zones array is empty
  - [ ] Modal closes cleanly (click outside, X button, escape)
  - [ ] `npm run lint && npx tsc --noEmit` pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Activity row click opens detail modal
    Tool: Playwright
    Preconditions: App running with mocked activities data
    Steps:
      1. Navigate to Dashboard
      2. Wait for activity list to render (selector: table tbody tr)
      3. Click first activity row
      4. Wait for dialog to appear (selector: [role="dialog"])
      5. Assert dialog contains activity name text
    Expected Result: Dialog visible with activity details
    Failure Indicators: No dialog appears, wrong activity shown
    Evidence: .sisyphus/evidence/task-8-modal-opens.png

  Scenario: Modal shows loading skeleton then content
    Tool: Playwright
    Preconditions: App running, mock invoke to delay response by 500ms
    Steps:
      1. Click activity row
      2. Assert skeleton elements visible initially (selector: .animate-pulse or [data-slot="skeleton"])
      3. Wait for skeleton to disappear
      4. Assert content appears
    Expected Result: Skeleton → Content transition
    Failure Indicators: No skeleton shown, immediate content without loading
    Evidence: .sisyphus/evidence/task-8-modal-loading.png

  Scenario: Modal shows "no data" for activity without laps
    Tool: Playwright
    Preconditions: Mock get_activity_laps to return empty array
    Steps:
      1. Click activity row
      2. Wait for dialog content
      3. Assert text "No lap data available" is visible
    Expected Result: Empty state message shown
    Failure Indicators: Empty chart area, error, or crash
    Evidence: .sisyphus/evidence/task-8-no-laps-message.png

  Scenario: Modal closes on escape key
    Tool: Playwright
    Preconditions: Modal is open
    Steps:
      1. Press Escape key
      2. Assert dialog is no longer visible
    Expected Result: Dialog closes
    Failure Indicators: Dialog remains open
    Evidence: .sisyphus/evidence/task-8-modal-close.png
  ```

  **Commit**: YES
  - Message: `feat(S103,S98): add ActivityDetail modal with click handler and loading states`
  - Files: `src/components/dashboard/ActivityDetailModal.tsx`, `src/components/dashboard/ActivityList.tsx`, `src/components/dashboard/index.tsx`
  - Pre-commit: `npm run lint && npx tsc --noEmit`

- [x] 9. Lap pace distribution chart (recharts) (S103)

  **What to do**:
  - Create `src/components/dashboard/LapPaceChart.tsx`:
    - Props: `laps: ActivityLap[]`
    - If `laps.length === 0`, render nothing (parent handles empty state)
    - If `laps.length === 1`, show a simple Card with text: "1 lap (entire activity) — Avg pace: X:XX /km"
    - If `laps.length >= 2`:
      - Transform laps to chart data: `{ lapIndex: number, paceMinPerKm: number, distanceKm: number, avgHr: number | null }`
      - Pace calculated as: `elapsed_time / distance * 1000 / 60` (min/km)
      - Use recharts `BarChart` with `Bar` for pace per lap
      - X-axis: lap index (1, 2, 3...)
      - Y-axis: pace (min/km) — INVERTED (lower = faster, shown higher on chart) using `reversed` domain
      - Tooltip showing: Lap N, Pace X:XX /km, Distance X.XX km, HR: XXX
      - Bar color: use CSS variable `hsl(var(--chart-1))` or similar theming variable
    - Show pace variance (CV%) as a subtitle below the chart title
    - Use `ResponsiveContainer` for responsive sizing
    - Wrap in a Card with title "Pace Distribution"
  - Style with Tailwind utilities, matching existing dashboard component styling

  **Must NOT do**:
  - Do NOT add zoom/pan/drill-down interactions
  - Do NOT add comparison between activities
  - Do NOT replace existing ActivityChart component

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Chart component with recharts, responsive design, theme integration
  - **Skills**: [`playwright`]
    - `playwright`: For visual verification of chart rendering

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 10)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 3, 8 (needs recharts + laps types + modal shell)

  **References**:

  **Pattern References**:
  - `src/components/dashboard/ActivityChart.tsx` — Existing chart-like component (CSS bars) — follow Card wrapping and heading style, do NOT modify
  - `src/components/dashboard/StatsCards.tsx` — Card + CardContent import pattern

  **API/Type References**:
  - `src/components/dashboard/types.ts` — `ActivityLap` interface (Task 2)

  **External References**:
  - recharts BarChart: https://recharts.org/en-US/api/BarChart
  - recharts ResponsiveContainer: https://recharts.org/en-US/api/ResponsiveContainer

  **WHY Each Reference Matters**:
  - `ActivityChart.tsx` — Shows the project's visual style for chart-like cards; match heading/spacing/colors
  - `types.ts:ActivityLap` — The data shape driving the chart

  **Acceptance Criteria**:

  - [ ] Multi-lap activities show bar chart with correct pace values
  - [ ] Single-lap activities show text-only display
  - [ ] Tooltip shows lap details on hover
  - [ ] Chart uses project theme colors (CSS variables)
  - [ ] `npm run lint && npx tsc --noEmit` pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Bar chart renders for multi-lap activity
    Tool: Playwright
    Preconditions: Mock get_activity_laps returns 5 laps with varied paces
    Steps:
      1. Open ActivityDetail for a multi-lap activity
      2. Wait for chart container to render (selector: .recharts-wrapper or [data-testid="lap-chart"])
      3. Assert 5 bar elements visible (selector: .recharts-bar-rectangle)
      4. Take screenshot
    Expected Result: Bar chart with 5 bars of varying heights
    Failure Indicators: No chart, wrong number of bars, rendering error
    Evidence: .sisyphus/evidence/task-9-lap-chart.png

  Scenario: Single-lap activity shows text
    Tool: Playwright
    Preconditions: Mock get_activity_laps returns 1 lap
    Steps:
      1. Open ActivityDetail for single-lap activity
      2. Assert text "1 lap (entire activity)" visible
      3. Assert no bar chart rendered
    Expected Result: Text display, no chart
    Failure Indicators: Chart renders with single bar
    Evidence: .sisyphus/evidence/task-9-single-lap.png
  ```

  **Commit**: YES
  - Message: `feat(S103): add lap pace distribution chart with recharts`
  - Files: `src/components/dashboard/LapPaceChart.tsx`, `src/components/dashboard/ActivityDetailModal.tsx`
  - Pre-commit: `npm run lint && npx tsc --noEmit`

- [x] 10. Per-activity HR zone chart (recharts) (S98)

  **What to do**:
  - Create `src/components/dashboard/ActivityZoneChart.tsx`:
    - Props: `zones: ActivityZoneDistribution[]`
    - If `zones.length === 0`, render nothing (parent handles empty state)
    - Transform zones to chart data: `{ zoneName: string, timeMinutes: number, percentage: number, fill: string }`
      - `zoneName`: "Z1", "Z2", ... "Z5"
      - `timeMinutes`: `time_seconds / 60`
      - `percentage`: computed from total time
      - `fill`: zone-specific color (Z1=green → Z5=red gradient, using CSS variables if available)
    - Use recharts `BarChart` with horizontal bars (layout="vertical") OR a `PieChart` showing zone percentages
      - Recommended: Horizontal stacked bar for compactness
    - Show time in each zone (mm:ss format) and percentage in tooltip
    - Wrap in Card with title "Heart Rate Zones"
    - Show zone boundaries in legend: "Z1 (0-120 bpm)", "Z2 (120-150 bpm)", etc.
  - Integrate into `ActivityDetailModal.tsx` below the LapPaceChart

  **Must NOT do**:
  - Do NOT add pace zones or power zones
  - Do NOT add custom zone editing
  - Do NOT add real-time HR monitoring features

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Chart component with zone-specific coloring and data transformation
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 9)
  - **Blocks**: Tasks 11, 14
  - **Blocked By**: Tasks 2, 4, 8 (needs recharts + zones types + modal shell)

  **References**:

  **Pattern References**:
  - `src/components/dashboard/LapPaceChart.tsx` — (Task 9) — Follow same Card wrapping, responsive container pattern
  - `src/components/dashboard/StatsCards.tsx` — Card layout pattern

  **API/Type References**:
  - `src/components/dashboard/types.ts` — `ActivityZoneDistribution` interface (Task 2)

  **External References**:
  - recharts BarChart (vertical layout): https://recharts.org/en-US/api/BarChart

  **WHY Each Reference Matters**:
  - `LapPaceChart.tsx` — Sister component; match visual style for consistency
  - `types.ts:ActivityZoneDistribution` — Data shape driving the chart

  **Acceptance Criteria**:

  - [ ] Zone chart shows time-in-zone for each HR zone with colors
  - [ ] Zone boundaries displayed in legend
  - [ ] Tooltip shows time (mm:ss) and percentage
  - [ ] Colors follow Z1=green → Z5=red gradient
  - [ ] `npm run lint && npx tsc --noEmit` pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Zone chart renders with 5 zones
    Tool: Playwright
    Preconditions: Mock get_activity_zone_distribution returns 5 zones
    Steps:
      1. Open ActivityDetail for an activity with zone data
      2. Wait for zone chart to render (selector: [data-testid="zone-chart"] or .recharts-wrapper)
      3. Assert 5 zone segments/bars visible
      4. Take screenshot
    Expected Result: Chart with 5 color-coded zones
    Failure Indicators: Wrong zone count, missing colors, rendering error
    Evidence: .sisyphus/evidence/task-10-zone-chart.png

  Scenario: No zone chart when zones empty
    Tool: Playwright
    Preconditions: Mock returns empty zones array
    Steps:
      1. Open ActivityDetail
      2. Assert "No heart rate zone data" message visible
      3. Assert no zone chart rendered
    Expected Result: Empty state message, no chart
    Failure Indicators: Empty chart or crash
    Evidence: .sisyphus/evidence/task-10-no-zones.png
  ```

  **Commit**: YES
  - Message: `feat(S98): add per-activity HR zone chart with recharts`
  - Files: `src/components/dashboard/ActivityZoneChart.tsx`, `src/components/dashboard/ActivityDetailModal.tsx`
  - Pre-commit: `npm run lint && npx tsc --noEmit`

- [x] 11. Aggregate zone analytics panel with time range presets (S98)

  **What to do**:
  - Create `src/components/dashboard/AggregateZonePanel.tsx`:
    - Standalone panel/Card for the Dashboard (not inside ActivityDetail modal)
    - Title: "HR Zone Distribution"
    - Time range preset buttons: "7 Days", "30 Days", "90 Days", "All Time"
      - Default selection: "30 Days"
      - Use shadcn Button components with variant="outline" for unselected, variant="default" for selected
      - On button click: call `invoke<ActivityZoneSummary[]>("get_aggregated_zone_distribution", { days: N })` where N = 7/30/90/null
    - Display aggregated zone data as a recharts horizontal stacked bar or grouped bar chart
      - Each zone shows: zone label (Z1-Z5), percentage, total time
      - Colors: Z1=green → Z5=red gradient (same colors as per-activity chart)
    - Show Skeleton while loading
    - If no zone data for selected range, show "No heart rate zone data for this period"
    - Show total training time across all zones below the chart
  - Integrate into Dashboard layout:
    - Add `AggregateZonePanel` to `src/components/dashboard/index.tsx` (or Dashboard.tsx)
    - Position: below the StatsCards, above or beside the ActivityList
    - Only show when the panel has been loaded (don't show skeleton on initial Dashboard load — load on demand or with a small delay)

  **Must NOT do**:
  - Do NOT add activity type filtering
  - Do NOT add trend arrows or moving averages
  - Do NOT add comparison between time periods

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dashboard panel with interactive buttons, chart rendering, responsive layout
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 13, 14)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 4, 10 (needs recharts + zone data + zone chart patterns)

  **References**:

  **Pattern References**:
  - `src/components/dashboard/StatsCards.tsx` — Card layout and skeleton pattern to match
  - `src/components/dashboard/ActivityChart.tsx` — Dashboard chart section positioning
  - `src/components/dashboard/index.tsx:185-206` — Where to add new panel in Dashboard layout
  - `src/components/dashboard/ActivityZoneChart.tsx` — (Task 10) Zone color scheme to reuse

  **API/Type References**:
  - `src/components/dashboard/types.ts` — `ActivityZoneSummary` interface (Task 2)
  - `src/components/ui/button.tsx` — Button component for preset buttons

  **WHY Each Reference Matters**:
  - `StatsCards.tsx` — Visual consistency — match Card styling, spacing, skeleton pattern
  - `ActivityChart.tsx` — Shows where chart sections are positioned relative to other dashboard elements
  - `dashboard/index.tsx:185-206` — Exact location in JSX tree where new panel should be inserted
  - `ActivityZoneChart.tsx` — Zone color palette must be consistent between per-activity and aggregate views

  **Acceptance Criteria**:

  - [ ] Panel renders on Dashboard with 4 preset buttons
  - [ ] Clicking a preset triggers backend query and updates chart
  - [ ] Zone chart shows correct aggregated data
  - [ ] "30 Days" is default selection
  - [ ] Empty state message for no data
  - [ ] Total training time displayed
  - [ ] `npm run lint && npx tsc --noEmit` pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Aggregate panel renders with default 30-day data
    Tool: Playwright
    Preconditions: App running with mocked zone distribution data
    Steps:
      1. Navigate to Dashboard
      2. Wait for aggregate zone panel (selector: [data-testid="aggregate-zone-panel"])
      3. Assert "30 Days" button has active styling
      4. Assert chart shows zone bars
      5. Take screenshot
    Expected Result: Panel visible, 30-day button active, chart rendered
    Failure Indicators: Panel missing, wrong default, empty chart
    Evidence: .sisyphus/evidence/task-11-aggregate-default.png

  Scenario: Switching time range updates chart
    Tool: Playwright
    Preconditions: Panel is rendered with 30-day data
    Steps:
      1. Click "7 Days" button
      2. Wait for chart to update (loading skeleton may flash)
      3. Assert "7 Days" button now has active styling
      4. Assert chart data has changed (or shows empty state if no data)
    Expected Result: Chart updates to 7-day aggregation
    Failure Indicators: Chart doesn't update, button styling doesn't change
    Evidence: .sisyphus/evidence/task-11-range-switch.png

  Scenario: Empty state for time range with no data
    Tool: Playwright
    Preconditions: Mock returns empty data for 7-day range
    Steps:
      1. Click "7 Days" button
      2. Assert "No heart rate zone data for this period" message visible
    Expected Result: Empty state message shown
    Failure Indicators: Empty chart renders instead of message
    Evidence: .sisyphus/evidence/task-11-empty-range.png
  ```

  **Commit**: YES
  - Message: `feat(S98): add aggregate zone analytics panel with time range presets`
  - Files: `src/components/dashboard/AggregateZonePanel.tsx`, `src/components/dashboard/index.tsx`
  - Pre-commit: `npm run lint && npx tsc --noEmit`

- [x] 12. Rust unit tests for all new backend code

  **What to do**:
  - Add comprehensive unit tests in the relevant `#[cfg(test)]` modules:
  - **storage/mod.rs tests**:
    - `test_migration_10_creates_tables` — verify activity_laps and activity_zone_distribution tables exist after migration
    - `test_save_get_activity_laps` — round-trip: save 3 laps → get → verify all fields
    - `test_save_activity_laps_replaces` — save laps → save again → verify only latest set exists
    - `test_has_activity_laps_true_false` — has_activity_laps returns correct bool
    - `test_save_get_zone_distribution` — round-trip for zone data
    - `test_has_zone_distribution` — correct bool
    - `test_aggregated_zone_distribution_days_filter` — insert activities with different dates, verify 7-day filter excludes old ones
    - `test_aggregated_zone_distribution_all_time` — None parameter includes everything
    - `test_aggregated_zone_percentages_sum` — verify percentages sum to ~100%
  - **strava/mod.rs tests**:
    - `test_parse_strava_laps_json` — sample JSON → Vec<ActivityLap> with correct mapping
    - `test_parse_strava_laps_empty` — empty array returns empty Vec
    - `test_parse_strava_zones_json` — sample zones JSON → Vec<ActivityZoneDistribution>
    - `test_parse_strava_zones_no_heartrate` — zones response without heart_rate key handled
    - `test_compute_pace_variance_multi_lap` — known lap paces → correct CV%
    - `test_compute_pace_variance_single_lap` — returns None
    - `test_compute_pace_variance_empty` — returns None
  - **context/mod.rs tests**:
    - `test_context_includes_pace_variance` — build_context with laps → output contains "CV:"
    - `test_context_excludes_pace_variance_no_laps` — without laps → no "CV:"
    - `test_context_includes_zone_summary` — with zone data → output contains "HR Zone Distribution"
    - `test_context_zone_summary_under_200_chars` — verify block length
    - `test_context_no_zone_summary_without_data` — without data → no zone block
  - Follow existing test patterns: temp DB setup, assert_eq!/assert!, synchronous `#[test]` for DB, `#[tokio::test]` where async needed

  **Must NOT do**:
  - Do NOT add HTTP mocking infrastructure (keep existing test style)
  - Do NOT test Strava API calls directly (test parsing + storage only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive test suite across 3 modules
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 13, 14)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 1, 3, 4, 5, 6 (all backend tasks)

  **References**:

  **Pattern References**:
  - `src-tauri/src/storage/mod.rs` — Existing `#[cfg(test)]` module with temp DB pattern — follow exactly
  - `src-tauri/src/strava/mod.rs` — Existing `test_extract_code_from_request` tests — follow pattern
  - `src-tauri/src/context/mod.rs` — Existing tests if any; otherwise follow storage test pattern with temp DB

  **WHY Each Reference Matters**:
  - `storage/mod.rs tests` — Shows temp DB creation, assertion patterns, and how to test CRUD operations
  - `strava/mod.rs tests` — Shows how pure parsing functions are tested without HTTP

  **Acceptance Criteria**:

  - [ ] All listed tests exist and pass
  - [ ] `cargo test` from src-tauri/ shows all new tests passing
  - [ ] `cargo clippy -- -D warnings` passes
  - [ ] No existing tests broken

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All Rust tests pass
    Tool: Bash
    Preconditions: All backend tasks completed
    Steps:
      1. Run `cargo test` from src-tauri/ with full output
      2. Count passed/failed
    Expected Result: All tests pass, 0 failures
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-12-rust-tests.txt

  Scenario: Clippy clean after test additions
    Tool: Bash
    Preconditions: Test code written
    Steps:
      1. Run `cargo clippy -- -D warnings` from src-tauri/
    Expected Result: Zero warnings
    Failure Indicators: Test code introduces warnings
    Evidence: .sisyphus/evidence/task-12-clippy.txt
  ```

  **Commit**: YES
  - Message: `test(S103,S98): add Rust unit tests for laps, zones, and context`
  - Files: `src-tauri/src/storage/mod.rs`, `src-tauri/src/strava/mod.rs`, `src-tauri/src/context/mod.rs`
  - Pre-commit: `cd src-tauri && cargo test && cargo clippy -- -D warnings`

- [x] 13. Vitest unit tests for all new frontend components

  **What to do**:
  - Add Vitest tests in `src/test/`:
  - **ActivityDetailModal.test.tsx**:
    - Test: modal opens when `open=true` and activity is provided
    - Test: modal shows loading skeletons initially
    - Test: modal renders activity name/date/distance after data loads
    - Test: modal shows "No lap data available" when laps empty
    - Test: modal shows "No heart rate zone data available" when zones empty
    - Test: modal shows "Detailed data available for Strava-synced activities only" when no strava_id
    - Mock `invoke("get_activity_laps")` and `invoke("get_activity_zone_distribution")` using existing vi.mock pattern
  - **AggregateZonePanel.test.tsx**:
    - Test: panel renders with default "30 Days" selected
    - Test: clicking "7 Days" calls invoke with `{ days: 7 }`
    - Test: clicking "All Time" calls invoke with `{ days: null }`
    - Test: empty state message when no data
    - Mock `invoke("get_aggregated_zone_distribution")`
  - **ActivityList click handler test**:
    - Test: clicking row calls `onActivityClick` with correct activity
  - Follow existing test patterns from `Chat.test.tsx` and `Settings.test.tsx` for invoke mocking and @testing-library usage

  **Must NOT do**:
  - Do NOT test recharts rendering internals (test data flow and state, not SVG details)
  - Do NOT add snapshot tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test files across components
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12, 14)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 8, 9, 10, 11 (all frontend components)

  **References**:

  **Pattern References**:
  - `src/test/Chat.test.tsx` — invoke mocking pattern, event listener mocking, @testing-library assertions
  - `src/test/Settings.test.tsx` — Component rendering and interaction testing pattern
  - `src/test/setup.ts` — Global mock setup for Tauri invoke/listen

  **WHY Each Reference Matters**:
  - `Chat.test.tsx` — Shows how to mock multiple invoke commands per test and assert on DOM state
  - `Settings.test.tsx` — Shows click interaction testing with mocked backend
  - `setup.ts` — Baseline mocks that tests inherit; may need to add new command defaults

  **Acceptance Criteria**:

  - [ ] All listed Vitest tests pass
  - [ ] `npm run test` shows new tests passing
  - [ ] `npm run lint` passes
  - [ ] No existing tests broken

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All Vitest tests pass
    Tool: Bash
    Preconditions: All frontend components completed
    Steps:
      1. Run `npm run test` from project root
      2. Verify output shows all tests passing
    Expected Result: All tests pass, 0 failures
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-13-vitest.txt

  Scenario: Lint passes with test files
    Tool: Bash
    Preconditions: Test files written
    Steps:
      1. Run `npm run lint`
    Expected Result: Zero warnings/errors
    Failure Indicators: Lint errors in test files
    Evidence: .sisyphus/evidence/task-13-lint.txt
  ```

  **Commit**: YES (groups with Task 14)
  - Message: `test(S103,S98): add Vitest tests for modal, charts, and aggregate panel`
  - Files: `src/test/ActivityDetailModal.test.tsx`, `src/test/AggregateZonePanel.test.tsx`, `src/test/setup.ts`
  - Pre-commit: `npm run lint && npx tsc --noEmit && npm run test`

- [x] 14. E2E tests + story status updates

  **What to do**:
  - Add or extend Playwright E2E tests in `e2e/`:
  - **dashboard.spec.ts** (extend existing):
    - Test: click activity row → ActivityDetail modal opens with correct activity name
    - Test: ActivityDetail shows lap chart area (even with mocked data)
    - Test: ActivityDetail shows zone chart area (even with mocked data)
    - Test: ActivityDetail closes on escape/clicking outside
    - Test: Aggregate zone panel visible on Dashboard with time range buttons
    - Test: clicking different time range button updates panel
  - Update `e2e/tauri-mock.ts`:
    - Add default mock responses for new commands: `get_activity_laps`, `get_activity_zone_distribution`, `get_aggregated_zone_distribution`
    - Include realistic sample data (3-5 laps, 5 zones)
  - Update story files:
    - `stories/S103-activity-pace-data.md`: Set `status: done`, update status history table
    - `stories/S98-heart-rate-zone-analytics.md`: Set `status: done`, update status history table
  - Run full test suite: `npm run e2e` and `cargo test` and `npm run test`

  **Must NOT do**:
  - Do NOT test with real Strava API — use tauri-mock only
  - Do NOT skip updating story statuses

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: E2E test orchestration + story file management
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (runs after Tasks 12, 13 complete)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 12, 13 (all tests must pass first)

  **References**:

  **Pattern References**:
  - `e2e/dashboard.spec.ts` — Existing Dashboard E2E test — extend with new test cases
  - `e2e/tauri-mock.ts` — DEFAULT_MOCK_RESPONSES — add new command mocks here
  - `stories/S103-activity-pace-data.md` — Story file to update status
  - `stories/S98-heart-rate-zone-analytics.md` — Story file to update status

  **WHY Each Reference Matters**:
  - `dashboard.spec.ts` — Existing E2E patterns for Dashboard; extend rather than create new file
  - `tauri-mock.ts` — ALL new Tauri commands must have mock responses here for E2E to work
  - Story files — AGENTS.md requires story status updates; both must be set to `done`

  **Acceptance Criteria**:

  - [ ] All new E2E tests pass with `npm run e2e`
  - [ ] Existing E2E tests not broken
  - [ ] tauri-mock has mock data for all new commands
  - [ ] S103 story status is `done`
  - [ ] S98 story status is `done`
  - [ ] Full suite: `cargo test && npm run test && npm run e2e` all pass

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full E2E test suite passes
    Tool: Bash
    Preconditions: All implementation complete
    Steps:
      1. Run `npm run e2e` from project root
      2. Verify all specs pass (including new tests)
    Expected Result: All E2E tests pass
    Failure Indicators: Any spec failure
    Evidence: .sisyphus/evidence/task-14-e2e.txt

  Scenario: Full test suite passes (Rust + Vitest + E2E)
    Tool: Bash
    Preconditions: All code complete
    Steps:
      1. Run `cd src-tauri && cargo test && cargo clippy -- -D warnings`
      2. Run `npm run lint && npx tsc --noEmit && npm run test`
      3. Run `npm run e2e`
    Expected Result: All pass with zero failures/warnings
    Failure Indicators: Any failure
    Evidence: .sisyphus/evidence/task-14-full-suite.txt

  Scenario: Story files updated
    Tool: Bash
    Preconditions: Tests all pass
    Steps:
      1. Read stories/S103-activity-pace-data.md — verify status: done
      2. Read stories/S98-heart-rate-zone-analytics.md — verify status: done
    Expected Result: Both stories marked done with date
    Failure Indicators: Status not updated
    Evidence: .sisyphus/evidence/task-14-stories.txt
  ```

  **Commit**: YES
  - Message: `test(S103,S98): add E2E tests, update story statuses to done`
  - Files: `e2e/dashboard.spec.ts`, `e2e/tauri-mock.ts`, `stories/S103-activity-pace-data.md`, `stories/S98-heart-rate-zone-analytics.md`
  - Pre-commit: `npm run lint && npx tsc --noEmit && npm run test && npm run e2e`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cargo clippy -- -D warnings` + `npm run lint` + `npx tsc --noEmit` + `cargo test` + `npm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports, `unwrap()` in production paths. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (laps + zones displayed together in modal, aggregate panel updates with presets, context preview includes new data). Test edge cases: activity with no laps, activity with no HR, empty time range, rapid modal open/close. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Content | Verification |
|--------|---------|-------------|
| 1 | `feat(S103,S98): add activity_laps and zone_distribution models, migration v10, storage CRUD` | `cargo test && cargo clippy -- -D warnings` |
| 2 | `feat(S103): add Strava laps fetch with lazy-load and 429/403 retry` | `cargo test && cargo clippy -- -D warnings` |
| 3 | `feat(S98): add Strava activity zones fetch with lazy-load and 429/403 retry` | `cargo test && cargo clippy -- -D warnings` |
| 4 | `feat(S103,S98): enrich context engine with pace variance and zone summary` | `cargo test && cargo clippy -- -D warnings` |
| 5 | `feat(S103,S98): install recharts, add ActivityDetail modal with pace and zone charts` | `npm run lint && npx tsc --noEmit && npm run test` |
| 6 | `feat(S98): add aggregate zone analytics panel with time range presets` | `npm run lint && npx tsc --noEmit && npm run test` |
| 7 | `test(S103,S98): add Rust unit tests for backend` | `cargo test && cargo clippy -- -D warnings` |
| 8 | `test(S103,S98): add Vitest and E2E tests, update story statuses` | `npm run lint && npx tsc --noEmit && npm run test && npm run e2e` |

---

## Success Criteria

### Verification Commands
```bash
cd src-tauri && cargo clippy -- -D warnings  # Expected: zero warnings
cd src-tauri && cargo test                    # Expected: all tests pass
npm run lint                                  # Expected: zero warnings
npx tsc --noEmit                              # Expected: zero errors
npm run test                                  # Expected: all vitest tests pass
npm run e2e                                   # Expected: all playwright tests pass
npm run tauri dev                             # Expected: app starts, features work
```

### Final Checklist
- [ ] All "Must Have" items present and verified
- [ ] All "Must NOT Have" items absent (grep-verified)
- [ ] All Rust tests pass (`cargo test`)
- [ ] All TypeScript tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run e2e`)
- [ ] Clippy clean (`cargo clippy -- -D warnings`)
- [ ] ESLint clean (`npm run lint`)
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Stories S98 and S103 status updated to `done`
