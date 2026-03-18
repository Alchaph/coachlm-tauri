---
id: S25
title: New user onboarding wizard
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S25 — New user onboarding wizard

## User story

As a new user,
I want to be guided through initial setup when I first launch the app
so that I can configure my LLM and optionally connect Strava before using the coach.

## Acceptance criteria

- [ ] Wizard shown automatically on first launch (no settings saved yet)
- [ ] Step 1: Welcome screen with app description and Get Started button
- [ ] Step 2: Strava connection (optional) — connect button or Skip option
- [ ] Step 3: Ollama configuration — enter endpoint URL and model name
- [ ] Step 4: Completion screen with Start Chatting button
- [ ] Progress indicator showing current step
- [ ] Settings saved at completion (reuses S23 save_settings command)
- [ ] Strava OAuth triggered inline if user chooses to connect (reuses S24 start_strava_auth command)
- [ ] Wizard does not show again after completion (settings exist = wizard skipped)
- [ ] Tauri command: is_first_run returns true if no settings exist
- [ ] Back and Next navigation between steps
- [ ] Skip button available on optional steps (Strava)
- [ ] Matches existing dark theme

## Technical notes

This is primarily a frontend feature. The wizard is an Onboarding.tsx component that:
1. Shows as a full-screen overlay when is_first_run returns true
2. Walks through setup steps using local component state
3. At completion, calls save_settings (from S23) to persist Ollama config
4. Optionally triggers start_strava_auth (from S24) for Strava connection
5. Once settings are saved, the wizard never appears again

is_first_run command in src-tauri/src/lib.rs: checks if storage.get_settings() returns an error or empty result.

The wizard component renders in src/App.tsx before the main tab UI, conditionally based on is_first_run.

## Tests required

- Unit: is_first_run returns true when no settings, false after save
- Unit: Onboarding.tsx renders all steps, navigation works
- Integration: complete wizard, settings saved, wizard hidden on reload
- Edge cases: close app mid-wizard, skip all optional steps

## Out of scope

Profile setup (name, age, goals) — that's S04. Import existing data. Account creation.

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
