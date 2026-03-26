---
id: S84
title: Ollama offline setup guide
status: done
created: 2026-03-26
updated: 2026-03-26
---

# S84 — Ollama offline setup guide

## User story

As a **runner**,
I want to **see clear setup instructions when Ollama is not running**
so that **I can install and start it without searching online**.

## Acceptance criteria

- [ ] Chat view shows an informational card when Ollama is the active provider but unreachable, replacing the empty-state prompt suggestions
- [ ] The card includes platform-specific instructions for macOS, Windows, and Linux (install + start)
- [ ] A "Check Connection" button re-checks the Ollama endpoint and dismisses the card on success
- [ ] Settings page expands the "Not reachable" indicator to include a collapsible setup guide (Accordion)
- [ ] When the user sends a message and gets the "Ollama is not running" error, the error card includes a "Setup Guide" link/button that opens the setup information
- [ ] Setup guide uses existing UI patterns: Card, Button, Accordion from shadcn/ui
- [ ] No new dependencies introduced
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

- Chat.tsx: Check Ollama status on mount (invoke check_ollama_status) when active_llm is ollama/local. If offline, render OllamaSetupGuide instead of prompt suggestions in the empty-state area.
- Settings.tsx: Add an Accordion below the "Not reachable" indicator with the same platform-specific instructions.
- New component: `src/components/OllamaSetupGuide.tsx` — reusable guide content used by both Chat and Settings.
- Reuse check_ollama_status Tauri command (already exists).
- Platform tabs: macOS, Windows, Linux — each with install command and start command.
- Link to https://ollama.com/download for the official download page.

## Tests required

- `npm run lint` passes
- `npx tsc --noEmit` passes
- `cargo clippy -- -D warnings` passes
- `cargo test` passes

## Out of scope

- Periodic polling / auto-refresh of Ollama status
- Auto-detecting the user's platform
- Installing Ollama from within the app

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-26 | draft | Created |
| 2026-03-26 | in-progress | Implementation started |
