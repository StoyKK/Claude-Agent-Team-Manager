# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATM (Agent Team Manager) is a Tauri v2 desktop app for visually managing Claude Code agent teams. Users build org charts via drag-drop, deploy agent teams with auto-generated primers, schedule runs via OS-level scheduling, and chain teams into pipelines. It also supports remote access from mobile devices via a local HTTPS server or cloud relay.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Full desktop app (frontend + Rust backend) — use this for development
pnpm dev              # Frontend-only dev server (no Tauri native APIs — limited usefulness)
pnpm build            # TypeScript check + Vite build (frontend only)
pnpm tauri build      # Production build (frontend + native installer)
```

**Important:** `pnpm dev` runs frontend only. Use `pnpm tauri dev` for the full app with file access, deployment, and terminal spawning.

**Prerequisites:** Node.js 18+, pnpm 9+, Rust stable. macOS needs `xcode-select --install`.

## Architecture

### Two-Layer System

- **Frontend** (`src/`): React 19 + TypeScript, bundled with Vite 7. Uses `@` path alias mapped to `src/`.
- **Backend** (`src-tauri/`): Rust via Tauri v2. Handles OS-level operations (scheduling, terminal launch, file system) and the remote access server.

### State Management

Two Zustand stores drive the entire app:

- **`tree-store.ts`** — The core store. Holds the node tree (`Map<string, AuiNode>`), layouts, clipboard, and all tree manipulation actions (add/remove/reparent nodes, save to disk, deploy pipelines, import/export). This is the single source of truth for the org chart.
- **`ui-store.ts`** — UI state (selected node, panel visibility, context menu, toasts) plus remote access state (server config, relay status, paired devices).

### Node Model

Everything on the canvas is an `AuiNode` (`types/aui-node.ts`). Node kinds: `human`, `agent`, `skill`, `group`, `pipeline`, `note`, `settings`, `context`. Agents and skills map to real `.claude/` markdown files on disk; groups and pipelines are virtual (stored in tree metadata only).

### Key Data Flow

1. **Load:** `file-scanner.ts` scans the `.claude/` directory → `agent-parser.ts` / `skill-parser.ts` parse markdown with gray-matter YAML frontmatter → nodes populate the tree store
2. **Edit:** Inspector panel components edit node properties → `tree-store.updateNode()` → `file-writer.ts` writes back to disk
3. **Deploy:** `tree-store.exportTeamAsSkill()` generates a deployment primer → `scheduler.ts` or `open_terminal` Tauri command launches it
4. **Sync:** `file-watcher.ts` watches for external disk changes → `syncFromDisk()` re-parses changed files

### Frontend Components

- `components/tree/` — React Flow canvas (`TreeCanvas.tsx`), org chart node rendering (`OrgNode.tsx`), auto-layout via dagre (`layout.ts`)
- `components/inspector/` — Right panel with kind-specific editors (`AgentEditor`, `SkillEditor`, `GroupEditor`, `PipelineEditor`, `VariableEditor`)
- `components/context-hub/` — Context Hub panel for cross-cutting views
- `components/schedule/` — Schedule panel for OS-level task scheduling
- `components/remote/` — Remote access UI (server control, QR codes, pairing)
- `components/settings/` — App settings panel
- `components/setup/` — First-run setup wizard

### Services Layer (`src/services/`)

- `agent-parser.ts` / `skill-parser.ts` / `settings-parser.ts` — Parse `.claude/` markdown files (gray-matter frontmatter + body)
- `file-scanner.ts` — Discovers agents/skills in a project's `.claude/` directory
- `file-writer.ts` — Writes node changes back to markdown files on disk
- `file-watcher.ts` — Watches `.claude/` for external changes
- `layout-service.ts` — Persists named layouts to `.aui/layouts/`
- `scheduler.ts` — Generates deploy scripts (PowerShell on Windows, bash on macOS/Linux)
- `remote-sync.ts` — Syncs tree state to remote clients via WebSocket
- `zip-service.ts` — Export/import org charts as compressed zip archives
- `claude-api.ts` — Claude API integration for AI-powered org generation

### Rust Backend (`src-tauri/src/`)

- `lib.rs` — Tauri command handlers: `open_terminal`, `create_scheduled_task`, `fetch_url`, plus all remote/relay commands
- `remote/` — Full remote access system: HTTPS server with self-signed certs, WebSocket bridge, PIN-based auth, QR code generation, cloud relay client for NAT traversal, persistent device pairing

### Validation

Zod schemas in `utils/validation.ts` validate agent/skill configs. Validation errors surface on nodes via `validationErrors` array.

### Platform Handling

`utils/platform.ts` provides `isWindows()` / `isMacOS()` via `navigator.userAgent`. The Rust backend uses `#[cfg(target_os = "...")]` for platform-specific scheduling and terminal commands.

## Key Conventions

- gray-matter is used browser-side with a Vite alias stubbing out Node's `fs` module (`utils/fs-stub.ts`) — it only receives string content, never file paths
- Tree metadata (hierarchy, positions, groups) persists to `.aui/tree.json` within the project directory
- Layouts persist to `.aui/layouts/` as individual JSON files with an index
- The `@/` import alias maps to `src/` (configured in both vite.config.ts and tsconfig.json)
- Version is maintained in three places: `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**ATM Stability**

ATM (Agent Team Manager) is a Tauri v2 desktop app for visually managing Claude Code agent teams via org charts, deployment, scheduling, pipelines, and remote access. This milestone focuses on fixing critical bugs that block the app from launching properly on macOS, and establishing the testing/logging/error-handling foundations needed for reliable operation.

**Core Value:** The app must complete its setup wizard and reach the main editor without errors — if users can't get past onboarding, nothing else matters.

### Constraints

- **Tech stack**: Must stay within existing Tauri v2 + React 19 + TypeScript stack
- **Compatibility**: Fixes must work on macOS (primary) and maintain Windows/Linux support
- **Non-breaking**: All changes must preserve existing functionality for users who got past the wizard
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9.3 - Frontend application code
- Rust 1.77.2 - Tauri backend and system integration
- JavaScript - Browser runtime for React/DOM
- YAML - Configuration and metadata files
## Runtime
- Node.js 18+ (development)
- Tauri v2 (desktop application runtime)
- pnpm 9+ (configured in `package.json`)
- Lockfile: `pnpm-lock.yaml` (present)
## Frameworks
- React 19.2.4 - UI framework with JSX/TSX
- Tauri 2.10.0 - Desktop application framework (wraps Rust backend)
- Vite 7.3.1 - Frontend build tool and dev server
- @xyflow/react 12.10.1 - React Flow for interactive node canvas (org chart)
- dagre 0.8.5 - Layout engine for graph visualization (auto-layout)
- @monaco-editor/react 4.7.0 - Code editor for viewing/editing agent/skill markdown
- Zustand 5.0.11 - Lightweight state store (`tree-store.ts`, `ui-store.ts`)
- gray-matter 4.0.3 - YAML frontmatter parser (browser-side for agent/skill files)
- yaml 2.8.2 - YAML parsing and generation
- zod 4.3.6 - Schema validation library
- fflate 0.8.2 - Compression library for export/import zip archives
- tweetnacl 1.0.3 - NaCl cryptography (X25519 key exchange, XSalsa20-Poly1305)
- tweetnacl-util 0.15.1 - Encoding utilities for tweetnacl
- No testing framework detected (no Jest, Vitest, or similar in dependencies)
- @tauri-apps/cli 2.10.0 - Tauri CLI for building and bundling
- @vitejs/plugin-react 5.1.4 - React support for Vite
- TypeScript compiler (tsc) - Type checking before build
## Key Dependencies
- @tauri-apps/api 2.10.1 - Core Tauri API (invoke, events, app info)
- @tauri-apps/plugin-fs 2.4.5 - File system access
- @tauri-apps/plugin-shell 2.3.5 - Terminal spawning and script execution
- @tauri-apps/plugin-dialog 2.6.0 - Native file dialogs
- axum 0.8 - Web framework for HTTPS server and WebSocket support
- axum-server 0.7 - TLS/HTTPS support (rustls)
- tokio 1 - Async runtime (full feature set enabled)
- tower-http 0.6 - HTTP middleware (CORS, static file serving)
- tokio-tungstenite 0.26 - WebSocket client for cloud relay
- rcgen 0.13 - Self-signed certificate generation
- qrcode 0.14 - QR code generation for pairing
- image 0.25 - PNG image encoding for QR codes
- local-ip-address 0.6 - Local network IP detection
- rusqlite 0.31 (relay only) - SQLite for relay persistence
- sha2 0.10 - SHA-256 hashing for certificate fingerprints
- hex 0.4 - Hex encoding/decoding
- rand 0.9 - Randomness for nonce generation
- chrono 0.4 - Datetime handling (for relay)
- uuid 1 - UUID generation for pairing tokens
- serde_json 1.0 - JSON serialization (Rust)
- futures 0.3 - Async utilities for WebSocket handling
## Configuration
- API key stored in `.aui/settings.json` within project directory (not `.env`)
- No `.env` file requirements detected
- Settings loaded per-project (not global)
- `vite.config.ts` - Vite bundler config with React plugin and path aliases
- `tsconfig.json` - TypeScript compiler options (ES2021 target, strict mode)
- `tsconfig.node.json` - TypeScript config for build-time scripts
- `src-tauri/tauri.conf.json` - Tauri app configuration (window size, resources, CSP)
- Log plugin v2 (built-in logging)
- Dialog plugin v2.6.0 (file dialogs)
- Filesystem plugin v2.4.5 (file I/O)
- Shell plugin v2.3.5 (terminal spawning)
## Platform Requirements
- macOS: `xcode-select --install` (for Rust compilation)
- All platforms: Rust stable toolchain
- Node.js 18+, pnpm 9+
- **Desktop target:** macOS (Intel/Apple Silicon), Windows, Linux
- **Minimum macOS:** 10.15 (Catalina)
- **Remote access:** Runs local HTTPS server with self-signed certificates
- **Cloud relay option:** Connects to external relay server via WebSocket (NAT traversal)
## Deployment
- `pnpm build` - TypeScript check + Vite production bundle → `dist/` directory
- Output: Minified React app, tree-shaken dependencies
- `pnpm tauri build` - Bundles frontend + Rust backend → platform-specific installer
- Outputs: `.dmg` (macOS), `.exe` (Windows), `.AppImage` (Linux)
- Standalone binary in `relay/` directory
- Uses SQLite for persistence (local database)
- Listens on WebSocket for cloud relay clients
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: PascalCase (e.g., `TreeCanvas.tsx`, `OrgNode.tsx`, `AgentEditor.tsx`)
- Utilities: camelCase (e.g., `file-scanner.ts`, `agent-parser.ts`)
- Types: kebab-case files with PascalCase exports (e.g., `aui-node.ts` exports `AuiNode`, `TreeExport`)
- Stores: descriptive camelCase with `-store` suffix (e.g., `tree-store.ts`, `ui-store.ts`)
- Services: descriptive camelCase (e.g., `file-writer.ts`, `layout-service.ts`, `remote-sync.ts`)
- Async functions often prefixed with descriptive action: `parseAgentFile()`, `writeNodeFile()`, `loadProject()`
- Private/helper functions use lowercase: `safeExists()`, `classifyFile()`, `parseFile()`
- Action creators in Zustand stores: camelCase verbs: `addNode()`, `updateNode()`, `reparentNode()`, `saveNodePosition()`
- Hooks use `use` prefix: custom hooks not found, but Zustand stores follow pattern
- Constants and lookup objects: UPPER_SNAKE_CASE for module constants: `MODEL_OPTIONS`, `PERMISSION_OPTIONS`, `KIND_COLORS`, `DEFAULT_SETTINGS`
- Local state variables: camelCase (e.g., `selectedNodeId`, `isGroup`, `isPipeline`)
- Boolean flags: `is`, `has`, `can` prefixes (e.g., `isRoot`, `hasErrors`, `canReparent`)
- Map/object variables: descriptive camelCase (e.g., `allNodes`, `skillNameCache`, `parentNode`)
- Configuration objects: camelCase (e.g., `remoteConfig`, `remoteConnected`)
- Interfaces: PascalCase (e.g., `AuiNode`, `TreeState`, `TreeActions`, `RemoteMessage`)
- Type unions: lowercase with pipe operators (e.g., `NodeKind = "human" | "agent" | "skill"`)
- Enums (when used): converted to Zod `.enum()` for runtime validation (e.g., `VariableKind`)
- Config types derived from Zod schemas: `z.infer<typeof SomeSchema>` pattern (e.g., `AgentConfig`, `SkillConfig`)
## Code Style
- No explicit Prettier or ESLint configuration files present
- Inferred standards from codebase: 2-space indentation, semicolons, trailing commas in multiline objects/arrays
- Line length: no strict limit enforced, but general readability observed (~80-120 char comfort zone)
- Quotes: double quotes for strings (consistent throughout)
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- `noFallthroughCasesInSwitch`: enabled
- `forceConsistentCasingInFileNames`: enabled
- `noUnusedLocals` and `noUnusedParameters`: disabled (not enforced)
- Grouped in order:
## Path Aliases
- `@/` maps to `src/` in both `vite.config.ts` and `tsconfig.json`
- `fs` module aliased to `src/utils/fs-stub.ts` (browser-safe stub for gray-matter)
## Error Handling
- Try-catch blocks with error extraction and user-facing toast notifications
- Pattern: `catch (err) { toast(err instanceof Error ? err.message : "Failed to...", "error") }`
- Example from `App.tsx`:
- Promise `.catch()` chains for non-blocking operations:
- Safe wrappers for potentially failing operations (e.g., `safeExists()` in `file-scanner.ts`):
- Zod schema validation before disk writes in `file-writer.ts`:
- Atomic file writes with temp file + rename pattern:
## Logging
- `console.warn()` for non-fatal issues (e.g., unresolved skill IDs in `OrgNode.tsx`):
- `console.error()` not explicitly found but implied in error contexts
- Info/debug logging: minimal — no explicit logging framework
## Comments
- Complex logic requiring context (e.g., explaining team/sub-agent classification in `OrgNode.tsx`)
- Non-obvious algorithms (e.g., djb2 hash for node IDs in `paths.ts`)
- Workarounds and constraints (e.g., gray-matter import comment in `vite.config.ts`)
- Used for public exported functions with clear parameter/return documentation
- Example from `agent-parser.ts`:
- Not consistently applied to all functions; typically used for service layer and utility functions
- Type descriptions embedded in comments for clarity on complex patterns (e.g., "gray-matter is used browser-side with a Vite alias")
## Function Design
- Utility functions are compact (10-40 lines), service functions moderate (30-80 lines)
- React components can be larger (SettingsPanel: 1087 lines, but structured with sections)
- Store actions are inline within Zustand `create()` callbacks
- Explicit typed parameters required (TypeScript strict mode)
- Optional parameters use `?` syntax (e.g., `content?: string`)
- Configuration objects passed as single parameter when multiple options exist
- Example: `loadProject(path: string)`, `parseAgentFile(filePath: string, content?: string)`
- Async operations return `Promise<T>` explicitly typed
- Success path returns data; errors throw exceptions (caught by caller)
- Validation functions return objects with `{ success, errors, data? }` pattern for fine-grained error info
- No null returns in most service functions; favor exceptions or empty defaults
## Module Design
- Service modules export primarily async functions: `parseAgentFile()`, `writeNodeFile()`, `loadProject()`
- Type modules export `interface`, `type`, and Zod schemas side-by-side
- Store modules export singleton instances: `useTreeStore`, `useUiStore` (Zustand stores)
- Component modules export default or named React components
- Not used; imports are direct from source files (`@/services/file-scanner`, `@/types/aui-node`)
- Index files exist but organize re-exports minimally
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React 19 frontend (Vite bundled) with dual Zustand stores as the source of truth
- Rust Tauri v2 backend handling OS-level operations, file watching, scheduling, and remote access
- Event-driven sync between frontend and backend
- Disk-based persistence: node tree stored as individual markdown files in `.claude/` directory
- Canvas-driven org chart visualization with hierarchical tree navigation
- Remote access via local HTTPS server or cloud relay with E2E encryption
## Layers
- Purpose: Render interactive UI for org chart editing, inspection, and deployment
- Location: `src/components/`
- Contains: Canvas rendering, form editors, dialogs, panels, common UI elements
- Depends on: UI store (selection, dialogs), tree store (node data), Zustand for state
- Used by: Main App component (`src/App.tsx`)
- Purpose: Centralize all application state and provide actions to modify it
- Location: `src/store/tree-store.ts`, `src/store/ui-store.ts`
- Contains: Tree nodes, layouts, clipboard, UI state, remote config, relay connection state
- Depends on: Services layer (file I/O, parsing, scheduling)
- Used by: All components via Zustand hooks
- Purpose: Handle file I/O, parsing, validation, scheduling, and external integrations
- Location: `src/services/`
- Contains: File scanning, parsing, writing, watching, layout persistence, scheduling, remote sync
- Depends on: Tauri APIs, external libraries (gray-matter, dagre)
- Used by: Store actions and components
- Purpose: Execute OS-level operations unsafe to run in JavaScript
- Location: `src-tauri/src/lib.rs`, `src-tauri/src/remote/`
- Contains: Task scheduling (Windows schtasks, Unix crontab), terminal spawning, HTTPS server, WebSocket bridge, cloud relay client
- Depends on: Tauri runtime, tokio async runtime
- Used by: Frontend via `invoke()` Tauri commands and event listeners
- Purpose: Provide cloud-based NAT traversal for remote access without port forwarding
- Location: `relay/src/`
- Contains: WebSocket room management, pairing, rate limiting, device registry
- Depends on: tokio, Axum web framework
- Used by: Desktop app in persistent relay mode
## Data Flow
- Tree store is source of truth for nodes, layouts, skill cache
- UI store is source of truth for selection, panels, dialogs, search, remote config
- Both stores persist to disk asynchronously (`.aui/tree.json`, `.aui/remote.json`)
- Remote sync (`remoteSync()`) subscribes to both store changes
- On change: serializes nodes → redacts secrets → encrypts → broadcasts to connected clients
- Remote clients send commands → decoded → validated → applied to store
## Key Abstractions
- Purpose: Unified representation of everything on the canvas
- Examples: Agent (real .md file), Skill (real .md file), Group (virtual, tree metadata), Pipeline (virtual, tree metadata), Note (sticky notes), Context (CLAUDE.md files)
- Pattern: Discriminated union via `kind` field; kind determines which config type is valid
- Purpose: Hierarchical organization with virtual groups and pipelines
- Pattern: Map of all nodes with parentId pointers; metadata maintains `hierarchy` object for fast parent lookups; tree-store actions handle reparenting, clipboard, duplication
- Purpose: Save/restore multiple views of same project
- Pattern: Each layout contains tree metadata (positions, hierarchy, groups); persisted as separate JSON files in `.aui/layouts/`
- Purpose: Capture all virtual structure (groups, pipelines, positions) independent of disk files
- Contains: Owner info, hierarchy map, node positions, group definitions, skill name cache
- Persisted to `.aui/tree.json` on save
- Purpose: Protocol for desktop-to-client and client-to-desktop commands
- Pattern: Discriminated union via `type` field; payload varies (updateNode, reparentNode, deleteNode, etc.)
- Redaction: Variables with sensitive types masked to prevent leaking secrets
- Purpose: E2E encryption for relay mode
- Pattern: NaCl box (X25519 + XSalsa20-Poly1305); role-prefixed nonces to prevent collisions; desktop = 0x01, mobile = 0x02
## Entry Points
- Location: `src/main.tsx` → renders React into DOM
- Triggers: Application start
- Responsibilities: Initialize React root, mount App component
- Location: `src/App.tsx`
- Triggers: Rendered by React
- Responsibilities: Load project on mount, set up file watcher, render layout (toolbar, tree canvas, inspector, dialogs), handle global keyboard shortcuts
- Location: `src-tauri/src/main.rs`
- Triggers: Application startup (desktop only)
- Responsibilities: Initialize Tauri window, register command handlers
- Location: `src-tauri/src/remote/server.rs::start_server()`
- Triggers: User enables remote in settings → `connectRemote()` calls `invoke("start_remote_server")`
- Responsibilities: Start HTTPS listener, accept WebSocket connections, handle auth, dispatch commands
- Location: `relay/src/main.rs`
- Triggers: Deployment as separate service
- Responsibilities: WebSocket listener, room management, device pairing, message relay
## Error Handling
- Parse errors: Invalid markdown files → validation errors array on node; node displays in canvas with error badge
- File write errors: Atomic writes (temp + rename) prevent partial updates; on failure, temp file cleaned up and error toasted
- Network errors: Remote disconnection → UI shows "disconnected" state; operations queued until reconnected
- Validation errors: Zod schemas validate on write; errors aggregated per field and displayed in inspector
- File watching: Errors caught and silently ignored (non-critical feature)
- Remote sync: Encryption/decryption errors logged but don't crash app
## Cross-Cutting Concerns
- Frontend: `console.log()` with `[ATM]` prefix (e.g., `"[ATM] Loading project from:"`)
- Backend: Uses Rust println! macros; no persistent logging
- Frontend: Zod schemas in `src/types/` define all config shapes
- On write: Schema validation before file write
- On parse: Validation errors collected and stored on node; surface in UI
- LAN mode: Token-based (single-use token per QR code scan)
- Relay mode: PIN-based pairing → persistent session tokens
- Backend manages sessions in-memory (lost on restart)
- Utility functions in `src/utils/paths.ts`: `join()`, `normalizePath()`, `getFileName()`, `generateNodeId()`
- Node IDs derived from file paths via hash to ensure consistency across reloads
- `src/utils/platform.ts`: `isWindows()` / `isMacOS()` via user agent
- Backend uses `#[cfg(target_os)]` conditional compilation for scheduler code
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
