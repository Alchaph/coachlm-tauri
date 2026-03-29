# CoachLM

Your personal AI running coach. A local-first desktop app that syncs your activities from Strava, builds a structured athlete profile, and lets you chat with an LLM that actually knows your training history. No cloud. No telemetry. Your data stays on your machine.

Built with Tauri v2, React, and Rust.

## Features

### Chat
- Multi-session chat with tab management
- Streaming LLM responses with Markdown rendering
- Progress stepper for multi-step coaching workflows
- Chat insights are saved back into your athlete context, so the coach remembers what matters

### Dashboard
- Activity list with search and filtering
- Heart rate zone distribution charts
- Lap-by-lap analysis with pace, HR, cadence, and elevation
- Training load stats cards (weekly distance, time, elevation)
- Activity detail modal with interactive charts (Recharts)

### Training Plans
- AI-generated training plans tied to specific races
- Calendar view for scheduled workouts
- Race management with goal times and priorities

### Strava Integration
- OAuth flow with automatic token refresh
- Background activity sync with deduplication
- Stale-scope detection and re-auth prompting
- Activity zone backfill with rate-limit-aware batching

### FIT File Import
- Manual upload for activities not on Strava
- Parses laps, HR, cadence, and GPS data from `.fit` files

### Athlete Context
- Structured profile (age, weight, resting HR, max HR, threshold pace, VO2max)
- Training summaries compressed over time to fit token budgets
- Pinned insights from chat are never dropped or compressed
- Race history tracking

### Additional Features
- Web search integration for coaching queries
- Research agent for deep-dive analysis
- Shoe tracking and mileage calculator
- Guided onboarding wizard
- In-app auto-updater via GitHub Releases

## LLM Providers

CoachLM supports three LLM backends. Configure your preferred provider in Settings.

| Provider | Type | Notes |
|---|---|---|
| [Ollama](https://ollama.com/) | Local | Runs on your machine. No API key needed. |
| [Groq](https://groq.com/) | Cloud | Fast inference. Requires API key. |
| [OpenRouter](https://openrouter.ai/) | Cloud | Access to many models. Requires API key. |

## Security

- OAuth tokens encrypted at rest with AES-256-GCM
- Encryption key derived via Argon2
- Content Security Policy headers enforced
- `unsafe` code denied at the compiler level
- No telemetry, no analytics, no external data sharing

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Node.js](https://nodejs.org/) (v20+)
- Tauri v2 system dependencies ([see platform guide](https://v2.tauri.app/start/prerequisites/))
- At least one LLM provider: [Ollama](https://ollama.com/) running locally, or a Groq/OpenRouter API key

## Setup

```sh
git clone https://github.com/Alchaph/coachlm-tauri.git
cd coachlm-tauri
npm install
```

To enable Strava sync, set your API credentials before building:

```sh
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
```

## Run locally

```sh
npm run tauri dev
```

## Build

```sh
npm run tauri build
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`.

Supported platforms: macOS, Windows, Linux.

## Lint and test

```sh
# TypeScript
npm run lint
npx tsc --noEmit

# Rust (from src-tauri/)
cargo clippy -- -D warnings
cargo test

# Frontend unit tests
npm test

# End-to-end tests
npm run e2e
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Tauri v2 |
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Styling | Tailwind CSS 4, shadcn/ui, CSS variables (dark theme) |
| Backend | Rust (edition 2021) |
| Database | SQLite via rusqlite |
| Charts | Recharts |
| Icons | lucide-react |
| Notifications | sonner |
| Testing | Vitest + Testing Library, Playwright, cargo test + clippy pedantic |

## Project Structure

```
src/                    React frontend
  components/
    chat/               Chat interface, sessions, message rendering
    dashboard/          Activity list, charts, stats, detail modal
    training-plan/      Plan generation, calendar, race management
    context/            Athlete profile, insights, training summary
    onboarding/         Setup wizard
    settings/           LLM provider config, Strava connection
    ui/                 shadcn/ui primitives
  styles/               Global CSS

src-tauri/              Rust backend
  src/
    lib.rs              Tauri commands and app setup
    models.rs           Shared data types
    storage/            SQLite layer and migrations
    strava/             OAuth, activity sync, zone backfill
    llm/                Ollama, Groq, and OpenRouter clients
    context/            Context engine and prompt assembly
    plan/               Training plan generation
    fit/                FIT file parser

stories/                Feature story files (one per feature)
```

## License

See [LICENSE](LICENSE) for details.
