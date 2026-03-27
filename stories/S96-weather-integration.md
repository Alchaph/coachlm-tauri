---
id: S96
title: Weather integration for training context
status: draft
created: 2026-03-27
updated: 2026-03-27
---

# S96 — Weather integration for training context

## User story

As a **runner**,
I want the coaching context to include current weather conditions
so that **the LLM can give weather-appropriate training advice**.

## Acceptance criteria

- [ ] Fetch current weather data for the runner's location
- [ ] Include temperature, humidity, wind, and conditions in LLM context
- [ ] Allow user to set their training location in settings
- [ ] Handle API failures gracefully (coach works without weather)

## Technical notes

Use a free weather API (Open-Meteo is free, no API key required).
Include weather in the context prompt when available.
Cache weather data to avoid excessive API calls.

## Tests required

- Unit: weather data formatting
- Unit: context includes weather when available
- Unit: context works without weather data

## Out of scope

- Historical weather for past activities
- Weather forecasting for planned runs
- Air quality index

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | draft | Created |
