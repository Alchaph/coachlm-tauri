---
id: S22
title: Training plan generation
status: done
created: 2026-03-16
updated: 2026-03-18
---

# S22 — Training plan generation

## User story

As a **runner**,
I want to **describe my goal race and have the app generate a personalised weekly training plan**
so that **every session I do between now and race day is purposeful, load-appropriate, and grounded in my actual fitness**.

## Acceptance criteria

### Race wizard
- [ ] User can create a "goal race" with: race name, distance (preset list + custom km), date, terrain (road / trail / track), elevation gain (optional), goal finish time (optional), priority level (A/B/C race)
- [ ] Multiple goal races can exist; only one is "active" at a time
- [ ] Races are stored in SQLite (races table) and editable/deletable
- [ ] Weeks-to-race is computed automatically from today's date and shown to the user before generation

### Plan generation
- [ ] User triggers plan generation from the race detail screen; a confirmation screen shows what context will be used (race info, profile fields, training history window)
- [ ] The app assembles a generation prompt from: athlete profile (S05), last 8 weeks of training summary (extended window vs. the usual 4), all pinned insights (S07), goal race details, and a structured plan schema description
- [ ] The generation prompt is sent to the Ollama LLM client via the existing LLM interface (`src-tauri/src/llm/mod.rs`)
- [ ] The LLM response is parsed into a structured plan: N weeks x 7 days, each day having zero or one session
- [ ] Each session contains: session type (easy / tempo / intervals / long run / strength / rest), target duration (minutes), target distance (km, optional), target HR zone (1-5, optional), target pace range (optional), notes/description (free text, max 300 chars)
- [ ] The app validates the parsed plan (no missing required fields, sane durations, race week is the final week) and retries the LLM call up to 2 times on parse failure before surfacing an error
- [ ] Generated plan is saved to SQLite and linked to the race record

### Plan UI
- [ ] A "Training Plan" top-level section appears in the navigation once a plan exists
- [ ] Default view is a weekly calendar: columns = Mon-Sun, rows = weeks, each cell shows session type + duration as a colour-coded chip
- [ ] Clicking a session opens a detail panel: all session fields, editable notes
- [ ] User can mark a session as: completed, skipped, or modified (with actual duration/distance recorded)
- [ ] A weekly summary bar shows planned vs. actual volume for the week
- [ ] Weeks in the past are visually distinguished from upcoming weeks
- [ ] Clicking "Regenerate plan" from the race detail triggers a new LLM call with the same inputs plus a diff note

### Plan as context
- [ ] The active training plan is included as a new context block in the prompt assembler (S08), slotted between the profile block and training summary block
- [ ] The plan block includes: race name, date, weeks remaining, current week's sessions, next week's sessions — no more (token budget respected)
- [ ] Pinned insights remain highest priority; plan block is compressed before the training summary block

### Adjustment chat
- [ ] From any session detail, user can open a chat pre-seeded with "I want to adjust this session: [session details]"
- [ ] The full coaching context (including plan block) is present so the LLM can suggest a coherent swap

## Technical notes

### New modules and files

  src-tauri/src/plan/mod.rs — prompt assembly + LLM call + response parsing + SQLite CRUD
  src-tauri/src/models.rs   — Rust structs: Race, TrainingPlan, PlanWeek, PlanSession
  src/components/TrainingPlan.tsx — React component for the plan UI
  src-tauri/src/lib.rs      — Tauri commands (see below)

### SQLite schema

  races table: id (UUID PK), name, distance_km, race_date, terrain (road/trail/track), elevation_m (nullable), goal_time_s (nullable), priority (A/B/C), is_active, created_at
  training_plans table: id, race_id (FK), generated_at, llm_backend, prompt_hash (SHA-256)
  plan_weeks table: id, plan_id (FK), week_number, week_start; UNIQUE(plan_id, week_number)
  plan_sessions table: id, week_id (FK), day_of_week (1-7), session_type, duration_min, distance_km, hr_zone (1-5), pace_min_low, pace_min_high, notes, status (planned/completed/skipped/modified), actual_duration_min, actual_distance_km, completed_at

### Tauri commands (src-tauri/src/lib.rs)

  create_race(race: Race) -> Result<Race, String>
  update_race(race: Race) -> Result<(), String>
  delete_race(id: String) -> Result<(), String>
  list_races() -> Result<Vec<Race>, String>
  set_active_race(id: String) -> Result<(), String>
  generate_plan_cmd(race_id: String) -> Result<TrainingPlan, String>
  get_active_plan() -> Result<Option<TrainingPlan>, String>
  get_plan_weeks(plan_id: String) -> Result<Vec<PlanWeek>, String>
  update_session_status(session_id: String, status: String, actual: ActualMetrics) -> Result<(), String>

### LLM prompt structure

The generation prompt instructs the LLM to return a JSON object matching the plan schema. System prompt establishes the LLM as an expert running coach and states that only valid JSON must be returned (no prose wrapping). Parse with `serde_json`. If parsing fails, strip markdown code fences and retry before counting as a failure. Log the raw LLM response on every parse failure.

### Context block (S08 integration)

Plan block formats: race name, date, weeks remaining, current week sessions, next week sessions. Capped at 400 tokens. Slot: after profile block, before training summary block.

### Session type colour coding

  easy → green-400
  long_run → blue-500
  tempo → orange-400
  intervals → red-500
  strength → purple-400
  rest → gray-200
  race → yellow-500

## Tests required

- Unit — src-tauri/src/models.rs: struct validation (missing required fields, out-of-range HR zone, past race date)
- Unit — src-tauri/src/plan/mod.rs: race CRUD, plan CRUD, session status updates, active race constraint, cascade delete
- Unit — src-tauri/src/plan/mod.rs: prompt assembly (correct fields, token count within limit), JSON parse success, parse failure + fence strip + retry, 2-failure error propagation
- Unit — src-tauri/src/plan/mod.rs: current week detection, next week inclusion, token cap enforcement, empty plan handling
- Integration — generation pipeline: mock LLM returns valid JSON → plan persisted → retrievable with all sessions
- Integration — S08 hook: assembled prompt includes plan block in correct priority position
- Integration — session completion: mark session completed with actual metrics → reflected in weekly summary
- Edge cases:
  - Race date is less than 4 weeks away → abbreviated plan, warning shown
  - Race date is in the past → wizard blocks creation with validation error
  - LLM returns plan with wrong number of weeks → validation catches mismatch, triggers retry
  - LLM returns prose instead of JSON (even after fence strip) → 3rd failure returns descriptive error to UI
  - Active plan exists when regenerate triggered → old plan archived (not deleted), new plan becomes active
  - Plan block alone exceeds token budget → cap enforced, no panic
  - Athlete has zero historical activities → generation proceeds with profile + race data only; warning shown

## Out of scope

- Automatic session adjustment when Strava activity deviates from plan (smart adaptation engine — separate story)
- Heart-rate-based zone auto-calibration from activity data
- Multi-race periodisation across a full season
- Sharing or exporting the plan as PDF or calendar (.ics)
- Social or coach-review features
- Integration with Garmin / Wahoo to push sessions to devices

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-16 | draft | Created |
| 2026-03-18 | done | Migrated to Tauri v2 + Rust architecture. Full implementation: Rust backend (schema, storage, generator, context block), Tauri commands, frontend (TrainingPlan.tsx), e2e tests. All cargo test + npx tsc --noEmit passing. |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
