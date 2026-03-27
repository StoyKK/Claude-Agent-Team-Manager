# Milestones

## v1.0 ATM Stability (Shipped: 2026-03-27)

**Phases completed:** 3 phases, 9 plans
**Timeline:** Single session (Mar 27 2026, 16:55–20:45)
**Commits:** 59 | **Files modified:** 87 | **Lines added:** ~20,097

**Key accomplishments:**

1. Toast portal + JSONC parsing fixes unblock setup wizard: createPortal renders toasts above blur overlay, jsonc-parser handles commented settings, global ~/.claude/settings.json fallback added
2. Typed error class hierarchy (AtmError → ParseError, WriteError, ValidationError, ScanError) with @throws JSDoc contracts on all 5 core service functions
3. Logger facade service routing all output through Tauri plugin-log in production, console in dev/tests
4. All 55 scattered console.log/warn/error calls replaced with structured logger calls across 6 source files
5. Vitest 3 test framework with 55 tests across 3 tiers: utilities (29), services (17), components (9)
6. React Error Boundaries with dark-themed fallback UI on 3 critical paths + unhandled promise rejection handler

**Tech debt accepted:**
- `ValidationError` exported but never thrown (no service uses it yet)
- Worktree artifacts in `.claude/worktrees/` inflate test count (add `include` pattern to Vitest config)
- 3 human verification items pending live Tauri runtime testing

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
