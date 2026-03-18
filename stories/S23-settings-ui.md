---
id: S23
title: Settings UI with LLM configuration
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S23 — Settings UI with LLM configuration

## User story

As a runner,
I want to open a Settings tab to configure my Ollama endpoint and model
so that I can use my local LLM without editing files.

## Acceptance criteria

- [ ] New Settings tab in the sidebar navigation
- [ ] Settings.tsx component with sections for LLM configuration
- [ ] Input field for Ollama endpoint URL
- [ ] Input field for Ollama model name
- [ ] Strava connect and disconnect buttons
- [ ] Save button that persists settings via Tauri command
- [ ] Load existing settings on mount and populate form
- [ ] Success and error feedback after save
- [ ] Tauri commands in lib.rs: get_settings and save_settings exposed to frontend
- [ ] Saving settings hot-swaps the active LLM client
- [ ] Matches existing dark theme and component style

## Technical notes

Backend storage layer lives in src-tauri/src/storage/mod.rs. This story adds:
1. Tauri commands in src-tauri/src/lib.rs to expose get_settings and save_settings
2. src/components/Settings.tsx component
3. Tab entry in src/App.tsx

The save_settings command must:
- Recreate the LLM client with new settings
- Return error on invalid config

The get_settings command must:
- Return the current SettingsData from storage
- Return default values if no settings exist yet

## Tests required

- Unit: get_settings returns defaults when no settings, save_settings round-trip
- Unit: Settings.tsx renders all fields, save triggers command
- Integration: save settings, reload, settings persisted
- Edge cases: empty model name, invalid endpoint URL

## Out of scope

Strava OAuth implementation (S24), onboarding wizard (S25), model browser (S27)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
