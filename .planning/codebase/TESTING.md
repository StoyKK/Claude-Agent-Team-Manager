# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**Status:** No testing framework configured

**Runner:** Not detected
- No `vitest`, `jest`, or other test runner in `package.json` dependencies or devDependencies
- No test configuration files (`jest.config.js`, `vitest.config.ts`, etc.)

**Assertion Library:** Not detected

**Run Commands:** Not applicable

## Test File Organization

**Status:** No test files present in codebase

**Findings:**
- Zero `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` files found in project
- No dedicated `__tests__/` or `tests/` directories
- Code is production-only with no test suite

## Test Structure

**Patterns:** Not applicable — no tests to analyze

## Mocking

**Framework:** Not applicable — no testing infrastructure

## Fixtures and Factories

**Test Data:** Not detected

## Coverage

**Requirements:** No coverage enforcement

**View Coverage:** Not applicable

## Test Types

**Unit Tests:** Not present
**Integration Tests:** Not present
**E2E Tests:** Not present

## Implementation Gaps

The codebase lacks testing infrastructure entirely. Given the complexity of the system, testing opportunities exist across these areas:

**Unit Testing Candidates:**

1. **Validation (`src/utils/validation.ts`)**
   - Test `validateNode()` with valid/invalid configs
   - Test Zod schema validation paths (`validateAgentConfig()`, `validateSkillConfig()`, etc.)
   - Example: validate agent with missing required fields, invalid model, invalid permission mode

2. **Path Utilities (`src/utils/paths.ts`)**
   - Test `normalizePath()` with Windows/Unix paths
   - Test `getFileName()` edge cases (no extension, multiple dots, empty string)
   - Test `titleCase()` transformations (kebab-case, snake_case, single words)
   - Test `generateNodeId()` determinism (same path = same hash)

3. **File Scanner (`src/services/file-scanner.ts`)**
   - Mock Tauri FS operations
   - Test `scanProject()` finds agents, skills, settings, rules, and context files
   - Test `safeExists()` returns false on missing parent directories

4. **Parsers (agent, skill, settings in `src/services/`)**
   - Test gray-matter parsing with minimal/complete frontmatter
   - Test schema validation errors bubble up correctly
   - Test fallback behaviors (missing name → derived from filename)

5. **File Writer (`src/services/file-writer.ts`)**
   - Mock Tauri write/rename/remove
   - Test atomic write pattern (temp file + rename)
   - Test cleanup on rename failure
   - Test validation errors throw before write attempt

6. **Platform Detection (`src/utils/platform.ts`)**
   - Test `isWindows()` / `isMacOS()` with mocked `navigator.userAgent`

7. **Grouping Utilities (`src/utils/grouping.ts`)**
   - Test team/member detection logic if present

**Integration Testing Candidates:**

1. **Store Actions (tree-store, ui-store)**
   - Test `loadProject()` → full initialization flow
   - Test `addNode()` → `updateNode()` → `saveNode()` sequence
   - Test `reparentNode()` with validation
   - Test layout save/load cycle
   - Test clipboard copy/paste operations

2. **File System Sync**
   - Test disk changes detected → `syncFromDisk()` → store update
   - Test external file addition → node creation
   - Test file deletion → node removal

3. **Remote Sync (src/services/remote-sync.ts)**
   - Mock WebSocket connection
   - Test message serialization/deserialization
   - Test command payload validation

4. **Scheduler (src/services/scheduler.ts)**
   - Test schedule creation with validation
   - Test platform-specific script generation (Windows PowerShell vs macOS bash)

**Component Testing Candidates:**

1. **Canvas & Nodes (src/components/tree/)**
   - Test `OrgNode` rendering with different node kinds
   - Test color assignment based on node type and hierarchy
   - Test skill resolution from cache
   - Test context menu interactions

2. **Inspector Panels (src/components/inspector/)**
   - Test `AgentEditor` field updates → store mutations
   - Test `GroupEditor` team/skill assignment UI
   - Test validation error display

3. **Dialogs (src/components/dialogs/)**
   - Test create node with validation
   - Test delete confirmation flow

**System Integration Testing Candidates:**

1. **End-to-end Agent Creation**
   - Create project → Create agent → Edit config → Save → Verify disk write

2. **Team Deployment**
   - Load project → Create team → Assign skills → Export → Verify generated skill markdown

3. **Remote Access**
   - Start server → Connect client → Sync state → Verify remote see changes → Edit on remote → Verify sync back

## Testing Recommendation

**Next Steps:**
1. Install test framework: `pnpm add --save-dev vitest @testing-library/react @testing-library/user-event`
2. Configure vitest in `vitest.config.ts`
3. Start with path utilities (zero dependencies, easy isolation)
4. Move to validation utilities (test Zod schemas)
5. Add service layer tests with Tauri FS mocking
6. Add integration tests for store state flows
7. Add component tests for key interactions

**Suggested Test Structure:**
```
src/
├── services/
│   └── __tests__/
│       ├── agent-parser.test.ts
│       ├── file-scanner.test.ts
│       └── scheduler.test.ts
├── utils/
│   └── __tests__/
│       ├── paths.test.ts
│       ├── validation.test.ts
│       └── platform.test.ts
├── store/
│   └── __tests__/
│       ├── tree-store.test.ts
│       └── ui-store.test.ts
└── components/
    └── tree/
        └── __tests__/
            └── OrgNode.test.tsx
```

---

*Testing analysis: 2026-03-27*
