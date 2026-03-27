---
phase: 01-infrastructure
plan: 01
subsystem: ui
tags: [jsonc-parser, react-portal, toast, setup-wizard, tauri, settings]

# Dependency graph
requires: []
provides:
  - Toast renders via createPortal at document.body (z-index 99999), visible above all overlays
  - All 3 JSONC callsites in SetupWizard and settings-parser use jsonc-parser instead of JSON.parse
  - handleEnableTeams preserves JSONC comments using modify+applyEdits
  - Global ~/.claude/settings.json fallback when project-level file lacks teams key
  - User-friendly error message in handleGetStarted ("Could not complete setup...")
affects: [testing, logging, future wizard changes]

# Tech tracking
tech-stack:
  added: [jsonc-parser 3.3.1]
  patterns:
    - "Use createPortal to escape CSS stacking contexts created by backdrop-filter"
    - "Use jsonc-parser modify+applyEdits to preserve comments on round-trip writes"
    - "JSONC parse errors collected via errors array parameter, not try/catch"

key-files:
  created: []
  modified:
    - src/components/common/Toast.tsx
    - src/components/setup/SetupWizard.tsx
    - src/services/settings-parser.ts
    - package.json

key-decisions:
  - "createPortal to document.body instead of z-index bump — backdrop-filter creates isolated stacking context"
  - "jsonc-parser v3.3.1 — Microsoft-maintained, handles comments + trailing commas, zero deps"
  - "modify+applyEdits for comment-preserving writes — preserves user's comments in ~/.claude/settings.json"

patterns-established:
  - "Portal pattern: Toast escapes overlay stacking context via createPortal(jsx, document.body)"
  - "JSONC pattern: parse with errors array param, check errors.length > 0 for reporting"

requirements-completed: [BUG-01, BUG-02, BUG-03, BUG-04]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 01 Plan 01: Setup Wizard Bug Fixes Summary

**Toast portal + JSONC parsing fixes unblock setup wizard: createPortal renders toasts above blur overlay, jsonc-parser handles commented settings files, global ~/.claude/settings.json fallback added**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-27T18:14:00Z
- **Completed:** 2026-03-27T18:18:10Z
- **Tasks:** 2
- **Files modified:** 4 (plus pnpm-lock.yaml)

## Accomplishments

- Toast container now renders via createPortal to document.body at z-index 99999, making it visible above the setup wizard's blur overlay (BUG-01)
- All 3 JSONC callsites updated: SetupWizard step 2 check, handleEnableTeams write-back, and settings-parser.ts all use jsonc-parser instead of JSON.parse (BUG-02)
- handleEnableTeams now uses modify+applyEdits to preserve comments when writing back to ~/.claude/settings.json (BUG-02)
- Global ~/.claude/settings.json fallback: if project-level settings lacks the teams key, the wizard checks the global config (BUG-03)
- handleGetStarted failure shows "Could not complete setup — check that your home directory is writable" instead of raw error message (BUG-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jsonc-parser and fix toast portal (BUG-01)** - `b09cde5` (feat)
2. **Task 2: JSONC parsing + global settings fallback + wizard error message (BUG-02, BUG-03, BUG-04)** - `19bf754` (feat)

## Files Created/Modified

- `src/components/common/Toast.tsx` — Added createPortal import, wrapped container in createPortal(jsx, document.body), bumped z-index to 99999
- `src/components/setup/SetupWizard.tsx` — Added jsonc-parser + homeDir imports, replaced JSON.parse in step 2 effect and handleEnableTeams, added global settings fallback, updated handleGetStarted error message
- `src/services/settings-parser.ts` — Added jsonc-parser import, replaced JSON.parse with parseJsonc using ParseError[] type
- `package.json` — Added jsonc-parser 3.3.1 dependency

## Decisions Made

- Used `createPortal(jsx, document.body)` rather than just bumping z-index — the wizard's `backdropFilter: "blur(8px)"` creates a CSS stacking context where child z-index values are relative to it, not the document root
- Used `modify + applyEdits` from jsonc-parser for comment-preserving writes — JSON.stringify would strip all comments from user's ~/.claude/settings.json
- Imported `ParseError` type from jsonc-parser to fix TypeScript strict mode error (errors array must be `ParseError[]` not `{ error: number }[]`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in settings-parser.ts**
- **Found during:** Task 2 (settings-parser.ts JSONC fix)
- **Issue:** `{ error: number }[]` type for errors array was incompatible with jsonc-parser's `ParseError[]` (which requires `offset` and `length` properties)
- **Fix:** Imported `ParseError` type from jsonc-parser and used it for the errors array declaration
- **Files modified:** src/services/settings-parser.ts
- **Verification:** `pnpm build` passed without type errors
- **Committed in:** 19bf754 (Task 2 commit)

**2. [Rule 1 - Bug] Removed unused `err` variable in handleGetStarted catch block**
- **Found during:** Task 2 (handleGetStarted BUG-04 fix)
- **Issue:** `catch (err)` with `err` unused after changing to user-friendly message — potential lint issue and inconsistency
- **Fix:** Changed to bare `catch` block
- **Files modified:** src/components/setup/SetupWizard.tsx
- **Verification:** Build passes cleanly
- **Committed in:** 19bf754 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes were necessary for TypeScript correctness. No scope creep.

## Issues Encountered

None beyond the type annotation fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 blocking bugs (BUG-01 through BUG-04) are resolved
- Setup wizard should now complete successfully on macOS with JSONC settings
- Ready to proceed to Plan 02 (ERR-01 typed error classes) and Plan 03 (LOG-01 structured logging)

---
*Phase: 01-infrastructure*
*Completed: 2026-03-27*
