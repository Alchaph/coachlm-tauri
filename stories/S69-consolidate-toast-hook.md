---
id: S69
title: Consolidate duplicated toast pattern into shared hook
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S69 — Consolidate duplicated toast pattern into shared hook

## User story

As a **developer**,
I want **a shared `useToast` hook**
so that **the identical toast state + showToast + auto-clear pattern is defined once instead of five times**.

## Acceptance criteria

- [ ] New `src/hooks/useToast.ts` hook created
- [ ] Hook exports `{ toast, showToast, ToastContainer }` (or similar)
- [ ] All five components use the hook instead of inline toast state
- [ ] Toast behavior unchanged (3-second auto-clear, success/error types)
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

Five components have identical toast pattern:
- `Chat.tsx` (line 53, 305)
- `Context.tsx` (line 44, 51)
- `Settings.tsx` (line 41, 77)
- `ShoeCalculator.tsx` (line 279, 292)
- `Onboarding.tsx` (line 22, 24)

Each has: `useState<Toast | null>(null)`, a `showToast(message, type)` that sets state and auto-clears after 3s, and toast JSX rendering.

The Toast type is `{ message: string; type: "success" | "error" }`.

## Tests required

- `npm run lint` passes
- `npx tsc --noEmit` passes
- Toast behavior unchanged (manual verification)

## Out of scope

- Changing toast styling or animation
- Adding new toast types

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
