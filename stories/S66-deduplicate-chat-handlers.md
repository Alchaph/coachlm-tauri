---
id: S66
title: Deduplicate chat handler logic in lib.rs
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S66 — Deduplicate chat handler logic in lib.rs

## User story

As a **developer**,
I want **shared logic between send_message and edit_and_resend extracted into a helper**
so that **bug fixes and enhancements only need to be applied once**.

## Acceptance criteria

- [ ] Shared web-search + context + LLM + save-response logic extracted to a helper function
- [ ] `send_message` and `edit_and_resend` both call the helper
- [ ] Behavior unchanged — same progress events emitted, same responses returned
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes

## Technical notes

Lines ~232-278 of `send_message` and ~307-353 of `edit_and_resend` share ~40 lines of identical logic:
1. Web search (if enabled)
2. Build context
3. Assemble messages array
4. Query LLM
5. Save assistant response

Extract into a helper like `query_llm_and_save(db, app_handle, settings, session_id, content) -> Result<String, String>`.

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes (existing tests still pass)

## Out of scope

- Changing the chat behavior or adding new features

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
| 2026-03-22 | done | Clippy clean, 55 tests pass, ESLint/tsc clean |
