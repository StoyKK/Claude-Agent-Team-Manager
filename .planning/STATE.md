---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-03-27T19:06:37.628Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 7
  completed_plans: 6
  percent: 86
---

# Project State: ATM Stability

**Last updated:** 2026-03-27 (plan 02-03 complete)
**Milestone:** ATM Stability

---

## Project Reference

**Core Value:** The app must complete its setup wizard and reach the main editor without errors

**Current Focus:** Phase 02 — Service Tests

---

## Current Position

Phase: 02 (Service Tests) — EXECUTING
Plan: 3 of 3 (all complete)
**Active Phase:** 2 — Service Tests
**Active Plan:** Plans 02-01 through 02-03 complete
**Status:** Phase 02 all plans complete — ready for verification

**Progress:**

[█████████░] 86%
Phase 1 [          ]   0% — Not started
Phase 2 [          ]   0% — Not started
Phase 3 [          ]   0% — Not started

```

**Overall:** 0 / 3 phases complete

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 3 |
| Requirements mapped | 13 / 13 |
| Requirements complete | 0 / 13 |
| Plans written | 0 |
| Plans complete | 0 |

---
| Phase 01 P03 | 109s | 2 tasks | 4 files |
| Phase 01 P01 | 4 | 2 tasks | 4 files |
| Phase 01 P04 | 294 | 2 tasks | 6 files |
| Phase 02 P01 | 8 | 2 tasks | 4 files |
| Phase 02 P02 | 7 | 2 tasks | 9 files |
| Phase 02 P03 | 505 | 3 tasks | 11 files |

## Accumulated Context

### Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Vitest 3 (not 4) | Node 18+ minimum; Vitest 4 requires Node 20 | Pending implementation |
| `mergeConfig` alias inheritance | Vitest must inherit `@/` alias and `fs` stub from vite.config.ts | Pending implementation |
| `jsonc-parser` v3.3.1 | Microsoft-maintained, handles comments + trailing commas, zero deps | Pending implementation |
| Logger as facade | Must check `window.__TAURI_INTERNALS__` at call time, not import time, to preserve Tier 1 test isolation | Pending implementation |
| Typed `Error` subclasses | `AtmError` base → `ParseError`, `WriteError`, `ValidationError`, `ScanError`; narrowable via `instanceof` and `.kind` | Implemented (01-02) |
| `createPortal` for ToastContainer | z-index bump alone fails when any ancestor has `backdrop-filter`; must render at `document.body` | Pending implementation |
| jsdom over happy-dom | Safer for this project's use of File, Blob, URL, and `window.__TAURI_INTERNALS__` | Pending implementation |
| `@testing-library/react` v16 | First RTL version with React 19 peer support | Pending implementation |
| Gray-matter cache-aware testing | gray-matter caches partial file object before parseMatter — use single-call rejection pattern (catch+expect) not double rejects assertions | Implemented (02-03) |
| Separate try-catch per failure mode | parsers use distinct try-catch for readTextFile vs matter() to produce different ParseError messages | Implemented (02-03) |

### Critical Pitfalls to Avoid

- Vite aliases not inherited by Vitest — use `mergeConfig` or extend `vite.config.ts` directly with a `test:` block
- Logger calling Tauri IPC at import time — use facade pattern, check for `__TAURI_INTERNALS__` lazily
- JSONC fix applied to only one callsite — fix all 3 (wizard step 2, `handleEnableTeams`, `settings-parser.ts`)
- Zustand store state leaking between tests — reset with `store.setState(initialState, true)` in `beforeEach`
- Toast z-index fixed with number bump only — must use `createPortal` because the wizard creates a CSS stacking context via `backdrop-filter`
- gray-matter `matter.cache` stores partial `{data:{}}` before `parseMatter` throws — calling the same bad YAML twice in a test will have the second call resolve (cache hit); use single-call rejection pattern

### Open TODOs

- Verify `src-tauri/capabilities/default.json` includes `$HOME/.claude/**` path scope (first task in Phase 1)
- Establish `vi.mock` factory pattern for Zustand stores in Phase 2 so Phase 3 can reuse it

### Blockers

None

---

## Session Continuity

**To resume work:**

1. Read this file
2. Read `.planning/ROADMAP.md` for phase details and success criteria
3. Read `.planning/REQUIREMENTS.md` for requirement details
4. Run `/gsd:plan-phase 1` to create the execution plan for Phase 1

**Phase 1 entry point:** Fix BUG-01 first (toast visibility) — it makes all subsequent debugging visible. Then BUG-02/BUG-03 (JSONC + global path) to unblock wizard completion. Then LOG-01 + ERR-01 (shared utilities) before TEST-01 (Vitest config), because tests need the logger and error types to be non-breaking at import time.

---

*State initialized: 2026-03-27*
