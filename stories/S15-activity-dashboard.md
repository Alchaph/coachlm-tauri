---
id: S15
title: Activity dashboard
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S15 — Activity dashboard

## User story

As a **runner**,
I want to **see my recent activities and basic metrics at a glance**
so that **I can track my training**.

## Acceptance criteria

- [ ] Display list of recent activities (last 20)
- [ ] Show per-activity metrics: date, distance, duration, avg pace, avg HR
- [ ] Activities sorted by date descending
- [ ] Empty state when no activities exist
- [ ] Activity data sourced from SQLite `activities` table
- [ ] Error state if data fetch fails

## Technical notes

Lives in `src/components/Dashboard.tsx`.
React component using Tauri v2.
Tauri commands in `src-tauri/src/lib.rs`: `get_recent_activities`, `get_activity_stats`.
Reads from `activities` table (same schema as S03).
No charting — just a list with summary metrics.
Depends on S03 (activity data).

## Tests required

- Unit: list rendering, metric formatting
- Integration: fetch → display via Tauri commands
- Edge cases: zero activities, missing metrics, 1000+ activities, non-running types

## Out of scope

Detail view, charting/graphs, comparison, training load, route maps

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Implementation started |
| 2026-03-16 | done | Dashboard + tab nav implemented, builds pass |
| 2026-03-18 | done | Rewritten for React + Tauri v2 architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
