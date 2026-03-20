---
id: S55
title: Chat notification banner and collapsible history sidebar
status: done
created: 2026-03-20
updated: 2026-03-20
---

# S55 — Chat notification banner and collapsible history sidebar

## User story

As a **runner**,
I want to **see when the AI coach has responded while I browse other tabs, and have a collapsible list of my chat history on the left side**
so that **I never miss a response and can easily find past conversations**.

## Acceptance criteria

- [ ] When the user sends a message and switches to another tab, a subtle banner appears at the top of the main content area
- [ ] The banner shows the LLM status: "Thinking..." while loading, "Coach has replied" when the response arrives
- [ ] Clicking the banner navigates back to the Chat tab
- [ ] The banner disappears automatically when the user returns to the Chat tab
- [ ] Chat component state persists across tab switches (component stays mounted but hidden)
- [ ] Chat sessions displayed as a collapsible vertical list on the left side of the chat area
- [ ] The history sidebar can be toggled open/closed with a button
- [ ] Each session in the list shows its title (or "New Chat")
- [ ] Active session is visually highlighted
- [ ] Each session has a close (X) button to delete it
- [ ] New Chat (+) button at the top of the sidebar
- [ ] Horizontal session tabs removed and replaced by this sidebar list
- [ ] Sidebar state (open/closed) persists visually but defaults to open

## Technical notes

### Architecture change: persistent Chat mounting

Currently `App.tsx` conditionally renders `<Chat />` only when `activeTab === "chat"`. This means Chat unmounts when switching tabs, losing all state (messages, loading status). To support cross-tab notifications:

1. **Always render Chat** but hide it with `display: none` when not active.
2. **Lift chat loading state** up to App.tsx via a callback so the banner can read it.
3. Alternative: use a ref/callback pattern where Chat reports its loading status to App.

### Notification banner (App.tsx)

- Rendered inside the `<main>` area, above the active tab content.
- Only visible when `activeTab !== "chat"` AND chat has an active operation (loading or just completed).
- Two states:
  - `chatStatus: "thinking"` — show "Coach is thinking..." with a subtle pulse animation
  - `chatStatus: "replied"` — show "Coach has replied — click to view" with accent color
  - `chatStatus: "idle"` — banner hidden
- Clicking banner calls `setActiveTab("chat")`.

### Collapsible history sidebar (Chat.tsx)

- Replace horizontal `.chat-tabs` with a vertical sidebar list inside the Chat component.
- Sidebar sits on the left side of the chat area, with a fixed width (~220px).
- Toggle button (hamburger or chevron) to collapse/expand.
- When collapsed, sidebar is hidden and chat takes full width.
- Session list is scrollable vertically.

## Tests required

- TypeScript: `npx tsc --noEmit` passes
- ESLint: `npm run lint` passes
- Manual: send message, switch tab, see banner update from thinking to replied, click to return
- Manual: toggle chat history sidebar open/closed, switch sessions, delete sessions

## Out of scope

- Streaming LLM responses
- Persistent sidebar state across app restarts
- Session search/filtering
- Drag-and-drop session reordering

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-20 | draft | Created |
| 2026-03-20 | in-progress | Implementation started |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
