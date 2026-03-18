---
id: S07
title: Context engine — pinned insights
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S07 — Context engine — pinned insights

## User story

As a **runner**,
I want to **save important coaching insights from chat**
so that **they persist across sessions and are never lost**.

## Acceptance criteria

- [ ] Store insights in SQLite with timestamp and source session ID
- [ ] CRITICAL: Pinned insights from chat are NEVER compressed or dropped (AGENTS.md constraint)
- [ ] Retrievable for context assembly (S08)
- [ ] Deletable by user
- [ ] Highest-priority context block — if budget is tight, other blocks shrink first

## Technical notes

Lives in `src-tauri/src/context/mod.rs` for assembly and `src-tauri/src/storage/mod.rs` for CRUD. Table: `pinned_insights`. AGENTS.md constraint is absolute: pinned insights survive all compression passes. Depends on S14 for creation (save-from-chat action), but storage/retrieval is independent. Output is the "pinned insights block."

## Tests required

- Unit: `#[cfg(test)]` for CRUD for insights
- Integration: `cargo test` for save → retrieve → include in context
- Edge cases: 100+ insights, duplicate text, empty insight, insights exceeding budget alone

## Out of scope

Auto-detection from chat, categorization, search, insight editing

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Agent implementing CRUD storage layer |
| 2026-03-18 | done | Storage CRUD implemented in Rust, all tests passing |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
