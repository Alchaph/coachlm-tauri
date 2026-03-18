---
id: S42
title: Context uses structured insights, not raw pinned messages
status: done
created: 2026-03-17
updated: 2026-03-18
---

# S42 — Context uses structured insights, not raw pinned messages

## User story

As a **runner receiving coaching**,
I want **the coach to reference my saved insights in a structured way**
so that **the context is clear and actionable, not just a dump of random message excerpts**.

## Problem

Today, the "pinned insights" feature (S07, S14) works technically, but the context assembly may just be dumping raw message content. The insights should be formatted as structured coaching wisdom extracted from conversation, not raw chat snippets. The coach should reference insights like "As you noted in your saved insight: 'Consistent tempo work improves my race times'" rather than including raw message dumps.

## Acceptance criteria

- [ ] Insights in context are formatted as clear, standalone statements
- [ ] Each insight in context includes its creation date (e.g., "[Insight from Mar 15]")
- [ ] Insights are prioritized by creation date (most recent first) in context assembly
- [ ] Context preamble includes guidance for the coach on how to use insights:
  - Reference insights when relevant to the question
  - Build on previous coaching guidance (insights)
  - Avoid repeating insight content verbatim unless necessary
- [ ] Large insights (> 500 chars) are truncated with ellipsis to save tokens
- [ ] Insight metadata (source session, date) is minimal in context to avoid clutter
- [ ] Context preview shows insight count but not full content (use Context tab to manage)

## Technical notes

Review and update `src-tauri/src/context/mod.rs`:
- Verify how insights are currently assembled
- Ensure insights block is formatted as bullet points, not raw message dumps

Example current (hypothetical, if it's wrong):
```
Pinned Insights:
[User]: I notice tempo runs help my race times.
[User]: My knees hurt when I do long runs without rest.
```

Target format:
```
Saved Coaching Insights:
- Tempo runs improve race times consistently [Mar 15]
- Long runs without rest cause knee pain [Mar 12]
```

Update `#[cfg(test)]` module in `src-tauri/src/context/mod.rs`:
- Verify insights format matches target structure
- Test with multi-line insights, very long insights
- Test insight count in context preview

No schema changes needed — `pinned_insights` table already has `content` and `created_at`.

Frontend: `src/components/Context.tsx` already shows full insights; no changes needed there. This is about how insights appear in the LLM context.

## Tests required

- Unit: insights block in assembled prompt uses bullet format with dates
- Unit: long insights (> 500 chars) are truncated with ellipsis
- Unit: insights are sorted by created_at DESC (most recent first)
- Integration: full context (profile + insights + training) fits within token budget
- Edge cases:
  - No insights — insights block is empty or omitted entirely
  - 100+ insights — compressed from oldest first, preserve newest
  - Insights with markdown formatting — preserve or flatten? (decision: preserve for now)
  - Insights with emoji or special chars — encode correctly

## Out of scope

- Insight tagging or categorization (future story)
- Insight search or filtering (future story)
- Auto-summarization of multiple related insights (future story)
- Insight versioning or editing

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-17 | draft | Created |
| 2026-03-18 | done | Updated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
