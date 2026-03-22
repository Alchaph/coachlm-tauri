---
id: S63
title: In-app auto-update
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S63 — In-app auto-update

## User story

As a **user**,
I want the app to **check for updates automatically on launch and notify me when a new version is available**
so that **I always have the latest features and fixes without manually downloading installers**.

## Acceptance criteria

- [ ] App checks for updates on launch using `@tauri-apps/plugin-updater`
- [ ] If an update is available, a toast notification appears with the new version number
- [ ] User can click the toast to download and install the update
- [ ] Download progress is shown in the toast
- [ ] After installation, the app relaunches automatically
- [ ] If no update is available, nothing is shown (silent)
- [ ] If the update check fails (offline, server error), nothing is shown (fail silently)
- [ ] Release builds include signed update artifacts (`.sig` files)
- [ ] GitHub Releases serve as the update provider via `latest.json`
- [ ] Update signing keys are configured as GitHub Secrets

## Technical notes

### Backend (Rust)
- Add `tauri-plugin-updater` and `tauri-plugin-process` crates to `Cargo.toml` under desktop-only target
- Register both plugins in `lib.rs` setup with `#[cfg(desktop)]` guard
- No custom Tauri commands needed — the plugins expose JS APIs directly

### Frontend (TypeScript)
- Use `check()` from `@tauri-apps/plugin-updater` to check for updates
- Use `relaunch()` from `@tauri-apps/plugin-process` to restart after install
- Add update check in `App.tsx` `useEffect` on mount
- Show toast using existing toast pattern (fixed-position element, auto-dismiss)
- Toast shows: version, download progress bar, install/restart action

### Configuration
- `tauri.conf.json`: Add `bundle.createUpdaterArtifacts: true` and `plugins.updater` section
- `capabilities/default.json`: Add `updater:default` and `process:allow-restart`
- Endpoint: `https://github.com/user/repo/releases/latest/download/latest.json`
  - Note: actual owner/repo must match the GitHub repository
  - A `TAURI_UPDATE_PUBKEY` placeholder is used until real keys are generated

### CI/CD
- `release.yml`: Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars from secrets
- `tauri-action`: Already creates GitHub Releases; `updater: true` generates `latest.json` automatically

### Signing keys
- Generate with `npx tauri signer generate -w ~/.tauri/coachlm.key`
- Store private key as `TAURI_SIGNING_PRIVATE_KEY` GitHub Secret
- Embed public key in `tauri.conf.json` `plugins.updater.pubkey`
- Keys must never be regenerated after first release (breaks existing installs)

## Tests required

- Unit: None (plugin is third-party, no custom Rust logic)
- Integration: Manual test — build two versions, verify update flow
- TypeScript: `npx tsc --noEmit` passes with new imports
- Lint: `npm run lint` and `cargo clippy -- -D warnings` pass

## Out of scope

- Custom update server (using GitHub Releases)
- Update channels (beta/stable)
- Manual "Check for Updates" button in Settings (can be added later)
- macOS notarization
- Rollback mechanism

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | in-progress | Created |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
