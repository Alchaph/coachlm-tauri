---
id: S100
title: Native desktop notifications
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S100 — Native desktop notifications

## User story

As a **runner**,
I want the app to send native desktop notifications
so that **I'm reminded of planned workouts and alerted to sync completions**.

## Acceptance criteria

- [ ] Notify when Strava sync completes with activity count
- [ ] Notify when a planned workout is upcoming (configurable lead time)
- [ ] Notify when training plan generation completes
- [ ] Notifications respect OS notification settings
- [ ] User can enable/disable notification categories in settings

## Technical notes

Use `tauri-plugin-notification` for cross-platform native notifications.
Add notification preferences to settings table.

## Tests required

- Unit: notification scheduling logic
- Unit: notification preference filtering

## Out of scope

- Push notifications (this is a local-only app)
- Email or SMS notifications
- Sound customization

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
