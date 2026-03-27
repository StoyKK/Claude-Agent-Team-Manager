# Requirements: ATM Stability

**Defined:** 2026-03-27
**Core Value:** The app must complete its setup wizard and reach the main editor without errors

## v1 Requirements

Requirements for stability milestone. Each maps to roadmap phases.

### Bug Fixes

- [x] **BUG-01**: Toast notifications render above all overlays including setup wizard (createPortal to document.body, z-index above 20000)
- [x] **BUG-02**: Claude settings files parsed with JSONC support (handle comments) across all 3 callsites (wizard step 2, handleEnableTeams, settings-parser)
- [x] **BUG-03**: Setup wizard reads global ~/.claude/settings.json when project-level .claude/settings.json doesn't contain the expected keys
- [x] **BUG-04**: Setup wizard "Get Started" button completes setup successfully or shows a readable error message to the user

### Logging

- [x] **LOG-01**: Centralized logger facade service that integrates with @tauri-apps/plugin-log when running in Tauri, falls back to console when running in browser-only mode (pnpm dev)
- [x] **LOG-02**: All 55 existing console.log/warn/error calls replaced with structured logger calls using appropriate log levels

### Error Handling

- [x] **ERR-01**: Typed error classes (ParseError, WriteError, ValidationError, ScanError) defined for core services with discriminant `kind` field
- [x] **ERR-02**: Service functions (agent-parser, skill-parser, file-writer, file-scanner) document expected error types in JSDoc
- [ ] **ERR-03**: React Error Boundaries wrap major app sections with user-friendly fallback UI using react-error-boundary

### Testing

- [ ] **TEST-01**: Vitest configured within vite.config.ts (not separate file) with correct path aliases, fs stub, jsdom environment, and Tauri mock setup file
- [ ] **TEST-02**: Tier 1 unit tests for pure utility functions: paths.ts (join, normalize, generateNodeId) and validation.ts (Zod schemas)
- [ ] **TEST-03**: Tier 2 integration tests for services: file-scanner, agent-parser, skill-parser using @tauri-apps/api/mocks mockIPC
- [ ] **TEST-04**: Tier 3 component tests for SetupWizard flow (all 3 steps, error cases, Get Started completion) using @testing-library/react with Zustand store resets

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Refactoring

- **REF-01**: Split tree-store.ts (2,767 lines) into focused modules
- **REF-02**: Split large components (SettingsPanel 1,087 lines, GroupEditor 1,041 lines, MobileTreeView 1,029 lines)

### Security

- **SEC-01**: Certificate pinning for remote access
- **SEC-02**: Encrypted vault for sensitive variable values
- **SEC-03**: Strict cron syntax validation in scheduler

### Testing Extension

- **TEST-05**: E2E tests with Tauri WebDriver
- **TEST-06**: Rust backend unit tests

## Out of Scope

| Feature | Reason |
|---------|--------|
| tree-store.ts refactoring | Dedicated milestone — too large to combine with stability work |
| New features or UI changes | Stability-only milestone — no feature additions |
| Performance optimization | Not a current pain point — address after stability |
| Tests for tree-store.ts | Anti-feature: creates coupling to a monolith scheduled for refactoring |
| CI/CD pipeline | Useful but not blocking the user's ability to use the app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| BUG-04 | Phase 1 | Complete |
| LOG-01 | Phase 1 | Complete |
| LOG-02 | Phase 1 | Complete |
| ERR-01 | Phase 1 | Complete |
| ERR-02 | Phase 1 | Complete |
| ERR-03 | Phase 3 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
