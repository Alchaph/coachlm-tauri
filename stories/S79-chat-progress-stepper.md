---
id: S79
title: Move chat progress indicator above message bubble
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S79 — Move chat progress indicator above message bubble

## User story

As a **user**,
I want to see the LLM progress steps displayed subtly above the response bubble instead of in a duplicate bubble below it
so that **the chat interface feels clean and the status is not confusingly repeated**.

## Acceptance criteria

- [x] Progress steps render above the streaming assistant bubble, not in a separate bubble
- [x] Completed steps show a middle dot indicator, active step shows a bullet indicator
- [x] After response completes, steps collapse into a single summary line above the message
- [x] The old standalone progress bubble is removed
- [x] Pre-streaming state shows a small "Thinking..." label without a bubble wrapper
- [x] TypeScript and ESLint pass with zero new errors

## Technical notes

The bug: during streaming, progress steps rendered in their own `{loading && ...}` block as a separate bubble below the streaming message. This caused a visual duplicate — the response text appeared in one bubble while progress/timer appeared in another bubble right below it.

Fix: moved progress rendering into the message map, positioned above the assistant bubble. Added `completedSteps` state to capture a snapshot when loading finishes, rendered as a collapsed summary line.

Files changed: `src/components/Chat.tsx`

## Tests required

- Visual: progress steps appear above streaming bubble during LLM response
- Visual: collapsed summary appears above completed assistant message
- Visual: "Thinking..." label shown before first chunk arrives

## Out of scope

- CSS class extraction (codebase uses inline styles throughout Chat.tsx)
- Animation/transition on collapse

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | done | Implemented and verified |
