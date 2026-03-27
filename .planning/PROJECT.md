# ATM Stability

## What This Is

ATM (Agent Team Manager) is a Tauri v2 desktop app for visually managing Claude Code agent teams via org charts, deployment, scheduling, pipelines, and remote access. This milestone focuses on fixing critical bugs that block the app from launching properly on macOS, and establishing the testing/logging/error-handling foundations needed for reliable operation.

## Core Value

The app must complete its setup wizard and reach the main editor without errors — if users can't get past onboarding, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Fix toast z-index rendering behind wizard overlay (z:10000 vs z:20000 with blur)
- [ ] Fix setup wizard "Get Started" button not responding due to hidden error
- [ ] Fix Claude settings reading — check global ~/.claude/ path, support JSONC parsing
- [ ] Fix setup wizard reporting "Agent teams not enabled" despite correct settings
- [ ] Replace scattered console.log/warn/error (55 instances) with structured logging service
- [ ] Define error types for core services (agent-parser, file-writer, remote-sync, file-scanner)
- [ ] Add Vitest testing framework and configuration
- [ ] Write tests for setup wizard flow (all 3 steps, error cases)
- [ ] Write tests for file-scanner, agent-parser, skill-parser services
- [ ] Write tests for path utilities and validation schemas

### Out of Scope

- Refactoring tree-store.ts (2,767 lines) — deferred to a dedicated refactoring milestone
- Splitting large components (SettingsPanel, GroupEditor, etc.) — cosmetic, not stability
- Security improvements (cert pinning, secret encryption) — separate security milestone
- New features or UI changes beyond bug fixes
- Performance optimization

## Context

- Project discovered by user today; has trouble running on macOS (Apple Silicon M1)
- Installed from .dmg release, Claude Code v2.1.83 via native installer
- The setup wizard blocks app usage — "Get Started" button fails silently
- Toast notifications are hidden behind the wizard's blurred overlay, making debugging impossible
- No test framework exists — zero test coverage currently
- 55 scattered console.log/warn/error calls with no structured logging
- Services lack defined error types — callers don't know what exceptions to expect
- Brownfield codebase: React 19 + TypeScript 5.9.3 + Tauri v2 + Zustand + Vite 7

## Constraints

- **Tech stack**: Must stay within existing Tauri v2 + React 19 + TypeScript stack
- **Compatibility**: Fixes must work on macOS (primary) and maintain Windows/Linux support
- **Non-breaking**: All changes must preserve existing functionality for users who got past the wizard

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest over Jest | Already using Vite for build; Vitest integrates natively | — Pending |
| Structured logging service | Centralize 55 scattered console calls into one service | — Pending |
| JSONC parser for Claude settings | Claude Code settings may contain comments; JSON.parse fails on them | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
