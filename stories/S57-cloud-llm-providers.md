---
id: S57
title: Add cloud LLM providers (Groq, OpenRouter) as fast alternatives to local Ollama
status: done
created: 2026-03-20
updated: 2026-03-20
---

# S57 — Add cloud LLM providers (Groq, OpenRouter) as fast alternatives to local Ollama

## User story

As a **runner using CoachLM**,
I want to **use free cloud LLM providers (Groq, OpenRouter) instead of or alongside local Ollama**
so that **I get much faster responses (5-10x) without needing a powerful GPU**.

## Acceptance criteria

- [ ] Settings UI has a provider selector: Ollama (default), Groq, OpenRouter
- [ ] When Groq or OpenRouter is selected, an API key field and model name field appear
- [ ] API keys are stored encrypted in SQLite (same AES-256-GCM as Strava tokens)
- [ ] Chat messages route to the selected provider transparently
- [ ] Training plan generation routes to the selected provider transparently
- [ ] Ollama remains the default and works exactly as before (no regression)
- [ ] Provider-specific error messages (e.g. "Invalid API key", rate limit errors)
- [ ] Onboarding wizard updated: provider selection step added before Ollama config
- [ ] `get_ollama_models` still works for Ollama; Groq/OpenRouter use manual model input
- [ ] All existing tests pass; new unit tests for the OpenAI-compatible client

## Technical notes

### Architecture

Add a dispatcher function `llm::chat()` that routes based on `settings.active_llm`:
- `"ollama"` -> existing `chat_with_ollama()` (unchanged)
- `"groq"` -> new `chat_with_openai_compatible()` with Groq base URL
- `"openrouter"` -> new `chat_with_openai_compatible()` with OpenRouter base URL

The OpenAI-compatible chat completions API is simple — same reqwest, different JSON shape.
No new crate dependencies needed.

### Provider details

| Provider | Base URL | Auth | Free tier |
|---|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | Bearer token | 14.4K req/day (8B), 1K/day (70B) |
| OpenRouter | `https://openrouter.ai/api/v1` | Bearer token | 50 req/day, 27+ free models |

### Files to change

| File | Change |
|---|---|
| `src-tauri/src/models.rs` | Add `ChatMessage` (generic), `OpenAiChatRequest`, `OpenAiChatResponse` types. Add provider config fields to `SettingsData` |
| `src-tauri/src/llm/mod.rs` | Add `chat()` dispatcher, `chat_with_openai_compatible()` function |
| `src-tauri/src/lib.rs` | Update `send_message` and imports to use `llm::chat()`. Add `get_cloud_api_key` / `save_cloud_api_key` commands |
| `src-tauri/src/plan/mod.rs` | Update to use `llm::chat()` instead of `chat_with_ollama()` |
| `src-tauri/src/storage/mod.rs` | Add columns for encrypted API keys, provider model names. Add get/save functions for cloud provider settings |
| `src/components/Settings.tsx` | Add provider selector, conditional API key field, model input |
| `src/components/Onboarding.tsx` | Add provider selection step |

### API key storage

API keys are encrypted using the existing `Database::encrypt()` / `Database::decrypt()` methods (AES-256-GCM), matching the Strava token pattern.

### No streaming (phase 1)

This story keeps the existing "Thinking..." UX. Streaming support is a separate future story.

## Tests required

- Unit: `chat_with_openai_compatible()` — verify request JSON shape matches OpenAI spec
- Unit: `chat()` dispatcher — verify routing based on `active_llm` value
- Unit: Storage — verify encrypted API key round-trip (encrypt -> store -> retrieve -> decrypt)
- Unit: Settings — verify new fields persist and load correctly
- Integration: Frontend settings save/load with new provider fields

## Out of scope

- Streaming responses (separate story)
- Token counting / rate limit tracking in the UI
- Provider-specific model fetching (Groq/OpenRouter users type model names)
- Adding more providers beyond Groq and OpenRouter
- Automatic fallback between providers

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-20 | draft | Created |
