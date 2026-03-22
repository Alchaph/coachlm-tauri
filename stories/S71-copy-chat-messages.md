---
id: S71
title: Add copy-to-clipboard button on chat messages
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S71 — Add copy-to-clipboard button on chat messages

## User story

As a **runner**,
I want to **copy chat messages to my clipboard**
so that **I can paste training advice into notes or other apps**.

## Acceptance criteria

- [ ] Each assistant message shows a "Copy" button next to the existing "Pin" button
- [ ] Clicking Copy writes the message content (raw markdown) to the clipboard
- [ ] A toast notification confirms "Copied to clipboard" on success
- [ ] The button uses a `Copy` icon from `lucide-react`
- [ ] Follows existing button styling patterns (btn-ghost, same size/gap as Pin button)
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

- Use `navigator.clipboard.writeText()` for clipboard access
- Add `Copy` to the lucide-react import
- The copy button sits in the same row as the Pin button (line ~522-531 in Chat.tsx)
- Use the existing `useToast` hook already imported in Chat.tsx
- Button text must be static "Copy" (no dynamic text per AGENTS.md)

## Tests required

- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Copying user messages (only assistant messages)
- Copy formatting (copies raw markdown, not rendered HTML)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
