---
id: S48
title: Migrate to Ollama-only — remove all cloud backends, make local LLM the sole provider
status: done
created: 2026-03-18
updated: 2026-03-18
---

# S48 — Migrate to Ollama-only — remove all cloud backends, make local LLM the sole provider

## User story

As a **runner using CoachLM**,
I want to **use local LLMs via Ollama for maximum privacy and zero cost**
so that **I don't need to manage cloud API keys or worry about data leaving my machine**.

## Acceptance criteria

- [ ] All cloud LLM backends (Claude, OpenAI, Gemini) are removed from the codebase entirely
- [ ] Ollama is the sole LLM provider, configured via endpoint and model name
- [ ] Settings UI is simplified: no backend selector, no API key fields, only Ollama configuration
- [ ] Onboarding wizard is streamlined: remove the AI backend selection step
- [ ] `src-tauri/src/llm/mod.rs` is updated to handle only Ollama requests
- [ ] `src-tauri/src/storage/mod.rs` schema is updated to remove cloud-specific settings (API keys, model overrides)
- [ ] All existing `cargo test` tests pass
- [ ] No references to cloud LLMs remain in the UI or documentation

## Technical notes

### Files to change

| File | Change |
|---|---|
| `src-tauri/src/llm/mod.rs` | Remove Claude, OpenAI, and Gemini client implementations; simplify to Ollama only |
| `src-tauri/src/storage/mod.rs` | Remove `claude_api_key`, `openai_api_key`, `gemini_api_key`, and associated model fields from the settings table |
| `src-tauri/src/lib.rs` | Update Tauri commands to remove cloud LLM parameters and simplify settings handling |
| `src/components/Settings.tsx` | Remove backend selector and cloud API key fields; simplify to Ollama endpoint and model inputs |
| `src/components/Onboarding.tsx` | Remove the AI backend selection step; update the flow to skip directly to Strava connection |

### Migration strategy

The SQLite settings table should be cleaned up to remove unused columns. Since this is a local-only app, we can simply ignore the old columns or migrate the `active_llm` to always be `"ollama"`.

### LLM Client simplification

The Rust backend now uses `reqwest` to communicate directly with the Ollama API. The complex multi-backend switching logic is replaced with a single, robust Ollama client.

### UI simplification

The React frontend is updated to remove all conditional rendering based on the active LLM. The settings page now provides a clean interface for Ollama configuration.

## Tests required

- Unit: `src-tauri/src/llm/mod.rs` — verify Ollama request generation and response parsing
- Unit: `src-tauri/src/storage/mod.rs` — verify settings persistence for Ollama configuration
- Integration: Verify that `SendMessage` Tauri command correctly routes to Ollama

## Out of scope

- Supporting multiple local LLM providers (e.g., LM Studio)
- Cloud sync or multi-device features
- Built-in model downloading (users must install Ollama separately)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-18 | draft | Created |
| 2026-03-18 | in-progress | Implementation started |
| 2026-03-18 | done | All cloud backends removed. Ollama is now the sole LLM provider. Settings and Onboarding simplified. |
| 2026-03-18 | done | Pivoted from Gemini to Ollama-only: removed Gemini backend entirely, Ollama is now sole LLM. `cargo test` passes. |
