# Learnings

## [2026-03-27] Session start

### Architecture conventions
- Rust: `#[cfg(test)]` modules next to code; tempfile crate for temp DB in tests
- TypeScript: Vitest + @testing-library; E2E via Playwright in `e2e/`
- All Tauri commands registered in `generate_handler![]` in `src-tauri/src/lib.rs`
- `spawn_blocking` used for DB operations in Tauri commands
- Errors mapped with `.map_err(|e| e.to_string())`
- Storage uses `rusqlite`; DB passed as `State<AppState>` via `AppState.db`
- Frontend uses `invoke()` from `@tauri-apps/api/core` for IPC
- All icons from `lucide-react`; toasts via `sonner`
- Tailwind v4 + shadcn/ui; dark-only theme with OKLCH CSS variables
- Use `cn()` from `@/lib/utils` for conditional class merging
- Use `@/` path aliases for all imports

### Key file locations
- Models: `src-tauri/src/models.rs`
- Storage CRUD: `src-tauri/src/storage/mod.rs`
- Strava API: `src-tauri/src/strava/mod.rs`
- Context engine: `src-tauri/src/context/mod.rs`
- Tauri commands: `src-tauri/src/lib.rs`
- Dashboard components: `src/components/dashboard/`
- Test setup: `src/test/setup.ts`
- E2E mocks: `e2e/tauri-mock.ts`

### Critical constraints
- Migration must be version 10 (current max is 9)
- Do NOT modify `activity_streams` table
- Do NOT fetch laps/zones during sync — lazy-load ONLY
- Token budget: pace CV ≤50 chars/activity, zone block ≤200 chars
- Use `clippy::pedantic` + `unwrap_used` denied — use `?` everywhere
- No `as any`, `@ts-ignore` in TypeScript

## [2026-03-27] Task 3 completed

### fetch_activity_laps + compute_pace_variance in strava/mod.rs

- `mod strava` is private in `lib.rs` — `pub` items inside that have no callers yet get flagged as dead_code. Use `#[allow(dead_code)]` on transitional public functions until Task 7 wires them up.
- Use `serde_json::Value` for Strava JSON parsing (matches module's existing pattern in `parse_activity`, `fetch_athlete_zones`) — avoids dead private struct lint
- Strava laps endpoint uses `index` field for lap number (NOT `lap_index`) — map via `r["index"].as_i64()`
- 429 retry pattern: check `resp.status() == 429`, read `retry-after` header, sleep, loop via `continue`
- Cache check pattern: `db.has_activity_laps(activity_id).map_err(AppError::Database)?`
- `compute_pace_variance`: pace = elapsed_time as f64 / distance (s/m), CV = stddev/mean * 100; need `#[allow(clippy::cast_precision_loss)]` on the i64→f64 cast
- 182 tests pass after Task 3 (was 176 before; 6 new pace_variance tests added)

## [2026-03-27] Task 4 completed

### fetch_activity_zones in strava/mod.rs

- Strava zones endpoint: `GET /activities/{strava_id}/zones` — returns array of zone-type objects (not flat)
- Response structure: `[{"type": "heartrate", "distribution_buckets": [{"min": 0, "max": 120, "time": 600}, ...]}, ...]`
- Must filter for `type == "heartrate"` — power, pace zones also present; ignore them
- If no heartrate entry or empty response → return empty Vec (not error)
- 403 → `AppError::Strava("HR zone data requires Strava Premium or is unavailable for this activity")`
- 429 retry: same loop pattern as `fetch_activity_laps` (read `retry-after`, sleep, continue)
- Cache check: `db.has_activity_zone_distribution(activity_id).map_err(AppError::Database)?`
- Cache read: `db.get_activity_zone_distribution(activity_id).map_err(AppError::Database)`
- Cache write: `db.save_activity_zone_distribution(activity_id, &zones).map_err(AppError::Database)?`
- `#[allow(dead_code)]` needed (no caller yet until Task 7)
- `#[allow(clippy::cast_possible_wrap, clippy::cast_possible_truncation)]` on `i as i64` for zone_index
- 182 tests still pass after Task 4 (no new tests added — function has no pure logic to unit test)

## [2026-03-27] Task 5 completed

### Context engine — inline pace CV in format_this_week_summary

- `activity_laps.activity_id` is the INTERNAL UUID (FK → `activities.activity_id`), NOT `strava_id`. Use `a.activity_id` when calling `db.has_activity_laps` / `db.get_activity_laps` from context functions.
- `compute_pace_variance` is already `pub` in `strava/mod.rs`. Since `mod strava` is private in `lib.rs`, use `crate::strava::compute_pace_variance(&laps)` from within the same crate — works fine.
- CV format: `| CV:{cv:.0}%` — use inlined format args `{cv:.0}` to satisfy `clippy::uninlined_format_args`.
- Never use `?` in context functions (they return `String`, not `Result`). Pattern: `db.has_activity_laps(&id).unwrap_or(false)` + `db.get_activity_laps(&id).ok()`.
- `format_last_week_summary` shows only aggregate totals (no per-activity lines) — CV not applicable, left unchanged.
- Test pattern: insert activity via `db.insert_activity()` with matching `activity_id`, then `db.save_activity_laps("act-id", &laps)` — the FK constraint requires the activity to exist first.
- 184 tests pass after Task 5 (was 182; +2 new context tests).

## [2026-03-27] Task 6 completed

### Context engine — zone distribution summary block in build_context

- `ActivityZoneSummary.zone_index` is `i64`, NOT `i32` — verify model fields directly in `models.rs` before writing format code.
- `get_aggregated_zone_distribution(Some(7))` filters by `a.start_date >= datetime('now', '-7 days')`. Activities with `start_date = None` (NULL in SQLite) fail this filter — test must set `activity.start_date = Some(Utc::now().format(...))`.
- Use `chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ")` for a current timestamp in tests (chrono is already a dependency).
- `f64.round() as i64` triggers `clippy::cast_possible_truncation` — use `#[allow(clippy::cast_possible_truncation)]` on a separate let binding.
- Zone formatting logic: `zone_min == 0` → `<zone_max`; `zone_max == -1 || zone_max == 999` → `>zone_min`; otherwise `zone_min-zone_max`.
- Use `block.floor_char_boundary(200)` + `block.truncate(boundary)` for safe UTF-8 truncation at 200 chars.
- `format_zone_distribution_block` takes `&[ActivityZoneSummary]` — must add `ActivityZoneSummary` to the top-level import line.
- Tests must import `ActivityZoneDistribution` (not `ActivityZoneSummary`) in test module — the former is what `save_activity_zone_distribution` accepts.
- `build_context` returns `String` not `Result` — use `if let Ok(zones) = db.get_aggregated_zone_distribution(Some(7))` pattern (no `?`).
- 186 tests pass after Task 6 (was 184; +2 new context tests).

## [2026-03-27] Task 7 completed

### Wiring Tauri commands for laps and zone data

- `get_valid_token` was private (no `pub`) in `strava/mod.rs` — made it `pub(crate)` to expose to lib.rs callers.
- `fetch_activity_laps` and `fetch_activity_zones` had `#[allow(dead_code)]` — removed after wiring. Both already handle internal caching, so commands call them directly.
- `get_activity_by_id` did not exist in storage — added a minimal one returning `SqlResult<Option<ActivityData>>`, querying by `activity_id` with `LIMIT 1`.
- Clippy `manual_let_else` fires for `match opt { Some(x) => x, None => return }` — rewrite as `let Some(x) = opt else { return };`.
- Commands use `let Some(strava_id) = activity_opt.and_then(|a| a.strava_id) else { return Ok(vec![]) }` to short-circuit FIT imports.
- `Arc<Database>` is passed by ref to `get_valid_token(&db)` — `Arc<T>` derefs to `T`, so `&db` = `&Database`. Works fine.
- 186 tests pass after Task 7 (unchanged count — no new tests needed, commands are thin wiring over already-tested functions).

## [2026-03-27] Task 8 completed

### ActivityDetailModal + ActivityList + Dashboard wiring

- Dialog from `@/components/ui/dialog` uses `@base-ui/react/dialog` under the hood. Props `open`/`onOpenChange` work as expected (same as Radix API surface). Pattern confirmed in Context.tsx and PlanCalendar.tsx.
- `ScrollArea` from `@/components/ui/scroll-area` is available — use for scrollable modal content.
- `useEffect` cancellation pattern: `let cancelled = false; return () => { cancelled = true; }` inside the effect, and check `if (cancelled) return` in `.then`/`.catch`/`.finally` callbacks.
- For `react-hooks/exhaustive-deps`, include the full `activity` object (not optional chained fields) in deps when the effect reads multiple fields off it. This avoids the lint warning while still being semantically correct.
- `Promise.all` with `void` prefix to satisfy `@typescript-eslint/no-floating-promises`, plus `.catch` to handle errors.
- ActivityList: optional prop `onActivityClick?: (activity: ActivityItem) => void` added; `TableRow` gets `onClick` + conditional `cursor-pointer hover:bg-muted/50` via `cn()`.
- Dashboard index: import `ActivityDetailModal`, add `selectedActivity` + `detailOpen` states, `handleActivityClick` sets both, pass `onActivityClick={handleActivityClick}` to `ActivityList`, render `<ActivityDetailModal>` at end of JSX.
- Pre-existing shadcn UI warnings: 8 in badge, button, tabs, toggle-group, toggle — not our code, not a failure.
- `npx tsc --noEmit` passes with zero errors after all changes.

## [2026-03-27] Task 14 completed

### E2E tests for ActivityDetailModal and AggregateZonePanel

- ActivityList uses `@tanstack/react-virtual` — the DOM has a first spacer `<tr>` with height 0 that is "not visible". Do NOT use `table tbody tr:first-child` to click activity rows. Use `.filter({ hasText: "..." })` instead: `page.locator("table tbody tr").filter({ hasText: "Morning Run" }).click()`.
- Split table structure: header is in a standalone `<table>` element; body rows are in a second `<table>` inside a `<div ref={tableContainerRef}>` with `overflow: auto`. Both share the same `<tbody>` parent — hence `table tbody tr` matches both spacers and data rows.
- `setupTauriMocks` with `addInitScript` must be called BEFORE `page.goto("/")` — confirmed pattern works for modal tests (re-setup + re-navigate per test).
- Pre-existing E2E failures (NOT caused by T14): `creates new chat session`, `saves profile data`, `saves settings when form is dirty` — these were already failing before this task.
- 6 new dashboard E2E tests added: aggregate zone panel visible, time range button click, modal opens, modal lap chart, modal zone chart, modal Escape close.
- 3 new mock commands added to `DEFAULT_MOCK_RESPONSES`: `get_activity_laps`, `get_activity_zone_distribution`, `get_aggregated_zone_distribution`.
