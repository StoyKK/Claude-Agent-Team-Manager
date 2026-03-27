# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `TreeCanvas.tsx`, `OrgNode.tsx`, `AgentEditor.tsx`)
- Utilities: camelCase (e.g., `file-scanner.ts`, `agent-parser.ts`)
- Types: kebab-case files with PascalCase exports (e.g., `aui-node.ts` exports `AuiNode`, `TreeExport`)
- Stores: descriptive camelCase with `-store` suffix (e.g., `tree-store.ts`, `ui-store.ts`)
- Services: descriptive camelCase (e.g., `file-writer.ts`, `layout-service.ts`, `remote-sync.ts`)

**Functions:**
- Async functions often prefixed with descriptive action: `parseAgentFile()`, `writeNodeFile()`, `loadProject()`
- Private/helper functions use lowercase: `safeExists()`, `classifyFile()`, `parseFile()`
- Action creators in Zustand stores: camelCase verbs: `addNode()`, `updateNode()`, `reparentNode()`, `saveNodePosition()`
- Hooks use `use` prefix: custom hooks not found, but Zustand stores follow pattern
- Constants and lookup objects: UPPER_SNAKE_CASE for module constants: `MODEL_OPTIONS`, `PERMISSION_OPTIONS`, `KIND_COLORS`, `DEFAULT_SETTINGS`

**Variables:**
- Local state variables: camelCase (e.g., `selectedNodeId`, `isGroup`, `isPipeline`)
- Boolean flags: `is`, `has`, `can` prefixes (e.g., `isRoot`, `hasErrors`, `canReparent`)
- Map/object variables: descriptive camelCase (e.g., `allNodes`, `skillNameCache`, `parentNode`)
- Configuration objects: camelCase (e.g., `remoteConfig`, `remoteConnected`)

**Types:**
- Interfaces: PascalCase (e.g., `AuiNode`, `TreeState`, `TreeActions`, `RemoteMessage`)
- Type unions: lowercase with pipe operators (e.g., `NodeKind = "human" | "agent" | "skill"`)
- Enums (when used): converted to Zod `.enum()` for runtime validation (e.g., `VariableKind`)
- Config types derived from Zod schemas: `z.infer<typeof SomeSchema>` pattern (e.g., `AgentConfig`, `SkillConfig`)

## Code Style

**Formatting:**
- No explicit Prettier or ESLint configuration files present
- Inferred standards from codebase: 2-space indentation, semicolons, trailing commas in multiline objects/arrays
- Line length: no strict limit enforced, but general readability observed (~80-120 char comfort zone)
- Quotes: double quotes for strings (consistent throughout)

**Linting:**
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- `noFallthroughCasesInSwitch`: enabled
- `forceConsistentCasingInFileNames`: enabled
- `noUnusedLocals` and `noUnusedParameters`: disabled (not enforced)

**Import Organization:**
- Grouped in order:
  1. Built-in Node/React imports: `import { useEffect, useState } from "react"`
  2. Third-party libraries: `import { invoke } from "@tauri-apps/api/core"`, `import matter from "gray-matter"`
  3. Internal types: `import type { AuiNode } from "@/types/aui-node"`
  4. Internal stores/services: `import { useTreeStore } from "@/store/tree-store"`, `import { toast } from "@/components/common/Toast"`
  5. Utilities: `import { normalizePath, joinPath } from "@/utils/paths"`
  6. Styles: `import "@xyflow/react/dist/style.css"`

## Path Aliases

- `@/` maps to `src/` in both `vite.config.ts` and `tsconfig.json`
- `fs` module aliased to `src/utils/fs-stub.ts` (browser-safe stub for gray-matter)

Example imports:
```typescript
import type { AuiNode } from "@/types/aui-node";
import { useTreeStore } from "@/store/tree-store";
import { normalizePath } from "@/utils/paths";
```

## Error Handling

**Patterns:**
- Try-catch blocks with error extraction and user-facing toast notifications
- Pattern: `catch (err) { toast(err instanceof Error ? err.message : "Failed to...", "error") }`
- Example from `App.tsx`:
```typescript
try {
  await createAgentNode(name, description, resolvedParentId);
  toast(`Created ${name}`, "success");
  closeCreateDialog();
} catch (err) {
  toast(err instanceof Error ? err.message : "Failed to create", "error");
}
```

- Promise `.catch()` chains for non-blocking operations:
```typescript
getVersion().then(v => setVersion(v)).catch(() => {});
```

- Safe wrappers for potentially failing operations (e.g., `safeExists()` in `file-scanner.ts`):
```typescript
async function safeExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}
```

- Zod schema validation before disk writes in `file-writer.ts`:
```typescript
const result = schema.safeParse(node.config);
if (!result.success) {
  const msgs = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
  throw new Error(`Validation failed: ${msgs.join("; ")}`);
}
```

- Atomic file writes with temp file + rename pattern:
```typescript
const tmpPath = node.sourcePath + ".tmp";
await writeTextFile(tmpPath, output);
try {
  await rename(tmpPath, node.sourcePath);
} catch {
  try { await remove(tmpPath); } catch { /* ignore */ }
  throw new Error(`Failed to atomically write ${node.sourcePath}`);
}
```

## Logging

**Framework:** Console-based logging (no centralized logger)

**Patterns:**
- `console.warn()` for non-fatal issues (e.g., unresolved skill IDs in `OrgNode.tsx`):
```typescript
console.warn(`[ATM] Skill ID "${skillId}" not resolved for group "${node.name}"`);
```
- `console.error()` not explicitly found but implied in error contexts
- Info/debug logging: minimal — no explicit logging framework

## Comments

**When to Comment:**
- Complex logic requiring context (e.g., explaining team/sub-agent classification in `OrgNode.tsx`)
- Non-obvious algorithms (e.g., djb2 hash for node IDs in `paths.ts`)
- Workarounds and constraints (e.g., gray-matter import comment in `vite.config.ts`)

**JSDoc/TSDoc:**
- Used for public exported functions with clear parameter/return documentation
- Example from `agent-parser.ts`:
```typescript
/**
 * Parse a .md agent file into an AuiNode.
 * If content is not provided, reads the file from disk via Tauri FS.
 */
export async function parseAgentFile(
  filePath: string,
  content?: string
): Promise<AuiNode>
```

- Not consistently applied to all functions; typically used for service layer and utility functions
- Type descriptions embedded in comments for clarity on complex patterns (e.g., "gray-matter is used browser-side with a Vite alias")

## Function Design

**Size:**
- Utility functions are compact (10-40 lines), service functions moderate (30-80 lines)
- React components can be larger (SettingsPanel: 1087 lines, but structured with sections)
- Store actions are inline within Zustand `create()` callbacks

**Parameters:**
- Explicit typed parameters required (TypeScript strict mode)
- Optional parameters use `?` syntax (e.g., `content?: string`)
- Configuration objects passed as single parameter when multiple options exist
- Example: `loadProject(path: string)`, `parseAgentFile(filePath: string, content?: string)`

**Return Values:**
- Async operations return `Promise<T>` explicitly typed
- Success path returns data; errors throw exceptions (caught by caller)
- Validation functions return objects with `{ success, errors, data? }` pattern for fine-grained error info
- No null returns in most service functions; favor exceptions or empty defaults

## Module Design

**Exports:**
- Service modules export primarily async functions: `parseAgentFile()`, `writeNodeFile()`, `loadProject()`
- Type modules export `interface`, `type`, and Zod schemas side-by-side
- Store modules export singleton instances: `useTreeStore`, `useUiStore` (Zustand stores)
- Component modules export default or named React components

**Barrel Files:**
- Not used; imports are direct from source files (`@/services/file-scanner`, `@/types/aui-node`)
- Index files exist but organize re-exports minimally

**Example service structure** from `services/agent-parser.ts`:
```typescript
// Imports (types and dependencies)
import matter from "gray-matter";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { AuiNode } from "@/types/aui-node";
import type { AgentConfig } from "@/types/agent";

// Single exported function
export async function parseAgentFile(...): Promise<AuiNode> { ... }
```

**Example store structure** from `store/tree-store.ts`:
```typescript
// State interface
interface TreeState { ... }

// Actions interface
interface TreeActions { ... }

// Combined type
type TreeStore = TreeState & TreeActions;

// Zustand store creation
export const useTreeStore = create<TreeStore>()((set, get) => ({
  // initial state + action implementations
}));
```

---

*Convention analysis: 2026-03-27*
