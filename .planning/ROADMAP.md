# Roadmap: ATM Stability

**Milestone:** ATM Stability
**Core Value:** The app must complete its setup wizard and reach the main editor without errors
**Created:** 2026-03-27
**Granularity:** Coarse
**Total Phases:** 3

---

## Phases

- [ ] **Phase 1: Infrastructure** - Fix blocking bugs and lay shared foundations (logger, error types, JSONC, Vitest)
- [ ] **Phase 2: Service Tests** - Test utility functions and service-layer parsers with the infrastructure from Phase 1
- [ ] **Phase 3: Component Tests and Error Boundaries** - Test the SetupWizard end-to-end and add React Error Boundaries

---

## Phase Details

### Phase 1: Infrastructure
**Goal**: The app reaches the main editor without silent failures — visible errors, parseable settings, a working test runner, typed errors, and structured logging are all in place
**Depends on**: Nothing
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, LOG-01, LOG-02, ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. A user running the setup wizard sees any toast error messages — they are not hidden behind the blurred overlay
  2. A user whose `~/.claude/settings.json` contains comments (JSONC) passes wizard step 2 without a false "Agent teams not enabled" message
  3. A user on a fresh macOS install where only `~/.claude/settings.json` exists (no project-level file) is not blocked at wizard step 2
  4. Running `pnpm test` in the project root executes the Vitest suite without import alias errors or `fs` stub failures
  5. A developer inspecting log output sees structured log entries (with level and context) rather than raw `console.log` strings
**Plans:** 3/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Fix blocking bugs: toast portal, JSONC parsing, global settings fallback, wizard error message
- [x] 01-02-PLAN.md — Typed error classes and JSDoc error documentation on services
- [x] 01-03-PLAN.md — Logger facade service with Tauri/console routing
- [ ] 01-04-PLAN.md — Replace all 55 console.log/warn/error calls with structured logger

### Phase 2: Service Tests
**Goal**: The utility functions and file-parsing services have automated test coverage that catches regressions before users see them
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Running `pnpm test` runs at least one Tier 1 test covering `paths.ts` join/normalize/generateNodeId and at least one test covering a Zod schema in `validation.ts`
  2. Running `pnpm test` runs Tier 2 tests for `agent-parser`, `skill-parser`, and `file-scanner` that pass without requiring a real filesystem or Rust backend
  3. A test asserting on a parse failure receives a typed error (e.g. `ParseError` with `kind === 'parse'`), not a plain `Error` with a string message
**Plans**: TBD

### Phase 3: Component Tests and Error Boundaries
**Goal**: The SetupWizard is covered by component tests and app-crashing render errors are caught gracefully rather than blanking the screen
**Depends on**: Phase 2
**Requirements**: ERR-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Running `pnpm test` includes Tier 3 tests that exercise all three SetupWizard steps, the "Get Started" completion path, and at least one error-case path (e.g. JSONC parse failure in step 2)
  2. When a render error occurs inside the wizard or the canvas, the user sees a fallback UI (error message + retry option) rather than a blank white screen
  3. An unhandled promise rejection in the app is caught and logged rather than silently swallowed
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 3/4 | In Progress|  |
| 2. Service Tests | 0/? | Not started | - |
| 3. Component Tests and Error Boundaries | 0/? | Not started | - |

---

*Roadmap created: 2026-03-27*
*Last updated: 2026-03-27 after Phase 1 planning*
