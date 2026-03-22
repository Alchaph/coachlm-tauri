---
id: S72
title: Add Ollama connection status indicator
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S72 — Add Ollama connection status indicator

## User story

As a **runner**,
I want to **see whether Ollama is reachable**
so that **I know if chat will work before I type a message**.

## Acceptance criteria

- [ ] New `check_ollama_status` Tauri command returns `true` if Ollama responds at the configured endpoint
- [ ] Settings page shows a green/red dot next to the Ollama endpoint indicating connection status
- [ ] Status is checked on page load and when the user clicks "Fetch Models"
- [ ] Uses existing Strava connection indicator pattern (green dot + text)
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

- Rust: Add `check_ollama_status(endpoint: String) -> Result<bool, String>` that hits `GET /api/tags` with a short timeout (3s)
- Frontend: Call on mount when provider is ollama, and on successful `fetchModels`
- Reuse the green/red dot pattern from Strava status (line ~265 in Settings.tsx)

## Tests required

- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Periodic polling / auto-refresh
- Status indicator in the Chat view

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
