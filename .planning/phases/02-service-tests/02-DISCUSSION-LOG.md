# Phase 2: Service Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 02-service-tests
**Areas discussed:** None (full delegation)

---

## Full Delegation

The user was presented with 3 gray areas:
1. Test coverage depth (happy path vs edge cases)
2. Mock strategy (Tauri APIs, Zustand stores)
3. File organization (co-located vs `__tests__/`)

**User's response:** "je ne sais pas exactement ce qu'il faut faire donc je te laisse tout décider à ma place"

All decisions deferred to Claude's discretion. Prior Phase 1 decisions (jsdom, Vitest 3, mergeConfig, RTL v16, Zustand reset pattern) carried forward as locked constraints.

## Claude's Discretion

- All 11 decisions (D-01 through D-11) in CONTEXT.md
- Test file placement: co-located with source
- Coverage: happy path + key error cases
- Mock strategy: vi.mock factory for Tauri FS, no mocking for pure functions
- Zustand reset in beforeEach

## Deferred Ideas

None
