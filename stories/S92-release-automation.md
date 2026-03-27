---
id: S92
title: Release automation script
status: done
created: 2026-03-27
updated: 2026-03-27
---

# S92 — Release automation script

## User story

As a **developer**,
I want a single script that bumps versions and creates a release tag
so that **version files never get out of sync and releases are error-free**.

## Acceptance criteria

- [x] A `scripts/release.sh` script exists
- [x] Script accepts a semver bump type: `patch`, `minor`, or `major`
- [x] Script reads current version from `package.json`
- [x] Script computes next version based on bump type
- [x] Script updates `package.json` version field
- [x] Script updates `src-tauri/tauri.conf.json` version field
- [x] Script creates a git commit with message `chore: release vX.Y.Z`
- [x] Script creates a git tag `vX.Y.Z`
- [x] Script does NOT push (user pushes manually)
- [x] Script validates no uncommitted changes before running
- [x] Script is executable (`chmod +x`)

## Technical notes

### Version locations (must stay in sync)
1. `package.json` → `"version": "X.Y.Z"`
2. `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
3. Git tag → `vX.Y.Z`

### Implementation
Use a bash script with `jq` for JSON manipulation (or `sed` if `jq` is not available as fallback).

```bash
#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/release.sh [patch|minor|major]
```

### Validation checks
- Working tree must be clean (no uncommitted changes)
- Must be on `main` branch
- Bump type must be one of: patch, minor, major

## Tests required

- Script with `--dry-run` flag shows what would happen without modifying files
- Manually verify: `patch` bumps `1.22.0` → `1.22.1`
- Manually verify: `minor` bumps `1.22.0` → `1.23.0`
- Manually verify: `major` bumps `1.22.0` → `2.0.0`

## Out of scope

- Automatic push to remote
- Release notes generation (handled by CI)
- Cargo.toml version (not used for release versioning)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-27 | done | Created and tested — patch: 1.22.0 → 1.22.1, minor: 1.22.0 → 1.23.0, major: 1.22.0 → 2.0.0 all verified with --dry-run |
