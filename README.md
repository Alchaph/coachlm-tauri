# CoachLM

A local-first desktop app for runners. Syncs activities from Strava, stores everything in SQLite, and routes conversations to a local LLM via Ollama. No cloud. No telemetry.

## Features

- Strava OAuth integration with automatic activity sync
- FIT file import for manual uploads
- Encrypted token storage (AES-256-GCM)
- Structured athlete context (profile, training load, race history)
- Chat interface backed by Ollama (local LLM)
- Chat insights saved back into context for future sessions
- Training plan generation
- Dark theme UI

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Node.js](https://nodejs.org/) (v20+)
- [Ollama](https://ollama.com/) running locally
- Tauri v2 system dependencies ([see platform guide](https://v2.tauri.app/start/prerequisites/))

## Setup

```sh
git clone <repo-url>
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

## Lint and test

```sh
# TypeScript
npm run lint
npx tsc --noEmit

# Rust (from src-tauri/)
cargo clippy -- -D warnings
cargo test
```
