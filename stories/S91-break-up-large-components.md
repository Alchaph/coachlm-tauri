---
id: S91
title: Break up large frontend components
status: in-progress
created: 2026-03-27
updated: 2026-03-27
---

# S91 — Break up large frontend components

## User story

As a **developer**,
I want large React components split into focused sub-components
so that **the frontend code is easier to navigate, test, and maintain**.

## Acceptance criteria

- [ ] `Chat.tsx` (922 lines) is split into logical sub-components in `src/components/chat/`
- [ ] `Dashboard.tsx` (524 lines) is split into logical sub-components in `src/components/dashboard/`
- [ ] All sub-components use proper TypeScript types (no `any`)
- [ ] All existing functionality preserved — no behavioral changes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes

## Technical notes

### Chat.tsx breakdown
Suggested sub-components in `src/components/chat/`:
- `ChatTabBar.tsx` — horizontal tab bar with session management
- `ChatInput.tsx` — message input area with send button
- `ChatMessageList.tsx` — scrollable message container
- `ChatMessage.tsx` — individual message bubble with edit/copy actions
- `ChatProgress.tsx` — progress stepper / CurrentStepLabel
- `ChatHeader.tsx` — model info, web search controls
- `index.tsx` — main Chat component composing the above

### Dashboard.tsx breakdown
Suggested sub-components in `src/components/dashboard/`:
- `ActivityList.tsx` — virtualized activity list
- `StatsCards.tsx` — summary stat cards
- `ActivityChart.tsx` — chart/graph section (if exists)
- `index.tsx` — main Dashboard composing the above

### Rules
- Use `@/` path aliases for imports
- Props must be explicitly typed with interfaces (not inline)
- Shared state stays in the parent; children receive via props
- Use `cn()` for conditional class merging
- Keep shadcn/ui component usage — do not replace with raw HTML

## Tests required

- `npx tsc --noEmit` passes
- `npm run lint` passes
- Visual verification that UI looks identical (manual)

## Out of scope

- Adding new features or changing behavior
- Restyling or redesigning components
- Adding unit tests for React components (separate story)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
