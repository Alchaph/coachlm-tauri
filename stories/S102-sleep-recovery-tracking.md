---
id: S102
title: Sleep and recovery tracking
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S102 — Sleep and recovery tracking

## User story

As a **runner**,
I want to log sleep and recovery data
so that **the coaching context can factor in recovery when giving training advice**.

## Acceptance criteria

- [ ] Daily sleep logging (hours, quality rating 1-5)
- [ ] Optional HRV input (manual entry)
- [ ] Recovery score calculation based on sleep + training load
- [ ] Include recovery context in LLM prompts
- [ ] Dashboard widget showing recovery trends

## Technical notes

Sleep and recovery are critical for training adaptation.
Keep input simple — manual entry, not wearable integration.
Recovery score formula: weighted combination of sleep quality, sleep duration, and training load ratio.

## Tests required

- Unit: recovery score calculation
- Unit: context formatting with recovery data

## Out of scope

- Wearable device integration (Garmin, Whoop, etc.)
- Automatic sleep detection
- Detailed sleep stage analysis

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
