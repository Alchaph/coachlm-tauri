---
id: S05
title: Context engine — profile block assembly
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S05 — Context engine — profile block assembly

## User story

As a **system**,
I want to **assemble the athlete's profile into a structured text block**
so that **LLM conversations have accurate runner context**.

## Acceptance criteria

- [ ] Read profile from `athlete_profile` table
- [ ] Format into structured, human-readable text block
- [ ] Output is deterministic (same input → same output)
- [ ] Include all profile fields with labels
- [ ] Handle missing/optional fields gracefully (omit rather than show empty)

## Technical notes

Lives in `src-tauri/src/context/mod.rs`. Part of the single `build_context()` function that assembles all blocks. Depends on S04 for profile data. Output is the "profile block."

## Tests required

- Unit: `#[cfg(test)]` for full profile formatting, partial profile formatting
- Integration: `cargo test` for storage → block
- Edge cases: empty profile, special characters, missing optional fields

## Out of scope

Training summary (S06), pinned insights (S07), full assembly (S08), token counting

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Implemented in Rust as part of build_context() |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
