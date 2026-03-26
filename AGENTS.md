# AGENTS.md

This file is the contract for any AI agent working on this codebase.
Read it fully before touching any code.

---

## Project overview

A Tauri v2 desktop app for runners that:
- Syncs activities automatically via Strava API
- Parses and stores activity metrics in SQLite
- Maintains a structured athlete context (profile, training load, insights)
- Routes chat to Ollama (local LLM)
- Saves chat insights back into the context for future sessions

This app is local only. It does not use cloud sync.

### Landing page

The project landing page (marketing / product website) lives on a separate branch: `feat/website`. Do not merge it into `main`. If you need to work on the landing page, check out that branch first. Do not mix landing page changes with app changes.

The landing page is deployed to GitHub Pages at **https://alchaph.github.io/coachlm-tauri/**.

#### How deployment works

- A GitHub Actions workflow (`.github/workflows/pages.yml`) deploys the site automatically on every push to `feat/website`.
- The workflow runs `npm ci && npm run build`, uploads the `dist/` folder, and deploys via `actions/deploy-pages`.
- Manual deployment can also be triggered via `workflow_dispatch` in the Actions tab.
- Vite's `base` is set to `/coachlm-tauri/` in `vite.config.ts` to match the GitHub Pages subpath. Do not change this unless the repo is moved or a custom domain is configured.

#### How to update the landing page

1. Check out the `feat/website` branch. If a worktree already exists (e.g. at `../coachlm-website`), work there instead.
2. Make changes in `src/`. The site is a Vite + React + TypeScript project (no Tailwind, no shadcn — inline styles + CSS variables).
3. Run `npm run build` to verify the build passes.
4. Commit and push to `feat/website`. The Pages workflow will deploy automatically within a few minutes.
5. Verify at https://alchaph.github.io/coachlm-tauri/.

#### Rules for landing page changes

- Do not merge `feat/website` into `main` or vice versa.
- Do not add app dependencies (Tauri, shadcn, etc.) to the landing page `package.json`.
- Do not hardcode version numbers in download links. The site fetches the latest release from the GitHub API at runtime.
- The landing page has its own `package.json`, `tsconfig.json`, and `vite.config.ts`. These are independent from the app's config files.

---

## Non-negotiable workflow

Every task follows this exact sequence. No exceptions.

1. READ: Load the story file for the feature you are working on.
2. UPDATE: Set story status to `in-progress`.
3. BUILD: Implement the feature exactly as specified.
4. TEST: Run `cargo clippy -- -D warnings` and `cargo test` for Rust. Run `npm run lint` and `npx tsc --noEmit` for TypeScript. Run `npm run tauri dev`. Also run the e2e and other tests to verify.
5. UPDATE: Set story status to `done` (or `failed` with notes).
6. COMMIT: git commit with message format: `feat|fix|docs(SXX): short description`.
7. RELEASE: Create and push a semver tag (e.g. `v1.8.2`). This triggers the release pipeline.
8. CHECK: use gh to check if the build pipelines are green. this should be if the local tests are also green

If a story file does not exist for what you are about to build, stop and create one first.

### Release versioning

Tags follow `vMAJOR.MINOR.PATCH` semver:

- **PATCH** bump: bug fix story (e.g. `fix:`)
- **MINOR** bump: new feature story (e.g. `feat:`)
- **MAJOR** bump: breaking change (rare; discuss first)

Always check the latest tag before creating a new one:

```bash
git tag --sort=-v:refname | head -5
```

Use the next semver after the highest `vX.Y.Z` tag. Do not create `v0.XX` style tags for individual stories. Every release tag must be a proper `vMAJOR.MINOR.PATCH` that advances the sequence.

### Version files (must stay in sync with the git tag)

Three places carry the version. All three must match the tag being created:

| File | Field | Example |
|---|---|---|
| `package.json` | `"version"` | `"1.4.0"` |
| `src-tauri/tauri.conf.json` | `"version"` | `"1.4.0"` |
| git tag | `vX.Y.Z` | `v1.4.0` |

Before creating a release tag, update both files to the new version and include the change in the release commit. Failing to do this will cause the app binary to report the wrong version.

### Release notes

Every release must include notes. The release workflow auto-generates them from commit messages since the previous tag, grouped by type:

```
## Features
- feat(S12): add chat history sidebar

## Fixes
- fix(S37): prevent scroll jump on pin

## Documentation
- docs(S19): update README with setup instructions

## Other
- chore: scaffold project
```

Rules for release notes:

- Notes are generated from commit messages. Write good commit messages.
- Group commits by prefix: `feat` -> Features, `fix` -> Fixes, `docs` -> Documentation, everything else -> Other.
- No emojis anywhere in commit messages or release notes.
- No marketing language. State what changed, not why it is exciting.
- If a release has no commits (empty diff), do not create a tag.

---

## Repository structure

```
/
├── AGENTS.md               ← you are here
├── stories/                ← one .md file per feature
│   ├── _template.md        ← copy this when creating new stories
│   ├── S01-strava-oauth.md
│   ├── S02-activity-sync.md
│   └── ...
├── src/                    ← React frontend (TypeScript)
│   ├── components/         ← Chat, Dashboard, Context, Settings, Onboarding, TrainingPlan
│   ├── styles/             ← global.css, markdown.css
│   ├── App.tsx             ← Main shell with sidebar navigation
│   └── main.tsx
├── src-tauri/              ← Rust backend
│   ├── src/
│   │   ├── lib.rs          ← Tauri commands + app setup
│   │   ├── models.rs       ← All data types
│   │   ├── storage/        ← SQLite layer
│   │   ├── strava/         ← Strava API client + OAuth
│   │   ├── llm/            ← Ollama HTTP client
│   │   ├── context/        ← Context engine + prompt assembler
│   │   ├── plan/           ← Training plan generator
│   │   └── fit/            ← FIT file parser
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── tsconfig.json
```

---

## Story file format

Every story lives in `/stories/SXX-short-name.md`.
Use the template at `/stories/_template.md`.

### Status values

| Status | Meaning |
|---|---|
| `draft` | Written, not started |
| `in-progress` | Agent is actively working on it |
| `done` | Implemented, tested, passing |
| `failed` | Blocked or tests not passing. Add notes. |
| `skipped` | Deliberately deferred |

### Updating status

At the top of the story file there is a `status:` field in the frontmatter.
Update it by editing that line. Do not change anything else in the frontmatter unless the story itself has changed scope.

---

## Testing rules

- Every story must have corresponding tests before it is marked `done`.
- Rust unit tests live next to the code they test (`_test.rs` suffix or `#[cfg(test)]` modules).
- TypeScript checks use `npx tsc --noEmit`.
- Integration tests live in the `tests/` directory.
- Run Rust tests with `cargo test`.
- Do not mark a story `done` if any test fails.
- If a test is skipped intentionally, leave a comment explaining why.

## Linting rules (mandatory on every task)

Both linters MUST pass with zero warnings before any story is marked `done` or any code is committed.

### Rust — Clippy (pedantic)

Run: `cargo clippy -- -D warnings` (from `src-tauri/`).

Configuration lives in `src-tauri/Cargo.toml` under `[lints.clippy]` and `src-tauri/clippy.toml`.
Key rules enforced:
- `clippy::pedantic` as baseline (warnings).
- `clippy::unwrap_used` is denied — use `map_err` or `?` instead.
- `clippy::panic` is denied — never panic in production paths.
- `unsafe_code` is denied at the Rust level.

### TypeScript — ESLint (strict)

Run: `npm run lint` (from project root).

Configuration lives in `eslint.config.js`. Key rules enforced:
- `typescript-eslint/strictTypeChecked` as baseline.
- No `any` types (`@typescript-eslint/no-explicit-any`).
- No floating promises (`@typescript-eslint/no-floating-promises`).
- No `console.log` in production code (warning).
- Strict equality required (`eqeqeq`).

### Fixing lint errors

- Run `npm run lint:fix` for auto-fixable TypeScript issues.
- Never suppress a lint with `// eslint-disable`, `#[allow(...)]`, `as any`, or `@ts-ignore` unless there is a documented justification in the code.
- If a lint rule is wrong for a specific case, discuss before suppressing.

---

## Context engine — special rules

The context engine (`src-tauri/src/context/`) is the most sensitive part of the codebase.
Changes here affect every LLM interaction.

- Never modify the prompt template without updating the relevant story.
- The assembled context must always fit within the configured token budget.
- Older training summaries must be compressed before recent ones.
- Pinned insights from chat are never compressed or dropped.

---

## LLM interface

All LLM interaction goes through `src-tauri/src/llm/mod.rs`.
Currently, the app uses Ollama only.
To add a new backend, implement the same function signatures and add a story.

---

## Strava sync rules

- OAuth tokens are stored encrypted in SQLite (AES-256-GCM), never in plaintext.
- Activity deduplication: check `strava_id` before inserting.
- Credentials are injected via `option_env!()` at build time or runtime environment variables.

---

## Frontend rules

- React components use `invoke()` from `@tauri-apps/api/core` for IPC.
- Events use `listen()` from `@tauri-apps/api/event`.
- Icons come from `lucide-react`.
- The app uses Tailwind CSS v4 with shadcn/ui components. All styling uses Tailwind utility classes and CSS variables defined in `src/index.css`.
- The app uses a dark-only theme. Colors are mapped to OKLCH CSS variables consumed by shadcn's theming system.
- **Always use shadcn components** when a matching component exists. Never build custom dropdowns, toggles, modals, tables, tooltips, or form controls from raw HTML. Check `src/components/ui/` for installed components before creating anything new. If a shadcn component is not installed yet, install it with `npx shadcn@latest add <component>`.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Use `@/` path aliases for all imports (maps to `./src/`).
- Use `sonner` for toast notifications (`toast.success()`, `toast.error()`). Do not build custom toast/notification UI.
- Do not use dynamic text in buttons. Button labels must be static strings (e.g. always "Save Settings", never "Saving..." then "Save Settings"). Use the `disabled` attribute for loading states, not label swaps.
- Patch releases for bug fixes (`fix:` commits), minor releases for new features (`feat:` commits). See Release versioning above.

---

## What agents must NOT do

- Do not commit secrets, API keys, or tokens.
- Do not skip writing tests to save time.
- Do not mark a story `done` without running `cargo clippy -- -D warnings`, `cargo test`, `npm run lint`, and `npx tsc --noEmit`.
- Do not use `as any` or `@ts-ignore` in TypeScript.
- Do not use `unsafe` in Rust without justification.
- Do not use `unwrap()` in production paths. Use `map_err` or `?` instead.
- Do not modify another story's status unless you are working on it.
- Do not create a release tag without updating the version in both `package.json` and `src-tauri/tauri.conf.json` to match.

---

## When you are blocked

Update the story status to `failed`. Add a `## Blocker` section at the bottom of the story file describing the issue and stop. Do not guess or work around it silently.
