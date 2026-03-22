---
id: S62
title: Automatic Strava sync with toast notifications
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S62 — Automatic Strava sync with toast notifications

## User story

As a **runner**,
I want my Strava activities to sync automatically when I open the app
so that I always see up-to-date data without pressing a button.

## Acceptance criteria

- [ ] On app startup, if Strava is connected, activities sync automatically in the background
- [ ] Sync status is shown in an app-level toast notification (visible from any tab)
- [ ] Toast shows progress during sync (e.g. "Syncing: 5 activities")
- [ ] Toast shows success with count on completion (e.g. "Synced 3 new activities")
- [ ] Toast shows error message if sync fails
- [ ] Success toast auto-dismisses after 3 seconds
- [ ] Error toast stays until manually dismissed
- [ ] Auto-sync does not block app startup or navigation
- [ ] Dashboard inline sync UI still works for manual sync
- [ ] No duplicate syncs if user triggers manual sync during auto-sync

## Technical notes

- Backend already emits all needed events: `strava:sync:start`, `strava:sync:progress`, `strava:sync:complete`, `strava:sync:error`, `strava:sync:context-ready`
- No backend changes needed; `sync_strava_activities` command and `get_strava_auth_status` already exist
- Toast follows the same pattern as the plan generation toast in App.tsx (fixed-position, bottom-right)
- Auto-sync is fire-and-forget: invoke without awaiting, let events drive the toast
- Strava sync toast should stack above the plan toast (use different bottom offset or vertical stacking)

## Tests required

- TypeScript: `npx tsc --noEmit` passes
- Lint: `npm run lint` passes with zero new errors
- Manual: app starts with Strava connected, toast appears showing sync progress and completion

## Out of scope

- Periodic background sync (only on startup)
- Sync settings (enable/disable auto-sync toggle)
- Backend changes

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | All checks pass, auto-sync + toast implemented |
