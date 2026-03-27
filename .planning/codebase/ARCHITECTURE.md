# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** Two-layer client-server architecture with reactive state management

**Key Characteristics:**
- React 19 frontend (Vite bundled) with dual Zustand stores as the source of truth
- Rust Tauri v2 backend handling OS-level operations, file watching, scheduling, and remote access
- Event-driven sync between frontend and backend
- Disk-based persistence: node tree stored as individual markdown files in `.claude/` directory
- Canvas-driven org chart visualization with hierarchical tree navigation
- Remote access via local HTTPS server or cloud relay with E2E encryption

## Layers

**Frontend Presentation (React Components):**
- Purpose: Render interactive UI for org chart editing, inspection, and deployment
- Location: `src/components/`
- Contains: Canvas rendering, form editors, dialogs, panels, common UI elements
- Depends on: UI store (selection, dialogs), tree store (node data), Zustand for state
- Used by: Main App component (`src/App.tsx`)

**State Management Layer (Zustand Stores):**
- Purpose: Centralize all application state and provide actions to modify it
- Location: `src/store/tree-store.ts`, `src/store/ui-store.ts`
- Contains: Tree nodes, layouts, clipboard, UI state, remote config, relay connection state
- Depends on: Services layer (file I/O, parsing, scheduling)
- Used by: All components via Zustand hooks

**Services Layer (Business Logic):**
- Purpose: Handle file I/O, parsing, validation, scheduling, and external integrations
- Location: `src/services/`
- Contains: File scanning, parsing, writing, watching, layout persistence, scheduling, remote sync
- Depends on: Tauri APIs, external libraries (gray-matter, dagre)
- Used by: Store actions and components

**Backend/Rust (Tauri Commands & Remote Access):**
- Purpose: Execute OS-level operations unsafe to run in JavaScript
- Location: `src-tauri/src/lib.rs`, `src-tauri/src/remote/`
- Contains: Task scheduling (Windows schtasks, Unix crontab), terminal spawning, HTTPS server, WebSocket bridge, cloud relay client
- Depends on: Tauri runtime, tokio async runtime
- Used by: Frontend via `invoke()` Tauri commands and event listeners

**Cloud Relay (Optional Deployment):**
- Purpose: Provide cloud-based NAT traversal for remote access without port forwarding
- Location: `relay/src/`
- Contains: WebSocket room management, pairing, rate limiting, device registry
- Depends on: tokio, Axum web framework
- Used by: Desktop app in persistent relay mode

## Data Flow

**Load Project:**

1. App mount → `loadProject(projectPath)` in tree-store
2. `scanProject()` discovers all files in `.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `.claude/settings`
3. Parsers extract node data:
   - `parseAgentFile()` reads markdown + gray-matter YAML → AuiNode
   - `parseSkillFile()` reads skill markdown → AuiNode
   - `parseSettingsFile()` reads JSON → AuiNode
4. Tree metadata loaded from `.aui/tree.json` (hierarchy, positions, groups)
5. Nodes added to `Map<string, AuiNode>` in tree-store
6. TreeCanvas renders via React Flow with dagre layout

**Edit Node:**

1. User edits in inspector panel (AgentEditor, SkillEditor, etc.)
2. Component calls `updateNode(id, updates)`
3. Store updates in-memory node and metadata
4. `useAutosave` hook debounces and calls `saveNode(id)`
5. `writeNodeFile()` validates via Zod and writes atomic update to disk (temp file + rename)

**Deploy Team:**

1. User selects group node and clicks "Deploy Team"
2. `exportTeamAsSkill(teamId)` generates skill markdown from team hierarchy
3. `scheduler.ts` creates deployment primer script (bash/PowerShell)
4. Script saved to `.aui/schedules/`
5. If scheduled: `create_scheduled_task()` Tauri command registers OS task (Windows schtasks or Unix crontab)
6. On trigger: OS launches primer script → spawns `open_terminal` command → deployment executes

**Sync External Changes:**

1. `file-watcher.ts` watches `.claude/` directory via Tauri `watch()` plugin
2. File change event → debounced callback with changed file paths
3. `syncFromDisk()` re-parses affected files and updates store
4. New nodes added, existing nodes updated
5. Canvas re-renders with updated state

**Remote Access (LAN Mode):**

1. User enables remote in settings → `connectRemote()`
2. Rust backend `start_server()` starts HTTPS server on configured port (default 5175)
3. Self-signed cert generated on first run
4. Mobile client connects via QR code scan
5. Client authenticates with token → gets session
6. Desktop → mobile: desktop WebSocket sends tree updates (redacted for security)
7. Mobile → desktop: sends commands (if allowEdits=true) via WebSocket
8. Both sync via `CryptoSession` with NaCl E2E encryption in relay mode

**Remote Access (Cloud Relay Mode):**

1. Desktop connects to cloud relay and registers persistent device
2. Desktop public key exchanged via relay
3. Mobile (or other client) requests pairing via relay
4. Once paired: relay acts as message broker
5. Messages encrypted E2E with `CryptoSession` (relay sees only ciphertext)
6. Desktop receives commands from relay → executes locally → sends response back

**State Management Flow:**

- Tree store is source of truth for nodes, layouts, skill cache
- UI store is source of truth for selection, panels, dialogs, search, remote config
- Both stores persist to disk asynchronously (`.aui/tree.json`, `.aui/remote.json`)
- Remote sync (`remoteSync()`) subscribes to both store changes
- On change: serializes nodes → redacts secrets → encrypts → broadcasts to connected clients
- Remote clients send commands → decoded → validated → applied to store

## Key Abstractions

**AuiNode:**
- Purpose: Unified representation of everything on the canvas
- Examples: Agent (real .md file), Skill (real .md file), Group (virtual, tree metadata), Pipeline (virtual, tree metadata), Note (sticky notes), Context (CLAUDE.md files)
- Pattern: Discriminated union via `kind` field; kind determines which config type is valid

**Node Tree:**
- Purpose: Hierarchical organization with virtual groups and pipelines
- Pattern: Map of all nodes with parentId pointers; metadata maintains `hierarchy` object for fast parent lookups; tree-store actions handle reparenting, clipboard, duplication

**Layouts:**
- Purpose: Save/restore multiple views of same project
- Pattern: Each layout contains tree metadata (positions, hierarchy, groups); persisted as separate JSON files in `.aui/layouts/`

**TreeMetadata:**
- Purpose: Capture all virtual structure (groups, pipelines, positions) independent of disk files
- Contains: Owner info, hierarchy map, node positions, group definitions, skill name cache
- Persisted to `.aui/tree.json` on save

**RemoteMessage:**
- Purpose: Protocol for desktop-to-client and client-to-desktop commands
- Pattern: Discriminated union via `type` field; payload varies (updateNode, reparentNode, deleteNode, etc.)
- Redaction: Variables with sensitive types masked to prevent leaking secrets

**CryptoSession:**
- Purpose: E2E encryption for relay mode
- Pattern: NaCl box (X25519 + XSalsa20-Poly1305); role-prefixed nonces to prevent collisions; desktop = 0x01, mobile = 0x02

## Entry Points

**Desktop App Launch:**
- Location: `src/main.tsx` → renders React into DOM
- Triggers: Application start
- Responsibilities: Initialize React root, mount App component

**App Root Component:**
- Location: `src/App.tsx`
- Triggers: Rendered by React
- Responsibilities: Load project on mount, set up file watcher, render layout (toolbar, tree canvas, inspector, dialogs), handle global keyboard shortcuts

**Tauri Main Window:**
- Location: `src-tauri/src/main.rs`
- Triggers: Application startup (desktop only)
- Responsibilities: Initialize Tauri window, register command handlers

**Remote Server:**
- Location: `src-tauri/src/remote/server.rs::start_server()`
- Triggers: User enables remote in settings → `connectRemote()` calls `invoke("start_remote_server")`
- Responsibilities: Start HTTPS listener, accept WebSocket connections, handle auth, dispatch commands

**Cloud Relay:**
- Location: `relay/src/main.rs`
- Triggers: Deployment as separate service
- Responsibilities: WebSocket listener, room management, device pairing, message relay

## Error Handling

**Strategy:** Graceful degradation with user feedback

**Patterns:**
- Parse errors: Invalid markdown files → validation errors array on node; node displays in canvas with error badge
- File write errors: Atomic writes (temp + rename) prevent partial updates; on failure, temp file cleaned up and error toasted
- Network errors: Remote disconnection → UI shows "disconnected" state; operations queued until reconnected
- Validation errors: Zod schemas validate on write; errors aggregated per field and displayed in inspector
- File watching: Errors caught and silently ignored (non-critical feature)
- Remote sync: Encryption/decryption errors logged but don't crash app

## Cross-Cutting Concerns

**Logging:**
- Frontend: `console.log()` with `[ATM]` prefix (e.g., `"[ATM] Loading project from:"`)
- Backend: Uses Rust println! macros; no persistent logging

**Validation:**
- Frontend: Zod schemas in `src/types/` define all config shapes
- On write: Schema validation before file write
- On parse: Validation errors collected and stored on node; surface in UI

**Authentication:**
- LAN mode: Token-based (single-use token per QR code scan)
- Relay mode: PIN-based pairing → persistent session tokens
- Backend manages sessions in-memory (lost on restart)

**Path Handling:**
- Utility functions in `src/utils/paths.ts`: `join()`, `normalizePath()`, `getFileName()`, `generateNodeId()`
- Node IDs derived from file paths via hash to ensure consistency across reloads

**Platform Handling:**
- `src/utils/platform.ts`: `isWindows()` / `isMacOS()` via user agent
- Backend uses `#[cfg(target_os)]` conditional compilation for scheduler code
