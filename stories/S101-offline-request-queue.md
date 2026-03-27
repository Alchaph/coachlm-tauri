---
id: S101
title: Offline request queue
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S101 — Offline request queue

## User story

As a **runner**,
I want failed API requests to be queued and retried automatically
so that **temporary network issues don't cause data loss**.

## Acceptance criteria

- [ ] Failed Strava sync requests are queued for retry
- [ ] Failed LLM requests (cloud providers) are queued for retry
- [ ] Queue persists across app restarts (stored in SQLite)
- [ ] Automatic retry with exponential backoff
- [ ] UI indicator showing pending queue items
- [ ] User can manually trigger retry or clear queue

## Technical notes

Create a `request_queue` table with: id, request_type, payload, status, retry_count, next_retry_at.
Background task checks queue periodically and retries pending items.
Max retry count: 5, backoff: 30s, 2min, 10min, 1h, 6h.

## Tests required

- Unit: queue insertion and retrieval
- Unit: exponential backoff calculation
- Unit: max retry enforcement

## Out of scope

- Offline-first architecture
- Conflict resolution
- Request deduplication

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
