# Domain Pitfalls

**Domain:** Tauri v2 + React 19 desktop app — stability infrastructure (testing, logging, error handling)
**Researched:** 2026-03-27
**Confidence:** HIGH for Tauri-specific items (official docs verified); MEDIUM for React/Vitest patterns (multi-source); LOW flagged inline.

---

## Critical Pitfalls

These cause silent failures, non-functional tests, or regressions that take hours to diagnose.

---

### Pitfall 1: Vite Aliases Not Inherited by Vitest — `@/` Imports Fail in Tests

**What goes wrong:** This project uses `resolve.alias: { "@": path.resolve(..., "./src") }` in `vite.config.ts`. When Vitest is added in a separate `vitest.config.ts` (or inline test block), the alias is NOT automatically inherited unless explicitly re-declared or the configs are merged. Every service import using `@/` fails with "Cannot find module '@/...'" at test time.

**Why it happens:** Vitest uses its own module resolver. The `resolve.alias` from `vite.config.ts` only applies if Vitest merges or extends that config. Vitest's own `test.alias` is a separate config key. The same project also stubs `fs` via a Vite alias (`fs: path.resolve(..., "./src/utils/fs-stub.ts")`) for gray-matter — that stub also won't apply in Vitest unless re-declared, causing gray-matter to try to import Node's real `fs` in jsdom (which fails differently).

**Consequences:** Every import in `src/services/*.ts`, `src/store/*.ts`, `src/utils/*.ts` that uses `@/` breaks. Tests don't run at all. The `fs` stub missing causes gray-matter to crash in the test environment, even though it works fine in the browser build.

**Prevention:**
- Either extend `vite.config.ts` inside `vitest.config.ts` using `mergeConfig` from Vite, OR explicitly re-declare `@` and `fs` aliases in the Vitest config's `resolve.alias`.
- Verify with `vitest --reporter=verbose` and a simple smoke test: `import { parseAgent } from '@/services/agent-parser'`.

**Warning signs:**
- Tests fail with "Cannot find module" for any `@/` path
- "Module 'fs' not found" or gray-matter-related import errors in test output
- Vite dev build works perfectly but `vitest` fails immediately

**Phase:** Testing setup (Phase 1 of milestone)

---

### Pitfall 2: Tauri IPC Calls Crash Tests Without `mockIPC` — No Graceful Degradation

**What goes wrong:** Services like `file-writer.ts`, `file-scanner.ts`, and `settings-parser.ts` call Tauri's `@tauri-apps/plugin-fs` functions (`readTextFile`, `writeTextFile`, `exists`, `mkdir`). In jsdom, `window.__TAURI_INTERNALS__` does not exist. Any test that imports these services and does not mock IPC will throw immediately — not with a helpful error, but with "Cannot read properties of undefined (reading 'invoke')" or similar.

**Why it happens:** Tauri plugins call `window.__TAURI_INTERNALS__.invoke` under the hood. jsdom does not set up this global. The `@tauri-apps/api/mocks` package provides `mockIPC` specifically for this, but it must be called BEFORE any Tauri API is invoked. The official docs note: `mockIPC` and `mockWindows` must run before module code that calls Tauri APIs executes — this means the calls belong in `beforeAll` or a `setupFiles` entry, not in individual `it()` blocks.

**Consequences:** Parser tests that test pure logic (e.g., `parseAgentMarkdown(string)`) are forced to mock Tauri even when they don't need IPC, increasing setup burden. Tests that do need IPC fail with cryptic errors unless the engineer knows to reach for `@tauri-apps/api/mocks`.

**Prevention:**
- Structure services so pure parsing logic is decoupled from Tauri FS calls. `agent-parser.ts` already takes a string — keep it that way. Test the parser directly without any Tauri mocking.
- For integration-style tests that exercise `file-scanner.ts` or `file-writer.ts`, set up `mockIPC` in a `setupFiles` script that runs before each test file.
- Call `clearMocks()` from `@tauri-apps/api/mocks` in `afterEach` — failing to do so means mock state leaks between tests and produces false positives.

**Warning signs:**
- "Cannot read properties of undefined (reading 'invoke')" in test output
- Tests pass individually but fail when run together (mock state leak from missing `clearMocks`)
- Test file imports service module and immediately crashes before any test runs

**Phase:** Testing setup (Phase 1); individual service tests (Phase 2)

---

### Pitfall 3: Toast Z-Index Is Behind the Wizard — Already Known, But Has a Hidden Root Cause

**What goes wrong:** `Toast.tsx` uses `zIndex: 10000`. `SetupWizard.tsx` uses `zIndex: 20000`. This makes toasts invisible during the wizard. The straightforward fix is to bump Toast to 30000, but the root cause is subtler and will recur: the wizard overlay uses `backdrop-filter: blur(...)`, which **creates a new stacking context**. Any element rendered outside that stacking context with a lower z-index will be clipped by it, regardless of the absolute z-index values.

**Why it happens:** In CSS, these properties create a new stacking context automatically: `backdrop-filter`, `transform`, `opacity < 1`, `filter`, `isolation: isolate`, `will-change`. The wizard's blur overlay is a stacking context root. `ToastContainer` is rendered as a sibling in the DOM (typically mounted at the app root level), but if ANY ancestor of the toast in the DOM tree has a lower z-index than the wizard overlay, the toast loses regardless of its own z-index.

**Consequences:** Bumping toast z-index alone may fix the immediate bug but a future component that adds `transform` or `filter` for animations will silently re-introduce the same layering issue. The same trap applies to context menus (`zIndex: 9999`) and dropdowns (`zIndex: 1000`) — they are all at risk.

**Prevention:**
- Render `ToastContainer` in a portal at `document.body` using `createPortal` (React). This ensures toasts are a direct child of `body`, outside any stacking context created by app components.
- Establish a documented z-index scale (e.g., `100` = dropdowns, `1000` = context menus, `5000` = modals, `6000` = toasts, `7000` = wizard overlay) and put it in a shared constants file. Prevents ad hoc values.
- Never create stacking contexts in overlay components without explicitly accounting for everything that must appear above them.

**Warning signs:**
- Toast appears in DOM (React DevTools confirms it exists) but is visually hidden behind another element
- Adding `outline: 1px solid red` to the toast reveals it is rendered but covered
- Components have inline `zIndex` values that are hardcoded integers rather than constants

**Phase:** Bug fixes (Phase 0 / pre-requisite)

---

### Pitfall 4: Zustand Store State Leaks Between Tests — Tests Are Order-Dependent

**What goes wrong:** `tree-store.ts` and `ui-store.ts` are module-level singletons. Once a test mutates store state (e.g., sets `projectPath`, loads nodes), that mutation persists for every subsequent test in the same Vitest worker. Tests that assume initial state will fail only when run after other tests — a classic intermittent test failure.

**Why it happens:** Zustand stores are initialized at module import time, not at component render time. The store instance is shared across all tests in the module. Vitest does not automatically reset module state between tests.

**Consequences:** Tests that pass in isolation fail in CI where test ordering may differ. `SetupWizard` tests are particularly at risk — the wizard visibility check reads `projectPath` from the store, so if a prior test set a valid `projectPath`, the wizard won't show and assertions fail.

**Prevention:**
- In `vitest.config.ts`, add `test.clearMocks: true` and `test.restoreMocks: true`.
- For store reset, use Zustand's store `.setState()` method in `beforeEach` to reset to initial state. The official Zustand testing guide recommends exposing an initial state snapshot and calling `store.setState(initialState, true)` (the `true` forces a full replace, not a merge) before each test.
- Alternatively, use `vi.mock` to provide a fresh store instance per test file using `vi.importActual` + a factory.

**Warning signs:**
- Tests pass when run individually (`vitest run --testNamePattern`) but fail in full suite
- `SetupWizard` tests fail with "wizard not visible" when certain other tests run first
- Flaky CI results that cannot be reproduced locally (different test ordering)

**Phase:** Testing setup (Phase 1); critical to get right before writing wizard tests

---

### Pitfall 5: JSONC Settings Parse Fails Silently, Shows Wrong Wizard State

**What goes wrong:** The setup wizard reads `.claude/settings.json` with `JSON.parse()`. Claude Code's actual settings file is JSONC — it may contain `//` line comments or trailing commas. `JSON.parse()` throws a `SyntaxError` on these, which the wizard catches generically and falls back to `setTeamsEnabled(false)`, falsely reporting "Agent teams not enabled." This is the known "Get Started button fails" bug, but it will recur after the fix if done incorrectly.

**Why it happens:** Line 60 of `SetupWizard.tsx`: `catch { setTeamsEnabled(null); setTeamsError(true); }` — parse failures are silently absorbed. The engineer fixing this may replace `JSON.parse` with a JSONC parser in the wizard but miss that the same pattern occurs in `handleEnableTeams()` (line 125) and in `settings-parser.ts`. A partial fix leaves the other callsites broken.

**Consequences:** Wizard shows an error state ("Failed to read settings") that is actually a parse format issue, not a missing file. User tries to "Enable Teams" button, which overwrites the JSONC file with plain JSON (line 130: `JSON.stringify(settings, null, 2)`), silently stripping all their comments and custom formatting.

**Prevention:**
- Use `jsonc-parser` (Microsoft, `npm install jsonc-parser`) — it handles `//` comments, `/* */` block comments, and trailing commas. It's the same parser used by VS Code and is well-maintained.
- Create a single `parseJsonc(text: string): unknown` utility in `src/utils/jsonc.ts` and replace all `JSON.parse` calls that read `.claude/` files.
- Never write back to a JSONC file using `JSON.stringify` — it strips all comments. Use `jsonc-parser`'s `applyEdits` API to modify specific values while preserving formatting.
- Write tests that pass JSONC strings with comments to `settings-parser.ts` and assert correct results.

**Warning signs:**
- Step 2 of the wizard shows "teams not enabled" on a machine where they are enabled
- "Get Started" button in step 3 doesn't respond (async error swallowed)
- `.claude/settings.json` loses comments after any ATM write operation

**Phase:** Bug fixes (Phase 0); must be fixed before wizard tests are written

---

## Moderate Pitfalls

These cause incorrect behavior or test gaps but don't immediately block users.

---

### Pitfall 6: React Error Boundaries Don't Catch Async Errors or Event Handler Errors

**What goes wrong:** Adding an `ErrorBoundary` around the app tree gives the impression of comprehensive error coverage. It is not. React error boundaries only catch errors thrown synchronously during rendering, in lifecycle methods, and in class component constructors. They do NOT catch: errors in event handlers (`onClick`, `onChange`), errors in `useEffect` async callbacks, errors in `setTimeout`/`setInterval` callbacks, or errors in promises that aren't re-thrown into render.

**Why it matters here:** Almost every critical operation in this app is async in an event handler — `handleSaveApiKey()`, `handleEnableTeams()`, `handleGetStarted()` all await Tauri FS calls inside click handlers. If any of these throw (e.g., JSONC parse error), the error boundary does not fire; the error is silently swallowed in the `catch` block (or crashes the app if `catch` is missing).

**Prevention:**
- Use the `react-error-boundary` library's `useErrorBoundary` hook (v4+). Call `showBoundary(error)` in async catch blocks to manually propagate the error into the nearest error boundary.
- Add a global `window.addEventListener('unhandledrejection', handler)` to catch async errors that escape try/catch entirely.
- Do not rely on error boundaries alone for the wizard flow. The wizard's async handlers already have try/catch — ensure every catch block either calls `toast()` OR `showBoundary()`, never just logs.

**Warning signs:**
- Error boundary fallback never appears even when services throw
- `console.error` fires in tests but component renders as if nothing happened
- "Unhandled promise rejection" in browser DevTools while error boundary fallback is not shown

**Phase:** Error handling (Phase 1)

---

### Pitfall 7: Structured Logging Service Breaks in Tests If It Calls Tauri IPC

**What goes wrong:** The natural implementation of a logging service for a Tauri app is to call `tauri-plugin-log`'s JavaScript API (`info()`, `warn()`, `error()`), which itself calls Tauri IPC under the hood. If any test imports a service that uses the logger, the logger immediately crashes tests with "Cannot read __TAURI_INTERNALS__" unless IPC is mocked everywhere.

**Why it happens:** Replacing 55 `console.log/warn/error` calls with a logger is correct, but if the logger is a thin wrapper over `@tauri-apps/plugin-log`, it becomes a mandatory Tauri dependency for every module that logs — including pure utilities that shouldn't need IPC mocking at all.

**Prevention:**
- Implement the logger as a facade with a pluggable backend: `log(level, message, context?)`. In production (when `window.__TAURI_INTERNALS__` exists), delegate to `tauri-plugin-log`. In test/non-Tauri environments, delegate to `console`. Detect with `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window`.
- This pattern is also correct for `pnpm dev` (the frontend-only dev mode where Tauri is not present).
- Never call `attachConsole()` in production builds — it's for development only. Calling it in a production bundle creates unnecessary IPC overhead on every log statement.

**Warning signs:**
- Tests that import any service crash with Tauri IPC errors after logging service is introduced
- Log messages do not appear in `pnpm dev` (frontend-only) mode
- `attachConsole()` called unconditionally at app startup in `main.tsx`

**Phase:** Logging service (Phase 1); must be designed before replacing console calls

---

### Pitfall 8: WebCrypto Not Available in jsdom — CryptoSession Tests Fail

**What goes wrong:** `remote-sync.ts` uses `CryptoSession` which calls `crypto.getRandomValues()` and `crypto.subtle.*` — standard Web Crypto APIs. jsdom does not include a WebCrypto implementation by default. Any test file that imports `remote-sync.ts` (even transitively) will throw "crypto.getRandomValues is not a function" or "Cannot read properties of undefined (reading 'subtle')".

**Why it happens:** jsdom's `window.crypto` lacks the `subtle` property and may have a limited `getRandomValues`. The official Tauri testing docs specifically call this out as a known jsdom limitation.

**Prevention:**
- Add to Vitest `setupFiles`: `import { webcrypto } from 'node:crypto'; Object.defineProperty(globalThis, 'crypto', { value: webcrypto })`. This polyfills Web Crypto from Node's implementation.
- Do this ONCE in a global setup file, not in individual test files.
- The `CryptoSession` class has zero tests (noted in CONCERNS.md). When writing those tests, the crypto polyfill must be in place first.

**Warning signs:**
- "crypto.getRandomValues is not a function" or "TextEncoder is not defined" in test output
- Tests that don't use crypto directly still fail because a transitive import loads `remote-sync.ts`

**Phase:** Testing setup (Phase 1); required before any crypto tests

---

### Pitfall 9: `@tauri-apps/plugin-fs` Scope Restrictions Block Global `~/.claude/` Access

**What goes wrong:** The wizard reads `~/.claude/settings.json` (the global Claude settings path). Tauri v2's `plugin-fs` enforces capability-based path scoping via `src-tauri/capabilities/`. If `$HOME` or `$APPDATA` is not explicitly listed in the capability scope, `readTextFile` will throw "path not allowed on the configured scope" at runtime — not at build time. This is a silent runtime failure.

**Why it matters here:** The wizard currently uses `join(projectPath, ".claude", "settings.json")` — a project-local path. But the CONCERNS.md notes the wizard should also check the global `~/.claude/` path. Expanding to read the global path requires a capabilities change that is easy to forget.

**Prevention:**
- Before expanding path reading beyond `projectPath`, verify the capability file at `src-tauri/capabilities/default.json` includes `$HOME/**` or the specific `$HOME/.claude/**` scope.
- Test file access at the global path explicitly — Tauri's path restriction errors are thrown at runtime, not statically analyzable.
- Do NOT use tilde (`~`) in paths passed to `plugin-fs` — Tauri does not expand tilde. Use `homeDir()` from `@tauri-apps/api/path` to get the actual home directory string.

**Warning signs:**
- "path not allowed on the configured scope" error in runtime logs or toast
- Feature works in `pnpm tauri dev` but not in the production `.dmg` build (different capability files)
- Passing `~/...` instead of an absolute path produces a confusing "not found" error

**Phase:** Bug fix (reading global Claude settings path)

---

## Minor Pitfalls

These cause friction or subtle bugs but are easy to fix once identified.

---

### Pitfall 10: Vitest `environment: 'jsdom'` Must Be Set Explicitly — Node Is the Default

**What goes wrong:** Vitest's default test environment is `node`, not `jsdom`. Running tests for React components in `node` mode means `document`, `window`, `localStorage`, and DOM APIs do not exist. Tests fail with "document is not defined" or render errors. This is the first thing any Tauri+React test setup must configure.

**Prevention:** Set `test.environment: 'jsdom'` in vitest config and install `jsdom` as a dev dependency. Alternatively, use `// @vitest-environment jsdom` docblock per test file, but the global config approach is less error-prone.

**Phase:** Testing setup (Phase 1 — must be the very first thing configured)

---

### Pitfall 11: Replacing `console.log` with a Structured Logger Breaks Existing Error Messages

**What goes wrong:** Currently, services throw `new Error("Failed to atomically write ...")` — generic messages that swallow the root cause. When replacing console calls with a logger, engineers often add log calls but do not improve error message quality. The result is structured logs that still say "Failed to atomically write" without any context about which file, what the OS error was, or what the caller was doing.

**Prevention:**
- When replacing a `console.error(err)`, capture the original error: `log.error("Failed to write agent file", { path: node.sourcePath, error: err.message })`.
- Define a structured context type: `{ path?: string, nodeId?: string, kind?: string, error?: string }` and pass it as the second argument to the logger.
- This is particularly important in `file-writer.ts` where the catch block currently just re-throws a generic `Error("Failed to atomically write ${node.sourcePath}")` discarding the original OS error.

**Phase:** Logging service rollout (Phase 1)

---

### Pitfall 12: `act()` Warnings Flood Test Output When Testing Async Wizard Steps

**What goes wrong:** The `SetupWizard` has multiple async `useEffect` hooks and async event handlers that update state after awaiting Tauri calls. Without proper `act()` wrapping, React Testing Library (RTL) floods the test output with "Warning: An update to SetupWizard inside a test was not wrapped in act(...)". With React 19 and current RTL, there are known issues where `userEvent` interactions are not automatically wrapped in `act()` when used with Vitest (as opposed to Jest).

**Prevention:**
- Always `await userEvent.click()` (not just `userEvent.click()`) — RTL's `@testing-library/user-event` v14 is async-first.
- Use `await waitFor(() => expect(...))` for assertions that depend on state changes after async operations.
- Do not use `fireEvent` for wizard interaction tests — use `userEvent` which handles async state propagation correctly.
- If `act()` warnings persist after correct async handling, check that the `@testing-library/react` version matches the React version (React 19 requires RTL 16+).

**Phase:** Wizard tests (Phase 2)

---

### Pitfall 13: Error Types Defined but Not Narrowed in Catch Blocks — Still Generic

**What goes wrong:** Defining error types (e.g., `FileNotFoundError`, `ValidationError`) for services is valuable. The pitfall is defining them but then catching them generically everywhere: `catch (err) { toast(err instanceof Error ? err.message : "Unknown error") }`. This discards the type information and prevents callers from handling specific cases differently (e.g., showing a "file not found — was it deleted?" message vs. "validation failed — here's what's wrong").

**Prevention:**
- Define a discriminated union error type per service: `type AgentParseError = { kind: 'not_found' } | { kind: 'parse_error', details: string } | { kind: 'validation_error', errors: string[] }`.
- In catch blocks, use `instanceof` narrowing: `if (err instanceof ValidationError) { showValidationDetails(err.errors) }`.
- At minimum, ensure wizard catch blocks distinguish between "file system error" (OS-level) and "parse error" (content-level) so the user message is accurate.

**Phase:** Error type definitions (Phase 1)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Vitest initial setup | Vite aliases (`@/`, `fs`) not inherited | Merge vite.config or re-declare aliases |
| Vitest initial setup | Node environment (not jsdom) is default | Set `environment: 'jsdom'` and install jsdom |
| Vitest initial setup | jsdom missing WebCrypto | Add Node crypto polyfill in setupFiles |
| Zustand store tests | Store state leaks between tests | Reset store in `beforeEach` with `setState(initial, true)` |
| Tauri IPC mocking | `window.__TAURI_INTERNALS__` missing | Call `mockIPC` in setupFiles; `clearMocks` in afterEach |
| Logging service | Logger causes IPC dependency in all modules | Facade pattern with environment detection |
| Logging service | Replacing console calls loses error context | Capture original error in structured context object |
| JSONC parsing fix | Fix applied only in wizard, misses settings-parser | Audit all `JSON.parse` callsites reading `.claude/` files |
| JSONC parsing fix | Writing back with `JSON.stringify` strips comments | Use `jsonc-parser`'s `applyEdits` for surgical updates |
| Error boundaries | Async/event handler errors not caught | Add `useErrorBoundary` + `window.unhandledrejection` handler |
| Toast z-index | Bumping number doesn't fix stacking context root | Use `createPortal` to render toast at `document.body` |
| Wizard tests | `act()` warning floods from async effects | Use `userEvent` (async API), `waitFor` for assertions |
| Error types | Types defined but catch blocks stay generic | Use discriminated unions + instanceof narrowing |
| Global path reading | `~/.claude/` blocked by capability scope | Verify capability file; use `homeDir()` not tilde |

---

## Sources

- [Tauri v2 — Mock Tauri APIs](https://v2.tauri.app/develop/tests/mocking/) — official mocking docs (HIGH confidence)
- [Tauri v2 — mocks namespace](https://v2.tauri.app/reference/javascript/api/namespacemocks/) — `mockIPC`, `clearMocks`, `mockWindows` API (HIGH confidence)
- [Tauri v2 — Logging plugin](https://v2.tauri.app/plugin/logging/) — `tauri-plugin-log` setup and targets (HIGH confidence)
- [Tauri v2 — File System plugin](https://v2.tauri.app/plugin/file-system/) — capability scopes and path restrictions (HIGH confidence)
- [Tauri v2 — plugin-fs home permissions bug #10330](https://github.com/tauri-apps/tauri/issues/10330) — path scope enforcement issue (MEDIUM confidence)
- [Vitest — Configuring aliases](https://vitest.dev/config/alias) — `test.alias` vs `resolve.alias` (HIGH confidence)
- [Vitest — Common Errors](https://vitest.dev/guide/common-errors) — jsdom environment issues (HIGH confidence)
- [Zustand — Testing guide](https://zustand.docs.pmnd.rs/guides/testing) — store state isolation (HIGH confidence)
- [Zustand Discussion #1918 — Vitest + store reset](https://github.com/pmndrs/zustand/discussions/1918) — practical reset pattern (MEDIUM confidence)
- [RTL Issue #1413 — act() warnings with Vitest](https://github.com/testing-library/react-testing-library/issues/1413) — ongoing compatibility issue (MEDIUM confidence)
- [React — Error Boundaries docs](https://legacy.reactjs.org/docs/error-boundaries.html) — what boundaries don't catch (HIGH confidence)
- [react-error-boundary — useErrorBoundary](https://github.com/bvaughn/react-error-boundary) — async propagation pattern (HIGH confidence)
- [MDN — Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Positioned_layout/Stacking_context) — `backdrop-filter` creates stacking context (HIGH confidence)
- [joshwcomeau.com — What the heck, z-index](https://www.joshwcomeau.com/css/stacking-contexts/) — stacking context mental model (HIGH confidence)
- [jsonc-parser on npm](https://www.npmjs.com/package/jsonc-parser) — Microsoft's JSONC parser with `applyEdits` (HIGH confidence)
- [Vitest Integration test discussion #6636](https://github.com/vitest-dev/vitest/discussions/6636) — Tauri + Vitest integration patterns (MEDIUM confidence)
- [How to write Unit Tests for Tauri with Vitest — Yonatan Kra](https://yonatankra.com/how-to-setup-vitest-in-a-tauri-project/) — jsdom + WebCrypto polyfill pattern (MEDIUM confidence)
