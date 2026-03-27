# Project Research Summary

**Project:** ATM (Agent Team Manager) — Stability Milestone
**Domain:** Brownfield Tauri v2 + React 19 desktop app — testing infrastructure, structured logging, error handling
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

ATM is a brownfield Tauri v2 desktop app with zero test coverage, 55 scattered `console.log` calls, no typed errors on service boundaries, and two actively broken user-facing bugs (toast hidden behind the setup wizard, Claude settings failing to parse JSONC). This stability milestone is not a feature build — it is laying the professional foundation that any shipped desktop app requires: reproducible error visibility, testable service boundaries, and a logging system that produces artifacts a developer or user can inspect. The research is clear on every technology choice and the correct sequencing is dictated by hard dependencies between layers.

The recommended approach is to install Vitest 3 (not 4, due to the Node 18 minimum), configure it by extending the existing `vite.config.ts` rather than creating a separate config (to inherit the `@/` alias and the `fs` stub that gray-matter requires), add the `@tauri-apps/plugin-log` JS package (the Rust side is already wired), adopt Microsoft's `jsonc-parser` for all `.claude/` file reads, and define a flat hierarchy of typed error classes (`ParseError`, `WriteError`, `ValidationError`, `ScanError`) that services throw and stores catch. No new architectural layers are needed — these additions slot directly into the existing two-layer React/Rust architecture.

The primary risks are all setup-order problems rather than technology risks. If Vitest aliases are misconfigured, every test fails with cryptic import errors. If the logging service calls Tauri IPC directly (instead of using a facade that falls back to `console` in non-Tauri environments), every imported service module will require IPC mocking, turning Tier 1 pure-function tests into Tier 2 Tauri-mocked tests. If the JSONC fix is applied only in the wizard component and not in `settings-parser.ts`, partial fixes leave other callsites broken. The correct mitigation is to sequence the work: infrastructure first, shared utilities second, service layer third, component tests last.

## Key Findings

### Recommended Stack

The existing stack already contains almost everything needed. The only net-new additions are: Vitest 3 + jsdom + `@testing-library/react` v16 (which is the first RTL version with React 19 peer support) for the test runner, `jsonc-parser` v3.3.1 (Microsoft, used in VS Code, ESM+UMD, zero deps) for JSONC parsing, and `@tauri-apps/plugin-log` as an npm package (the Cargo side is already registered). Error typing requires no new library — typed `Error` subclasses with a `kind` discriminant are the correct standard TypeScript pattern and avoid the scope-explosion of adopting `neverthrow` or `ts-results` against an existing throw/catch codebase.

**Core technologies:**
- `vitest ^3.2.x` + `@vitest/coverage-v8`: Test runner — native Vite integration, inherits `@/` alias and `fs` stub with zero extra config; pinned to v3 because Vitest 4 requires Node 20 and this project documents Node 18+
- `@testing-library/react ^16.3.x` + `@testing-library/dom ^10.x` + `@testing-library/user-event ^14.x`: Component testing — v16 is the first release with first-class React 19 peer support
- `jsdom ^26.x`: DOM simulation — safer than happy-dom for this project's use of File, Blob, URL, and Tauri's `window.__TAURI_INTERNALS__`
- `@tauri-apps/api/mocks` (already included in `@tauri-apps/api` 2.10.x): IPC mocking — intercepts all `invoke()` calls in jsdom without running the Rust backend
- `@tauri-apps/plugin-log ^2.7.x` (JS side only): Log transport — bridges JS logs to the Rust `log` crate which writes to the OS log directory; Rust side already installed
- `jsonc-parser ^3.3.1`: JSONC parsing — Microsoft-maintained, handles `//` and `/* */` comments + trailing commas; also provides `applyEdits` for surgical in-place updates that preserve comment formatting
- Typed `Error` subclasses (`AtmError`, `ParseError`, `WriteError`, `ValidationError`, `ScanError`): Error types — zero dependencies, type-narrowable in catch blocks via `instanceof` and `.kind` discriminant

### Expected Features

The research treats these as feature categories for the milestone, ordered by the priority the FEATURES.md established.

**Must have (table stakes — the app cannot be considered stable without these):**
- Toast notifications visible over all overlays — `ToastContainer` z-index bug makes all error feedback invisible during the setup wizard; renders the app undebuggable for users
- JSONC support for Claude settings — `JSON.parse` fails on real-world `.claude/settings.json` files that contain comments; causes false "Agent teams not enabled" wizard state
- Global `~/.claude/` path fallback — wizard only reads project-local settings; new installs always fail step 2
- Structured logging service replacing 55 `console.*` calls — production desktop apps require a log file users can share when reporting bugs
- Typed error classes for `agent-parser`, `skill-parser`, `settings-parser`, `file-scanner`, `file-writer` — callers cannot distinguish failure modes without typed errors
- Vitest test framework configured and running — zero tests means any refactor can silently break the onboarding flow
- Tests for file parsers (agent-parser, skill-parser, settings-parser) — pure functions, highest test ROI
- Tests for setup wizard flow — the single most important user path in the app

**Should have (differentiators that raise quality beyond baseline):**
- React Error Boundary around `SetupWizard` and `TreeCanvas` — prevents render crashes from killing the whole app
- Log file written to OS log directory (`~/Library/Logs/<app-name>/` on macOS) via `tauri-plugin-log`'s `LogTarget::LogDir`
- Log correlation IDs (UUID prefix per wizard session) — turns scattered log lines into filterable sessions
- `attachConsole()` in dev mode only, file-only in production
- Tests for `file-scanner.ts` — integration-level, requires `mockIPC` for `readDir`/`exists`
- Error toast deduplication — prevents identical error floods from file-watcher loops
- Global unhandled rejection handler in `main.tsx`

**Defer (out of scope for this milestone):**
- Remote crash reporting / Sentry integration — telemetry decisions come after local logging works
- End-to-end tests with tauri-driver/WebdriverIO — start with unit+component tests first
- Tests for `tree-store.ts` — the 2,767-line monolith is explicitly deferred; writing tests against it now creates brittle coupling
- Rust backend unit tests via `tauri::test` — command handlers are thin OS wrappers; low value-to-cost ratio
- Custom in-app log viewer UI — OS log directory is sufficient; add "Open Logs" menu item only if users request it
- Replacing `Toast.tsx` with a third-party library — the 124-line custom component works; replacing it risks new z-index bugs for zero gain

### Architecture Approach

The three concerns (testing, logging, error handling) all slot into the existing two-layer architecture without new structural layers. Services throw typed errors; stores catch them and decide whether to toast, log, or store a `validationErrors` array on the node; the logger is a pure singleton facade that delegates to `@tauri-apps/plugin-log` when Tauri is available and falls back to `console` in test/`pnpm dev` environments. Tests are stratified into three tiers: Tier 1 (pure functions, no mocking needed), Tier 2 (Tauri FS calls, requires `mockIPC`), and Tier 3 (React components, requires RTL + Zustand store reset).

**Major components:**
1. `src/services/logger.ts` (NEW) — Singleton facade; `info/warn/error/debug(context, message, data?)`; detects `window.__TAURI_INTERNALS__` to choose between `@tauri-apps/plugin-log` and `console`; no side effects on import (critical for Tier 1 testability)
2. `src/types/errors.ts` (NEW) — Flat error class hierarchy: `AtmError` base → `ParseError`, `WriteError`, `ValidationError`, `ScanError`; pure TypeScript, no imports; thrown by services, caught by stores; tests assert on `.kind` not `.message` strings
3. `src/test/setup.ts` + `vitest.config.ts` (NEW) — Global test setup: WebCrypto polyfill from `node:crypto`, `mockWindows('main')`, default `mockIPC` that throws on unmocked commands, `clearMocks()` in `afterEach`; config extends `vite.config.ts` via `mergeConfig` to inherit all aliases
4. Updated services (`agent-parser`, `skill-parser`, `settings-parser`, `file-scanner`, `file-writer`) — Replace `throw new Error(string)` with typed error classes; replace `JSON.parse` with `parseJsonc` utility from `src/utils/jsonc.ts`
5. Z-index fix in `ToastContainer` — Render via `createPortal` at `document.body`; establish a z-index constants file to prevent recurrence

### Critical Pitfalls

1. **Vite aliases not inherited by Vitest** — Every `@/` import and the `fs` stub for gray-matter fail silently if Vitest is configured in a separate file without merging the Vite config. Use `mergeConfig(viteConfig, vitestConfig)` or extend `vite.config.ts` directly with a `test:` block.

2. **Logger service causes Tauri IPC dependency in all modules** — If the logger calls `@tauri-apps/plugin-log` directly at module load, importing any service in tests requires full IPC mocking, destroying Tier 1 test isolation. Implement as a facade: check `'__TAURI_INTERNALS__' in window` before calling the plugin.

3. **Toast z-index fix is incomplete without a `createPortal`** — Bumping the z-index number alone fails when any ancestor element creates a CSS stacking context via `backdrop-filter`, `transform`, `opacity < 1`, or `filter`. The wizard's blur overlay is exactly this case. The fix is to render `ToastContainer` at `document.body` via `createPortal`.

4. **JSONC fix applied partially, leaving `handleEnableTeams()` and `settings-parser.ts` broken** — The bug appears in at least three callsites. Create a single `src/utils/jsonc.ts` utility and replace all `JSON.parse` calls that read `.claude/` files. Also: never write back with `JSON.stringify` — use `jsonc-parser`'s `applyEdits` to preserve user comments.

5. **Zustand store state leaks between tests** — `tree-store.ts` and `ui-store.ts` are module-level singletons; mutations persist across test files. Reset with `store.setState(initialState, true)` (the `true` flag forces full replace, not merge) in `beforeEach` for any test that touches the wizard.

## Implications for Roadmap

Based on the dependency graph established in FEATURES.md, ARCHITECTURE.md, and PITFALLS.md, the work naturally segments into three phases. These are strictly ordered — each phase unblocks the next.

### Phase 1: Infrastructure Foundation

**Rationale:** Nothing else can be built or tested until the test runner exists and the shared utilities (logger, error types, JSONC parser) are in place. The two visible bugs (toast z-index, JSONC parsing) are also prerequisites because wizard tests will assert on toast visibility and JSONC handling — fixing them before writing tests prevents writing tests against known-broken behavior.
**Delivers:** A working Vitest suite (even with zero test files initially), a structured logger replacing all `console.*` calls, typed error classes for all services, JSONC-safe settings parsing, and visible toasts during the wizard flow.
**Addresses:** Toast z-index fix, JSONC support, global `~/.claude/` path fallback, logger service, error types, Vitest + jsdom configuration.
**Avoids:** Pitfall 1 (alias inheritance), Pitfall 7 (logger IPC dependency), Pitfall 3 (stacking context), Pitfall 5 (partial JSONC fix).

### Phase 2: Service Layer Tests

**Rationale:** With the test runner and typed errors in place, services become directly testable. Tier 1 tests (pure utils) require no mocking and build confidence in the setup. Tier 2 tests (FS services) use `mockIPC` from the already-configured `@tauri-apps/api/mocks`. This is the highest-ROI test surface: parsers are called on every project load and are pure enough to test exhaustively.
**Delivers:** Test coverage for `paths.ts`, `validation.ts`, `agent-parser.ts`, `skill-parser.ts`, `settings-parser.ts`, `file-scanner.ts`, and `file-writer.ts`. Coverage report via `@vitest/coverage-v8`.
**Uses:** `mockIPC` / `clearMocks` from `@tauri-apps/api/mocks`; typed errors from Phase 1; `mockReadTextFile` / `mockExists` helpers from `src/test/tauri-helpers.ts`.
**Avoids:** Pitfall 2 (IPC crashes), Pitfall 4 (store state leak), Pitfall 13 (generic catch blocks).

### Phase 3: Wizard Component Tests and Error Boundaries

**Rationale:** Component tests (Tier 3) are the most complex — they require RTL, Zustand store resets, and `mockIPC` together. They should come last because they depend on Phase 1 (toast visibility, JSONC fix, error types) and Phase 2 (stable service behavior verified by unit tests) being solid. React Error Boundaries belong in this phase because their `onError` callbacks use the logger from Phase 1.
**Delivers:** Test coverage for all three `SetupWizard` steps, `react-error-boundary` wrapping the wizard and canvas, global `unhandledrejection` handler in `main.tsx`, and optionally error toast deduplication and log correlation IDs.
**Implements:** Tier 3 test architecture (RTL + Zustand reset), `react-error-boundary` with `useErrorBoundary` hook for async error propagation.
**Avoids:** Pitfall 6 (error boundaries don't catch async errors), Pitfall 12 (`act()` warning floods), Pitfall 4 (store state leaks in wizard tests).

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because tests cannot run without the test runner, and service tests cannot assert on meaningful errors without typed error classes.
- Phase 1 must also include the two bug fixes (toast z-index, JSONC) because Phase 3 wizard tests will assert on both — writing tests against the unfixed behavior would mean testing the wrong thing.
- Phase 2 must precede Phase 3 because wizard component tests mock the services that Phase 2 validates; if service behavior is unknown, component test assertions are guesswork.
- The Zustand store is intentionally not tested in any phase of this milestone (PROJECT.md defers `tree-store.ts` refactoring). Tests that need store behavior should mock at the component boundary with `vi.mock`.

### Research Flags

Phases with well-documented patterns (research-phase not needed):

- **Phase 1:** All technology choices are HIGH confidence (Vitest, RTL, `jsonc-parser`, `@tauri-apps/plugin-log`). Setup patterns are fully documented in official Tauri v2 and Vitest docs. The `mergeConfig` alias inheritance pattern is the canonical answer in Vitest documentation.
- **Phase 2:** `mockIPC` usage is fully documented in official Tauri v2 mocking guide. Tier 1 and Tier 2 test patterns are standard and well-established.
- **Phase 3:** RTL + Vitest async patterns are well-documented. The one area requiring care is Zustand store reset — the official Zustand testing guide covers this. The `react-error-boundary` v4 `useErrorBoundary` hook for async propagation is documented in that library's README.

No phases in this milestone require `/gsd:research-phase` during planning. All patterns are verified against official documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vitest 3 Node constraint, RTL v16 React 19 support, `jsonc-parser`, `@tauri-apps/plugin-log` — all verified against official docs and npm registry. One MEDIUM item: jsdom vs happy-dom tradeoff relies on community guidance, not empirical testing against this project's specific APIs. |
| Features | HIGH | Feature priorities and anti-features are grounded in the existing codebase (known bugs, known deferred items). Complexity estimates are conservative and based on direct codebase analysis. |
| Architecture | HIGH | Tier 1/2/3 test stratification, logger facade pattern, error class hierarchy, and Zustand reset pattern all verified against official Tauri v2, Vitest, and Zustand docs. Anti-patterns are derived from official guidance, not opinion. |
| Pitfalls | HIGH (Tauri-specific) / MEDIUM (React patterns) | Tauri-specific pitfalls (IPC mocking, capability scopes, plugin-log facade) are verified against official docs and an open GitHub issue. React/Vitest pitfalls (act() warnings, store state leaks) are confirmed by multiple community sources but not empirically reproduced in this project. |

**Overall confidence:** HIGH

### Gaps to Address

- **jsdom vs happy-dom for this codebase's specific APIs:** The File API, Blob, URL, and `window.__TAURI_INTERNALS__` usages were not empirically tested against happy-dom. The recommendation to use jsdom is conservative and correct, but if test run speed becomes a concern, happy-dom could be evaluated at that time. Resolution: accept jsdom for this milestone; re-evaluate only if test suite grows large and speed is flagged.

- **`tauri-plugin-log` Rust logging behavior in production builds:** The recommendation to avoid `tracing` and rely on the existing `log` crate is based on architectural reasoning (Tauri's command handlers don't need span context propagation), not on empirical comparison. If Rust-side log output is missing or malformed in a production `.dmg`, the first debugging step is to verify `tauri-plugin-log` targets are correctly configured in `lib.rs`. Resolution: verify during Phase 1 implementation.

- **Tauri capability file for `~/.claude/` path:** Whether `src-tauri/capabilities/default.json` already includes `$HOME/.claude/**` in its scope is not confirmed from static analysis — this must be checked at implementation time. Resolution: first task in Phase 1's bug-fix section is to inspect the capability file and add the required scope if missing.

- **`tree-store.ts` test strategy:** The monolith is explicitly deferred. This means component tests in Phase 3 must mock the store at component boundaries. The exact `vi.mock` factory pattern for Zustand stores should be established in Phase 2 (when first needed for service tests that the store calls) to avoid reinventing it in Phase 3.

## Sources

### Primary (HIGH confidence)

- [Vitest 4.0 release blog](https://vitest.dev/blog/vitest-4) — Node 20 requirement confirmed
- [Vitest Guide — Getting Started](https://vitest.dev/guide/) — install, config, mergeConfig pattern
- [Tauri v2 Mocking Guide](https://v2.tauri.app/develop/tests/mocking/) — `mockIPC`, `clearMocks`, `mockWindows`
- [Tauri v2 Logging Plugin](https://v2.tauri.app/plugin/logging/) — `@tauri-apps/plugin-log`, `attachConsole`
- [Tauri v2 Log JS API reference](https://v2.tauri.app/reference/javascript/log/) — `attachConsole`, log levels
- [Tauri v2 File System plugin](https://v2.tauri.app/plugin/file-system/) — capability scopes and path restrictions
- [Tauri v2 mocks namespace reference](https://v2.tauri.app/reference/javascript/api/namespacemocks/) — API surface
- [Zustand Testing Guide](https://zustand.docs.pmnd.rs/guides/testing) — store reset pattern (`setState(initial, true)`)
- [jsonc-parser npm](https://www.npmjs.com/package/jsonc-parser) — v3.3.1, ESM+UMD, zero deps
- [microsoft/node-jsonc-parser GitHub](https://github.com/microsoft/node-jsonc-parser) — `applyEdits` API
- [@testing-library/react npm](https://www.npmjs.com/package/@testing-library/react) — v16.3.x React 19 peer support
- [Vitest test environments](https://vitest.dev/guide/environment) — jsdom vs happy-dom tradeoffs
- [MDN — Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Positioned_layout/Stacking_context) — `backdrop-filter` creates stacking context
- [React — Error Boundaries docs](https://legacy.reactjs.org/docs/error-boundaries.html) — what boundaries don't catch (async/event handlers)
- [react-error-boundary — useErrorBoundary](https://github.com/bvaughn/react-error-boundary) — async propagation pattern

### Secondary (MEDIUM confidence)

- [Vitest — Common Errors](https://vitest.dev/guide/common-errors) — jsdom environment configuration
- [Zustand Discussion #1918 — Vitest + store reset](https://github.com/pmndrs/zustand/discussions/1918) — practical reset pattern
- [RTL Issue #1413 — act() warnings with Vitest](https://github.com/testing-library/react-testing-library/issues/1413) — React 19 + Vitest async handling
- [Tauri plugin-fs home permissions issue #10330](https://github.com/tauri-apps/tauri/issues/10330) — path scope enforcement detail
- [How to write Unit Tests for Tauri with Vitest — Yonatan Kra](https://yonatankra.com/how-to-setup-vitest-in-a-tauri-project/) — jsdom + WebCrypto polyfill pattern, verified against official Tauri mocking docs
- [joshwcomeau.com — What the heck, z-index](https://www.joshwcomeau.com/css/stacking-contexts/) — stacking context mental model

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
