---
id: S12
title: Chat UI
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S12 — Chat UI

## User story

As a **runner**,
I want to **chat with an AI coach through a conversational interface**
so that **I can get personalized training advice**.

## Acceptance criteria

- [ ] Text input field for sending messages
- [ ] Messages displayed in chronological order
- [ ] AI responses rendered as markdown via `react-markdown`
- [ ] Loading indicator while waiting for LLM response
- [ ] Enter key sends message
- [ ] Empty messages prevented (validation)
- [ ] Error state shown when backend call fails
- [ ] Empty state shown when no messages exist

## Technical notes

Lives in `src/components/Chat.tsx`.
React component using Tauri v2.
Uses `invoke('send_message', ...)` from `@tauri-apps/api/core` for IPC.
Depends on S11 (Ollama LLM client) for backend.
Markdown rendering is handled by the `react-markdown` library.

## Tests required

- Unit: message validation, markdown rendering
- Integration: send → receive via Tauri command `send_message`
- Edge cases: very long message, rapid sends, markdown edge cases like code blocks/tables, first-load empty state

## Out of scope

Voice input, file attachments, message editing/deletion, typing indicators, themes

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Implementation started |
| 2026-03-16 | done | Chat UI implemented with stub SendMessage binding |
| 2026-03-18 | done | Rewritten for React + Tauri v2 architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
