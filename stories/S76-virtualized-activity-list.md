---
id: S76
title: Add virtualized list for activity table
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S76 — Add virtualized list for activity table

## User story

As a **runner with many activities**,
I want the **activity table to scroll smoothly even with thousands of rows**
so that **the dashboard remains responsive**.

## Acceptance criteria

- [x] `@tanstack/react-virtual` is added as a dependency
- [x] Dashboard activity table uses virtualized rendering (only visible rows are in DOM)
- [x] Table header remains fixed/visible while scrolling
- [x] Existing activity formatting (badges, pace, elevation, etc.) is preserved
- [x] "Load More" button still works to fetch additional pages
- [x] Type filter still works on virtualized list
- [x] Weekly volume chart still renders correctly below the table
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes
- [x] `npm run lint` passes with zero errors
- [x] `npx tsc --noEmit` passes

## Technical notes

- Install `@tanstack/react-virtual` (lightweight, no opinions on markup)
- Replace the `<tbody>{filteredActivities.map(...)}</tbody>` section in Dashboard.tsx (lines ~388-407) with a virtualized approach:
  - Use `useVirtualizer` from `@tanstack/react-virtual`
  - Set a fixed row height (e.g. 44px based on current padding)
  - Create a scrollable container div with fixed height for the table body
  - Render only the visible rows using virtualizer.getVirtualItems()
  - Keep the `<thead>` outside the virtualized area so it stays fixed
- The table wrapper needs a fixed height scroll container. Use `calc(100vh - Xpx)` or a reasonable fixed height.
- Keep existing cell formatters (formatDistance, formatPace, getWorkoutBadge, etc.) unchanged
- filteredActivities is already computed; pass it to the virtualizer

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Virtualizing chat messages
- Infinite scroll (server-triggered fetch on scroll end)
- Column sorting

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | All linters pass, virtualized list implemented |
