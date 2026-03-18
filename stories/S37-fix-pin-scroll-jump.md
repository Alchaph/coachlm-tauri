---
id: S37
title: Fix chat scroll jumping on pin
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S37 — Fix chat scroll jumping on pin

## User story

As a **user reading chat history**,
I want **the chat to stay where I am when I pin a message**
so that **I don't lose my place in the conversation when saving an insight**.

## Problem

The chat component has a `useEffect` hook that unconditionally scrolls to the bottom on every render:

```typescript
useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
});
```

This runs on **every** component update. When a user pins a message (clicks the pin button), the state is updated, triggering a re-render, which runs the effect, which scrolls to the bottom — even if the user had scrolled up to read older messages.

## Acceptance criteria

- [ ] Pinning a message does NOT scroll the chat to the bottom
- [ ] The chat still auto-scrolls to bottom when:
  - A new message is sent by the user
  - A new response is received from the assistant
  - (This is the only time auto-scroll should happen)
- [ ] Manual scroll position is preserved when unrelated updates occur (e.g., pin, unpin, feedback toast appears)

## Technical notes

- `src/components/Chat.tsx`: Remove or refactor the `useEffect` hook
- Instead of unconditional scroll-on-update, only scroll when:
  1. User sends a message (`handleSend` function)
  2. New assistant message is appended (after the Tauri command returns)
- Implementation options:
  - Option A (simple): Call `chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight` at the end of `handleSend` and after appending assistant response
  - Option B (more precise): Track whether the user was at the bottom before update, restore after — but this adds complexity
  - Recommended: Option A — simpler and matches the intended behavior
- The unconditional `useEffect` hook can be removed entirely once explicit scroll calls are added

## Tests required

- Manual: Pin a message while scrolled up → verify scroll position stays unchanged
- Manual: Send a message → verify chat scrolls to bottom
- Manual: Receive an assistant response → verify chat scrolls to bottom
- Edge case: Pin button shows feedback toast ("Insight saved!") → verify no scroll jump

## Out of scope

- Scrolling to a specific pinned message
- "Jump to latest" button
- Touch / mobile scroll behavior (assume same fix works)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Refactored Chat.tsx to use explicit scroll-to-bottom only on new messages |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
