---
id: S77
title: Add frontend test setup with Vitest
status: done
created: 2026-03-22
updated: 2026-03-22
---

# S77 — Add frontend test setup with Vitest

## User story

As a **developer**,
I want a **working frontend test framework**
so that **I can write and run TypeScript component tests**.

## Acceptance criteria

- [x] `vitest` and `@testing-library/react` are installed as devDependencies
- [x] `@testing-library/jest-dom` is installed for DOM matchers
- [x] `jsdom` is installed as test environment
- [x] `vitest.config.ts` is created with React + jsdom configuration
- [x] A `test` script is added to package.json: `"test": "vitest run"`
- [x] Tauri API mocks are set up so tests don't fail on `invoke`/`listen` imports
- [x] At least one sample test exists and passes (e.g. testing a utility function or simple component render)
- [x] `npm run test` passes
- [x] `cargo clippy -- -D warnings` passes
- [x] `cargo test` passes
- [x] `npm run lint` passes with zero errors
- [x] `npx tsc --noEmit` passes

## Technical notes

- Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event`
- Create `vitest.config.ts` at project root:
  ```ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  });
  ```
- Create `src/test/setup.ts` with `@testing-library/jest-dom` import and Tauri API mocks:
  ```ts
  import '@testing-library/jest-dom';
  vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
  vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
  ```
- Add `"test": "vitest run"` to package.json scripts
- Write a sample test for a pure utility (e.g. formatting functions from Dashboard or the useToast hook)
- Test files go in `src/test/` or co-located as `*.test.tsx`

## Tests required

- `npm run test` passes (vitest)
- `cargo clippy -- -D warnings` passes
- `cargo test` passes
- `npm run lint` passes
- `npx tsc --noEmit` passes

## Out of scope

- Full component test coverage
- E2E tests
- CI integration

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-22 | draft | Created |
| 2026-03-22 | done | Implemented vitest setup with jsdom, Tauri API mocks, and sample tests passing |
