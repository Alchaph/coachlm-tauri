---
id: S94
title: Overtraining detection and recovery alerts
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S94 — Overtraining detection and recovery alerts

## User story

As a **runner**,
I want the app to detect signs of overtraining from my activity data
so that **I can adjust my training before injury or burnout**.

## Acceptance criteria

- [ ] Analyze training load trends (acute:chronic workload ratio)
- [ ] Detect monotony (low variation in training stress)
- [ ] Surface alerts in the dashboard when risk is elevated
- [ ] Include overtraining context in LLM prompts so the coach can address it

## Technical notes

Use existing activity data (distance, duration, heart rate) to compute:
- Acute training load (7-day rolling)
- Chronic training load (28-day rolling)
- Acute:chronic ratio (sweet spot: 0.8-1.3, danger zone: >1.5)
- Training monotony (weekly load / std deviation)

## Tests required

- Unit: ACWR calculation with known data
- Unit: monotony calculation
- Unit: alert thresholds trigger correctly

## Out of scope

- Sleep or HRV data (separate story)
- Prescriptive recovery plans

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
