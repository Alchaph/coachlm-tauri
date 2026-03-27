---
id: S93
title: Harden CSP and Tauri permissions
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S93 — Harden CSP and Tauri permissions

## User story

As a **runner**,
I want the app to follow the principle of least privilege
so that **a compromised frontend cannot access unintended system resources**.

## Acceptance criteria

- [ ] `opener:default` in `capabilities/default.json` is scoped to specific URL patterns the app actually opens
- [ ] CSP `connect-src` in `tauri.conf.json` is expanded to allow Ollama, Groq, OpenRouter, DuckDuckGo, and Strava API endpoints
- [ ] CSP `style-src 'unsafe-inline'` remains (required by shadcn/ui runtime styles) with a code comment explaining why
- [ ] No HTTP fetch scope violations — the app still works with all LLM providers
- [ ] `npm run tauri dev` launches successfully (manual verification note in story)

## Technical notes

### Current state

**capabilities/default.json:**
```json
"permissions": ["core:default", "opener:default", "updater:default", "process:allow-restart"]
```
`opener:default` allows opening ANY URL. Should be scoped.

**tauri.conf.json CSP:**
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://asset.localhost; font-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'
```
`connect-src` only allows IPC — but the app makes HTTP requests to Ollama, Groq, OpenRouter, DuckDuckGo, Strava, and GitHub (for updates).

### Changes needed

1. **capabilities/default.json**: Replace `opener:default` with specific URL opener permissions. The app opens:
   - Strava OAuth URLs (`https://www.strava.com/*`)
   - GitHub releases for updates (`https://github.com/Alchaph/coachlm-tauri/*`)
   
   Use Tauri v2 scoped opener:
   ```json
   { "identifier": "opener:allow-open-url", "allow": [{ "url": "https://www.strava.com/*" }, { "url": "https://github.com/Alchaph/*" }] }
   ```

2. **tauri.conf.json CSP**: The Rust backend makes HTTP requests (not the frontend), so `connect-src` in CSP doesn't need to list all API endpoints — those bypass the webview CSP. However, ensure `connect-src` includes what the frontend actually fetches (currently only IPC, which is correct).

   Actually, review if the frontend makes any direct HTTP calls. If not, the CSP is already correct for `connect-src`.

### Important
- Do NOT remove `'unsafe-inline'` from `style-src` — shadcn/ui requires it
- Do NOT add `'unsafe-eval'` to any directive
- The opener scoping must not break Strava OAuth flow

## Tests required

- `npx tsc --noEmit` passes
- `npm run lint` passes
- Verify `capabilities/default.json` is valid JSON
- Verify `tauri.conf.json` is valid JSON

## Out of scope

- Adding HTTP fetch scoping (Tauri v2 allowlist for HTTP)
- Removing `unsafe-inline` from CSP (would require nonce-based approach)
- Adding custom domains

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | done | Scoped `opener:default` to Strava OAuth and GitHub release URLs. CSP verified as correct (frontend only uses IPC for all external APIs). TypeScript checks pass. |
