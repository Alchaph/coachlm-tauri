---
id: S105
title: Fix heart rate zones missing due to OAuth scope
status: done
created: 2026-03-29
updated: 2026-03-29
---

# S105 — Fix heart rate zones missing due to OAuth scope

## User story

As a **runner**,
I want to **see my heart rate zone data in the app**
so that **I can analyze my training intensity distribution**.

## Problem

The Strava `/athlete/zones` endpoint requires the `profile:read_all` OAuth scope. The app only requested `read,activity:read_all`, so zone fetches failed silently. Existing users with tokens granted before this fix also lack the required scope.

## Acceptance criteria

- [x] OAuth authorization requests include `profile:read_all` in the scope
- [x] Granted scopes are stored in the `oauth_tokens` table
- [x] `get_auth_status` returns `needs_reauth: true` when stored scopes are missing required scopes
- [x] Dashboard shows an amber re-auth banner when `needs_reauth` is true
- [x] Settings page shows a re-auth notice in the Strava section when `needs_reauth` is true
- [x] ActivityDetailModal fetches laps and zones independently so one failure does not block the other
- [x] All existing tests updated and passing
- [x] Zero-time zone data (fetched with insufficient scope) is not treated as cached
- [x] Stale zero-time zone data is cleared on re-auth
- [x] Backfill limited to 50 activities per sync to respect Strava rate limits

## Technical notes

- `REQUIRED_SCOPE` constant added to `strava/mod.rs` — single source of truth for required scopes
- DB migration 11 adds `granted_scope TEXT NOT NULL DEFAULT ''` to `oauth_tokens`
- `scope_is_stale()` uses HashSet comparison; empty scope (pre-upgrade tokens) is treated as stale
- `save_oauth_tokens_with_scope()` stores scope alongside tokens; original `save_oauth_tokens()` kept as backward-compatible wrapper
- Re-auth flow: disconnect existing tokens then start fresh OAuth to get new scope grant
- `has_activity_zone_distribution` and `get_activities_missing_zones` now require at least one non-zero `time_seconds` value
- `clear_stale_zone_data()` removes all-zero zone rows; called during re-auth to allow re-fetch
- `fetch_activity_zones` only saves zones to DB when at least one zone has non-zero time
- Backfill capped at 50 activities per sync to stay within Strava API rate limits

## Tests required

- Unit: `scope_is_stale` logic covered by existing `get_auth_status` tests
- Unit: All 200 Rust tests passing
- TypeScript: `tsc --noEmit` clean, ESLint clean
- Integration: All frontend test mocks updated with `needs_reauth` field

## Out of scope

- Automatic silent token refresh with new scopes (Strava does not support scope upgrades on refresh)
- Backfill of zone data after re-auth (existing sync handles this)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-29 | done | Implemented, all checks passing |

