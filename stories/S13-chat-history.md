---
id: S13
title: Chat history persistence
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S13 — Chat history persistence

## User story

As a **runner**,
I want **my chat conversations saved**
so that **I can review previous coaching sessions**.

## Acceptance criteria

- [ ] Messages persisted to SQLite per session
- [ ] Sessions identified by unique ID + timestamp
- [ ] Previous sessions loadable from history
- [ ] New session created on app launch or explicit action
- [ ] Session list displayed with timestamps
- [ ] Empty state when no previous sessions exist

## Technical notes

Lives in `src-tauri/src/storage/mod.rs` for persistence.
Tauri commands in `src-tauri/src/lib.rs`: `get_chat_sessions`, `get_chat_messages`, `create_chat_session`, `delete_chat_session`.
Tables: `chat_sessions` (id, created_at) and `chat_messages` (id, session_id, role, content, created_at).
Depends on S12 for chat UI.

## Tests required

- Unit: message CRUD, session creation, session listing in Rust
- Integration: chat → save → reload via Tauri commands
- Edge cases: 1000+ messages, concurrent writes, empty session, corrupted content

## Out of scope

Session search/filtering, export, reactions, sharing

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | done | Storage layer implemented with full CRUD + 20 tests passing |
| 2026-03-18 | done | Rewritten for Rust + Tauri v2 architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
