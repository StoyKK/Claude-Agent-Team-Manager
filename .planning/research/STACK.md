# Technology Stack: Testing, Logging, and Error Handling

**Project:** ATM (Agent Team Manager) — Tauri v2 + React 19 + TypeScript 5.9 + Vite 7 + Zustand
**Milestone:** Stability milestone — adding testing infrastructure, structured logging, error handling
**Researched:** 2026-03-27
**Overall confidence:** MEDIUM-HIGH (most choices verified via official docs and npm; a few version
constraints confirmed via web search only)

---

## Context

This is a brownfield Tauri v2 desktop app. Zero test coverage. 55 scattered `console.log` calls.
No error types on services. The milestone requires:

1. A frontend test framework (unit + component tests)
2. Tauri API mocking for tests that call `invoke()`
3. A structured logging service (browser-side TypeScript + Rust-side)
4. A JSONC parser for reading Claude settings files (`~/.claude/settings.json` uses comments)
5. Defined error types on core services

The existing stack is React 19.2.4 / Vite 7.3.1 / TypeScript 5.9.3 / Tauri 2.10.0.

---

## Recommended Stack

### Test Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest | ^3.2.x | Unit + component test runner | Native Vite integration; zero config when `vite.config.ts` already exists; shares the same transform pipeline, so TypeScript path aliases (`@/`) work without separate setup. Vitest 4 is the current latest but requires Node 20+; this project's README says Node 18+, so pin to v3. |
| @vitest/coverage-v8 | ^3.2.x | Code coverage via V8 | Ships with Vitest, no extra configuration; V8 provider works in Node without installing Chrome. Use `c8` not `istanbul` — no instrumentation step needed. |
| jsdom | ^26.x (auto-installed) | DOM simulation for React tests | More complete Web API coverage than happy-dom. This project touches File API, Blob, URL, and Tauri's `window.__TAURI_INTERNALS__` — jsdom is safer than happy-dom here. |
| @testing-library/react | ^16.3.x | React component testing utilities | v16 is the first release with first-class React 19 support (peer dep widened). Use render, screen, act from here. |
| @testing-library/dom | ^10.x | Required peer dep for RTL v16 | RTL v16 moved this to a peer dependency; must install explicitly. |
| @testing-library/user-event | ^14.x | Simulate real user interactions | Builds on @testing-library/dom; handles async events properly. |

**Why Vitest over Jest:**
- Vite 7 is already the build tool; Vitest reuses `vite.config.ts` directly. Jest requires
  a separate Babel/ts-jest transform pipeline that must be kept in sync with Vite's config.
- The `@/` import alias defined in `tsconfig.json` and `vite.config.ts` works in Vitest
  with zero extra config. With Jest it requires a `moduleNameMapper` entry.
- ESM-first codebase: gray-matter, zustand 5, and @xyflow/react all ship ESM. Jest's ESM
  support is still experimental and fragile. Vitest is ESM-native.
- Project's own PROJECT.md already explicitly selects Vitest ("Vitest over Jest — Already
  using Vite for build; Vitest integrates natively").

**Why Vitest 3, not 4:**
- Vitest 4 requires Node >= 20. This project's CLAUDE.md documents Node 18+ as a
  prerequisite. Vitest 3 (latest 3.2.x) supports Vite >= 6 / Node >= 18 and has full
  Vite 7 compatibility confirmed from Vitest 3.2 onward.
- Vitest 4 also adds Browser Mode (stable) — not needed for this milestone. Upgrade
  when the project raises its Node floor to 20.

**Confidence:** HIGH — Vitest docs, official blog, npm registry all consulted.

---

### Tauri API Mocking

| Technology | Source | Purpose | Why |
|------------|--------|---------|-----|
| `@tauri-apps/api/mocks` | already in @tauri-apps/api 2.10.x | Mock `invoke()` and Tauri events in unit tests | Built into the existing @tauri-apps/api package at no extra cost |

`mockIPC(handler)` intercepts all IPC calls routed through `invoke()` and replaces them
with a JavaScript handler. `clearMocks()` tears down the mock after each test.

This means the Rust backend never runs during frontend unit tests. Tests execute in jsdom
only, making them fast and hermetic.

**Usage pattern:**
```typescript
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'
import { afterEach, test, expect } from 'vitest'

afterEach(() => clearMocks())

test('reads agent file', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'plugin:fs|read_text_file') {
      return '---\ntitle: My Agent\n---\nBody'
    }
  })
  // call code that uses Tauri FS plugin
})
```

**Important:** Tauri plugin commands follow the pattern `plugin:<plugin-name>|<command>`.
For `@tauri-apps/plugin-fs`, the IPC command is `plugin:fs|read_text_file`, not just
`read_text_file`. Verify exact command strings from the plugin source when writing mocks.

**Confidence:** HIGH — documented at v2.tauri.app/develop/tests/mocking/, mockIPC confirmed
in @tauri-apps/api 2.x.

---

### Structured Logging — Frontend (TypeScript/Browser)

**Recommendation: `@tauri-apps/plugin-log` as the transport, thin service wrapper on top.**

Do NOT add a general-purpose logging library like tslog or pino. Here is why:

1. The project already has `tauri-plugin-log` listed as a Tauri plugin in the existing
   STACK.md (Log plugin v2 — built-in logging).
2. `@tauri-apps/plugin-log` provides `trace`, `debug`, `info`, `warn`, `error` functions
   that forward log messages from JavaScript to the Rust backend, which then writes them
   to the OS-level log file (via `log` crate). This is the correct approach for a Tauri
   desktop app — logs land in a persistent file the user can inspect, not just the
   browser DevTools console.
3. `attachConsole()` mirrors Rust-side logs back to the browser DevTools console during
   development — zero extra effort.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @tauri-apps/plugin-log | ^2.7.x | Structured log transport | Bridges JS logs to Rust log crate; produces persistent log files; already wired into the Tauri backend; zero extra Rust dependencies |

**The service wrapper pattern (do not use the plugin directly everywhere):**

Write a thin `src/services/logger.ts` that wraps `@tauri-apps/plugin-log`. This:
- Provides a single import path (`import { logger } from '@/services/logger'`) to replace
  all 55 `console.log` calls
- Lets you fall back to `console.log` in test environments where the Tauri IPC is not
  available (i.e., wrap with `window.__TAURI_INTERNALS__ ? tauri_log : console_log`)
- Enforces a consistent structured format (caller module, context object, message)

**tslog is NOT recommended for this project** because it would add a third logging layer
on top of the existing Rust `log` crate. Logs from tslog would not appear in the OS log
file and would not be correlated with Rust-side events.

**Confidence:** HIGH — @tauri-apps/plugin-log v2 verified via npm (2.7.1), official Tauri
plugin docs, and existing project STACK.md confirms it is already a registered plugin.

---

### Structured Logging — Backend (Rust)

**Recommendation: Existing `log` crate + `tauri-plugin-log` — no changes needed.**

The Tauri log plugin registers the `log` crate as a subscriber. The Rust backend already
uses `tauri-plugin-log` as a Cargo dependency. All that is needed is to replace direct
`println!` / `eprintln!` calls in `src-tauri/src/` with `log::info!`, `log::warn!`,
`log::error!` macros.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| log (crate) | 0.4.x | Structured log macros for Rust | Already a transitive dep via tauri-plugin-log; `log::info!`, `log::warn!`, `log::error!` are the standard macros |
| tauri-plugin-log | 2.7.x (Cargo) | Routes Rust logs to file + optionally to webview | Already installed as a Cargo dep |

Do NOT add `tracing` to the Rust backend. `tracing` is the right choice for long-running
async services (axum HTTP server, tokio tasks) where span context propagation matters, but
for a Tauri app's command handlers it is overkill. The existing axum server in
`src-tauri/` already runs within tokio, but log messages from command handlers do not need
distributed trace IDs. Adding `tracing` would require replacing all `log::` macro calls
with `tracing::` macros and setting up a tracing-subscriber — significant churn for zero
user-visible benefit in this milestone.

**Confidence:** MEDIUM — confirmed that `log` crate integrates with tauri-plugin-log via
official Tauri docs and aptabase guide; `tracing` recommendation is based on reasoning,
not a confirmed test.

---

### JSONC Parser

**Recommendation: `jsonc-parser` (Microsoft)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| jsonc-parser | ^3.3.1 | Parse `~/.claude/settings.json` which uses `//` comments | Microsoft-maintained; ships both ESM and UMD for browser use; works with Vite bundler without any special config; fault-tolerant (continues parsing past errors); zero runtime dependencies |

**Why not a custom strip-comments approach:**
- Hand-rolling comment stripping with regex is brittle — it will incorrectly strip `//`
  inside strings.
- `jsonc-parser` uses a proper tokenizer, handles edge cases, and is the same library
  VS Code uses internally to parse its own JSONC config files. It is battle-tested.

**Why not `jsonc` (the other npm package):**
- `jsonc` (npm) is unmaintained and has known security issues.
- `jsonc-parser` has 1500+ dependents, is actively maintained by Microsoft, and is the
  de-facto standard.

**Usage:**
```typescript
import { parse } from 'jsonc-parser'

const settings = parse(rawFileContent) // handles // and /* */ comments
```

The `parse` function returns the JSON value directly. For error handling, use `parseTree`
which provides structural error information without throwing.

**Confidence:** HIGH — Microsoft GitHub repo verified, npm registry checked (3.3.1 is
latest stable), ESM support confirmed in package.json of the library.

---

### Error Types — No New Library Needed

**Recommendation: Typed error classes in TypeScript, no library.**

This project uses Zod 4.3.6 for input validation already. For service-level errors
(agent-parser, file-writer, file-scanner, remote-sync), use typed error subclasses:

```typescript
export class AgentParseError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly cause: unknown
  ) {
    super(`Failed to parse agent at ${filePath}`)
    this.name = 'AgentParseError'
  }
}
```

This pattern:
- Zero dependencies
- Type-narrowable in catch blocks (`if (err instanceof AgentParseError)`)
- Carries context (which file failed, what caused it)
- Works with the logger service (`logger.error('Agent parse failed', { err, filePath })`)

**Do not use `neverthrow` or `ts-results` (Result types):** The existing codebase uses
throw/catch throughout. Introducing Result types requires rewriting all callers, which
is out of scope for this milestone and would make the diff enormous.

**Confidence:** HIGH — standard TypeScript pattern, no library needed.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Test runner | vitest 3.x | Jest | Jest requires separate Babel/ts-jest pipeline; ESM support fragile; path aliases need extra mapping; Vite users should use Vitest |
| Test runner | vitest 3.x | vitest 4.x | Vitest 4 requires Node 20; project minimum is Node 18 |
| DOM env | jsdom | happy-dom | happy-dom is faster but missing some Web APIs; this project uses File, Blob, URL APIs that happy-dom may not fully implement |
| Frontend logging | @tauri-apps/plugin-log (wrapper) | tslog | tslog logs would not appear in OS log files; adds a third logging layer; Tauri plugin already installed |
| Frontend logging | @tauri-apps/plugin-log (wrapper) | pino | pino targets Node.js HTTP servers; browser-side pino still requires a server to receive logs; not meaningful for a desktop Tauri app |
| Rust logging | log crate (already present) | tracing | tracing adds span context / subscriber setup; overkill for command handler logs; no user-visible benefit in this milestone |
| JSONC parser | jsonc-parser (Microsoft) | Manual regex strip | Regex strips `//` inside strings; brittle; JSONC tokenizer is the correct approach |
| JSONC parser | jsonc-parser | jsonc (npm) | `jsonc` npm package is unmaintained with security issues |
| Error types | Typed Error subclasses | neverthrow / ts-results | Requires rewriting all callers; out of scope; existing code uses throw/catch |

---

## Installation Commands

```bash
# Test framework
pnpm add -D vitest @vitest/coverage-v8 jsdom
pnpm add -D @testing-library/react @testing-library/dom @testing-library/user-event

# JSONC parser (production dep — used at runtime to read Claude settings)
pnpm add jsonc-parser

# Tauri log plugin (JS side — check if already installed)
# @tauri-apps/plugin-log is NOT yet in package.json — add it
pnpm add @tauri-apps/plugin-log
```

Note: `@tauri-apps/api/mocks` is already available — it ships inside `@tauri-apps/api`
which is already a dependency (`^2.10.1`). No additional install required.

---

## vitest.config (minimal, integrated into vite.config.ts)

```typescript
// vite.config.ts — add test block
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src-tauri/**', 'dist/**', 'src/test/**'],
    },
  },
})
```

The `setupFiles` entry should import `@testing-library/jest-dom` matchers and set up
`clearMocks()` in `afterEach`.

---

## Version Summary Table

| Package | Recommended Version | Notes |
|---------|--------------------|----|
| vitest | ^3.2.x | Node 18 compatible; Vite 7 compatible from 3.2 |
| @vitest/coverage-v8 | ^3.2.x | Must match vitest major.minor |
| jsdom | ^26.x | Auto-installed as vitest environment dep |
| @testing-library/react | ^16.3.x | React 19 peer dep support |
| @testing-library/dom | ^10.x | Required peer dep for RTL v16 |
| @testing-library/user-event | ^14.x | Async user interaction simulation |
| jsonc-parser | ^3.3.1 | Microsoft JSONC; ESM+UMD; zero deps |
| @tauri-apps/plugin-log | ^2.7.x | Already Rust-registered; needs JS side added |

---

## Confidence Assessment

| Area | Confidence | Evidence |
|------|------------|---------|
| Vitest 3 over 4 (Node constraint) | HIGH | Official Vitest 4 release notes confirm Node 20 req; project README confirms Node 18+ |
| Vitest over Jest | HIGH | Official Vite docs + Vitest docs + project's own PROJECT.md decision |
| @testing-library/react v16 for React 19 | HIGH | npm page + GitHub releases confirmed React 19 peer support in v16 |
| jsdom over happy-dom | MEDIUM | Community guidance; specific Web APIs used by this project not tested against happy-dom |
| @tauri-apps/api/mocks for IPC mocking | HIGH | Official Tauri v2 docs + npm package inspection |
| @tauri-apps/plugin-log as log transport | HIGH | Official Tauri plugin docs + npm 2.7.1 + existing project STACK.md confirms plugin is registered |
| jsonc-parser (Microsoft) | HIGH | npm registry, GitHub repo, 1500+ dependents, ESM confirmed |
| Typed Error subclasses (no library) | HIGH | Standard TS pattern; no library needed |
| log crate (Rust, no tracing) | MEDIUM | Tauri integration confirmed; tracing exclusion based on scope reasoning not empirical test |

---

## Sources

- [Vitest 4.0 release blog](https://vitest.dev/blog/vitest-4) — Node 20 requirement confirmed
- [Vitest Guide — Getting Started](https://vitest.dev/guide/) — install and config
- [Vitest npm registry](https://www.npmjs.com/package/vitest) — current version 4.1.2; v3.2 stable
- [Tauri v2 Mocking Guide](https://v2.tauri.app/develop/tests/mocking/) — mockIPC, clearMocks
- [Tauri v2 Logging Plugin](https://v2.tauri.app/plugin/logging/) — @tauri-apps/plugin-log
- [@tauri-apps/plugin-log npm](https://www.npmjs.com/package/@tauri-apps/plugin-log) — v2.7.1
- [@tauri-apps/plugin-log JS API reference](https://v2.tauri.app/reference/javascript/log/) — attachConsole
- [jsonc-parser npm](https://www.npmjs.com/package/jsonc-parser) — v3.3.1, ESM+UMD
- [microsoft/node-jsonc-parser GitHub](https://github.com/microsoft/node-jsonc-parser) — maintained by Microsoft
- [@testing-library/react npm](https://www.npmjs.com/package/@testing-library/react) — v16.3.x React 19 support
- [Vitest test environments (jsdom vs happy-dom)](https://vitest.dev/guide/environment) — tradeoffs
- [tslog — Universal TypeScript Logger](https://tslog.js.org/) — v4.10.2, zero deps, browser support
