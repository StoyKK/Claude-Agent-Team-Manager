# Phase 3: Component Tests and Error Boundaries - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Test the SetupWizard component end-to-end (all 3 steps, error cases, completion) and add React Error Boundaries with user-friendly fallback UI to prevent blank white screens on render crashes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **D-01:** All implementation decisions deferred to Claude — user confirmed full delegation
- **D-02:** Use `react-error-boundary` library (lightweight, well-maintained, provides `ErrorBoundary` component with `fallbackRender` prop) — not hand-rolled class components
- **D-03:** Error Boundary placement: 3 boundaries — one wrapping SetupWizard, one wrapping TreeCanvas (main editor), one wrapping the root App (catch-all). Coarse granularity — inspector/settings panels don't need their own boundaries since they're non-critical and errors there surface via toast
- **D-04:** Fallback UI: dark-themed card (matching `#0d1117` background) with error icon, "Something went wrong" heading, technical error message in monospace, and a "Try Again" button that calls `resetErrorBoundary()`. Consistent with existing app theme — no new colors
- **D-05:** Unhandled promise rejections: `window.addEventListener("unhandledrejection", ...)` in App.tsx — logs via `logger.error("unhandled-rejection", ...)` and shows a toast. Does NOT trigger Error Boundary (those only catch render errors)
- **D-06:** SetupWizard tests use `@testing-library/react` with Zustand store mocking via `vi.mock` — reset stores in `beforeEach` per Phase 2 pattern
- **D-07:** Wizard tests mock `@tauri-apps/plugin-fs` (readTextFile for settings), `@tauri-apps/api/path` (homeDir), and jsonc-parser responses to simulate all 3 wizard steps without Tauri runtime
- **D-08:** Test at least: wizard renders step 1, step 2 validates settings, step 3 shows project selection, "Get Started" completes setup, and one error case (JSONC parse failure in step 2 shows toast)
- **D-09:** Error Boundary tests: render a component that throws → verify fallback UI appears → click "Try Again" → verify component re-renders

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component Under Test
- `src/components/setup/SetupWizard.tsx` — Full wizard: 3 steps, settings reading, handleGetStarted, handleEnableTeams
- `src/App.tsx` — Main app component where Error Boundaries and unhandledrejection handler will be added

### Infrastructure from Prior Phases
- `src/types/errors.ts` — Typed error classes for assertion in tests
- `src/services/logger.ts` — Logger facade for unhandledrejection logging
- `src/services/settings-parser.ts` — Settings parsing with JSONC support (mocked in tests)
- `src/components/common/Toast.tsx` — Toast system (verify error toasts in tests)
- `vite.config.ts` — Vitest config with jsdom, already configured in Phase 2
- `src/vitest.setup.ts` — Tauri stubs, already configured in Phase 2

### Stores to Mock
- `src/store/tree-store.ts` — Tree store (loadProject called by wizard completion)
- `src/store/ui-store.ts` — UI store (toast, panel visibility)

### UI Spec
- `.planning/phases/01-infrastructure/01-UI-SPEC.md` — Color tokens, typography (fallback UI must match)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@testing-library/react` v16 already installed (Phase 2)
- Vitest with jsdom already configured (Phase 2)
- `vitest.setup.ts` already stubs `window.__TAURI_INTERNALS__` (Phase 2)
- vi.mock factory pattern established in Phase 2 parser tests

### Established Patterns
- Zustand store reset: `store.setState(initialState, true)` in `beforeEach`
- Tauri FS mock: `vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(), ... }))`
- Toast assertions: check toast store state or DOM presence after error actions

### Integration Points
- Error Boundaries wrap existing components in App.tsx — minimal changes to component tree
- `window.addEventListener("unhandledrejection")` added in App.tsx useEffect
- New `ErrorFallback` component created (small, self-contained)

</code_context>

<specifics>
## Specific Ideas

- The SetupWizard test should simulate the full flow: render → see step 1 → advance to step 2 → mock settings read → advance to step 3 → click "Get Started" → verify completion
- Error boundary fallback should NOT use any external libraries for styling — just inline styles matching the existing dark theme
- The "Try Again" button in the fallback should be prominent (accent blue `#4a9eff` background)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-component-tests-and-error-boundaries*
*Context gathered: 2026-03-27*
