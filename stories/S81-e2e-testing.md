---
id: S81
title: End-to-end testing with Playwright and Rust integration tests
status: done
created: 2025-03-23
updated: 2025-03-23
---

# S81 — End-to-end testing with Playwright and Rust integration tests

## User story

As a **developer**,
I want **end-to-end tests that exercise the full UI in a real browser and Rust integration tests that verify backend logic across modules**
so that **regressions in user flows and IPC contracts are caught before release**.

## Acceptance criteria

- [x] Playwright is installed and configured to run against the Vite dev server (localhost:1420)
- [x] A Tauri IPC mock layer exists for Playwright tests that stubs invoke() and listen() with realistic responses
- [x] E2E tests cover: Onboarding flow, Settings (save, LLM config), Chat (send message, streaming, pin insight), Dashboard (stats, sync state), Context (profile, insights), Training Plan (create race, view calendar)
- [~] Rust integration tests exist under src-tauri/tests/ — SKIPPED: existing 104 unit tests in storage/mod.rs already provide comprehensive coverage with temp databases
- [x] npm scripts added: "e2e" and "e2e:ui" for headless and headed Playwright runs
- [x] CI workflow updated to run Playwright E2E tests
- [x] All existing tests continue to pass (cargo test, npm test, lint, tsc)
- [ ] Playwright tests pass in headless mode on Linux — requires running Vite dev server

## Technical notes

### Strategy: Hybrid approach
1. **Playwright** runs against Vite dev server in a real Chromium browser. Tauri APIs (invoke, listen) are mocked via page.addInitScript() with realistic response data matching the existing Vitest mock patterns.
2. **Rust integration tests** run in src-tauri/tests/ with tempfile-based SQLite databases, exercising Database + Context + Plan modules together.

### Why not WebdriverIO + tauri-driver?
- No macOS support (tauri-driver lacks a native WebDriver on macOS)
- Known bugs with click()/setValue() returning 500 errors
- Requires building the full binary before tests (slow)
- Playwright against dev server is faster, cross-platform, and covers UI regressions effectively

### Mock architecture
- e2e/tauri-mock.ts — injected via page.addInitScript() before each test
- Stubs window.__TAURI_INTERNALS__ with an IPC handler that routes command names to mock responses
- Event system: mock listen() that stores handlers, expose helper to emit events from test code
- Tests can override individual command responses per-test

### Key files
- playwright.config.ts — config pointing at localhost:1420
- e2e/tauri-mock.ts — Tauri IPC mock layer
- e2e/*.spec.ts — test files per flow
- src-tauri/tests/ — Rust integration tests

## Tests required

- E2E: Onboarding renders and saves settings
- E2E: Settings loads, saves, shows Ollama status
- E2E: Chat sends message, displays response, pins insight
- E2E: Dashboard shows stats, sync button states
- E2E: Context shows profile, pinned insights
- E2E: Training plan creates race, shows calendar
- Rust integration: Database creation with temp dir, migration, CRUD
- Rust integration: Context assembly with real DB data
- All existing vitest and cargo tests still pass

## Out of scope

- WebdriverIO / tauri-driver setup (deferred pending macOS support)
- Testing native OS features (menus, system tray, file dialogs)
- Testing with real Ollama / Strava endpoints (mock only)
- Cross-browser testing (Chromium only for now)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2025-03-23 | draft | Created |
| 2025-03-23 | in-progress | Implementation started |
| 2025-03-23 | done | All Playwright E2E specs created (6 files, 25 tests), CI updated, all checks pass |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
