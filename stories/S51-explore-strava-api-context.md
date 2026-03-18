---
id: S51
title: Explore and integrate Strava API data into context framework
status: done
created: 2026-03-18
updated: 2026-03-18
---

# S51 — Explore and integrate Strava API data into context framework

## User story

As a runner using CoachLM, I want the LLM to have richer training data from Strava beyond basic activity summaries, so that coaching advice is more informed and personalized using detailed metrics like heart rate zones, gear mileage, and training load statistics.

## Acceptance criteria

- [ ] Document exploration results: list all viable Strava API endpoints with their value for coaching context
- [ ] Implement fetching and storing athlete training zones (HR zones from `/athlete/zones`)
- [ ] Implement fetching and storing athlete statistics (training load from `/athletes/:id/stats`)
- [ ] Implement fetching and storing gear details (shoe mileage from `/gear/:id`)
- [ ] Integrate fetched Strava data into context assembly (`src-tauri/src/context/mod.rs`)
- [ ] Add rate limiting and retry logic for Strava API calls using `reqwest`
- [ ] Ensure new data sources respect token budget (training summary still lowest priority, pinned insights sacred)
- [ ] Add unit tests for new Strava endpoint clients in Rust
- [ ] Add unit tests for context assembly with new data sources
- [ ] All tests pass: `cargo test`

## Technical notes

### Phase 1: Exploration & Documentation

**Strava API v3 endpoints to evaluate**:

**High Priority**:
- `GET /api/v3/athlete/zones` — HR and power zones for intensity analysis
- `GET /api/v3/athletes/:id/stats` — recent 4 weeks, YTD, all-time totals for training load tracking
- `GET /api/v3/gear/:id` — shoe/bike mileage for equipment tracking

**Rate limits**:
- Respect Strava's limits (100 requests / 15 min, 1000 requests / day)
- Track via `X-RateLimit-Usage` headers
- Implement exponential backoff for 429 responses

### Phase 2: Implementation - New Strava Endpoints

**Backend files to modify**:

`src-tauri/src/strava/mod.rs`:
- Implement `fetch_athlete_stats`, `fetch_athlete_zones`, and `fetch_gear`
- Use `serde` for JSON deserialization of Strava responses
- Use `reqwest` for HTTP requests with a custom middleware or wrapper for rate limiting

**Data structures**:
Rust structs are defined to match Strava's JSON schema, using `#[derive(Deserialize)]` and `#[serde(rename = "...")]` where necessary.

`src-tauri/src/storage/mod.rs`:
- Add tables for `athlete_stats`, `athlete_zones`, and `gear`
- Implement persistence methods for these new data types

### Phase 3: Integration with Context Engine

**Modify `src-tauri/src/context/mod.rs`**:

Update the context assembler to include the new data sources in the prompt generation process. The priority order for the prompt is:
1. Sacred: preamble + custom prompt + pinned insights
2. Profile block
3. Training load stats block (Medium priority)
4. Zones block (Medium priority)
5. Gear block (Medium priority)
6. Training summary (Lowest priority, truncated first)

**Modify `src-tauri/src/lib.rs`**:

Update the `send_message` and `get_context_preview` Tauri commands to fetch the new data from storage and pass it to the context assembler.

### Phase 4: Sync and Rate Limiting

**Implement retry logic**:
A wrapper around the `reqwest` client handles 429 Too Many Requests by inspecting the `Retry-After` header and implementing exponential backoff for other transient errors.

**Sync strategy**:
- Fetch zones and stats during the manual Strava sync process
- Fetch gear details for activities that reference a specific `gear_id`
- Cache this data in SQLite to minimize API calls

## Tests required

- Unit: `src-tauri/src/strava/mod.rs` — test API client methods with mocked responses
- Unit: `src-tauri/src/context/mod.rs` — test prompt assembly with various combinations of stats, zones, and gear data
- Unit: `src-tauri/src/storage/mod.rs` — test persistence and retrieval of new data types
- Test token budget behavior: ensure lower priority blocks are truncated correctly when the limit is reached

## Out of scope

- Strava webhooks (manual sync only)
- Activity streams (raw time-series data)
- UI changes for displaying new data (focus is on backend integration for LLM context)

---

## Status history

| Date | Status | Notes |
|------|--------|-------|
| 2026-03-18 | draft | Created story |
| 2026-03-18 | in-progress | Implementation started: Rust API client, storage updates, context engine integration |
| 2026-03-18 | done | All layers implemented and tested. `cargo test` passes. |
