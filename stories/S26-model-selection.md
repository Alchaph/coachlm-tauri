---
id: S26
title: Model selection for Ollama
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S26 — Model selection for Ollama

## User story

As a runner,
I want to choose which specific model my Ollama backend uses (e.g. llama3.1, mistral)
so that I can balance response quality and speed for my coaching sessions.

## Acceptance criteria

- [ ] Settings store ollama_model field in SQLite
- [ ] When the model field is empty, the backend falls back to its hardcoded default (llama3)
- [ ] LLM client uses the stored model for requests
- [ ] Settings UI shows a text input for the Ollama model with placeholder showing the default
- [ ] Onboarding wizard includes model input on the Ollama setup step
- [ ] Saving settings with a new model reloads the LLM client with that model
- [ ] All existing tests continue to pass
- [ ] New tests cover round-trip save and load of the model field

## Technical notes

The Ollama backend accepts a model field in its configuration.

Changes required:
1. src-tauri/src/storage/mod.rs — update settings table and SaveSettings / GetSettings
2. src-tauri/src/models.rs — add ollama_model to SettingsData struct
3. src-tauri/src/lib.rs — wire through save_settings command
4. src/components/Settings.tsx — model text input for Ollama
5. src/components/Onboarding.tsx — model text input on step 3

Free-text input is used because model names change frequently and users may use custom models.

## Tests required

- Unit: Save settings with model field, read it back, verify default when empty
- Integration: LLM client picks up stored model value
- Edge cases: Empty model string falls back to default, whitespace-only model treated as empty

## Out of scope

- Model validation against Ollama API (user responsibility)
- Per-conversation model switching

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-16 | in-progress | Implementation started |
| 2026-03-16 | done | All fields wired end-to-end, tests passing |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture (Ollama only) |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
