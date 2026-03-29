---
id: S104
title: UI consistency and accessibility polish
status: done
created: 2026-03-29
updated: 2026-03-29
---

# S104 — UI consistency and accessibility polish

## User story

As a **user**,
I want **consistent button components, static labels, proper loading states, and accessible interactive elements**
so that **the app looks and behaves uniformly and works well with assistive technologies**.

## Acceptance criteria

- [x] All raw HTML `<button>` elements replaced with shadcn `<Button>` (Settings model chips, theme buttons, ShoeCalculator brand chips, ChatMessageList prompt suggestions, ChatTabBar session items)
- [x] Dynamic button labels replaced with static text (PlanCreator save, ShoeCalculator compare, ChatMessageList setup guide toggle)
- [x] PlanCreator Save Race button is disabled while saving
- [x] PlanCalendar Mark Skipped/Completed buttons are disabled while updating
- [x] PlanCalendar session tiles have descriptive aria-labels (both calendar grid and weekly view)
- [x] ShoeCalculator brand chips have aria-pressed attribute
- [x] ChatTabBar session items have aria-current for active session
- [x] TypeScript compiles with zero errors
- [x] ESLint passes with zero new errors
- [x] Rust clippy passes with zero warnings
- [x] All 200 Rust tests pass

## Technical notes

Files changed (7 files):
- `src/App.tsx` — no changes needed (banner is a notification bar, not a button)
- `src/components/Settings.tsx` — model selection buttons and theme buttons converted from raw `<button>` to `<Button>`
- `src/components/ShoeCalculator.tsx` — brand filter chips converted to `<Button>` with `aria-pressed`, compare button uses static label
- `src/components/chat/ChatMessageList.tsx` — prompt suggestions converted to `<Button>`, setup guide toggle uses static label
- `src/components/chat/ChatTabBar.tsx` — session list items converted to `<Button>` with `aria-current`, close icon uses `<span>` with role=button
- `src/components/TrainingPlan/PlanCreator.tsx` — save button uses static "Save Race" label, disabled during save
- `src/components/TrainingPlan/PlanCalendar.tsx` — mark buttons disabled during update, session tiles have aria-labels

## Tests required

- Visual: verify all buttons render with correct shadcn styling
- Interaction: verify loading states disable buttons during async operations
- Accessibility: verify aria-pressed, aria-current, and aria-label attributes render correctly

## Out of scope

- WCAG color contrast audit
- Backend Rust changes
- New component creation

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-29 | done | Implemented and verified — all checks pass |
