---
id: S103
title: Activity pace distribution data
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S103 — Activity pace distribution data

## User story

As a **runner**,
I want to **see pace distribution data for each activity** (laps, splits, pace variance)
so that **my AI coach can distinguish interval sessions from steady runs and provide more nuanced training feedback**.

## Acceptance criteria

- [ ] Fetch laps and/or streams per activity from Strava API (`/activities/{id}/laps`, `/activities/{id}/streams`)
- [ ] Store lap/split data in a new SQLite table linked to activities
- [ ] Context engine includes pace variance indicators in training summaries (not just average pace)
- [ ] Activity detail view in the dashboard shows pace distribution (chart or table)
- [ ] Existing activity sync handles backfill for activities already stored without lap data
- [ ] Rate limiting respected when fetching additional data per activity

## Technical notes

- Current sync only calls `/athlete/activities` (list endpoint) which returns summary-level averages
- Strava streams endpoint: `/activities/{id}/streams?keys=velocity_smooth,heartrate,time`
- Strava laps endpoint: `/activities/{id}/laps` returns per-lap pace, HR, distance, elapsed time
- New Rust model needed for laps (e.g. `ActivityLap` struct in `models.rs`)
- New SQLite table: `activity_laps` with columns for lap_index, distance_m, elapsed_time_s, avg_pace_secs, avg_hr, max_hr
- Context engine (`context/mod.rs` `build_training_summary()`) currently only outputs avg pace/HR per activity — needs pace variance indicators (e.g. CV of pace, min/max lap pace)
- Rate limiting: Strava allows 100 requests per 15 minutes, 1000 per day. Fetching streams/laps for each activity adds 1-2 API calls per activity
- Consider lazy-loading: fetch lap data on first activity detail view, not during bulk sync

## Tests required

- Unit: Parse Strava laps JSON response into `ActivityLap` structs
- Unit: Calculate pace variance metrics from lap data
- Unit: Context engine includes pace distribution in training summary
- Integration: Sync flow fetches and stores laps for new activities
- Edge cases: Activities without laps (manual entries), activities with single lap, rate limit handling

## Out of scope

- Charting library selection (deferred to implementation)
- Heart rate zone distribution (separate story)
- FIT file lap parsing (existing FIT parser may need extension, but that is a separate concern)
- Garmin API integration (separate story)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created from user request for more detailed activity data |
| 2026-03-27 | done | Implemented: laps fetch, pace chart, context CV, E2E tests |
