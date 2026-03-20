---
id: S56
title: UX polish — autosave, toast feedback, multiline chat, prompt history
status: done
created: 2026-03-20
updated: 2026-03-20
---

# S56 — UX polish — autosave, toast feedback, multiline chat, prompt history

## User story

As a **user**,
I want **settings to save automatically on selection change, toast feedback when pinning or unpinning insights, Shift+Enter for newlines in the chat input, and Up/Down arrow prompt history**
so that **the app feels responsive and efficient without extra clicks or lost context**.

## Acceptance criteria

- [x] Clicking a model chip in Settings auto-saves immediately with toast confirmation
- [x] Pinning an insight from Chat shows a success toast
- [x] Unpinning (deleting) an insight from Context shows a success toast
- [x] Chat input is a textarea — Shift+Enter inserts a newline, Enter sends
- [x] Textarea auto-resizes up to a max height, then scrolls
- [x] Up arrow at cursor position 0 recalls the previous sent prompt
- [x] Down arrow at cursor end navigates forward through history
- [x] Current unsent input is preserved when navigating history
- [x] TypeScript compiles with zero errors
- [x] ESLint passes with zero new errors

## Technical notes

Files changed:
- `src/components/Settings.tsx` — model chip onClick now builds updated settings object and calls invoke + showToast
- `src/components/Chat.tsx` — added Toast, textarea with auto-resize, prompt history with refs
- `src/components/Context.tsx` — added success toast to deleteInsight

Toast pattern matches existing codebase convention (local useState + showToast + 3s setTimeout).
Prompt history uses refs (historyIndex, savedInput) to avoid unnecessary re-renders.

## Tests required

- Unit: prompt history navigation (up/down boundary conditions) — deferred to integration testing via `npm run tauri dev`
- Integration: verify toast appears on pin, unpin, and model selection
- Edge cases: up arrow with empty history does nothing, down arrow past index 0 restores saved input

## Out of scope

- Centralizing toast into a shared context/hook (future refactor)
- Persisting prompt history across sessions
- Autosave for text inputs (endpoint, system prompt) — only selection-based inputs

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-20 | done | Implemented and verified |
