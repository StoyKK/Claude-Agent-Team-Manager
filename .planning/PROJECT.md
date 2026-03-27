# ATM (Agent Team Manager)

## What This Is

ATM is a Tauri v2 desktop app for visually managing Claude Code agent teams via org charts, deployment, scheduling, pipelines, and remote access. As of v1.0, the app completes its setup wizard and reaches the main editor reliably on macOS, with structured logging, typed errors, and 55 automated tests providing a stability foundation.

## Core Value

The app must be reliable and debuggable — users need to trust that setup works, errors are visible, and regressions are caught by tests.

## Requirements

### Validated

- ✓ Fix toast z-index rendering behind wizard overlay — v1.0 (createPortal to document.body)
- ✓ Fix setup wizard "Get Started" button not responding — v1.0
- ✓ Fix Claude settings reading (global path, JSONC parsing) — v1.0
- ✓ Fix false "Agent teams not enabled" message — v1.0
- ✓ Structured logging service replacing 55 console calls — v1.0
- ✓ Typed error classes for core services — v1.0
- ✓ Vitest testing framework configured — v1.0
- ✓ Unit tests for path utilities and validation schemas — v1.0
- ✓ Service tests for parsers and file-scanner — v1.0
- ✓ Component tests for SetupWizard flow — v1.0
- ✓ React Error Boundaries with fallback UI — v1.0
- ✓ Unhandled promise rejection handler — v1.0

### Active

(none — next milestone not yet planned)

### Out of Scope

- Refactoring tree-store.ts (2,767 lines) — dedicated refactoring milestone
- Splitting large components (SettingsPanel, GroupEditor) — cosmetic, not stability
- Security improvements (cert pinning, secret encryption) — separate security milestone
- E2E tests with Tauri WebDriver — deferred to future testing milestone
- Rust backend unit tests — deferred to future testing milestone

## Context

Shipped v1.0 Stability milestone in a single session (Mar 27 2026).
Tech stack: React 19 + TypeScript 5.9.3 + Tauri v2 + Zustand 5 + Vite 7.
Test suite: 55 tests (Vitest 3, jsdom, @testing-library/react).
Brownfield codebase with remote access, scheduling, and pipeline features already built.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest over Jest | Already using Vite for build; Vitest integrates natively via mergeConfig | ✓ Good — zero config friction |
| Structured logger facade | Centralize 55 scattered console calls; route to Tauri plugin-log in production | ✓ Good — all calls migrated |
| JSONC parser (jsonc-parser) | Claude Code settings contain comments; JSON.parse fails on them | ✓ Good — Microsoft-maintained, zero deps |
| createPortal for toasts | z-index alone fails when wizard has backdrop-filter CSS stacking context | ✓ Good — renders at document.body |
| react-error-boundary | Battle-tested library vs hand-rolled class components | ✓ Good — 3 boundaries, clean API |
| Coarse-grained error boundaries | 3 boundaries (root, canvas, wizard) vs per-component | ✓ Good — covers critical paths without overhead |
| jsdom over happy-dom | Safer for File, Blob, URL, and window.__TAURI_INTERNALS__ | ✓ Good — no compatibility issues |
| @testing-library/react v16 | First RTL version with React 19 peer support | ✓ Good — standard testing patterns |

## Constraints

- **Tech stack**: Must stay within existing Tauri v2 + React 19 + TypeScript stack
- **Compatibility**: Fixes must work on macOS (primary) and maintain Windows/Linux support
- **Non-breaking**: All changes must preserve existing functionality

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-27 after v1.0 milestone*
