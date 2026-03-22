---
id: S67
title: Add Content Security Policy to tauri.conf.json
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S67 — Add Content Security Policy to tauri.conf.json

## User story

As a **user**,
I want **a Content Security Policy enforced on the webview**
so that **the app is protected against XSS and unauthorized resource loading**.

## Acceptance criteria

- [ ] `csp` field in `tauri.conf.json` is set to a restrictive policy
- [ ] Policy allows `default-src 'self'` for Tauri IPC
- [ ] Policy allows inline styles via `style-src 'self' 'unsafe-inline'` (needed for React inline styles)
- [ ] Policy blocks all external connections from the frontend (connect-src, script-src, etc.)
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes

## Technical notes

The current `tauri.conf.json` has `"csp": null`, which means no Content Security Policy is enforced. All HTTP calls in this app go through the Rust backend (Strava, Ollama, Groq, OpenRouter, DuckDuckGo). The frontend only communicates via Tauri IPC (`invoke`/`listen`), so no external network access is needed from the webview.

Tauri v2 automatically injects `ipc:` and `asset:` protocol permissions into the CSP, so we only need to specify the base policy.

## Tests required

- App still loads correctly with the CSP applied (manual verification)
- `cargo clippy -- -D warnings` and `cargo test` pass
- `npm run lint` and `npx tsc --noEmit` pass

## Out of scope

- Changing any backend network behavior
- Adding nonce-based script loading

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
