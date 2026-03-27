# Phase 1: Infrastructure - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix critical bugs blocking app launch (toast z-index, JSONC parsing, settings path, wizard completion) and establish shared infrastructure (structured logger, typed errors, Vitest test framework) that all subsequent phases depend on.

</domain>

<decisions>
## Implementation Decisions

### Toast Fix
- **D-01:** Claude's discretion on technical approach (createPortal vs z-index bump) — whichever is most robust against future CSS stacking context issues
- **D-02:** Keep current toast styling — bottom-right position, 3-second duration, existing animation. Only fix visibility.

### Logging
- **D-03:** Claude's discretion on log level granularity (4 or 5 levels)
- **D-04:** Structured log format: `[ATM] [level] [context] message` — easy to filter and parse
- **D-05:** Logger facade pattern: detect `window.__TAURI_INTERNALS__`, use @tauri-apps/plugin-log when in Tauri, fallback to console in browser-only mode (pnpm dev)

### Error UX
- **D-06:** Errors shown to users via toast notifications only — no inline error UI changes in this phase
- **D-07:** User-friendly error messages in toasts (e.g., "Could not save settings. Please try again.") — technical details go to structured logs only

### Settings Fallback
- **D-08:** Settings reading strategy: check project-level `.claude/settings.json` first, then fallback to global `~/.claude/settings.json`, merge results
- **D-09:** Use JSONC parser (jsonc-parser from Microsoft) for all Claude settings reads — handle comments gracefully across all 3 callsites (wizard step 2, handleEnableTeams, settings-parser.ts)

### Claude's Discretion
- Toast fix technical approach (D-01)
- Log level granularity (D-03)
- Vitest configuration details (jsdom vs happy-dom, test file patterns)
- Typed error class hierarchy design (which error classes, what `kind` discriminants)
- @tauri-apps/plugin-log Rust-side setup if needed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug Analysis
- `src/components/common/Toast.tsx` — Current toast implementation (z-index: 10000)
- `src/components/setup/SetupWizard.tsx` — Wizard overlay (z-index: 20000, backdrop-filter: blur), settings reading logic, handleGetStarted
- `src/services/settings-parser.ts` — Third callsite for Claude settings JSON.parse

### Infrastructure Targets
- `src/store/tree-store.ts` — Contains scattered console.log/warn/error calls to replace
- `src/services/agent-parser.ts` — Service needing typed error contracts
- `src/services/skill-parser.ts` — Service needing typed error contracts
- `src/services/file-writer.ts` — Service needing typed error contracts
- `src/services/file-scanner.ts` — Service needing typed error contracts

### Configuration
- `vite.config.ts` — Vitest config must extend this file (not separate vitest.config.ts)
- `src-tauri/capabilities/default.json` — FS permissions scope (verify ~/.claude/ access)
- `src/utils/fs-stub.ts` — fs module stub for gray-matter browser-side usage (must be inherited by test config)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Toast.tsx` module-level store with `useSyncExternalStore` — functional pattern, just needs portal fix
- `join()` / `normalizePath()` from `utils/paths.ts` — pure functions, ideal first test targets
- `safeExists()` in `file-scanner.ts` — existing error-swallowing pattern to replace with typed errors

### Established Patterns
- Zustand stores (`tree-store.ts`, `ui-store.ts`) are the state management pattern
- Services use async functions with try/catch and `console.warn` for error reporting
- Tauri FS plugin used via `@tauri-apps/plugin-fs` imports (readTextFile, writeTextFile, exists, mkdir)
- gray-matter runs browser-side with fs module stubbed via Vite alias

### Integration Points
- Logger service will be imported by all services and components replacing console calls
- Typed error classes will be thrown by services and caught by store/component code
- Vitest setup must inherit Vite config aliases (`@/` → `src/`, `fs` → `fs-stub.ts`)

</code_context>

<specifics>
## Specific Ideas

- The JSONC fix must cover ALL 3 callsites — wizard step 2 (line 49-53), handleEnableTeams (line 122-130), and settings-parser.ts — not just one
- The wizard write-back (handleEnableTeams) must NOT strip JSONC comments when re-writing the file — use jsonc-parser's edit API or read-modify-write approach
- Toast error message for wizard "Get Started" failure should say something like "Could not complete setup — check that your home directory is writable"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure*
*Context gathered: 2026-03-27*
