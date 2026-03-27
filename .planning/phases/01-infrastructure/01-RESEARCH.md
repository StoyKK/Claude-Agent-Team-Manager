# Phase 1: Infrastructure - Research

**Researched:** 2026-03-27
**Domain:** Tauri v2 + React 19 — bug fixes, JSONC parsing, structured logging, typed errors
**Confidence:** HIGH

## Summary

Phase 1 fixes four critical bugs that block the setup wizard from working on macOS, then lays shared infrastructure (structured logger, typed errors) that subsequent phases depend on. All bugs are already located in known files and have clear root causes. The JSONC fix must touch exactly three callsites; the toast fix requires `createPortal` not a z-index bump because the wizard overlay applies `backdrop-filter` which creates a CSS stacking context that clips any child's z-index. The `@tauri-apps/plugin-log` Rust plugin is already registered in `lib.rs` and the `tauri-plugin-log = "2"` Cargo dependency is already present — only the frontend facade and the capability permission entry are missing.

The phase does NOT include Vitest setup (that is Phase 2, per REQUIREMENTS.md traceability). Phase 1 covers BUG-01 through BUG-04, LOG-01, LOG-02, ERR-01, and ERR-02 only.

**Primary recommendation:** Fix BUG-01 first (toast portal) so all subsequent error messages during wizard debugging are visible. Then BUG-02/BUG-03 (JSONC + global path fallback). Then LOG-01 (logger facade) and ERR-01 (typed error classes) as shared utilities. Finally LOG-02 (replace 55 console calls) last because it touches many files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Claude's discretion on toast fix technical approach (createPortal vs z-index bump)
- **D-02:** Keep current toast styling — bottom-right, 3-second duration, existing animation. Only fix visibility.
- **D-03:** Claude's discretion on log level granularity (4 or 5 levels)
- **D-04:** Structured log format: `[ATM] [level] [context] message`
- **D-05:** Logger facade pattern: detect `window.__TAURI_INTERNALS__` at call time, use @tauri-apps/plugin-log when in Tauri, fallback to console in browser-only mode
- **D-06:** Errors shown to users via toast notifications only — no inline error UI changes in this phase
- **D-07:** User-friendly error messages in toasts — technical details go to structured logs only
- **D-08:** Settings reading strategy: check project-level `.claude/settings.json` first, then fallback to `~/.claude/settings.json`, merge results
- **D-09:** Use `jsonc-parser` (Microsoft) for all Claude settings reads — handle comments across all 3 callsites (wizard step 2, handleEnableTeams, settings-parser)

### Claude's Discretion
- Toast fix technical approach (D-01) — createPortal is the correct choice (see Architecture Patterns)
- Log level granularity (D-03) — 5 levels recommended: trace/debug/info/warn/error
- Vitest configuration details — deferred to Phase 2
- Typed error class hierarchy design (which error classes, what `kind` discriminants)
- @tauri-apps/plugin-log Rust-side setup — already done (see Standard Stack)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-01 | Toast renders above all overlays including setup wizard | createPortal to document.body; z-index 99999 above wizard's 20000 |
| BUG-02 | Claude settings files parsed with JSONC support across all 3 callsites | jsonc-parser v3.3.1 `parse()` + `modify()` + `applyEdits()` APIs documented |
| BUG-03 | Setup wizard reads global ~/.claude/settings.json when project-level file lacks expected keys | fs:scope-home-recursive already granted; fallback logic pattern documented |
| BUG-04 | Setup wizard "Get Started" button completes setup or shows readable error | handleGetStarted already has try/catch; toast portal fix (BUG-01) makes it visible |
| LOG-01 | Centralized logger facade integrating @tauri-apps/plugin-log / console fallback | Plugin already registered in Rust; only frontend facade + capability permission needed |
| LOG-02 | All 56 console.* calls replaced with structured logger | Full list audited; 56 calls across 8 files |
| ERR-01 | Typed error classes (ParseError, WriteError, ValidationError, ScanError) with `kind` field | AtmError base class pattern documented |
| ERR-02 | Service functions document expected error types in JSDoc | JSDoc `@throws` pattern documented |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonc-parser | 3.3.1 | Parse JSON with comments + trailing commas | Microsoft-maintained, zero deps, handles `modify()+applyEdits()` for comment-preserving write-back |
| @tauri-apps/plugin-log | 2.8.0 | Structured log sink in Tauri context | Already in Cargo.toml; plugin already registered in lib.rs debug block |
| react-dom | (existing 19.x) | `createPortal` for toast rendering at document.body | Already a project dependency; no new install |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | Phase is mostly code reorganization | All needed libraries are already in the project or being added above |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonc-parser | strip-json-comments + JSON.parse | jsonc-parser preserves AST, enabling comment-safe write-back via modify()+applyEdits(); strip-json-comments destroys comments permanently |
| createPortal | z-index bump to 30000 | z-index bump fails because SetupWizard's `backdrop-filter: blur(8px)` creates a new CSS stacking context; any descendant z-index is relative to that context, not the document root |

**Installation:**
```bash
pnpm add jsonc-parser
pnpm add @tauri-apps/plugin-log
```

**Version verification (confirmed 2026-03-27):**
- jsonc-parser: 3.3.1 (npm registry)
- @tauri-apps/plugin-log: 2.8.0 (npm registry)
- @tauri-apps/plugin-log Rust: already `tauri-plugin-log = "2"` in Cargo.toml

## Architecture Patterns

### Pattern 1: Toast Portal Fix (BUG-01)

**What:** Move `ToastContainer` rendering out of the React tree into `document.body` using `createPortal`. This bypasses the stacking context created by the wizard's `backdrop-filter`.

**Why `createPortal` is required:** The wizard overlay at line 166–176 of `SetupWizard.tsx` applies `backdropFilter: "blur(8px)"`. Any CSS property that creates a stacking context (backdrop-filter, filter, transform, opacity < 1, will-change) means that even a child with `z-index: 999999` cannot escape the parent's stacking context. `createPortal` renders into `document.body` at the DOM root, completely outside this stacking context.

**Where:** `ToastContainer` in `src/components/common/Toast.tsx`. The `toast()` function and module-level store do not change.

**Example:**
```typescript
// Source: React 19 docs / react-dom createPortal
import { createPortal } from "react-dom";

export function ToastContainer() {
  const entries = useSyncExternalStore(subscribe, getSnapshot);
  // ... keyframes injection stays the same ...

  if (entries.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      {entries.map((entry) => (
        <ToastItem key={entry.id} entry={entry} />
      ))}
    </div>,
    document.body
  );
}
```

**Note:** `App.tsx` renders `<ToastContainer />` at line 225 — no change needed there. The portal moves the DOM node but not the React component position.

### Pattern 2: JSONC Parsing (BUG-02)

**What:** Replace all `JSON.parse(raw)` calls on Claude settings files with `jsonc-parser`'s `parse()`. For the write-back in `handleEnableTeams`, use `modify()` + `applyEdits()` to preserve comments.

**Three callsites to fix:**
1. `SetupWizard.tsx` line 52 — step 2 check (`JSON.parse(raw)`)
2. `SetupWizard.tsx` line 125 — `handleEnableTeams` (`JSON.parse(...)`)
3. `src/services/settings-parser.ts` line 20 — `JSON.parse(raw)`

**Read-only parse (callsites 1 and 3):**
```typescript
import { parse as parseJsonc } from "jsonc-parser";

const errors: { error: number }[] = [];
const settings = parseJsonc(raw, errors, { allowTrailingComma: true });
if (errors.length > 0) {
  // surface parse error
}
```

**Comment-preserving write-back (callsite 2 — handleEnableTeams):**
```typescript
import { modify, applyEdits, parse as parseJsonc } from "jsonc-parser";

// Read raw text (not parsed object)
const raw = await readTextFile(claudeSettingsPath);
// Compute edits that preserve existing comments
const edits = modify(
  raw,
  ["env", "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"],
  "1",
  { formattingOptions: { insertSpaces: true, tabSize: 2 } }
);
const updated = applyEdits(raw, edits);
await writeTextFile(claudeSettingsPath, updated);
```

**Source:** jsonc-parser v3.3.1 GitHub README (microsoft/node-jsonc-parser) — HIGH confidence, verified against npm package.

### Pattern 3: Global Settings Fallback (BUG-03)

**What:** When project-level `.claude/settings.json` exists but does not contain `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, fall back to reading `~/.claude/settings.json`.

**Current code issue:** `SetupWizard.tsx` lines 49–63 only reads `{projectPath}/.claude/settings.json`. If the file exists but lacks the key, `setTeamsEnabled(false)` is called, blocking the wizard even though the global file has the setting enabled.

**fs capability:** `src-tauri/capabilities/default.json` already has `"fs:scope-home-recursive"` and explicitly allows `{ "path": "$HOME/.claude/**" }` — no Rust changes needed.

**Home directory detection:** Use `homeDir()` from `@tauri-apps/api/path` (already available via `@tauri-apps/api`).

**Pattern:**
```typescript
import { homeDir } from "@tauri-apps/api/path";

async function readTeamsEnabled(projectPath: string): Promise<boolean | null> {
  const claudeSettingsPath = join(projectPath, ".claude", "settings.json");

  // Try project-level first
  if (await exists(claudeSettingsPath)) {
    const raw = await readTextFile(claudeSettingsPath);
    const settings = parseJsonc(raw, [], { allowTrailingComma: true });
    const val = settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    if (val !== undefined) return val === "1";
    // Key absent — fall through to global
  }

  // Fall back to global ~/.claude/settings.json
  const home = await homeDir();
  const globalPath = join(home, ".claude", "settings.json");
  if (await exists(globalPath)) {
    const raw = await readTextFile(globalPath);
    const settings = parseJsonc(raw, [], { allowTrailingComma: true });
    const val = settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    return val === "1";
  }

  return false;
}
```

### Pattern 4: Logger Facade (LOG-01)

**What:** A single `logger.ts` service that routes to `@tauri-apps/plugin-log` when running inside Tauri, and falls back to formatted `console.*` calls when running in browser-only mode (`pnpm dev`) or tests.

**Critical rule:** The Tauri check must happen **at call time**, not at import time. Checking at import time would make the module non-importable in test environments where `window.__TAURI_INTERNALS__` is undefined.

**Log levels (5 recommended):** trace, debug, info, warn, error. Maps directly to `@tauri-apps/plugin-log` exported functions.

**Pattern:**
```typescript
// src/services/logger.ts
import type { LogOptions } from "@tauri-apps/plugin-log";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

function isTauri(): boolean {
  return typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window;
}

async function log(level: LogLevel, context: string, message: string): Promise<void> {
  const formatted = `[ATM] [${level.toUpperCase()}] [${context}] ${message}`;

  if (isTauri()) {
    // Lazy import — only resolves inside Tauri runtime
    const pluginLog = await import("@tauri-apps/plugin-log");
    await pluginLog[level](formatted);
  } else {
    // Browser-only fallback
    const consoleFn = level === "trace" || level === "debug" ? "log"
      : level === "info" ? "info"
      : level === "warn" ? "warn"
      : "error";
    console[consoleFn](formatted);
  }
}

export const logger = {
  trace: (context: string, message: string) => log("trace", context, message),
  debug: (context: string, message: string) => log("debug", context, message),
  info:  (context: string, message: string) => log("info",  context, message),
  warn:  (context: string, message: string) => log("warn",  context, message),
  error: (context: string, message: string) => log("error", context, message),
};
```

**Rust side:** Already configured. `lib.rs` lines 844–849 register `tauri_plugin_log::Builder::default().level(log::LevelFilter::Info)` in the debug setup block. The capability file needs `"log:default"` added to `default.json`.

### Pattern 5: Typed Error Classes (ERR-01)

**What:** A base `AtmError` class extended by domain-specific subclasses with a `kind` discriminant. Services throw these; callers narrow via `instanceof` or `.kind`.

```typescript
// src/types/errors.ts

export type ErrorKind = "parse" | "write" | "validation" | "scan";

export class AtmError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AtmError";
    // Preserve prototype chain in transpiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ParseError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("parse", message, cause);
    this.name = "ParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WriteError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("write", message, cause);
    this.name = "WriteError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("validation", message, cause);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ScanError extends AtmError {
  constructor(message: string, cause?: unknown) {
    super("scan", message, cause);
    this.name = "ScanError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**JSDoc pattern (ERR-02):**
```typescript
/**
 * Parse a .md agent file into an AuiNode.
 * @throws {ParseError} If the file cannot be read or gray-matter fails
 */
export async function parseAgentFile(filePath: string, content?: string): Promise<AuiNode> {
```

### Anti-Patterns to Avoid

- **z-index bump on ToastContainer:** Does not work when any ancestor element uses `backdrop-filter`, `filter`, `transform`, or `opacity < 1`. The wizard uses `backdropFilter: "blur(8px)"` — a z-index of any value inside this context cannot escape it.
- **Checking `window.__TAURI_INTERNALS__` at module import time:** Makes the logger module fail to import in test environments. Must check lazily at call time.
- **Applying JSONC fix to only one callsite:** All three callsites use `JSON.parse` on Claude settings. Missing one leaves the bug partially in place.
- **Stripping comments when writing back:** Using `JSON.stringify(parsedObject)` to write back settings destroys the user's existing comments. Use `modify()` + `applyEdits()` on the raw string.
- **Not calling `Object.setPrototypeOf` in error subclasses:** TypeScript compiles `class extends Error` to ES5 in some targets. Without `Object.setPrototypeOf(this, new.target.prototype)`, `instanceof ParseError` returns `false` for thrown errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON with comments parsing | Custom regex comment stripper | jsonc-parser | Handles nested comments, string literals containing `//`, trailing commas, malformed JSON gracefully |
| Comment-preserving JSON write-back | Parse → mutate → stringify | jsonc-parser `modify()` + `applyEdits()` | Stringify always strips comments; modify computes text-level edits |
| Tauri log routing | Custom transport system | @tauri-apps/plugin-log facade | Plugin already wired in Rust; reinventing adds surface area |

## Common Pitfalls

### Pitfall 1: backdrop-filter Creates Stacking Context
**What goes wrong:** Developer bumps `ToastContainer` z-index to 30000. Toast still renders behind the wizard overlay.
**Why it happens:** CSS spec — `backdrop-filter` always creates a new stacking context. Any z-index inside is relative to that context, not the document.
**How to avoid:** Use `createPortal(…, document.body)` so the toast DOM node is at the root stacking context.
**Warning signs:** Toast visible in `pnpm dev` (no wizard) but not visible when wizard is showing.

### Pitfall 2: JSONC Parse at Import Time vs. Call Time
**What goes wrong:** Logger imports `@tauri-apps/plugin-log` at the top of the file. Vitest (Phase 2) fails to import the logger because Tauri IPC is not available.
**Why it happens:** `@tauri-apps/plugin-log` calls `window.__TAURI_INTERNALS__.invoke` when imported — undefined in jsdom.
**How to avoid:** Dynamic `import()` inside the `if (isTauri())` branch, checked lazily per call.
**Warning signs:** "Cannot read properties of undefined (reading 'invoke')" in test output.

### Pitfall 3: Three JSONC Callsites, Not One
**What goes wrong:** Fix `SetupWizard.tsx` step 2 check but miss `handleEnableTeams` and `settings-parser.ts`.
**Why it happens:** Two of the three callsites are in the same file but in different functions.
**How to avoid:** Search for `JSON.parse` in the three files and replace all. Grep: `grep -n "JSON.parse" src/components/setup/SetupWizard.tsx src/services/settings-parser.ts`
**Warning signs:** Step 2 check passes for JSONC files but enabling teams still fails.

### Pitfall 4: Object.setPrototypeOf Omission in Error Subclasses
**What goes wrong:** `catch (err) { if (err instanceof ParseError)` is always false even when a `ParseError` was thrown.
**Why it happens:** TypeScript's ES5 emit breaks `instanceof` for Error subclasses without the prototype fix.
**How to avoid:** Always call `Object.setPrototypeOf(this, new.target.prototype)` in each custom error constructor.
**Warning signs:** Error boundary catches `AtmError` instances but `instanceof ParseError` in catch blocks is false.

### Pitfall 5: handleEnableTeams Write-Back Strips Comments
**What goes wrong:** `handleEnableTeams` reads JSONC correctly but writes back with `JSON.stringify(settings, null, 2)` — stripping all comments from the user's `~/.claude/settings.json`.
**Why it happens:** Current code on line 130: `await writeTextFile(claudeSettingsPath, JSON.stringify(settings, null, 2))`.
**How to avoid:** Keep the raw string, use `modify()` + `applyEdits()` to produce the updated string.
**Warning signs:** After clicking "Enable Teams", the user's settings file has no comments.

### Pitfall 6: `log:default` Capability Missing
**What goes wrong:** `logger.ts` dynamically imports `@tauri-apps/plugin-log`, calls `info()`, but the call silently fails or throws "Permission denied".
**Why it happens:** Tauri v2 requires capability permissions for every plugin. The Rust plugin is registered but the capability file does not list `"log:default"`.
**How to avoid:** Add `"log:default"` to the `permissions` array in `src-tauri/capabilities/default.json`.
**Warning signs:** No log output in the Tauri console even after calling `logger.info()`.

## Code Examples

### homeDir() for Global Settings Path
```typescript
// Source: @tauri-apps/api/path — available in existing @tauri-apps/api@2.10.1
import { homeDir } from "@tauri-apps/api/path";

const home = await homeDir();
const globalSettings = join(home, ".claude", "settings.json");
```

### createPortal Import
```typescript
// Source: react-dom (already installed as react-dom@19.x)
import { createPortal } from "react-dom";
```

### jsonc-parser Imports
```typescript
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";
// parse: read JSONC → JS object
// modify: compute text edits for a path change
// applyEdits: apply edits to raw string, preserving comments
```

## Runtime State Inventory

Step 2.5 SKIPPED — this is not a rename/refactor/migration phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pnpm install, build | ✓ | v22.12.0 | — |
| pnpm | package management | ✓ | (project uses pnpm) | — |
| Rust stable | Tauri build | assumed ✓ | per CLAUDE.md | — |
| @tauri-apps/plugin-log (Rust) | LOG-01 | ✓ (already in Cargo.toml) | "2" | — |
| jsonc-parser | BUG-02 | ✗ (not yet installed) | 3.3.1 available | — |
| @tauri-apps/plugin-log (JS) | LOG-01 | ✗ (not yet installed) | 2.8.0 available | — |
| $HOME/.claude/** FS scope | BUG-03 | ✓ (in default.json already) | — | — |
| log:default capability | LOG-01 | ✗ (missing from default.json) | — | — |

**Missing dependencies with no fallback:**
- `jsonc-parser` npm package — `pnpm add jsonc-parser`
- `@tauri-apps/plugin-log` npm package — `pnpm add @tauri-apps/plugin-log`
- `"log:default"` in `src-tauri/capabilities/default.json`

**Missing dependencies with fallback:**
- None

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON.parse for all JSON files | jsonc-parser for Claude settings | Fix in this phase | Handles real-world Claude settings.json which contains JSONC comments |
| console.log/warn/error | Structured logger facade | Implemented in this phase | Log levels filterable, routes to Tauri log sink in production |
| Plain Error throws | AtmError subclass hierarchy | Implemented in this phase | instanceof-narrowable errors with discriminant `kind` field |

## Open Questions

1. **Should `handleEnableTeams` create `~/.claude/settings.json` if it doesn't exist?**
   - What we know: Current code checks `exists(claudeSettingsPath)` for project-level path. The global `~/.claude/` directory is likely always present on a machine with Claude Code installed.
   - What's unclear: Whether to write to project-level or global settings when enabling teams.
   - Recommendation: Write to project-level `.claude/settings.json` (current behavior) — it is the correct scope for per-project settings. The fallback in BUG-03 is read-only.

2. **Which console calls in `remote-sync.ts` map to which log levels?**
   - What we know: 41 of 56 console calls are in `remote-sync.ts`. Most are `console.warn` or `console.log`.
   - What's unclear: Some `console.log` calls are informational (relay connected) vs. debug noise.
   - Recommendation: `console.log` → `logger.info` or `logger.debug` based on content; `console.warn` → `logger.warn`; `console.error` → `logger.error`. The planner should map each call explicitly.

## Sources

### Primary (HIGH confidence)
- jsonc-parser GitHub README (microsoft/node-jsonc-parser) — parse, modify, applyEdits API
- @tauri-apps/plugin-log GitHub README (tauri-apps/tauri-plugin-log) — TypeScript API, Rust registration
- Tauri v2 mocks docs (v2.tauri.app/reference/javascript/api/namespacemocks) — mockIPC, clearMocks pattern
- Direct source inspection: `Toast.tsx`, `SetupWizard.tsx`, `vite.config.ts`, `settings-parser.ts`, `lib.rs`, `default.json` — confirmed current state

### Secondary (MEDIUM confidence)
- Vitest environment docs (vitest.dev/guide/environment.html) — jsdom install pattern
- CSS stacking context spec — backdrop-filter creates stacking context (well-established CSS behavior)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Bug analysis: HIGH — direct source inspection of all affected files
- Standard stack: HIGH — npm registry versions confirmed, Rust plugin confirmed in Cargo.toml
- Architecture: HIGH — createPortal and JSONC patterns verified against official docs
- Pitfalls: HIGH — root causes verified from source code inspection

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable libraries)
