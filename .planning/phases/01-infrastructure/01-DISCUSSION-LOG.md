# Phase 1: Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-infrastructure
**Areas discussed:** Toast behavior, Logging levels, Error UX, Settings fallback

---

## Toast behavior

| Option | Description | Selected |
|--------|-------------|----------|
| createPortal (Recommended) | Render toast via React createPortal to document.body — escapes all CSS stacking contexts | |
| Z-index bump | Raise z-index to 99999 — simpler but fragile if other overlays have backdrop-filter | |
| You decide | Claude chooses the technical approach | ✓ |

**User's choice:** You decide
**Notes:** User trusts Claude to pick the most robust approach.

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-right, 3s | Current behavior | |
| Top-right, 5s | More visible, slightly longer duration | |
| Keep current | Don't change styling — just fix visibility | ✓ |

**User's choice:** Keep current
**Notes:** Only fix the visibility bug, don't change toast position or duration.

---

## Logging levels

| Option | Description | Selected |
|--------|-------------|----------|
| Standard 4 (Recommended) | debug, info, warn, error — debug only in dev | |
| Standard 5 | trace, debug, info, warn, error — more granular | |
| You decide | Claude chooses granularity | ✓ |

**User's choice:** You decide
**Notes:** Claude discretion on level count.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured (Recommended) | [ATM] [level] [context] message — easy to filter and parse | ✓ |
| Simple | Just message with level — more readable in console | |
| You decide | Claude chooses format | |

**User's choice:** Structured
**Notes:** User wants filterable structured logs.

---

## Error UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast only (Recommended) | Errors in toasts — but visible and with user-friendly messages | ✓ |
| Toast + console detail | User-friendly toast + technical detail in console/logs | |
| Inline errors | Errors displayed directly in the concerned component | |

**User's choice:** Toast only
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| User-friendly (Recommended) | Clear messages: "Could not save settings. Please try again." — technical details in logs | ✓ |
| Technical | Messages with technical detail: "writeTextFile failed: EACCES..." | |
| Both | User-friendly message + "Show details" link for technical info | |

**User's choice:** User-friendly
**Notes:** Technical details only in structured logs, not shown to users.

---

## Settings fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Project then global (Recommended) | Check project first, fallback to ~/.claude/ global, merge results | ✓ |
| Global only | Always read ~/.claude/settings.json — ignore project-level for this check | |
| You decide | Claude chooses fallback strategy | |

**User's choice:** Project then global
**Notes:** Merge strategy: project-level settings take priority, global fills in missing keys.

---

## Claude's Discretion

- Toast fix technical approach (createPortal vs z-index)
- Log level granularity (4 vs 5 levels)
- Vitest configuration details
- Typed error class hierarchy design

## Deferred Ideas

None — discussion stayed within phase scope.
