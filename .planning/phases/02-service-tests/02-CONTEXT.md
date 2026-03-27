# Phase 2: Service Tests - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure Vitest test framework and write automated tests for utility functions (paths.ts, validation.ts) and service-layer parsers (agent-parser, skill-parser, file-scanner) using the typed errors and logger from Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Test Targets (Tier 1 — Pure Functions)
- `src/utils/paths.ts` — join, normalizePath, getFileName, generateNodeId (djb2 hash)
- `src/utils/validation.ts` — Zod schemas for AgentConfig, SkillConfig, VariableKind

### Test Targets (Tier 2 — Service Parsers)
- `src/services/agent-parser.ts` — parseAgentFile: markdown → AuiNode with gray-matter + validation
- `src/services/skill-parser.ts` — parseSkillFile: markdown → AuiNode
- `src/services/file-scanner.ts` — scanProject: discovers .claude/ directory files

### Infrastructure from Phase 1
- `src/types/errors.ts` — AtmError, ParseError, WriteError, ValidationError, ScanError (test error assertions use these)
- `src/services/logger.ts` — Logger facade with lazy Tauri detection (must not break in test env)
- `src/utils/fs-stub.ts` — Browser-safe fs module stub (must be inherited by Vitest config)

### Build Config
- `vite.config.ts` — Must extend with `test:` block using `mergeConfig`
- `package.json` — Add vitest devDependency and test scripts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `errors.ts` typed error classes — tests can assert `instanceof ParseError` and `.kind === "parse"`
- `logger.ts` lazy detection — tests run without Tauri IPC because `isTauri()` returns false in jsdom
- `fs-stub.ts` — already stubs `fs` module for gray-matter; Vitest must inherit this alias

### Established Patterns
- gray-matter used browser-side (string-only, no file path reads) — parsers receive content strings
- Zod schemas validate configs — `.safeParse()` returns `{ success, data?, error? }`
- Services are async functions accepting string paths/content — clean test boundaries

### Integration Points
- `vite.config.ts` gets a `test:` block — must not break existing `pnpm dev` or `pnpm build`
- `package.json` gets vitest + @testing-library/react devDependencies and test scripts

</code_context>

<specifics>
## Specific Ideas

- Parser tests should pass real markdown strings (with valid/invalid frontmatter) directly to parse functions — no need to mock the filesystem for parsing, only for `file-scanner.ts` which calls Tauri FS
- The `generateNodeId` function in `paths.ts` uses djb2 hash — test with known input/output pairs for deterministic behavior
- Zod schema tests should verify both valid configs and specific validation error messages

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-service-tests*
*Context gathered: 2026-03-27*
