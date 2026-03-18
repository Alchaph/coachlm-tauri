---
id: S50
title: Consolidate user context inputs into Context tab
status: done
created: 2026-03-18
updated: 2026-03-18
---

# S50 — Consolidate user context inputs into Context tab

## User story

As a runner using CoachLM, I want all my athlete profile and context-related inputs in a single dedicated Context tab, so that I have a clear, unified place to manage my personal information and avoid confusion from duplicated inputs across the application.

## Acceptance criteria

- [ ] Remove duplicate Athlete Profile form from Onboarding wizard
- [ ] Onboarding guides new users to complete their profile in the Context tab instead
- [ ] Context tab is the canonical location for Athlete Profile fields (age, maxHR, threshold pace, weekly mileage, race goals, injury history, experience level, training days, resting HR, preferred terrain)
- [ ] Settings tab retains LLM configuration (Ollama endpoint, Ollama model) and Strava connection actions
- [ ] Custom System Prompt is managed in the Settings tab
- [ ] Context Export/Import buttons are located in the Settings tab
- [ ] Pinned Insights are displayed and managed in the Context tab
- [ ] Navigation works correctly: onboarding completion leads to the Context tab
- [ ] All tests pass: `cargo test` and TypeScript checks
- [ ] No data loss: existing profiles saved via onboarding continue to work

## Technical notes

### Current state

**Athlete Profile fields**:
- `src/components/Context.tsx` — canonical profile form
- `src/components/Onboarding.tsx` — previously contained a duplicate profile step

**Backend commands**:
- `src-tauri/src/lib.rs`: `get_profile_data`, `save_profile_data`
- `src-tauri/src/storage/mod.rs`: `AthleteProfile` struct, persistence logic
- Validation: Age 1-120, MaxHR 100-220, ThresholdPaceSecs > 0

**Settings/Preferences** (in `Settings.tsx`):
- Ollama endpoint and model configuration
- Custom System Prompt
- Context Export/Import buttons

### Files to change

**Frontend**:
- `src/components/Onboarding.tsx`
  - Remove the profile step and associated state
  - Replace with a call-to-action: "Complete your athlete profile in the Context tab"
  - On completion, navigate the user to the Context tab
- `src/components/Context.tsx`
  - Ensure it remains the primary interface for profile management
- `src/components/Settings.tsx`
  - Maintain LLM and Strava configuration
- `src/App.tsx`
  - Ensure tab navigation state transitions correctly from onboarding

**Backend**:
- `src-tauri/src/lib.rs`: No changes needed to existing Tauri commands
- `src-tauri/src/storage/mod.rs`: No changes needed to storage logic

### Validation and UX considerations

**Onboarding behavior change**:
- Users are no longer forced to fill out a long profile form during the initial setup. They are instead introduced to the app and directed to the Context tab for detailed configuration.

**Optional vs required fields**:
- The backend validation allows for partial profile updates, but core metrics like age and maxHR are recommended for accurate coaching.

## Testing requirements

- Unit: `src-tauri/src/storage/mod.rs` — verify profile persistence and validation
- Integration: Verify that `save_profile_data` Tauri command correctly updates the SQLite database
- Frontend: `npx tsc --noEmit` to ensure type safety after component refactoring

## Out of scope

- Backend storage schema changes
- New Tauri commands or modifications to existing ones
- Moving Strava connection UI (stays in Settings)
- Moving chat UI (stays separate)

---

## Status history

| Date | Status | Notes |
|------|--------|-------|
| 2026-03-18 | draft | Created story |
| 2026-03-18 | done | Profile inputs consolidated into Context tab. Onboarding streamlined. `cargo test` passes. |
