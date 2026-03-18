---
id: S19
title: README
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S19 — README

## User story

As a **developer or runner discovering the project**,
I want to **read a clear README at the repo root**
so that **I understand what the app does, how to build it locally, and how to contribute**.

## Acceptance criteria

- [ ] README.md exists at repo root
- [ ] Hero section: project name, one-line description, screenshot or demo GIF
- [ ] Feature list covers: Strava sync, activity dashboard, LLM-powered coaching chat, context engine, FIT file import
- [ ] Prerequisites section lists exact required versions: Rust (rustup), Node.js, npm, and system dependencies per Tauri docs
- [ ] Local development section: `git clone` → install deps → set env vars → `cargo tauri dev` → working app in 5 commands or fewer
- [ ] Environment variables table lists every required and optional var with description, required/optional flag, and example value
- [ ] Build section documents `cargo tauri build` and where the output binary lands per platform
- [ ] Configuration section explains Settings screen options (Ollama setup, Strava OAuth)
- [ ] Architecture overview section (brief, with the directory tree from AGENTS.md) explains the main modules
- [ ] Contributing section references AGENTS.md and the stories workflow
- [ ] License badge and license section (must match the LICENSE file if one exists, else note it is unlicensed)
- [ ] All commands in code blocks are copy-pasteable and tested to work on a clean checkout

## Technical notes

README is documentation, not Rust code — no tests in the traditional sense. Accuracy is the test.
Cross-reference AGENTS.md for the directory structure; keep them consistent.
Screenshot / GIF can be a placeholder `docs/screenshot.png` committed alongside the README; it must be referenced with a relative path so it renders on GitHub.
Do not hard-code version numbers that will rot — link to the Rust toolchain or Tauri release page instead.
Use GitHub-flavoured Markdown. Tables, fenced code blocks, and badges render correctly there.
Badge suggestions: build status (links to the CI workflow), Rust version, license.

## Tests required

- Unit: n/a
- Integration: follow the README quickstart on a clean machine (or CI runner) and verify the app builds and launches
- Edge cases:
  - All links in the README resolve (no 404s) — can be checked with a link-checker GitHub Action
  - Screenshot path renders on GitHub (not a local absolute path)

## Out of scope

- Full API documentation
- Changelog (separate CHANGELOG.md story if needed)
- Translated versions
- GitHub Pages site

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
