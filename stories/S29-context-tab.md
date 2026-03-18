---
id: S29
title: Context tab with editable profile and insights
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S29 — Context tab with editable profile and insights

## User story

As a runner,
I want a dedicated Context tab showing my athlete profile, pinned insights, and training summaries
so that I can see and edit the data my AI coach uses, making the app less of a black box.

## Acceptance criteria

- [ ] New Context tab accessible from sidebar navigation
- [ ] Athlete profile section: editable form for age, max HR, threshold pace, weekly mileage target, race goals, injury history
- [ ] Save button persists profile changes via save_profile_data command
- [ ] Pinned insights section: list all saved insights with delete button
- [ ] Deleting an insight calls delete_pinned_insight command and removes it from the list
- [ ] Training summary section: read-only display of recent activities (last 10)
- [ ] Empty states shown when no profile, no insights, or no activities exist
- [ ] Success and error feedback on save and delete actions
- [ ] Types defined as TypeScript interfaces in the component

## Technical notes

- Create src/components/Context.tsx component
- Tauri commands in src-tauri/src/lib.rs:
  - get_profile_data() -> wraps storage.get_profile()
  - save_profile_data(data) -> wraps storage.save_profile()
  - get_pinned_insights() -> wraps storage.get_insights()
  - delete_pinned_insight(id) -> wraps storage.delete_insight()
- Rust models defined in src-tauri/src/models.rs
- CRITICAL: Pinned insights are NEVER compressed or dropped (AGENTS.md constraint)

## Tests required

- Unit: get_profile_data returns error or empty when no profile exists
- Unit: save_profile_data validates and persists profile
- Unit: get_pinned_insights returns all insights
- Unit: delete_pinned_insight removes insight by ID
- Unit: delete_pinned_insight returns error for non-existent ID

## Out of scope

- Editing insights inline (only delete is supported)
- Training summary editing
- Context token budget visualization

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
