---
id: S70
title: Extract shoe data from ShoeCalculator.tsx to separate file
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S70 — Extract shoe data from ShoeCalculator.tsx to separate file

## User story

As a **developer**,
I want **shoe data extracted to a dedicated data file**
so that **ShoeCalculator.tsx is focused on component logic, not data**.

## Acceptance criteria

- [ ] New `src/data/shoes.ts` file created with the shoe data array and type
- [ ] `ShoeCalculator.tsx` imports the data from the new file
- [ ] No behavioral changes to the shoe calculator
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

ShoeCalculator.tsx contains ~230 lines of inline shoe data. Extract the `Shoe` interface and the `SHOES` (or similar) array to `src/data/shoes.ts`.

## Tests required

- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Changing shoe data content
- Changing component behavior

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
