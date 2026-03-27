---
phase: 01-infrastructure
plan: 03
subsystem: logging
tags: [logger, tauri, facade, plugin-log]
dependency_graph:
  requires: []
  provides: [logger-facade, log-capability]
  affects: [src/services/logger.ts, src-tauri/capabilities/default.json]
tech_stack:
  added: ["@tauri-apps/plugin-log@2.8.0"]
  patterns: [dynamic-import, tauri-facade, console-fallback]
key_files:
  created:
    - src/services/logger.ts
  modified:
    - src-tauri/capabilities/default.json
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Dynamic import for @tauri-apps/plugin-log inside isTauri() branch ensures test isolation"
  - "isTauri() checks window.__TAURI_INTERNALS__ at call time not import time (Pitfall 2 avoidance)"
  - "Console fallback wraps console methods with cast to avoid TypeScript index-signature errors"
metrics:
  duration: "109 seconds"
  completed: "2026-03-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 01 Plan 03: Logger Facade Summary

**One-liner:** Logger facade routing to @tauri-apps/plugin-log in Tauri via dynamic import with console fallback for browser/test environments.

## What Was Built

A centralized logging service (`src/services/logger.ts`) that:
- Exposes a `logger` object with 5 methods: `trace`, `debug`, `info`, `warn`, `error`
- Checks for Tauri at call time via `window.__TAURI_INTERNALS__` (lazy, not at import time)
- Dynamically imports `@tauri-apps/plugin-log` inside the Tauri branch only
- Falls back to `console.*` when not in Tauri or if the plugin throws
- Formats all messages as `[ATM] [LEVEL] [context] message`

The `log:default` capability was also added to `src-tauri/capabilities/default.json` to grant the frontend permission to call the Tauri log plugin.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @tauri-apps/plugin-log and add log:default capability | 7da1a4f | package.json, pnpm-lock.yaml, src-tauri/capabilities/default.json |
| 2 | Create logger facade service (LOG-01) | 9b808e8 | src/services/logger.ts |

## Verification Results

- `grep "log:default" src-tauri/capabilities/default.json` — PASS (line 41)
- `grep "export const logger" src/services/logger.ts` — PASS
- `grep "__TAURI_INTERNALS__" src/services/logger.ts` — PASS
- No top-level `import ... from "@tauri-apps/plugin-log"` — PASS
- TypeScript project type-check for logger.ts — PASS (zero errors)

## Deviations from Plan

### Out-of-Scope Issue (Deferred)

**Pre-existing build failure in settings-parser.ts**

- **Found during:** Task 2 verification (`pnpm build`)
- **Error:** `error TS2345: Argument of type '{ error: number; }[]' is not assignable to parameter of type 'ParseError[]'`
- **File:** `src/services/settings-parser.ts` line 22
- **Analysis:** Error existed before this plan's changes (confirmed via `git stash` test). Caused by another parallel agent introducing `jsonc-parser` usage with incorrect types.
- **Action:** Not fixed — out of scope per deviation rules (pre-existing, not caused by this plan's changes)
- **Deferred to:** `deferred-items.md` for tracking

No other deviations — plan executed as written.

## Key Decisions

1. **Dynamic import for plugin-log:** The `import("@tauri-apps/plugin-log")` call is inside the `isTauri()` branch to ensure the module never resolves in test environments (Vitest/jsdom). Top-level static imports would fail in jsdom.

2. **Call-time Tauri detection:** `isTauri()` is called inside each `log()` invocation, not at module load time. This matches D-05 from the research phase and preserves Tier 1 test isolation.

3. **TypeScript cast for console methods:** `(console[CONSOLE_MAP[level]] as (...args: unknown[]) => void)(formatted)` avoids TypeScript's strict index-signature error when calling console methods by dynamic key.

## Known Stubs

None — the logger facade is fully implemented and functional.

## Self-Check: PASSED

- [x] `src/services/logger.ts` exists and exports `logger`
- [x] Commit `7da1a4f` exists in git log
- [x] Commit `9b808e8` exists in git log
- [x] `log:default` is in `src-tauri/capabilities/default.json`
- [x] No top-level plugin-log import in logger.ts
