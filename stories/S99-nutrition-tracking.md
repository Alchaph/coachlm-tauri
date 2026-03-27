---
id: S99
title: Nutrition tracking integration
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S99 — Nutrition tracking integration

## User story

As a **runner**,
I want to log basic nutrition data alongside training
so that **the coaching context can account for fueling and recovery**.

## Acceptance criteria

- [ ] Simple daily nutrition logging (calories, hydration)
- [ ] Pre/post-run nutrition notes per activity
- [ ] Include nutrition context in LLM prompts
- [ ] Dashboard section showing nutrition trends

## Technical notes

Keep it simple — not a full nutrition app. Focus on running-relevant nutrition:
daily calorie intake, hydration, pre-run fueling notes, post-run recovery nutrition.
Store in SQLite alongside existing data.

## Tests required

- Unit: nutrition data CRUD
- Unit: nutrition context formatting

## Out of scope

- Macro/micronutrient breakdown
- Barcode scanning
- Meal planning
- Integration with nutrition APIs

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
