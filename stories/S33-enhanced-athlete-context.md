---
id: S33
title: Enhanced athlete context and pace input
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S33 — Enhanced athlete context and pace input

## User story

As a **runner setting up my coaching profile**,
I want **more profile fields to describe my training background, and the threshold pace input in min:sec format everywhere**
so that **the LLM coach has richer context about me and I don't have to convert my pace into raw seconds**.

## Problem

1. **Pace input inconsistency**: The onboarding wizard (step 4) already uses a friendly min:sec threshold pace input, but the Context tab still shows a raw "Threshold Pace (sec/km)" number field. A user seeing `300` has no idea that means `5:00/km`.

2. **Missing context fields**: The current profile captures age, max HR, threshold pace, weekly mileage, race goals, and injury history. Important coaching signals are missing — the LLM doesn't know how experienced the runner is, how many days per week they train, what surfaces they run on, or their resting heart rate. Adding these gives the coach significantly better context for personalized advice.

## Acceptance criteria

- [ ] Context tab (`Context.tsx`) threshold pace input changed from a single "sec/km" number field to the same min:sec two-field format used in the onboarding wizard
- [ ] New profile fields added to backend and both UI surfaces (Context tab + onboarding wizard step 4):
  - **Experience level** — select: beginner / intermediate / advanced / elite
  - **Training days per week** — number (1–7)
  - **Resting heart rate** — number (30–120 bpm)
  - **Preferred terrain** — select: road / trail / track / mixed
- [ ] Backend `AthleteProfile` struct, SQLite schema (migration), and `ProfileData` DTO updated with the four new fields
- [ ] New fields are included in the context engine prompt assembly so the LLM receives them
- [ ] All new fields are optional — profile validation must not reject a profile missing them
- [ ] Existing profiles (from before this migration) continue to load without errors; new fields default to zero-values
- [ ] Onboarding wizard step 4 asks all profile fields (existing + new)

## Technical notes

- `src-tauri/src/storage/mod.rs`: Add `experience_level`, `training_days_per_week`, `resting_hr`, `preferred_terrain` to `AthleteProfile` struct
- `src-tauri/src/storage/mod.rs`: Add migration to add the four new columns with sensible defaults (empty string / 0)
- `src-tauri/src/lib.rs`: Extend `ProfileData` struct with the new `serde` fields; update `get_profile_data` and `save_profile_data` Tauri commands
- `Context.tsx`: Replace `thresholdPaceSecs` number input with two inputs (min + sec) and a `:` separator, matching the onboarding wizard pattern; add inputs for the four new fields
- `Onboarding.tsx`: Add inputs for the four new fields in step 4
- `src-tauri/src/context/mod.rs`: Update prompt assembler to include new fields when non-empty/non-zero
- Experience and terrain are `<select>` dropdowns with predefined options, not free text

## Tests required

- Unit: `src-tauri/src/storage/mod.rs` — save and retrieve profile with new fields; verify defaults for missing fields
- Unit: `src-tauri/src/lib.rs` — round-trip `save_profile_data` / `get_profile_data` with new fields
- Unit: context engine — assembled prompt includes new fields when set, omits them when empty
- Edge case: existing profile (pre-migration) loads without error, new fields return zero-values
- Edge case: profile with only some new fields set — only populated fields appear in context

## Out of scope

- Heart rate zone calculation from resting + max HR (separate story)
- Auto-detecting experience level from activity history
- Per-activity terrain tagging

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Implemented new profile fields and min:sec pace input across UI and backend |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
