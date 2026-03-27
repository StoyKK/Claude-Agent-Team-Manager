# Retrospective

## Milestone: v1.0 — ATM Stability

**Shipped:** 2026-03-27
**Phases:** 3 | **Plans:** 9

### What Was Built
- Setup wizard bug fixes (toast portal, JSONC parsing, global settings fallback)
- Typed error class hierarchy (AtmError → ParseError, WriteError, ValidationError, ScanError)
- Structured logger facade with Tauri plugin routing
- Vitest 3 test framework with 55 tests across 3 tiers
- React Error Boundaries with dark-themed fallback UI
- Unhandled promise rejection handler

### What Worked
- **Wave-based parallel execution** — independent plans executed in parallel worktrees, cutting wall-clock time
- **Phase dependency ordering** — infrastructure first, then tests that exercise it, then component tests that build on both
- **Coarse-grained error boundaries** — 3 boundaries cover all critical paths without per-component overhead
- **mergeConfig for Vitest** — inheriting Vite aliases and stubs eliminated test config duplication
- **Single-session delivery** — entire milestone from planning through verification in ~4 hours

### What Was Inefficient
- **Worktree cleanup** — parallel agent worktrees left behind duplicate test files that Vitest discovers; should add `include` pattern to test config
- **SUMMARY.md one-liner extraction** — some plans had malformed one-liners ("One-liner:" with no content), degrading milestone accomplishment extraction
- **TypeScript type errors in worktrees** — agents didn't catch `pnpm build` failures (FallbackProps.error typed as `unknown` in react-error-boundary v6), requiring post-verification fixes

### Patterns Established
- `vi.mock("@tauri-apps/plugin-fs")` factory pattern for Tauri API mocking
- `window.__TAURI_INTERNALS__ = undefined` in vitest.setup.ts for logger isolation
- Single-call rejection pattern for gray-matter cache-aware error testing
- Separate try-catch per failure mode in parsers (readTextFile vs matter())
- `@throws {ErrorType}` JSDoc convention on all service functions

### Key Lessons
- **Always verify `pnpm build` after component creation** — runtime tests pass but TypeScript strict mode catches type mismatches that agents miss
- **react-error-boundary v6 changed FallbackProps.error to `unknown`** — downstream code must guard with `instanceof Error`
- **Track tsconfig.node.json in git** — worktree merges fail when it's untracked

### Cost Observations
- Model mix: 100% sonnet for executors/verifiers, opus for orchestration
- Sessions: 1 (single conversation)
- Notable: parallel worktree execution significantly reduced wall-clock time for independent plans

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 9 |
| Tests added | 55 |
| Commits | 59 |
| Duration | ~4h |

---
