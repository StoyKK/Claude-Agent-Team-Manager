# Feature Landscape: ATM Stability & Testing Milestone

**Domain:** Desktop app stability — testing infrastructure, structured logging, error handling, toast/z-index management
**Researched:** 2026-03-27
**Overall confidence:** HIGH (most claims verified against official Tauri v2 docs, Vitest docs, and current community practice)

---

## Table Stakes

Features users expect from a stable desktop app. Missing any of these and the app feels broken or unshippable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Setup wizard completes without silent failure | Onboarding is the first user touch — if "Get Started" swallows errors silently, users assume the app is broken | Low | Root cause: `handleGetStarted` catches errors, calls `toast()`, but toast z-index (10000) is lower than the wizard overlay (20000); fix is raise `ToastContainer` to z:25000 or render it via a React portal above the overlay |
| Toast notifications visible over all overlays | Toasts are the only feedback mechanism during wizard flow; invisible toasts = silent failures | Low | Current `ToastContainer` has `zIndex: 10000`; wizard overlay has `zIndex: 20000`; toast must be the highest z-index in the app; recommend a dedicated CSS variable `--z-toasts: 99999` |
| Claude settings parsed correctly (JSONC support) | Claude Code's `settings.json` may contain `//` comments; `JSON.parse` throws on them, causing step 2 to report "not enabled" even when it is | Low | Use `@microsoft/node-jsonc-parser` (authoritative, maintained by Microsoft, used in VS Code) or the lighter `jsonc-parse` package; strip comments before `JSON.parse` |
| Setup wizard reads global `~/.claude/` path | Project-local `.claude/settings.json` is empty on new installs; the app must also check `~/.claude/settings.local.json` and `~/.claude/settings.json` | Low | Wizard step 2 currently only reads `<project>/.claude/settings.json`; must add global path fallback |
| Structured logging replaces scattered console calls | Production desktop apps cannot be debugged if errors go only to `console.error` (no user-visible trace, no log file) | Medium | 55 `console.log/warn/error` calls spread across 6 files; use `@tauri-apps/plugin-log` — it bridges JS and Rust, writes to OS log directory, and supports log levels; this is the official Tauri v2 logging solution |
| Defined error types per service | Without typed errors, callers cannot distinguish "file not found" from "validation failed" from "permission denied" — every error becomes a generic `catch (err)` | Medium | Use TypeScript discriminated unions: `type AgentParseError = { kind: "not-found" } | { kind: "invalid-yaml" } | { kind: "validation"; issues: string[] }`; each service file exports its own error union |
| Vitest test framework configured | Zero test coverage means any change can silently break the setup wizard or parsers — this is the first thing contributors look for | Medium | Vitest is the correct choice for this stack (same Vite config, native ESM, identical API to Jest); requires `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, and a `setupTests.ts` file |
| Tests for setup wizard flow | The wizard is the critical user path; it has 3 steps, 2 async checks, and 4 error cases — none are tested | Medium | Test: step 1 save API key success, step 1 skip, step 2 reads teams setting, step 2 detects JSONC comments, step 3 "Get Started" completes and hides wizard, error toasts fire on failures; use `mockIPC` from `@tauri-apps/api/mocks` to stub Tauri FS commands |
| Tests for file parsers (agent-parser, skill-parser, settings-parser) | These parsers are called on every project load; malformed markdown should produce validation errors, not crashes | Medium | These are the easiest tests to write: pure functions that take string content and return `AuiNode`; no Tauri mocking needed for the string-input path |
| Tests for validation schemas and path utilities | Zod schemas and path utils are pure logic — bugs here corrupt every node silently | Low | Simple unit tests; no browser emulation needed; fast to write and maintain |

---

## Differentiators

Features that go beyond the bare minimum and make the app notably more trustworthy or debuggable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| React Error Boundary wrapping wizard and main editor | Prevents a crash in one component from killing the entire app; users see "Something went wrong, try again" instead of a blank screen | Low | Use `react-error-boundary` package (maintained, hook-friendly, supports `resetKeys` and `onError` callback for logging); place one boundary around `<SetupWizard />` and one around `<TreeCanvas />` at minimum; never wrap the `<ToastContainer />` itself or errors will kill the toast system |
| Log file written to OS log directory | Users can share a log file when reporting bugs; support becomes tractable | Low | `tauri-plugin-log` with `LogTarget::LogDir` writes to `~/Library/Logs/<app-name>/` on macOS; this is table stakes for shipped desktop apps but zero effort with the plugin |
| Log correlation IDs for wizard operations | Each wizard session gets a UUID prefix so logs can be filtered to a single run | Low | Add `sessionId` to every log call during wizard flow; costs two lines of code, dramatically improves debuggability |
| `attachConsole` in development, file-only in production | In dev mode, pipe Rust logs back to the JS console; in production, write to file only | Low | `tauri-plugin-log` supports this via the `attachConsole()` JS API and `TargetKind::Webview` in Rust config; distinguish via `import.meta.env.DEV` |
| Tests for file-scanner (integration-level) | File scanner is the entry point for all project data; bugs here lose agents silently | Medium | Requires `mockIPC` to stub `readDir` and `readTextFile` Tauri commands; test: empty directory, directory with mixed .md and non-.md files, subdirectory traversal |
| Error toast deduplication | If the same error fires 5 times in 300ms (e.g., file-watcher loop), users see 5 identical toasts — confusing | Low | Add a `key` dedup check in `toast()`: if an identical message was toasted in the last 500ms, skip; 10-line addition to `Toast.tsx` |
| Global unhandled rejection handler | Promise rejections that escape all `try/catch` blocks are silently swallowed in Tauri webviews | Low | Add `window.addEventListener('unhandledrejection', ...)` in `main.tsx`; log via the structured logging service; optionally show a toast |

---

## Anti-Features

Things to explicitly NOT build in this milestone. Including them would expand scope, introduce regression risk, or solve the wrong problem.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Remote crash reporting / Sentry integration | This milestone is about local stability; adding network telemetry before local logging works is backwards; also introduces privacy questions for a desktop app | Establish the local log file first; telemetry is a separate milestone decision |
| End-to-end tests with tauri-driver / WebdriverIO | Tauri's WebDriver integration requires a full production build and is fragile on CI; overkill when zero unit tests exist | Start with Vitest unit + component tests; E2E can come after coverage exists |
| Tests for tree-store.ts (the 2,767-line monolith) | PROJECT.md explicitly defers tree-store refactoring; writing tests against the current monolith creates tests that couple to implementation details and will all need rewriting | Defer until tree-store is refactored into focused modules |
| Rust backend unit tests via `tauri::test` | The `test` feature in Tauri v2's Cargo.toml enables `mock_builder` / `mock_context`, but the existing Rust commands (`open_terminal`, `create_scheduled_task`, `fetch_url`) are thin OS wrappers — the value-to-cost ratio is low for this milestone | Rust commands are integration concerns; test the TypeScript service layer that calls them |
| Custom logging UI / in-app log viewer | No user has asked for this; adds complexity to the UI; the OS log directory is sufficient for support use cases | Ship log files; add a "Open Logs" menu item if users request it |
| Replacing Toast.tsx with a third-party library (react-toastify, sonner, etc.) | The custom `Toast.tsx` is 124 lines and works; replacing it risks introducing new z-index bugs and API differences; the only real fix needed is raising the z-index | Fix the z-index with one CSS value change; keep the custom component |
| Log sampling / rate limiting | Premature; the app has 55 log calls total and will have maybe 100 after this milestone | Revisit if log file size becomes a complaint |
| Full Zustand store reset utilities for tests | The official Zustand testing guide recommends resetting store state between tests, but tree-store.ts is 2,767 lines and deferred — building a reset harness for it now creates coupling to the monolith | Mock the store at the component boundary using `vi.mock` on the hook; test components against a mocked store state |

---

## Feature Dependencies

```
JSONC parsing fix
  → must land before setup wizard tests (tests would fail on the same bug)

Vitest configuration
  → must land before any test file (obvious)
  → setup file must stub Tauri FS APIs via mockIPC before wizard or parser tests

Structured logging service
  → must land before wizard tests (tests assert on log output, not console.log)
  → must land before error type definitions (logging service is the sink for typed errors)

Error type definitions (discriminated unions)
  → agent-parser, skill-parser, settings-parser each need their own error types
  → file-writer needs its own error types
  → these inform what wizard tests should assert on

Toast z-index fix
  → must land before wizard tests (otherwise test assertions about "toast fires on error" cannot be visually validated by a human)
  → independent of all other features — one-line fix, ship first

React Error Boundaries
  → depends on the logging service (boundary's onError callback logs via the service)
  → can be added after the logging service is established
```

---

## MVP Recommendation

Prioritize in this order for the milestone:

1. **Toast z-index fix** — one-line change (`zIndex: 25000` in `ToastContainer`), zero risk, immediately unblocks human debugging of every other issue
2. **JSONC parsing for Claude settings** — fixes the "Agent teams not enabled" false positive; use `@microsoft/node-jsonc-parser`'s `stripComments()` function, keep the rest of the parsing logic identical
3. **Global `~/.claude/` path fallback** — fixes the other root cause of step 2 failures; read `~/.claude/settings.json` then `~/.claude/settings.local.json` as fallbacks when project-local settings.json is missing or has no `env` key
4. **Vitest + jsdom configuration** — add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` as devDependencies; add `test` block to `vite.config.ts` or a separate `vitest.config.ts`; add `src/setupTests.ts` with `@testing-library/jest-dom` import and `mockIPC` setup
5. **Structured logging service** — thin wrapper over `@tauri-apps/plugin-log`; exports `log.debug/info/warn/error(message, context?)`; replaces all 55 `console.*` calls
6. **Service error types** — discriminated union `XxxError` types for `agent-parser`, `skill-parser`, `settings-parser`, `file-writer`; no behavior change, just type-level contracts
7. **Tests: parsers and path utils** — highest return on investment; pure functions, no mocks needed, fast
8. **Tests: setup wizard flow** — most critical user path; requires `mockIPC` stubs for FS operations

Defer: React Error Boundaries (valuable but not blocking), log correlation IDs (nice-to-have), file-scanner tests (need mockIPC complexity, lower urgency than parsers).

---

## Sources

- [Tauri v2 Mock Tauri APIs (official)](https://v2.tauri.app/develop/tests/mocking/) — HIGH confidence
- [Tauri v2 Tests overview (official)](https://v2.tauri.app/develop/tests/) — HIGH confidence
- [Tauri v2 Logging plugin (official)](https://v2.tauri.app/plugin/logging/) — HIGH confidence
- [Tauri v2 Log JS API reference (official)](https://v2.tauri.app/reference/javascript/log/) — HIGH confidence
- [Zustand testing guide (official)](https://zustand.docs.pmnd.rs/guides/testing) — HIGH confidence
- [Vitest test environment docs (official)](https://vitest.dev/guide/environment) — HIGH confidence
- [react-error-boundary on LogRocket](https://blog.logrocket.com/react-error-handling-react-error-boundary/) — MEDIUM confidence
- [react-toastify z-index issue thread](https://github.com/fkhadra/react-toastify/issues/139) — MEDIUM confidence (confirms portal + z-index as canonical fix)
- [Microsoft node-jsonc-parser](https://github.com/microsoft/node-jsonc-parser) — HIGH confidence (used in VS Code)
- [Tauri v2 Rust test feature — mock_builder docs](https://docs.rs/tauri/latest/tauri/test/fn.mock_builder.html) — HIGH confidence
- [Vitest + Tauri setup guide (community)](https://yonatankra.com/how-to-setup-vitest-in-a-tauri-project/) — MEDIUM confidence (community, but verified against official Tauri mocking docs)
- [LogRocket: React toast libraries compared 2025](https://blog.logrocket.com/react-toast-libraries-compared-2025/) — MEDIUM confidence
