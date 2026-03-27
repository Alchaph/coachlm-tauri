---
id: S95
title: Race time prediction
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S95 — Race time prediction

## User story

As a **runner**,
I want the app to predict my race times for common distances
so that **I can set realistic goals and track fitness progress**.

## Acceptance criteria

- [ ] Predict race times for 5K, 10K, half marathon, and marathon
- [ ] Use recent training data (pace, distance, heart rate) as inputs
- [ ] Display predictions in the dashboard or context tab
- [ ] Update predictions as new activities are synced

## Technical notes

Use established models:
- Riegel formula for distance extrapolation
- Jack Daniels VDOT tables for pace-based estimation
- Consider recent race results if available

## Tests required

- Unit: Riegel formula produces expected results
- Unit: predictions update when new data arrives

## Out of scope

- Machine learning models
- Elevation-adjusted predictions
- Weather-adjusted predictions

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
