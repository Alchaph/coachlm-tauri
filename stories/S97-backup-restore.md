---
id: S97
title: Backup and restore user data
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S97 — Backup and restore user data

## User story

As a **runner**,
I want to back up and restore my entire app data
so that **I can move to a new machine or recover from data loss**.

## Acceptance criteria

- [ ] Export full database to a single backup file
- [ ] Import backup file to restore all data
- [ ] Backup includes: activities, chat history, insights, settings, profile, plans
- [ ] Import warns before overwriting existing data
- [ ] Backup file is portable across OS

## Technical notes

The existing export_context/import_context only covers a subset.
A full backup should include the SQLite database file directly,
or a comprehensive JSON export of all tables.

## Tests required

- Unit: backup includes all expected data
- Unit: restore correctly populates all tables
- Integration: round-trip backup and restore

## Out of scope

- Cloud backup
- Automatic scheduled backups
- Incremental backups

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
