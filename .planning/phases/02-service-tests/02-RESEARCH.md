# Phase 2: Service Tests - Research

**Researched:** 2026-03-27
**Domain:** Vitest 3, TypeScript unit testing, Tauri plugin mocking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All implementation decisions deferred to Claude — user confirmed they trust Claude's judgment on all testing choices
- **D-02:** Test file placement: co-located with source (`paths.test.ts` next to `paths.ts`) — standard Vitest convention, no separate `__tests__/` directory
- **D-03:** Vitest 3 (not 4) for Node 18+ compatibility — decided in Phase 1 STATE.md
- **D-04:** jsdom environment (not happy-dom) — decided in Phase 1 STATE.md for File/Blob/URL and `window.__TAURI_INTERNALS__` support
- **D-05:** `mergeConfig` in `vite.config.ts` to inherit `@/` alias and `fs` stub — decided in Phase 1 STATE.md
- **D-06:** `@testing-library/react` v16 for React 19 peer support — decided in Phase 1 STATE.md
- **D-07:** Mock Tauri APIs via `vi.mock("@tauri-apps/plugin-fs")` factory pattern — return async stubs for readTextFile, writeTextFile, exists, mkdir
- **D-08:** Zustand store reset pattern: `store.setState(initialState, true)` in `beforeEach` — decided in Phase 1 STATE.md
- **D-09:** Test coverage depth: happy path + key error cases (malformed YAML, missing frontmatter, invalid schema) — not exhaustive edge cases
- **D-10:** Tier 1 tests (pure functions) need no mocking. Tier 2 tests (services) mock only Tauri FS APIs
- **D-11:** Test script in package.json: `"test": "vitest run"` for CI, `"test:watch": "vitest"` for dev

### Claude's Discretion
All implementation decisions (D-01 above) — Claude chooses all test structure details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Vitest configured within vite.config.ts (not separate file) with correct path aliases, fs stub, jsdom environment, and Tauri mock setup file | `mergeConfig` pattern in vite.config.ts; jsdom via `npm i -D vitest jsdom`; setup file stubs `window.__TAURI_INTERNALS__` |
| TEST-02 | Tier 1 unit tests for pure utility functions: paths.ts (join, normalize, generateNodeId) and validation.ts (Zod schemas) | Pure functions, no mocking; djb2 hash verified with known input/output; Zod `.safeParse()` tested with valid + invalid inputs |
| TEST-03 | Tier 2 integration tests for services: file-scanner, agent-parser, skill-parser using vi.mock factory for @tauri-apps/plugin-fs | `vi.mock("@tauri-apps/plugin-fs")` factory stubs `readTextFile`, `readDir`, `exists`; parsers accept content strings directly (no Tauri call needed for happy path) |
</phase_requirements>

---

## Summary

Phase 2 installs Vitest 3 and writes two tiers of tests. Tier 1 covers pure utility functions (`paths.ts`, `validation.ts`) that need zero mocking. Tier 2 covers service parsers (`agent-parser.ts`, `skill-parser.ts`) and `file-scanner.ts`, which call `@tauri-apps/plugin-fs`. The parsers already accept an optional `content` string — when provided, they skip the Tauri `readTextFile` call entirely. This means Tier 2 parser tests can pass real markdown strings and need no mocking at all for their happy paths. Only `file-scanner.ts` (which calls `readDir` and `exists`) requires `vi.mock`.

The key infrastructure work is: (1) add `test:` block to `vite.config.ts` using `mergeConfig`, (2) create a setup file that stubs `window.__TAURI_INTERNALS__`, (3) add `vitest` + `jsdom` devDependencies, and (4) add `test` / `test:watch` scripts to `package.json`.

**Primary recommendation:** Configure Vitest 3 inline in `vite.config.ts` via `mergeConfig`. Use `vi.mock("@tauri-apps/plugin-fs")` at the module level for `file-scanner` tests. Pass markdown content strings directly to `parseAgentFile` and `parseSkillFile` — avoids Tauri calls without any mocking.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 (latest 3.x) | Test runner, assertion, mocking | Locked in STATE.md; compatible with Node 18+; native Vite integration |
| jsdom | 25.x (auto-installed with vitest) | DOM environment for tests | Locked in STATE.md; supports `window.__TAURI_INTERNALS__` stub |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 (latest) | Component testing utilities | Phase 3 (component tests) — installed in Phase 2 alongside vitest to front-load setup, but only used in Phase 3 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest 3 | Vitest 4.1.2 | Vitest 4 requires Node 20+; project targets Node 18+ — locked decision |
| jsdom | happy-dom | jsdom is safer for `File`, `Blob`, `URL` and `window.__TAURI_INTERNALS__` stub — locked decision |
| `vi.mock` factory | `@tauri-apps/api/mocks` `mockIPC` | `vi.mock` is more direct for plugin-fs; mockIPC intercepts raw IPC — unnecessary layer for plugin calls |

**Installation:**
```bash
pnpm add -D vitest@">=3 <4" jsdom @testing-library/react @testing-library/user-event @types/jsdom
```

**Version verification (confirmed 2026-03-27):**
- `vitest@3`: latest 3.x is 3.2.4 (published via `npm view vitest@3 version`)
- `@testing-library/react`: 16.3.2
- `jsdom`: 29.0.1 (peer dependency, auto-installed by vitest)

---

## Architecture Patterns

### Test File Placement
```
src/
├── utils/
│   ├── paths.ts
│   ├── paths.test.ts          # Tier 1 — pure functions
│   ├── validation.ts
│   └── validation.test.ts     # Tier 1 — Zod schemas
├── services/
│   ├── agent-parser.ts
│   ├── agent-parser.test.ts   # Tier 2 — gray-matter + Zod
│   ├── skill-parser.ts
│   ├── skill-parser.test.ts   # Tier 2 — gray-matter + Zod
│   ├── file-scanner.ts
│   └── file-scanner.test.ts   # Tier 2 — needs vi.mock(plugin-fs)
└── vitest.setup.ts             # Tauri __TAURI_INTERNALS__ stub
```

### Pattern 1: Vitest inline config via mergeConfig

The `vite.config.ts` uses `defineConfig(async () => ({...}))` (async factory). Vitest's `mergeConfig` merges the test block without breaking the async factory pattern.

```typescript
// vite.config.ts
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () =>
  mergeConfig(
    {
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          fs: path.resolve(__dirname, "./src/utils/fs-stub.ts"),
        },
      },
      clearScreen: false,
      server: {
        port: 5173,
        strictPort: true,
        host: host || false,
        hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
        watch: { ignored: ["**/src-tauri/**"] },
      },
    },
    {
      test: {
        environment: "jsdom",
        setupFiles: ["./src/vitest.setup.ts"],
        globals: true,
      },
    }
  )
);
```

Note: `globals: true` enables `describe`, `it`, `expect`, `vi` without explicit imports — standard Vitest convention.

### Pattern 2: Tauri setup stub

Create `src/vitest.setup.ts` to define `window.__TAURI_INTERNALS__` before any test imports run. This prevents `logger.ts` from attempting a dynamic import of `@tauri-apps/plugin-log`.

```typescript
// src/vitest.setup.ts
// Prevent logger from routing to Tauri plugin in test environment
Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: undefined,
  writable: true,
});
```

### Pattern 3: vi.mock factory for @tauri-apps/plugin-fs

Place `vi.mock(...)` at the **top level** of the test file (before imports is fine in Vitest — it hoists the call). Use factory pattern to return async stubs.

```typescript
// file-scanner.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { scanProject } from "./file-scanner";

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}));

// In each test — configure per-test behavior:
import { exists, readDir } from "@tauri-apps/plugin-fs";

describe("scanProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when .claude dir does not exist", async () => {
    vi.mocked(exists).mockResolvedValue(false);
    const result = await scanProject("/fake/root");
    expect(result).toEqual([]);
  });
});
```

### Pattern 4: Parser tests — pass content directly (no mock needed)

Both `parseAgentFile` and `parseSkillFile` accept an optional `content?: string` parameter. When content is provided, they skip `readTextFile`. This makes parser happy-path tests trivially simple:

```typescript
// agent-parser.test.ts
import { parseAgentFile } from "./agent-parser";

const VALID_MARKDOWN = `---
name: My Agent
description: Does things
model: claude-opus-4-5
permissionMode: default
---
# Agent Body
`;

it("parses valid agent markdown", async () => {
  const node = await parseAgentFile("/fake/path/my-agent.md", VALID_MARKDOWN);
  expect(node.kind).toBe("agent");
  expect(node.name).toBe("My Agent");
  expect(node.config.description).toBe("Does things");
  expect(node.validationErrors).toHaveLength(0);
});
```

For parse error cases, the parsers currently do NOT throw — they return a node with non-empty `validationErrors`. The success criteria for TEST-03 says "a test asserting on a parse failure receives a typed error." This requires adding throw-on-parse-failure behavior OR interpreting "parse failure" as malformed YAML (which gray-matter can throw on). Verify the current error path before writing tests.

### Pattern 5: Typed error assertions

The errors.ts module from Phase 1 provides `ParseError`, `ScanError` etc. as named subclasses with `kind` discriminant.

```typescript
import { ParseError } from "@/types/errors";

it("throws ParseError on malformed YAML", async () => {
  const BAD_YAML = `---
name: [unclosed
---
`;
  await expect(parseAgentFile("/path/bad.md", BAD_YAML)).rejects.toBeInstanceOf(ParseError);
  await expect(parseAgentFile("/path/bad.md", BAD_YAML)).rejects.toMatchObject({ kind: "parse" });
});
```

### Pattern 6: djb2 hash verification (Tier 1)

`generateNodeId` uses djb2 — test with known inputs to verify determinism:

```typescript
it("generates deterministic ID for known path", () => {
  // Pre-computed: run once manually, lock the value
  const id = generateNodeId("/project/.claude/agents/my-agent.md");
  expect(id).toBe(generateNodeId("/project/.claude/agents/my-agent.md"));
  // Also verify backslash normalization produces same result
  expect(generateNodeId("C:\\project\\agent.md")).toBe(
    generateNodeId("C:/project/agent.md")
  );
});
```

### Anti-Patterns to Avoid

- **Separate vitest.config.ts file:** The locked decision (D-05) requires inline config in `vite.config.ts` via `mergeConfig`. A separate `vitest.config.ts` would duplicate alias config and risk drift.
- **Testing with real file paths:** Do not call `parseAgentFile("/real/path.md")` without a `content` argument in tests — this will try to invoke Tauri IPC and fail in jsdom.
- **Missing `vi.clearAllMocks()` in `beforeEach`:** vi.fn() retains call history between tests; failing to clear causes flaky behavior when checking call counts.
- **Importing logger in tests without setup file:** The `logger.ts` checks `window.__TAURI_INTERNALS__` at call time. Without the setup file defining it as `undefined`, the check is still safe — but the setup file prevents accidents if the environment somehow exposes the key.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM environment for tests | Custom jsdom wiring | `environment: "jsdom"` in Vitest config | Vitest manages jsdom lifecycle per test file automatically |
| Module mocking | Manual monkey-patching | `vi.mock()` hoisted factory | Hoisting ensures mock is in place before module-under-test imports the dependency |
| Async mock return values | Promise wrappers | `vi.fn().mockResolvedValue(x)` | Vitest helper handles `.then()` chain, rejection, etc. |
| TypeScript mock typing | Manual casts | `vi.mocked(fn)` | Narrows type to `MockedFunction<typeof fn>` without unsafe casts |

**Key insight:** The parser's optional `content` parameter is the most valuable test seam in this codebase — use it aggressively to avoid needing Tauri mocks for parser tests.

---

## Common Pitfalls

### Pitfall 1: vite.config.ts async factory breaks mergeConfig
**What goes wrong:** Wrapping `mergeConfig` incorrectly inside the async callback breaks Vite's config resolution.
**Why it happens:** `defineConfig` accepts either an object or an async function. `mergeConfig` returns an object — it must be the return value of the async function.
**How to avoid:** Return `mergeConfig(baseConfig, testConfig)` directly from the async factory. See Pattern 1 example above.
**Warning signs:** `pnpm build` fails with "vite config must export an object" or similar.

### Pitfall 2: Alias inheritance failure
**What goes wrong:** Tests get `Cannot find module '@/types/aui-node'` errors.
**Why it happens:** Without `mergeConfig`, Vitest uses its own separate config and does not inherit `resolve.alias` from Vite.
**How to avoid:** Always configure Vitest in the same `vite.config.ts` using `mergeConfig` (D-05).
**Warning signs:** Any `@/` import fails at test runtime but succeeds in `pnpm build`.

### Pitfall 3: gray-matter imports Node fs at top level
**What goes wrong:** Tests crash with `fs.readFileSync is not a function` before any test code runs.
**Why it happens:** gray-matter does `require('fs')` at module import time. Without the `fs` alias from `vite.config.ts`, Node's actual `fs` is used — which works in Node but hits the stub in the browser. In test env, if the alias isn't inherited, gray-matter may try real Node fs.
**How to avoid:** The `fs` alias stub must be inherited via `mergeConfig`. Verify by running a parser test and checking it doesn't throw on import.
**Warning signs:** Test file fails to import `agent-parser.ts` entirely.

### Pitfall 4: ParseError never thrown by current parsers
**What goes wrong:** TEST-03 success criterion says "a test asserting on a parse failure receives a typed error" — but current `agent-parser.ts` and `skill-parser.ts` do NOT throw `ParseError`. They catch Zod validation errors and store them in `validationErrors` array on the returned node.
**Why it happens:** The parsers currently have a "partial failure" design — they return a node with errors rather than throwing. The `@throws {ParseError}` JSDoc is documented but gray-matter itself rarely throws on malformed YAML (it often just produces empty data).
**How to avoid:** The plan must include a task to ADD throw-on-parse-failure behavior to at least one code path (e.g., if `readTextFile` fails, throw `ParseError`). The simplest path: when `content` is not provided and `readTextFile` rejects, wrap the rejection in `ParseError`. This satisfies the typed error requirement without restructuring the Zod validation path.
**Warning signs:** Writing a test that expects `rejects.toBeInstanceOf(ParseError)` and finding it passes with a plain `Error`.

### Pitfall 5: Zod v4 import path
**What goes wrong:** Tests fail importing Zod with `import { z } from "zod"` if the project uses `zod/v4` subpath.
**Why it happens:** The project uses `zod@4.3.6` and imports from `"zod/v4"` (confirmed in `agent.ts` and `skill.ts`). Test files that import from `@/types/agent` or `@/types/skill` inherit the correct import, but direct Zod imports in test utilities must also use `"zod/v4"`.
**How to avoid:** In test files that directly use Zod, always `import { z } from "zod/v4"` to match the project convention.
**Warning signs:** `Module '"zod"' has no exported member 'ZodError'` or similar type mismatch.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Vitest mergeConfig inline setup
```typescript
// vite.config.ts — adds test: block without breaking existing config
import { defineConfig, mergeConfig } from "vite";
// ...existing imports...

export default defineConfig(async () =>
  mergeConfig(
    {
      // ...existing config (plugins, resolve, server)...
    },
    {
      test: {
        environment: "jsdom",
        setupFiles: ["./src/vitest.setup.ts"],
        globals: true,
      },
    }
  )
);
```

### Tauri internals stub (setup file)
```typescript
// src/vitest.setup.ts
Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: undefined,
  writable: true,
});
```

### vi.mock factory for @tauri-apps/plugin-fs
```typescript
// Source: Vitest docs + Tauri plugin-fs API surface
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));
```

### package.json scripts
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate vitest.config.ts | Inline `test:` block in vite.config.ts via `mergeConfig` | Vitest 1.0+ | Single config file; aliases always inherited |
| `@tauri-apps/api/mocks` mockIPC for plugin calls | `vi.mock("@tauri-apps/plugin-fs")` factory | Tauri v2 | Plugin APIs are module-level imports; vi.mock is more direct |
| `globals: false` (explicit imports) | `globals: true` | Vitest default | Saves boilerplate in test files; standard convention |

**Deprecated/outdated:**
- Separate `vitest.config.ts`: Works but duplicates alias config — use inline config for this project.
- `@testing-library/react` v14 or v15: Does not support React 19 peer — must use v16+.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is code/config-only. The only "external" dependency is Node.js 18+ and pnpm, already confirmed in CLAUDE.md prerequisites. No database, no CLI tool, no external service required for running Vitest.

---

## Open Questions

1. **Does `parseAgentFile` / `parseSkillFile` throw ParseError when readTextFile fails?**
   - What we know: Both parsers have `@throws {ParseError}` in JSDoc and import `ParseError`. The content-override path skips Tauri. The fall-through to `readTextFile` path is `await readTextFile(filePath)` with no try-catch.
   - What's unclear: If `readTextFile` rejects (e.g., file not found), the rejection propagates as a plain promise rejection — NOT wrapped in `ParseError`. The JSDoc is aspirational, not implemented.
   - Recommendation: The plan must include a task to wrap the `readTextFile` call in a try-catch that throws `new ParseError(...)`. This is a small code change in both `agent-parser.ts` and `skill-parser.ts` and is required to satisfy TEST-03's typed error assertion criterion.

2. **Does `scanProject` propagate a ScanError?**
   - What we know: `scanProject` has `@throws {ScanError}` in JSDoc and imports `ScanError`. The `readDir` call is not wrapped in try-catch.
   - What's unclear: Same situation — plain promise rejection, not a `ScanError` wrapper.
   - Recommendation: Add a wrapping try-catch to `scanProject` for the `readDir` calls. Small change, same pattern as the parsers.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/utils/paths.ts`, `src/utils/validation.ts`, `src/services/agent-parser.ts`, `src/services/skill-parser.ts`, `src/services/file-scanner.ts`, `src/types/errors.ts`, `src/services/logger.ts`, `vite.config.ts`, `package.json` — exact signatures and behavior verified
- npm registry: `vitest@3.2.4` (latest 3.x confirmed 2026-03-27), `@testing-library/react@16.3.2` (confirmed 2026-03-27)
- [Tauri v2 Mocking Guide](https://v2.tauri.app/develop/tests/mocking/) — mockIPC usage verified
- [Tauri v2 Mocks API Reference](https://v2.tauri.app/reference/javascript/api/namespacemocks/) — clearMocks, mockWindows signatures

### Secondary (MEDIUM confidence)
- `.planning/phases/02-service-tests/02-CONTEXT.md` — locked decisions D-01 through D-11
- `.planning/STATE.md` — Vitest 3, jsdom, mergeConfig, RTL v16 decisions from Phase 1

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry 2026-03-27
- Architecture: HIGH — based on direct codebase inspection; patterns derived from actual source files
- Pitfalls: HIGH — Pitfalls 1–3 are known Vitest/Vite integration issues; Pitfall 4 is newly discovered from code inspection (critical finding)

**Research date:** 2026-03-27
**Valid until:** 2026-06-27 (Vitest 3.x stable; lock to `>=3 <4` to avoid auto-upgrade to v4)
