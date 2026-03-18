---
id: S24
title: Strava OAuth login UI
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S24 — Strava OAuth login UI

## User story

As a runner,
I want to connect my Strava account from the Settings screen
so that my activities sync automatically without manual configuration.

## Acceptance criteria

- [ ] Strava Connection section in Settings.tsx
- [ ] Connect Strava button that opens the Strava OAuth authorization URL in the system browser
- [ ] Local HTTP callback server to receive the OAuth redirect with authorization code
- [ ] Automatic token exchange after receiving the authorization code
- [ ] Encrypted token storage in SQLite
- [ ] Connection status displayed: Connected with disconnect option, or Not connected with connect button
- [ ] Disconnect button that deletes stored tokens
- [ ] Tauri commands: start_strava_auth, get_strava_auth_status, disconnect_strava
- [ ] Error handling: network failure, user denied access, invalid credentials

## Technical notes

The Strava module lives in src-tauri/src/strava/mod.rs. This story adds:
1. Tauri commands in src-tauri/src/lib.rs for the OAuth flow
2. A local HTTP server to catch the OAuth redirect (e.g., localhost:9876/callback)
3. Strava section in src/components/Settings.tsx
4. Opens browser via shell.open() from @tauri-apps/plugin-shell

start_strava_auth flow:
1. Start local HTTP server on localhost:9876/callback
2. Open authorization URL in system browser
3. Wait for callback with auth code
4. Exchange code for tokens
5. Encrypt and store tokens
6. Return success or error

Strava credentials (client ID and secret) are injected via option_env!() at build time or runtime environment variables.

## Tests required

- Unit: start_strava_auth validates credentials exist, get_strava_auth_status returns correct state
- Unit: callback server starts and stops cleanly
- Integration: full OAuth mock flow (mock Strava token endpoint)
- Edge cases: user cancels auth, duplicate connect, tokens expired

## Out of scope

Activity sync trigger, background sync — those exist in S03/S30

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
