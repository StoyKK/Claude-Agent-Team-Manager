# Phase 3: Component Tests and Error Boundaries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 03-component-tests-and-error-boundaries
**Areas discussed:** None (full delegation)

---

## Full Delegation

The user was presented with 3 gray areas:
1. Fallback UI design (what users see on crash)
2. Error Boundary scope (where to place boundaries)
3. Unhandled rejection handling (promise rejections)

**User's response:** "je te laisse tout décider toi même"

All decisions deferred to Claude's discretion. Prior phase decisions (jsdom, RTL v16, vi.mock, Zustand reset, toast-only errors) carried forward as locked constraints.

## Claude's Discretion

- All 9 decisions (D-01 through D-09) in CONTEXT.md
- react-error-boundary library
- 3 boundaries: SetupWizard, TreeCanvas, root App
- Dark-themed fallback card with "Try Again" button
- unhandledrejection → logger + toast (no Error Boundary)
- Full wizard flow test + error case

## Deferred Ideas

None
