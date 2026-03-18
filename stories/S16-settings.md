---
id: S16
title: Settings screen
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S16 — Settings screen

## User story

As a **runner**,
I want to **configure my local LLM and manage my Strava connection**
so that **I can customize the app to my needs**.

## Acceptance criteria

- [ ] Ollama endpoint URL configuration field (default: http://localhost:11434)
- [ ] Ollama model name configuration field
- [ ] Custom system prompt configuration field
- [ ] Button to connect/disconnect Strava
- [ ] Current Strava connection status displayed
- [ ] Export/Import application data
- [ ] Error state if settings save fails

## Technical notes

Lives in `src/components/Settings.tsx`.
React component using Tauri v2.
Storage in `src-tauri/src/storage/mod.rs`.
Tauri commands in `src-tauri/src/lib.rs`: `get_settings`, `save_settings`.
SettingsData fields: `active_llm`, `ollama_endpoint`, `ollama_model`, `custom_system_prompt`.
Ollama is the only supported LLM backend, so no API keys are required.
Table: `settings`.

## Tests required

- Unit: settings CRUD, validation in Rust
- Integration: save → reload via Tauri commands
- Edge cases: invalid endpoint URL, empty model name, re-auth failure

## Out of scope

Themes, notifications, account deletion, usage stats

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | done | Settings storage layer implemented and tested |
| 2026-03-18 | done | Rewritten for React + Tauri v2 architecture (Ollama-only) |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
