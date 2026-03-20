---
id: S53
title: Plan tab restructure with calendar and weekly views
status: done
created: 2026-03-20
updated: 2026-03-20
---

# S53 — Plan tab restructure with calendar and weekly views

## User story

As a **runner**,
I want to **manage my training plans in a dedicated tab with calendar and weekly overview views**
so that **I can create multiple plans, see my schedule at a glance, and only have one active plan at a time**.

## Acceptance criteria

- [ ] Plan creation (race management + generate) lives in its own tab, always visible in the sidebar
- [ ] Calendar view shows the full plan grid (existing week x day layout)
- [ ] Weekly overview shows the current week's sessions in a card-based summary
- [ ] Multiple plans can exist in the database
- [ ] Only one plan can be active at a time (is_active flag on training_plans)
- [ ] Generating a new plan automatically sets it as active
- [ ] User can switch between plans in the plan list
- [ ] Navigation tab is always visible (not hidden when no plan exists)
- [ ] Rust lints pass: `cargo clippy -- -D warnings`
- [ ] Rust tests pass: `cargo test`
- [ ] TypeScript lints pass: `npm run lint`
- [ ] TypeScript types pass: `npx tsc --noEmit`

## Technical notes

### Backend changes (Rust)
- Add `is_active` column to `training_plans` table via migration
- Add `list_plans()` storage method — returns all plans with race name
- Add `set_active_plan(plan_id)` — deactivates all, activates one
- Update `generate_plan()` to auto-activate new plan
- Add Tauri commands: `list_plans`, `set_active_plan`
- New model: `TrainingPlanSummary` with race name, generated date, is_active, session count

### Frontend changes (TypeScript/React)
- Split `TrainingPlan.tsx` into:
  - `src/components/TrainingPlan/types.ts` — shared interfaces
  - `src/components/TrainingPlan/PlanCreator.tsx` — race CRUD + generate button + plan list
  - `src/components/TrainingPlan/PlanCalendar.tsx` — calendar grid + weekly overview + session modal
  - `src/components/TrainingPlan/index.tsx` — wrapper with sub-tab navigation
- Update `App.tsx`: always show "Plans" tab, remove hasPlan gating
- Add sub-tabs within the plan page: "My Plans" and "Schedule" (calendar/weekly)

### Navigation structure
- Sidebar: Chat | Dashboard | Context | Plans | Settings
- Plans tab sub-views: My Plans (races + plan list) | Schedule (calendar + weekly toggle)

## Tests required

- Unit: `list_plans` returns all plans ordered by generated_at
- Unit: `set_active_plan` deactivates others and activates target
- Unit: migration adds `is_active` column with default 0
- Edge cases: generating plan when another is active, viewing calendar with no active plan

## Out of scope

- Plan comparison (side-by-side two plans)
- Plan archiving or soft delete
- Plan sharing or export

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-20 | draft | Created |
| 2026-03-20 | in-progress | Implementation started |
| 2026-03-20 | done | Frontend + backend complete, all checks pass |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
