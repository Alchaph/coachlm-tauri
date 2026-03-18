---
id: S01
title: Strava OAuth2 login and token storage
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S01 — Strava OAuth2 login and token storage

## User story

As a **runner**,
I want to **connect my Strava account via OAuth2**
so that **my activities sync automatically**.

## Acceptance criteria

- [ ] OAuth2 authorization code flow with Strava
- [ ] Encrypted token storage in SQLite (tokens never stored in plaintext)
- [ ] Automatic token refresh when access token expires
- [ ] Handle token revocation gracefully
- [ ] Secure redirect URI handling
- [ ] Store both access and refresh tokens
- [ ] `oauth_tokens` table created with `access_token`, `refresh_token`, and `token_expires_at` columns

## Technical notes

Lives in `src-tauri/src/strava/mod.rs`.
Tokens stored via `src-tauri/src/storage/mod.rs`.
NEVER store plaintext tokens.
Encryption: AES-256-GCM with key derived from app data dir path + salt.
All OAuth tokens are stored encrypted in SQLite.
Table name is `oauth_tokens`.

## Tests required

- Unit: `#[cfg(test)]` for encrypt/decrypt round-trip, token refresh logic, expired token detection
- Integration: `cargo test` for full OAuth flow with mock Strava
- Edge cases: revoked token, network failure, concurrent refresh

## Out of scope

Strava data fetching (S03), login UI (S24), other OAuth providers

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Implemented in Rust/Tauri |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
