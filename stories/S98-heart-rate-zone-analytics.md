---
id: S98
title: Heart rate zone analytics
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S98 — Heart rate zone analytics

## User story

As a **runner**,
I want to see time-in-zone analytics for my training
so that **I can verify I'm training at the right intensities**.

## Acceptance criteria

- [ ] Display time spent in each HR zone per activity
- [ ] Show weekly/monthly zone distribution charts
- [ ] Use zones from Strava data or allow manual zone configuration
- [ ] Include zone distribution in LLM coaching context

## Technical notes

HR zones are already fetched via Strava API (S41).
Build analytics on top of existing zone data in the database.
Chart library: consider lightweight options (recharts is already available if used elsewhere).

## Tests required

- Unit: zone time calculation from activity streams
- Unit: weekly aggregation logic

## Out of scope

- Power zones (cycling)
- Custom zone calculation formulas
- Real-time HR monitoring

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
