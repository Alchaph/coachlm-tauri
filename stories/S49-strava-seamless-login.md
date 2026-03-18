---
id: S49
title: Seamless Strava login — remove client ID/secret from UI
status: done
created: 2026-03-18
updated: 2026-03-18
---

# S49 — Seamless Strava login — remove client ID/secret from UI

## User story

As a **runner setting up CoachLM for the first time**,
I want to **click a single "Connect Strava" button** that opens the Strava website in my browser
so that **I can authorise the app without ever seeing or pasting API credentials**.

## Research findings

### Why users currently have to paste credentials

Strava's OAuth2 flow requires a registered `client_id` and `client_secret`.
These belong to the **application developer** (i.e. CoachLM), not to the user.
The previous architecture exposed them because it assumed every user would register their own Strava application.

### The correct approach

Register CoachLM as a Strava application once. Strava issues a permanent `client_id` and `client_secret`.
Inject both into the binary at build time using the Rust `option_env!()` macro:

```rust
let client_id = option_env!("STRAVA_CLIENT_ID");
let client_secret = option_env!("STRAVA_CLIENT_SECRET");
```

The user flow then becomes:

1. User clicks **Connect Strava** in the React frontend.
2. The Rust backend opens the Strava authorization URL in the system browser.
3. The user logs in on Strava and approves access.
4. Strava redirects to a local callback (e.g., `http://localhost:9876/callback`).
5. The Rust backend exchanges the code for tokens, saves them encrypted in SQLite (AES-256-GCM), and notifies the frontend.
6. The frontend updates its connected state.

### Strava redirect URI whitelist

Strava requires the `redirect_uri` to match a domain registered on the app.
`localhost` and `127.0.0.1` are explicitly whitelisted by Strava for all apps.

### Local development without a registered app

Developers can supply credentials via environment variables at runtime.
If neither build-time injection nor environment variables are present, the "Connect Strava" button is disabled with a note.

## Acceptance criteria

- [ ] `src-tauri/src/strava/mod.rs` handles credential resolution using `option_env!()` and runtime environment variables
- [ ] `src-tauri/src/lib.rs` provides Tauri commands for starting the OAuth flow and checking status
- [ ] `src/components/Settings.tsx` Strava section: remove Client ID and Client Secret input fields; show only status and Connect/Disconnect button
- [ ] `src/components/Onboarding.tsx` step "Connect Strava": remove credential input fields; show only a "Connect Strava" button
- [ ] `src-tauri/src/storage/mod.rs` schema ignores old `strava_client_id` and `strava_client_secret` columns
- [ ] OAuth tokens are stored encrypted with AES-256-GCM in the SQLite database
- [ ] `cargo test` passes
- [ ] No references to manual credential entry remain in the UI

## Technical notes

### Files to change

| File | Change |
|---|---|
| `src-tauri/src/strava/mod.rs` | Implement `resolve_credentials` helper using `option_env!()` and `std::env::var` |
| `src-tauri/src/lib.rs` | Implement `start_strava_auth` and `get_strava_auth_status` Tauri commands |
| `src-tauri/src/storage/mod.rs` | Update settings handling to exclude manual Strava credentials |
| `src/components/Settings.tsx` | Update UI to remove credential fields and use new Tauri commands |
| `src/components/Onboarding.tsx` | Update onboarding flow to use seamless Strava connection |

### Credential resolution logic

The Rust backend checks for credentials in this order:
1. `option_env!("STRAVA_CLIENT_ID")` (compile-time)
2. `std::env::var("STRAVA_CLIENT_ID")` (runtime)
3. If neither exists, Strava features are disabled.

### DB migration

The `strava_client_id` and `strava_client_secret` columns in the `settings` table are ignored. No destructive migration is performed to ensure compatibility with existing databases.

## Tests required

- Unit: `src-tauri/src/strava/mod.rs` — verify credential resolution logic
- Unit: `src-tauri/src/storage/mod.rs` — verify encrypted token storage and retrieval
- Integration: Verify that the OAuth callback server starts and handles redirects correctly

## Out of scope

- Registering the CoachLM Strava application
- Revoking authorization from within the app (requires Strava deauthorize endpoint)
- Multi-user support (app remains local-only, single athlete)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-18 | draft | Created |
| 2026-03-18 | done | Seamless Strava login implemented using Tauri and Rust. Credentials injected via `option_env!()`. `cargo test` passes. |
