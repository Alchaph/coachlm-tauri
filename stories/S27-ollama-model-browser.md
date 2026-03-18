---
id: S27
title: Ollama model browser
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S27 — Ollama model browser

## User story

As a user,
I want to see which Ollama models are installed and select one
so that I don't have to guess model names and can pick the correct tag (e.g. llama3:8b vs llama3).

## Acceptance criteria

- [ ] Backend can list installed Ollama models via /api/tags
- [ ] Tauri command exposes get_ollama_models(endpoint) to frontend
- [ ] Settings page shows a Fetch button next to the model input
- [ ] Clicking it displays installed models as clickable chips
- [ ] Clicking a model name fills the model input field
- [ ] Onboarding wizard has the same functionality
- [ ] Handles connection errors gracefully (shows inline error)
- [ ] Tests cover get_ollama_models success, empty, and error cases

## Technical notes

- Ollama GET /api/tags returns {"models": [{"name": "llama3:8b", ...}]}
- Only model names needed, not full metadata
- Function accepts endpoint parameter for custom endpoints
- 5s timeout to avoid blocking UI
- Implementation lives in src-tauri/src/llm/mod.rs

## Tests required

- Unit: get_ollama_models with mock HTTP server (success, empty list, error status, malformed response)

## Out of scope

- Model download or pull from within the app
- Model details (size, quantization, etc.)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | in-progress | Created |
| 2026-03-16 | done | Implemented and tested |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
