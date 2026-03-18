---
id: S11
title: Ollama LLM client
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S11 — Ollama LLM client

## User story

As a **runner**,
I want to **use a local LLM for privacy or offline coaching**
so that **my data never leaves my machine**.

## Acceptance criteria

- [ ] Implements the Ollama LLM client in `src-tauri/src/llm/mod.rs`
- [ ] Connects to Ollama-compatible HTTP endpoint
- [ ] Configurable endpoint URL (default localhost:11434)
- [ ] Handle connection failures gracefully (Ollama not running or port blocked)
- [ ] Support model selection through application configuration
- [ ] Exposed via Tauri command `send_message` in `src-tauri/src/lib.rs`
- [ ] No API key required for local operation

## Technical notes

Lives in `src-tauri/src/llm/mod.rs`.
Ollama is the only supported LLM backend.
The client sends HTTP requests to the `/api/chat` endpoint.
Requires no API key.
Endpoint URL is configurable to allow remote Ollama servers.
Must handle "Ollama not running" as a specific error case.

## Tests required

- Unit: Message formatting, endpoint URL construction, Rust unit tests in `src-tauri/src/llm/mod.rs`
- Integration: Round-trip with mock Ollama server
- Edge cases: Ollama not running, model not downloaded, slow response, very large response

## Out of scope

- Ollama installation or system setup
- Model management (pull or delete)
- GPU configuration
- Embedding API integration

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Rewritten for Tauri v2 + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
