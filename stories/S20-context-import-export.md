---
id: S20
title: Context import / export
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S20 — Context import / export

## User story

As a **runner**,
I want to **export my full coaching context to a file and reimport it later (or on another device)**
so that **I never lose my training history, pinned insights, and profile even if I reinstall or migrate the app**.

## Acceptance criteria

- [ ] Export produces a single `.coachctx` file (JSON envelope) containing: athlete profile, all training summaries, all pinned insights, and settings metadata (Ollama preference)
- [ ] Export is triggered from the Settings screen; user chooses the save location via a native file-save dialog
- [ ] Exported file includes a schema version field so future imports can handle migrations
- [ ] Import is triggered from the Settings screen; user picks a `.coachctx` file via a native file-open dialog
- [ ] Import validates the schema version and rejects files from incompatible future versions with a clear error
- [ ] Import is additive by default: existing pinned insights and summaries are merged, not overwritten; duplicate detection uses the same ID fields as the originals
- [ ] Import offers a "replace all" option that clears existing context before loading (with a confirmation dialog)
- [ ] Sensitive fields (OAuth tokens) are never included in the export file
- [ ] Exported file is human-readable JSON (pretty-printed) so power users can inspect or edit it
- [ ] Both operations show progress feedback and surface any errors in the UI

## Technical notes

Export/import logic in Rust backend (Tauri commands: `export_context`, `import_context` in `src-tauri/src/lib.rs`).
Uses Tauri file dialog (from `@tauri-apps/plugin-dialog`).

Export JSON envelope structure:
  schema_version: 1
  exported_at: RFC3339 timestamp
  athlete_profile: object
  training_summaries: array
  pinned_insights: array
  settings_meta: { active_llm: string }

For import merging, rely on the id primary key of each row. Use INSERT OR IGNORE (SQLite) to skip duplicates in the default additive mode. In "replace all" mode, use a transaction: DELETE the relevant tables, then insert.

The file extension .coachctx is cosmetic — the underlying format is JSON. Validate by attempting to parse with `serde_json` on import.

Depends on S05 (profile block), S06 (training summaries), S07 (pinned insights), and S16 (settings screen UI hooks).

## Tests required

- Unit: export serialization (all fields present, sensitive fields absent), import deserialization, merge deduplication logic, schema version rejection
- Integration: full round-trip — export from a populated DB, import into a clean DB, verify all records match
- Edge cases:
  - Import a corrupted / non-JSON file → clear error, no DB mutation
  - Import a file with schema_version higher than supported → rejected with version mismatch message
  - Export when context is empty → valid empty envelope, no panic
  - "Replace all" import → existing data gone, new data present
  - Import with duplicate IDs → only one copy exists after merge

## Out of scope

- Encrypted export (can be a follow-up story)
- Automatic cloud backup
- Exporting raw activity streams or FIT data
- Importing from third-party formats (Garmin Connect, Apple Health, etc.)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
