---
id: S80
title: UX accessibility and loading state improvements
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S80 — UX accessibility and loading state improvements

## User story

As a **user**,
I want **accessible modals, skeleton loading states, keyboard shortcuts, and clear feedback on destructive actions**
so that **the app is usable with assistive technologies, feels responsive during data loading, and prevents accidental data loss**.

## Acceptance criteria

- [x] All icon-only buttons have aria-labels (Chat, Context, PlanCalendar)
- [x] Focus-visible outlines render on keyboard navigation (global.css)
- [x] Reduced-motion media query disables animations for users who prefer it
- [x] App shell shows skeleton placeholders during initial load (App.tsx)
- [x] Dashboard shows skeleton stats grid and table rows while loading
- [x] Chat textarea gets aria-label; auto-focuses on new session creation
- [x] Chat error state shows Retry button that restores last sent message
- [x] Chat streaming shows Stop generating button
- [x] Context preview modal has role=dialog, aria-modal, focus trap, Escape close, return focus
- [x] PlanCalendar session modal has role=dialog, aria-modal, focus trap, Escape close, return focus
- [x] PlanCalendar grid cells and weekly cards are keyboard-navigable (role=button, tabIndex, Enter/Space)
- [x] Settings web search toggle has role=switch and aria-checked
- [x] Settings Strava disconnect requires confirmation dialog
- [x] Settings Save button is disabled when no changes have been made (dirty state tracking)
- [x] Error toasts persist 5s (vs 3s for success); toast region has aria-live=assertive
- [x] Onboarding step dots have role=img with descriptive aria-labels
- [x] Onboarding steps 2 and 3 have Skip for now buttons
- [x] ShoeCalculator has Reset all filters button and inline validation errors
- [x] Keyboard shortcuts: Ctrl+K focuses chat input, Ctrl+N switches to chat tab
- [x] TypeScript compiles with zero errors
- [x] ESLint passes with zero new errors
- [x] Rust clippy passes with zero warnings
- [x] All 104 Rust tests pass

## Technical notes

Files changed (10 files):
- `src/styles/global.css` — :focus-visible outlines, prefers-reduced-motion, .skeleton shimmer, .spin rotation
- `src/hooks/useToast.tsx` — error duration 5s, aria-live=assertive wrapper
- `src/App.tsx` — skeleton loading shell, aria-current=page on nav, Ctrl+K/Ctrl+N shortcuts
- `src/components/Chat.tsx` — aria-labels on 7 buttons + textarea, retry with last-sent restore, stop-generating, auto-focus
- `src/components/Dashboard.tsx` — dataLoaded state, 6-card skeleton grid + 8-row table skeleton
- `src/components/Context.tsx` — modal: role=dialog, aria-modal, focus trap, Escape, return focus
- `src/components/Settings.tsx` — ask() confirmation on disconnect, role=switch on toggle, isDirty save guard
- `src/components/Onboarding.tsx` — role=img aria-labels on dots, Skip for now on steps 2+3
- `src/components/ShoeCalculator.tsx` — reset filters button, inline validation
- `src/components/TrainingPlan/PlanCalendar.tsx` — modal accessibility, keyboard nav on cells+cards

## Tests required

- Integration: verify all modals trap focus and close on Escape
- Integration: verify skeleton loaders appear then disappear after data loads
- Integration: verify retry button restores last message on chat error
- Integration: verify Settings Save button disabled state tracks changes correctly
- Edge cases: Ctrl+K/N shortcuts don't fire when focus is in input/textarea

## Out of scope

- WCAG AA color contrast audit (separate story)
- Screen reader full end-to-end testing
- Automated accessibility test suite (e.g. axe-core)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | done | Implemented and verified — all tests pass |
