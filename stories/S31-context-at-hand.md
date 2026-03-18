---
id: S31
title: Context at hand — profile in onboarding and auto-rebuild after sync
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S31 — Context at hand — profile in onboarding and auto-rebuild after sync

## User story

As a runner using CoachLM for the first time,
I want to enter my athlete profile during onboarding and have my context automatically built after Strava sync
so that my AI coach has all relevant context from the very first conversation.

## Problem

The context engine assembles data when needed, but two flows can leave it empty:

1. **Onboarding wizard** — collects LLM config and Strava credentials but may skip athlete profile data. The profile stays empty until the user visits the Context tab.
2. **Post-Strava sync** — activities are stored but the training summary is not pre-built. The user has no indication of what the LLM will see.

## Acceptance criteria

### Onboarding — athlete profile step

- [ ] A new step is added to the onboarding wizard between the Strava step and the finish step, making the wizard 5 steps total
- [ ] The new step collects: age, max HR, threshold pace, weekly mileage target, race goals, injury history
- [ ] All fields are optional — the user can skip the entire step
- [ ] On Next or Skip, the profile is saved via the save_profile_data Tauri command
- [ ] The progress indicator updates to reflect 5 steps
- [ ] If the user connected Strava, a background sync is triggered automatically before the profile step

### Post-Strava sync — context rebuild and preview

- [ ] After sync completes, a new Tauri event strava:sync:context-ready is emitted containing a preview of the assembled context
- [ ] The preview includes: profile summary, training summary (4-week rolling), and pinned insights count
- [ ] A new Tauri command get_context_preview returns the fully assembled system prompt
- [ ] The Dashboard sync completion state shows a brief context summary
- [ ] The onboarding finish step shows a context readiness indicator

### Context freshness

- [ ] After every Strava sync, the Context tab reflects the latest training summary without requiring a page reload by listening for the strava:sync:context-ready event

## Technical notes

### Backend

- get_context_preview in src-tauri/src/lib.rs: calls build_context() in src-tauri/src/context/mod.rs with current profile, activities, and insights.
- After sync completes in sync_strava_activities, emit the result as strava:sync:context-ready event payload.

### Frontend

- src/components/Onboarding.tsx: add step between Strava and Finish. New step uses a form identical to the profile section in Context.tsx. Update step count to 5.
- Threshold pace input: minutes and seconds fields converted to total seconds before saving.
- src/components/Dashboard.tsx: on strava:sync:complete, show a context summary.
- src/components/Context.tsx: listen for strava:sync:context-ready and refresh displayed data.

## Tests required

- Unit: get_context_preview returns valid prompt with profile, activities, and insights
- Unit: get_context_preview handles missing profile or activities gracefully
- Integration: after sync, strava:sync:context-ready event is emitted with non-empty preview
- Frontend: onboarding wizard has 5 steps, profile step saves data correctly

## Out of scope

- Modifying context compression logic or token budget
- Adding new profile fields
- Auto-syncing Strava on app startup

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
