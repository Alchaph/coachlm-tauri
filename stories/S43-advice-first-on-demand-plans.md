---
id: S43
title: Advice-first coaching with on-demand plans
status: done
created: 2026-03-17
updated: 2026-03-18
---

# S43 — Advice-first coaching with on-demand plans

## User story

As a **runner asking "how do I get faster?"**,
I want **concise, tailored advice based on my physiology and training history**
so that **I understand the principles before committing to a structured training plan**.

## Problem

The coach currently defaults to generating full training plans even for simple questions. When a user asks "how do I get faster?", they want a direct answer explaining the principles (e.g., "Increase your threshold pace through tempo runs, add long runs for endurance, prioritize recovery") — not an 8-week schedule. Plans should be explicit deliverables, not the default response to every question.

## Acceptance criteria

- [ ] Coach responds to general questions with direct, principle-based advice first
- [ ] Coach references the athlete's actual profile data (threshold pace, recent mileage, HR zones) in advice
- [ ] Coach offers a plan only when:
  - User explicitly requests a plan ("Give me a training plan for...")
  - User clicks the "Generate Training Plan" button in the UI
  - The coach determines a plan is truly needed and asks "Would you like me to generate a structured training plan?"
- [ ] Chat UI has a "Generate Training Plan" button that sends a pre-configured prompt
- [ ] The plan prompt includes goal details (race type, date, target time if known)
- [ ] Coach asks clarifying questions before generating a plan (e.g., "What's your target race and date?")
- [ ] Plans are structured (weekly breakdown, key workouts, recovery days) but concise
- [ ] Coach's advice is typically < 150 words; plans can be longer but still focused

## Technical notes

Update coaching system prompt (`src-tauri/src/context/mod.rs`):
Add new response rule:
```
## When to Generate Training Plans
- Do NOT generate a full training plan unless:
  1. The user explicitly asks for one ("Give me a plan", "Create a schedule")
  2. The user clicks the "Generate Training Plan" button
  3. The coach determines a plan is needed and asks for permission first
- Default to direct, principle-based advice (e.g., "Focus on threshold work to improve your 5K pace")
- Reference the athlete's threshold pace, recent mileage, HR zones when giving advice
- If the user's question is broad ("How do I get faster?"), explain the approach, then ask if they want a plan
```

Frontend: Add "Generate Training Plan" button in `src/components/Chat.tsx`
- Location: Near chat input
- Action: Sends a structured prompt to the LLM:
  ```
  Generate a structured training plan for me. My goal is [USER_INPUT].
  Current profile: [FROM_CONTEXT]
  Recent training: [FROM_CONTEXT]
  Saved insights: [FROM_CONTEXT]
  ```
- Opens a modal or inline input for goal details (race, date, target time)

Tauri command (extend `src-tauri/src/lib.rs` if needed):
- May not need new command; just send a message via `send_message`
- Consider adding `generate_training_plan(goal: String)` if we want to track plan requests separately

## Tests required

- Unit: updated system prompt includes "When to Generate Training Plans" section
- Unit: coach responds to broad question ("how do I get faster?") with advice, not a plan
- Unit: coach responds to explicit plan request with structured plan
- Integration: "Generate Training Plan" button sends correct prompt and receives plan
- Integration: coach asks clarifying questions when goal is vague
- Edge cases:
  - User asks for plan but has no profile data — coach asks for basic info first
  - User clicks plan button but goal is empty — show validation error
  - User rejects plan offer — coach respects and continues with advice
  - Very long plan requested (e.g., 6-month marathon build) — plan is still structured and not overwhelming

## Out of scope

- Plan templates or presets (e.g., "Hal Higdon beginner") — coach generates custom plans
- Plan visualization (calendar view, charts) — future story
- Plan tracking or adherence monitoring (marking workouts done/missed) — future story
- Dynamic plan adjustment based on missed workouts — future story
- Plan export to calendar apps — future story

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-17 | draft | Created |
| 2026-03-18 | done | Updated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
