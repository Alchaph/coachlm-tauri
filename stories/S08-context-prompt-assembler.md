---
id: S08
title: Context engine — prompt assembler and token budget
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S08 — Context engine — prompt assembler and token budget

## User story

As a **system**,
I want to **assemble all context blocks into a final prompt that fits within the LLM's token limit**
so that **every conversation has complete, relevant context without exceeding model limits**.

## Acceptance criteria

- [ ] Assemble blocks in priority order: pinned insights (S07) > profile block (S05) > training summary block (S06)
- [ ] Enforce configurable token budget (~4000 tokens)
- [ ] Compress/truncate lower-priority blocks when budget is tight (training summary compressed first)
- [ ] Token counting accurate enough to prevent overflows (4 chars ≈ 1 token approximation)
- [ ] Output is a complete prompt ready for the LLM
- [ ] Budget is configurable with a sensible default

## Technical notes

Lives in `src-tauri/src/context/mod.rs`. Single `build_context()` function. Assembly order: system preamble → custom prompt → pinned insights (never cut) → profile block → active plan → stats → zones → gear → 4-week training summary (compressed first). Token counting: char-based approximation (4 chars ≈ 1 token). Consumes the context blocks produced by S05, S06, and S07.

## Tests required

- Unit: `#[cfg(test)]` for assembly order, budget enforcement, compression triggers
- Integration: `cargo test` for all blocks → final prompt within budget
- Edge cases: budget smaller than pinned insights, zero activities, all blocks empty, very large profile

## Out of scope

LLM-specific tokenizers, prompt engineering (template content), streaming updates

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Implementation started |
| 2026-03-18 | done | Assembler implemented in Rust with token budget enforcement, all tests passing |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
