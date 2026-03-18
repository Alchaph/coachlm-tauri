---
id: S41
title: Heart rate zones from Strava
status: done
created: 2026-03-17
updated: 2026-03-18
---

# S41 — Heart rate zones from Strava

## User story

As a **runner using CoachLM**,
I want **my personal heart rate zones displayed in my profile context**
so that **the coach can reference them when giving training advice** (e.g., "Do this workout in zone 3").

## Problem

Today, the athlete profile stores max HR and resting HR, but not the full 5-zone system that coaches actually use. Strava calculates personalized HR zones based on the athlete's activity data and stores them in the athlete profile. Re-calculating zones locally (220 - age, etc.) is inaccurate compared to Strava's data-driven approach.

## Acceptance criteria

- [ ] Fetch and store the athlete's HR zones from Strava
- [ ] HR zones appear in the Context tab profile section
- [ ] HR zones are included in the context assembly so the coach can reference them
- [ ] If Strava is not connected, display a note: "Connect Strava to see your HR zones"
- [ ] HR zones auto-refresh after Strava sync completes
- [ ] Support both Strava's default zone ranges and custom zones (if user has configured them in Strava)

## Technical notes

Strava API endpoint: `GET /athlete` returns `heart_rate_zones` object with:
- Custom zones: `custom_zones` array with `min`, `max`, `name`
- Default zones: calculated zones based on user's max HR from recent activities

Format (example):
```json
{
  "heart_rate_zones": {
    "custom_zones": [
      {"min": 128, "max": 142, "name": "Zone 2"},
      {"min": 143, "max": 155, "name": "Zone 3"},
      ...
    ]
  }
}
```

New storage in `src-tauri/src/storage/mod.rs`:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct HeartRateZones {
    pub zone1: MinMax,
    pub zone2: MinMax,
    pub zone3: MinMax,
    pub zone4: MinMax,
    pub zone5: MinMax,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MinMax {
    pub min: i32,
    pub max: i32,
}
```

Update `athlete_profile` table: add `heart_rate_zones` TEXT column (JSON)

Strava sync (`src-tauri/src/strava/mod.rs`):
- After fetching activities, fetch athlete profile
- Extract `heart_rate_zones` if available
- Save to database

Context assembly (`src-tauri/src/context/mod.rs`):
- Add HR zones block to profile section
- Format as readable text:
  ```
  Heart Rate Zones:
  - Zone 1: 128-142 bpm (recovery)
  - Zone 2: 143-155 bpm (endurance)
  - Zone 3: 156-168 bpm (tempo)
  - Zone 4: 169-181 bpm (threshold)
  - Zone 5: 182+ bpm (VO2 max)
  ```

Frontend: Update `src/components/Context.tsx` profile section to display HR zones

## Tests required

- Unit: HR zones parsing from Strava API response
- Unit: HR zones JSON serialization/deserialization (using `serde_json`)
- Unit: context assembly includes formatted HR zones when available
- Integration: fetch from real Strava account → save → retrieve → display in UI
- Edge cases:
  - Strava athlete endpoint returns no HR zones (e.g., account with no HR data) — display "No HR zones available"
  - Custom zones vs default zones — store whichever is returned
  - Sync after disconnecting Strava — HR zones remain from last successful sync (don't clear)
  - Very old HR zones from Strava — no expiration logic; show what we have

## Out of scope

- Calculating zones locally (220 - age, Karvonen, etc.) — use Strava's data only
- Dynamic zone updates based on fitness changes — rely on Strava's refresh
- Zone editing in CoachLM UI — must edit in Strava
- Power zones, pace zones (HR only for now)
- Visual zone charts or training load analysis (future story)

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-17 | draft | Created |
| 2026-03-18 | done | Updated to Tauri v2 + React + Rust architecture |

---

<!-- Agent: add a Blocker section here if status is set to failed -->
