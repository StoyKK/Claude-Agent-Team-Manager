# Architecture Patterns: Testing, Logging, and Error Handling

**Domain:** Tauri v2 + React 19 desktop app (brownfield)
**Researched:** 2026-03-27
**Confidence:** HIGH (verified against official Tauri v2 docs, Vitest docs, Zustand docs)

---

## Recommended Architecture

The three concerns — testing, logging, error handling — each slot into the existing two-layer architecture at different levels. They are cross-cutting but independent. The correct model is:

```
┌──────────────────────────────────────────────────────────────────┐
│  React Components (src/components/)                              │
│   - Consumes errors via validationErrors on AuiNode              │
│   - Displays toasts from ui-store                                │
│   - TestIDs on wizard steps for testing                          │
├──────────────────────────────────────────────────────────────────┤
│  State Management (src/store/)                                   │
│   - tree-store: catches service errors, toasts, stores to node   │
│   - ui-store: addToast() is the error display surface            │
├──────────────────────────────────────────────────────────────────┤
│  Services Layer (src/services/)                                  │
│   - Define typed error classes (ParseError, WriteError, etc.)    │
│   - Throw typed errors instead of generic Error strings          │
│   - Unit-testable in isolation via Tauri mock injection          │
├──────────────────────────────────────────────────────────────────┤
│  Utils / Cross-cutting (src/utils/, src/services/logger.ts)      │
│   - logger.ts: singleton, wraps console, structured output       │
│   - All console.log/warn/error calls route through logger        │
│   - paths.ts, validation.ts: pure functions, zero-dependency     │
│     tests — no Tauri mocking needed at all                       │
├──────────────────────────────────────────────────────────────────┤
│  Test Infrastructure (vitest.config.ts + src/test/)              │
│   - Vitest + jsdom environment                                   │
│   - Global setup file: mockIPC, mockWindows, crypto polyfill     │
│   - Per-service __tests__ directories or src/test/ directory     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. Logger Service (`src/services/logger.ts`) — NEW

**Responsibility:** Centralise all diagnostic output. Replace 56 raw `console.*` calls.

**Boundary:** Singleton module. No dependencies on Tauri, React, or stores. Imported directly by any layer that currently uses `console.*`.

**Interface:**
```typescript
export const logger = {
  info(context: string, message: string, data?: Record<string, unknown>): void
  warn(context: string, message: string, data?: Record<string, unknown>): void
  error(context: string, message: string, err?: unknown, data?: Record<string, unknown>): void
  debug(context: string, message: string, data?: Record<string, unknown>): void
}
```

**Data format:** Structured objects, not interpolated strings. The `context` param replaces the existing `[ATM]`, `[RemoteSync]`, `[Settings]` prefixes already in use.

**What it does NOT do:** Persist logs to disk, send telemetry, format for UI — those are separate concerns for later milestones. In production builds, `debug` level calls are silenced.

**Communicates with:** Nobody. Purely emits to the browser console (or a configurable sink in the future).

---

### 2. Typed Error Classes (`src/types/errors.ts`) — NEW

**Responsibility:** Give service callers a stable, typed surface for what can go wrong. Callers currently cannot distinguish `Error("Validation failed: ...")` from `Error("Failed to atomically write...")`.

**Boundary:** Pure TypeScript, no imports. Defined as classes extending `Error` with a `kind` discriminant.

```typescript
// Error hierarchy — kept intentionally flat for this milestone
export class AtmError extends Error {
  readonly kind: string;
}

export class ParseError extends AtmError {
  readonly kind = 'parse';
  constructor(
    public readonly filePath: string,
    public readonly cause: unknown,
    message: string
  ) { super(message); }
}

export class WriteError extends AtmError {
  readonly kind = 'write';
  constructor(
    public readonly filePath: string,
    public readonly cause: unknown,
    message: string
  ) { super(message); }
}

export class ValidationError extends AtmError {
  readonly kind = 'validation';
  constructor(
    public readonly fields: string[],
    message: string
  ) { super(message); }
}

export class ScanError extends AtmError {
  readonly kind = 'scan';
  constructor(
    public readonly directory: string,
    public readonly cause: unknown,
    message: string
  ) { super(message); }
}
```

**Communicates with:** Services throw them. Stores catch them and decide whether to toast/log/store on node. Tests assert on `.kind` instead of `.message` strings.

**What it does NOT do:** Wrap every error. `remote-sync.ts` has its own complexity and is deferred. Typed errors apply to: `agent-parser.ts`, `skill-parser.ts`, `settings-parser.ts`, `file-scanner.ts`, `file-writer.ts`.

---

### 3. Test Infrastructure (`vitest.config.ts` + `src/test/`) — NEW

**Responsibility:** Provide a fast, Tauri-aware test environment. Tests run in jsdom without needing the Rust backend running.

**Boundary:** Isolated from production code. Test files live either co-located as `__tests__/` sibling directories or in `src/test/` for shared test utilities.

**Key components:**

`vitest.config.ts` — Adds test block to existing Vite config:
```typescript
// Extends existing vite.config.ts resolve aliases
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  coverage: {
    provider: 'v8',
    include: ['src/services/**', 'src/utils/**'],
  }
}
```

`src/test/setup.ts` — Global test setup, runs before every test file:
```typescript
import { beforeAll, afterEach, vi } from 'vitest';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';

// jsdom does not ship WebCrypto — polyfill it
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

beforeAll(() => {
  // Tell Tauri we're in the "main" window
  mockWindows('main');
  // Default IPC handler — individual tests override per-command
  mockIPC((cmd) => {
    throw new Error(`Unmocked Tauri command: ${cmd}`);
  });
});

afterEach(() => {
  clearMocks();
});
```

`src/test/tauri-helpers.ts` — Reusable mock factories:
```typescript
// Mock readTextFile to return fixture content
export function mockReadTextFile(map: Record<string, string>) { ... }
// Mock exists() to return true/false by path
export function mockExists(map: Record<string, boolean>) { ... }
```

**Communicates with:** All service tests import helpers. Components tests use `@testing-library/react` with store reset.

---

## Data Flow: How Errors Move Through the System

### Parse Error Flow (agent-parser, skill-parser, settings-parser)

```
readTextFile(path)                   ← Tauri FS (mocked in tests)
  ↓ throws on Tauri error
ParseError(path, cause, message)     ← thrown by parser
  ↓
tree-store.loadProject()             ← catches, decides handling
  ↓ non-critical: store validationErrors on node, log warning
  ↓ critical: log error, toast user
ui-store.addToast("...")             ← surfaces to user
```

Key insight: Parsers already set `validationErrors` on the returned `AuiNode` for schema validation failures — this is the correct channel for "soft" errors where the node can still appear on the canvas with a warning badge. `ParseError` is thrown for "hard" failures where the file cannot be read at all.

### Write Error Flow (file-writer)

```
writeTextFile(tmpPath, content)      ← Tauri FS
rename(tmpPath, sourcePath)          ← Tauri FS
  ↓ throws on any OS error
WriteError(path, cause, message)     ← thrown by file-writer
  ↓
tree-store (useAutosave → saveNode)  ← catches
  ↓
ui-store.addToast("Save failed", "error")
logger.error("file-writer", ...)
```

### Log Flow (all layers)

```
Any layer: logger.warn("RemoteSync", "Decryption failed", { err })
  ↓
logger singleton
  ↓ dev: console.warn("[RemoteSync] Decryption failed", { err })
  ↓ prod: console.warn (debug suppressed, info/warn/error pass through)
  ↓ future: pluggable sink (Tauri file log, telemetry)
```

The logger is a pure emit function — it does not alter control flow. Callers still throw or return; the logger records what happened.

### Wizard Error Flow (SetupWizard component)

```
handleGetStarted()
  ↓ await writeTextFile(...)          ← Tauri FS
  ↓ throws if .aui/ not writable
catch(err)
  ↓ toast(err.message, "error")       ← currently hidden behind overlay (z-index bug)
```

The z-index bug (toast at z:10000, overlay at z:20000) means errors are swallowed visually. Fix: raise toast z-index to 30000. This is a CSS fix, not an architecture change — but it unblocks error visibility during testing.

---

## What Is Testable and How

### Tier 1: Zero-dependency — no mocking needed

These are pure functions. Tests run in jsdom with no setup overhead.

| Module | Why Zero-Dependency | Test Focus |
|--------|---------------------|------------|
| `src/utils/paths.ts` | No imports beyond string ops | `normalizePath`, `getFileName`, `generateNodeId`, `joinPath` edge cases |
| `src/utils/validation.ts` | Pure Zod validators | All Zod schema happy/sad paths |
| `src/types/errors.ts` | Class definitions | instanceof checks, kind discriminant |
| `src/services/logger.ts` | Wraps console only | Output format, level filtering |

### Tier 2: Tauri-mocked — requires `mockIPC` setup

These services call Tauri FS APIs (`readTextFile`, `exists`, `readDir`, `writeTextFile`, `rename`). The `mockIPC` pattern intercepts these at the IPC boundary without needing Rust.

| Module | Tauri APIs to Mock | Test Focus |
|--------|-------------------|------------|
| `src/services/agent-parser.ts` | `readTextFile` | Valid frontmatter, missing frontmatter, malformed YAML, content injection |
| `src/services/skill-parser.ts` | `readTextFile` | Same as agent-parser |
| `src/services/settings-parser.ts` | `readTextFile` | Valid JSON, JSONC (comments), malformed JSON → ParseError |
| `src/services/file-scanner.ts` | `readDir`, `exists` | Finds agents/skills/rules, handles missing dirs gracefully |
| `src/services/file-writer.ts` | `writeTextFile`, `rename`, `remove` | Atomic write success, rename failure cleanup |

Implementation pattern for Tier 2:
```typescript
import { mockIPC } from '@tauri-apps/api/mocks';

test('parseAgentFile handles missing frontmatter', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'plugin:fs|read_text_file') {
      return Promise.resolve('# Agent without frontmatter\nSome body.');
    }
  });
  const node = await parseAgentFile('/project/.claude/agents/helper.md');
  expect(node.name).toBe('Helper');
  expect(node.validationErrors).toHaveLength(0);
});
```

### Tier 3: React component tests — requires RTL + store

Setup wizard steps are the primary target. These require `@testing-library/react` and Zustand store resets between tests.

| Component | Test Focus |
|-----------|------------|
| `SetupWizard.tsx` Step 1 | Renders, API key save, skip, validation |
| `SetupWizard.tsx` Step 2 | Reads teams status, enable button, error state |
| `SetupWizard.tsx` Step 3 | Summary rendering, "Get Started" dismisses wizard |

Zustand store reset pattern for Vitest (official Zustand recommendation):
```typescript
import { act } from '@testing-library/react';
import { useTreeStore } from '@/store/tree-store';

afterEach(() => {
  act(() => useTreeStore.setState(useTreeStore.getInitialState()));
});
```

---

## Suggested Build Order

Dependencies determine order. Each step unblocks the next.

### Step 1: Infrastructure foundation (no production changes)

Install dev dependencies and create config files. Nothing in production code changes.

- Install: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`
- Create `vitest.config.ts` (or extend `vite.config.ts` with `test:` block)
- Create `src/test/setup.ts` with crypto polyfill, `mockWindows`, `mockIPC`, `clearMocks`
- Create `src/test/tauri-helpers.ts` with `mockReadTextFile`, `mockExists`, `mockReadDir`
- Verify: `pnpm vitest run` produces no errors on empty suite

**Why first:** Everything else depends on the test runner existing.

### Step 2: Typed errors (`src/types/errors.ts`)

Pure TypeScript, no imports, no tests yet needed to write it. Once defined, services can start throwing them.

- Define `AtmError`, `ParseError`, `WriteError`, `ValidationError`, `ScanError`
- Write unit tests: `src/types/__tests__/errors.test.ts` — verify `instanceof` and `.kind` behaviour

**Why second:** Services (Step 3) will throw these. Tests (Step 4) will assert on them.

### Step 3: Logger service (`src/services/logger.ts`)

Pure module, testable immediately as Tier 1.

- Implement singleton logger with `info/warn/error/debug` methods
- Write unit tests: spy on `console.*`, assert format/level filtering
- Replace 56 `console.*` calls across the codebase with `logger.*` calls (mechanical find-and-replace)

**Why third:** Replacing console calls is mechanical and should happen before adding new error handling code that would generate more console calls.

### Step 4: Service error types + tests (Tier 2)

For each priority service: add typed throws, write tests.

Order within this step:
1. `src/utils/paths.ts` — Tier 1, no mocking. Quick wins, builds confidence in setup.
2. `src/utils/validation.ts` — Tier 1, Zod schemas.
3. `src/services/agent-parser.ts` + `skill-parser.ts` — Tier 2. Update throws to `ParseError`.
4. `src/services/settings-parser.ts` — Tier 2. Add JSONC support here (strip comments before `JSON.parse`).
5. `src/services/file-scanner.ts` — Tier 2. Already has `safeExists` pattern; add `ScanError` for unexpected failures.
6. `src/services/file-writer.ts` — Tier 2. Update throws to `WriteError`.

**Why fourth:** Tests validate the typed errors from Step 2 and surface any issues before the component tests in Step 5.

### Step 5: Setup wizard tests (Tier 3)

By this point the test infrastructure is solid and services are typed. Component tests can mock both Tauri FS and the store.

- Fix z-index bug first (unblocks visibility of toast errors during test)
- Fix `JSON.parse` → JSONC for Claude settings reading (feeds `settings-parser.ts` fix)
- Write wizard step tests with RTL

**Why fifth:** Component tests are the highest complexity tier and depend on all earlier work. The z-index fix is a prerequisite for the toast-error assertion path in tests.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Wrapping Everything in Try/Catch in Services

**What:** Adding `try/catch` inside every service function and converting errors to `null | undefined` returns.

**Why bad:** Callers cannot distinguish "file not found" from "JSON parse error" from "Tauri IPC failed". Typed throws are more explicit. The existing `safeExists` function in `file-scanner.ts` is the correct pattern for the specific case where absence is expected; everywhere else, throw.

**Instead:** Throw typed errors. Let the store (the caller) decide whether to toast, log, degrade gracefully, or propagate.

### Anti-Pattern 2: Logger with Side Effects on Import

**What:** A logger that reads config files, sets up Tauri event listeners, or calls `invoke()` on module load.

**Why bad:** Breaks the Tier 1 testability guarantee. Any test that imports a module importing the logger would require Tauri mocking.

**Instead:** Logger is a pure singleton initialized with defaults. Configuration injection happens lazily if needed.

### Anti-Pattern 3: Testing Through the Store for Service Logic

**What:** Writing tests that instantiate the Zustand store and drive service calls through store actions in order to test parser behaviour.

**Why bad:** Makes tests slow, tightly coupled, and fragile. Store initialization triggers file loading.

**Instead:** Test services directly by calling `parseAgentFile(path)` with a mocked `readTextFile` IPC response. The store is the integration layer; services are the unit-testable layer.

### Anti-Pattern 4: Separate vitest.config.ts Instead of Extending vite.config.ts

**What:** Creating a standalone `vitest.config.ts` that duplicates all Vite resolve aliases.

**Why bad:** The `fs` stub alias (`fs → src/utils/fs-stub.ts`) must be present for `gray-matter` to work in jsdom. A separate config that misses this alias causes test failures that look like import errors.

**Instead:** Add a `test:` block directly to the existing `vite.config.ts`. Vitest reads from it automatically. The resolve aliases (including the `fs` stub) are inherited.

### Anti-Pattern 5: Error Boundary as Primary Error Handler

**What:** Wrapping the whole app in a React Error Boundary and treating it as the logging/error system.

**Why bad:** Error boundaries only catch render-phase errors. Service layer async errors (file I/O, IPC failures) do not propagate to Error Boundaries. This milestone's errors are almost all async.

**Instead:** Service errors are caught at the store level and surfaced through `ui-store.addToast()`. Error Boundaries remain appropriate for unexpected render crashes but are not part of this milestone's scope.

---

## Scalability Considerations

| Concern | Now (milestone scope) | Future |
|---------|----------------------|--------|
| Log volume | Dev console only, fine | Add file sink via Tauri FS when needed |
| Error granularity | 5 error kinds covers all services | Extend as new services added |
| Test coverage | Services + wizard = high-value surface | Add E2E with WebdriverIO/Playwright when tree-store is refactored |
| Rust backend errors | Out of scope | Tauri `Error` type propagation through `Result<T, String>` is already in place |

---

## Sources

- [Mock Tauri APIs — Tauri v2 Official Docs](https://v2.tauri.app/develop/tests/mocking/) — HIGH confidence, official
- [Vitest Configuration — Official Docs](https://vitest.dev/config/) — HIGH confidence, official
- [Zustand Testing Guide — Official Docs](https://zustand.docs.pmnd.rs/guides/testing) — HIGH confidence, official
- [Tauri v2 Mocks API Reference](https://v2.tauri.app/reference/javascript/api/namespacemocks/) — HIGH confidence, official
- [How to write Unit Tests for Tauri Frontend with Vitest — Yonatan Kra](https://yonatankra.com/how-to-setup-vitest-in-a-tauri-project/) — MEDIUM confidence, community verified
- Current codebase analysis: `src/services/`, `src/components/setup/`, `vite.config.ts`, `package.json` — HIGH confidence, direct inspection
