---
id: S68
title: Replace window.confirm with Tauri dialog plugin
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S68 — Replace window.confirm with Tauri dialog plugin

## User story

As a **user**,
I want **native confirmation dialogs instead of browser-style alerts**
so that **the app feels like a proper desktop application**.

## Acceptance criteria

- [ ] All `window.confirm()` calls replaced with `ask()` from `@tauri-apps/plugin-dialog`
- [ ] Confirm dialogs use the app name as title and appropriate messages
- [ ] Destructive actions use `kind: "warning"` for a warning-style dialog
- [ ] `npm run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes

## Technical notes

Three `window.confirm()` calls to replace:
1. `Context.tsx:93` — "Unpin this insight?"
2. `Chat.tsx:143` — "Delete this chat session?"
3. `TrainingPlan/PlanCreator.tsx:186` — "Delete this race? This will also remove any associated training plans."

The `@tauri-apps/plugin-dialog` package is already installed (package.json) and the Rust plugin is already registered (lib.rs:608). Just need to import and call `ask()`.

API: `const confirmed = await ask(message, { title, kind: "warning" });` returns `boolean`.

## Tests required

- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Adding new confirmation dialogs
- Changing dialog messages

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | in-progress | Implementation started |
