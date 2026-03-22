---
id: S65
title: Fix unused athleteSummary in Dashboard
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S65 — Fix unused athleteSummary in Dashboard

## User story

As a **developer**,
I want **unused data fetches cleaned up**
so that **the code is clean and there are no wasted API calls**.

## Acceptance criteria

- [ ] `athleteSummary` state and its fetch in `loadData()` are removed from Dashboard.tsx
- [ ] `void athleteSummary;` suppression on line 291 is removed
- [ ] `AthleteSummary` and `AthleteTotals` interfaces removed if no longer needed
- [ ] Linter passes with zero warnings

## Technical notes

Dashboard.tsx fetches `get_athlete_summary` in `loadData()` but then discards it with `void athleteSummary;` on line 291. The data is never displayed. Remove the fetch and related dead code.

## Tests required

- TypeScript: `npx tsc --noEmit` and `npm run lint` pass
- No runtime errors on Dashboard

## Out of scope

- Actually displaying athlete summary data (would be a separate story)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
