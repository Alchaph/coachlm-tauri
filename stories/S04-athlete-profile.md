---
id: S04
title: Athlete profile setup
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S04 — Athlete profile setup

## User story

As a **runner**,
I want to **enter my profile data (age, max HR, threshold pace, goals, injury history)**
so that **the coaching AI has accurate context about me**.

## Acceptance criteria

- [ ] Store profile fields in SQLite: age, max_hr, resting_hr, threshold_pace_secs, weekly_mileage_target, race_goals, injury_history, experience_level, training_days_per_week, preferred_terrain, heart_rate_zones
- [ ] Validate input ranges (e.g., age 1-120, HR 30-220)
- [ ] Update existing profile (not just create)
- [ ] Profile accessible to context engine for assembly
- [ ] Fields are typed: age (int), max_hr (int), resting_hr (int), threshold_pace_secs (int), weekly_mileage_target (float), race_goals (text), injury_history (text), experience_level (text), training_days_per_week (int), preferred_terrain (text), heart_rate_zones (json/text)

## Technical notes

Lives in `src-tauri/src/storage/mod.rs`. Table: `athlete_profile`. Structured record, not free-text. No Strava dependency — manual input only.

## Tests required

- Unit: `#[cfg(test)]` for field validation, CRUD
- Integration: `cargo test` for save → retrieve round-trip
- Edge cases: empty profile, partial update, negative age, missing optional fields

## Out of scope

Auto-detection from activities, profile UI form (S29 Context tab), LLM-suggested changes

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Agent started implementation |
| 2026-03-18 | done | Implemented in Rust/Tauri, all tests pass |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
