---
id: S64
title: Fix CSS orphaned scrollbar properties
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S64 — Fix CSS orphaned scrollbar properties

## User story

As a **user**,
I want **the custom scrollbar styling to apply correctly on Firefox**
so that **the scrollbar appearance is consistent across browsers**.

## Acceptance criteria

- [ ] `scrollbar-width` and `scrollbar-color` are placed inside a valid CSS selector (html, body, #root or *)
- [ ] Firefox-style scrollbar properties take effect
- [ ] No orphaned CSS properties outside any selector

## Technical notes

Lines 126-127 of `src/styles/global.css` have `scrollbar-width: thin;` and `scrollbar-color: #475569 transparent;` outside any CSS selector. These are Firefox scrollbar properties but they're orphaned — they should be inside a selector like `html` or `*`.

## Tests required

- TypeScript: `npx tsc --noEmit` passes
- Visual: scrollbar appears thin on Firefox

## Out of scope

- Redesigning scrollbar appearance

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
