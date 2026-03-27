# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
/Users/stoyk/projects/atm/
├── src/                          # React frontend (TypeScript)
│   ├── App.tsx                   # Root app component, layout, global shortcuts
│   ├── main.tsx                  # React mount entry point
│   ├── types/                    # TypeScript interfaces and Zod schemas
│   ├── store/                    # Zustand stores (tree-store, ui-store)
│   ├── services/                 # Business logic layer (file I/O, parsing, etc.)
│   ├── components/               # React components organized by feature
│   ├── hooks/                    # Custom React hooks (useAutosave)
│   ├── utils/                    # Utility functions (paths, validation, platform)
│   └── vite-env.d.ts             # Vite type definitions
├── src-tauri/                    # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs               # Tauri window initialization
│   │   ├── lib.rs                # Tauri command handlers (scheduling, terminal, etc.)
│   │   └── remote/               # Remote access subsystem
│   │       ├── mod.rs            # Module exports
│   │       ├── server.rs         # HTTPS server, WebSocket listener
│   │       ├── ws.rs             # WebSocket message routing
│   │       ├── bridge.rs         # Desktop-to-client message dispatcher
│   │       ├── relay_client.rs   # Cloud relay connection manager
│   │       ├── auth.rs           # Session and token management
│   │       ├── qr.rs             # QR code generation
│   │       └── state.rs          # Remote config and app state
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Pre-build script for Tauri setup
│   ├── tauri.conf.json           # Tauri configuration
│   ├── Entitlements.plist        # macOS entitlements
│   └── icons/                    # App icons (multiple formats/sizes)
├── relay/                        # Cloud relay service (optional deployment)
│   ├── src/
│   │   ├── main.rs               # Axum web server, room/device management
│   │   ├── ws.rs                 # WebSocket upgrade handler
│   │   ├── room.rs               # Room state and message relay
│   │   ├── pairing.rs            # Device pairing and persistence
│   │   ├── rate_limit.rs         # Rate limiting middleware
│   │   ├── health.rs             # Health check endpoint
│   │   └── config.rs             # Configuration loading
│   ├── Cargo.toml                # Relay service dependencies
│   ├── relay-config.toml         # Relay configuration file
│   ├── Dockerfile                # Docker build for relay
│   └── deploy/                   # Systemd service, Caddy reverse proxy
├── docs/                         # Architecture documentation
│   ├── remote-access-architecture.md
│   └── remote-access-critique.md
├── .aui/                         # Project metadata (generated at runtime)
│   ├── tree.json                 # Node hierarchy, positions, groups
│   ├── remote.json               # Remote server configuration
│   ├── layouts/                  # Saved layout definitions
│   │   ├── index.json            # Layout index
│   │   └── {layoutId}.json       # Individual layout data
│   └── schedules/                # Generated deployment scripts
├── .claude/                      # Project structure (user-created/managed)
│   ├── agents/                   # Agent definitions (*.md)
│   ├── skills/                   # Skill definitions ({skillName}/SKILL.md)
│   ├── rules/                    # Context/rule files (*.md)
│   └── settings*.json            # Project settings (global config)
├── package.json                  # Node.js dependencies and scripts
├── pnpm-lock.yaml                # pnpm lockfile
├── tsconfig.json                 # TypeScript configuration (frontend)
├── tsconfig.node.json            # TypeScript configuration (build tools)
├── vite.config.ts                # Vite configuration
├── index.html                    # HTML entry point
├── CLAUDE.md                     # Project instructions
├── CHANGELOG.md                  # Release history
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # Project license
├── README.md                     # README
└── USAGE.md                      # Usage documentation
```

## Directory Purposes

**src/ (Frontend)**
- Purpose: All React application code
- Contains: Components, stores, services, types, utilities, hooks
- Key files: `App.tsx` (root), `main.tsx` (entry), `types/aui-node.ts` (core data model)

**src/components/ (UI Layer)**
- Purpose: React component hierarchy organized by feature
- Contains: Dumb and smart components
- Structure:
  - `tree/` — Canvas and node rendering (TreeCanvas, OrgNode, StickyNote, layout logic)
  - `inspector/` — Property editors (AgentEditor, SkillEditor, GroupEditor, etc.)
  - `common/` — Shared UI (Toolbar, ContextMenu, Toast, SearchBar, etc.)
  - `dialogs/` — Modal dialogs (CreateNodeDialog, DeleteConfirmDialog)
  - `context-hub/` — Cross-cutting view panel (ContextHub, FileViewer)
  - `remote/` — Remote access UI (MobileTreeView, QR display)
  - `schedule/` — OS task scheduling UI
  - `settings/` — App configuration UI
  - `setup/` — First-run setup wizard
  - `chat/` — Chat panel (disabled in current version)

**src/store/ (State Management)**
- Purpose: Zustand stores — single source of truth
- Key stores:
  - `tree-store.ts` — Node tree, layouts, clipboard, all tree actions (add/remove/reparent/deploy)
  - `ui-store.ts` — UI state (selection, panels, dialogs, toasts, remote config)

**src/services/ (Business Logic)**
- Purpose: Stateless functions for complex operations
- Key services:
  - `file-scanner.ts` — Discover agents, skills, settings, rules in `.claude/`
  - `agent-parser.ts` — Parse agent markdown → AuiNode
  - `skill-parser.ts` — Parse skill markdown → AuiNode
  - `settings-parser.ts` — Parse settings JSON → AuiNode
  - `file-writer.ts` — Atomic write node changes back to disk
  - `file-watcher.ts` — Watch `.claude/` for external file changes
  - `layout-service.ts` — Persist/load layouts from `.aui/layouts/`
  - `scheduler.ts` — Generate deploy scripts and OS scheduled tasks
  - `remote-sync.ts` — Serialize nodes, manage crypto sessions, remote command handling
  - `zip-service.ts` — Export/import org charts as compressed archives
  - `claude-api.ts` — Claude API integration for AI-powered org generation
  - `skill-scanner.ts` — Scan all skills for assignment UI

**src/types/ (Type Definitions)**
- Purpose: TypeScript interfaces and Zod schemas
- Key types:
  - `aui-node.ts` — `AuiNode`, `NodeKind`, `TreeMetadata`, `TreeExport`, `Layout`
  - `agent.ts` — `AgentConfig` schema
  - `skill.ts` — `SkillConfig` schema
  - `settings.ts` — `SettingsConfig` schema
  - `remote.ts` — `RemoteConfig`, `RemoteMessage`, `AuthSession`, `QrCodeData`, all remote types

**src/utils/ (Utilities)**
- Purpose: Helper functions used across layers
- Key utils:
  - `paths.ts` — `join()`, `normalizePath()`, `getFileName()`, `generateNodeId()`, `titleCase()`
  - `validation.ts` — Shared validation helpers
  - `platform.ts` — `isWindows()`, `isMacOS()` platform detection
  - `templates.ts` — Built-in markdown templates for agents, skills, groups
  - `grouping.ts` — Auto-group logic and team detection
  - `fs-stub.ts` — Stub for gray-matter's Node.js fs requirement (browser only)

**src/hooks/ (Custom Hooks)**
- Purpose: Reusable React hook logic
- Key hooks:
  - `useAutosave.ts` — Debounce node saves on inspector edits

**src-tauri/src/ (Backend)**
- Purpose: Rust backend for OS-level operations
- Key modules:
  - `lib.rs` — Tauri command handlers: `create_scheduled_task`, `open_terminal`, `fetch_url`, and remote server commands
  - `main.rs` — Tauri window setup and lifecycle
  - `remote/` — Complete remote access system

**src-tauri/src/remote/ (Remote Access)**
- Purpose: Local HTTPS server, WebSocket relay, cloud relay integration
- Key modules:
  - `server.rs` — Axum HTTPS server, REST endpoints (`/health`, `/api/auth/qr`, `/api/auth/token`)
  - `ws.rs` — WebSocket upgrade handler and message dispatcher
  - `relay_client.rs` — Cloud relay connection manager (connect, sync, pairing)
  - `bridge.rs` — Dispatch RemoteMessage commands to tree-store
  - `auth.rs` — Session token generation/validation, PIN verification
  - `qr.rs` — QR code data generation
  - `state.rs` — RemoteConfig, AppState, WsMessage types

**relay/ (Cloud Relay Service)**
- Purpose: Optional deployed service for NAT traversal
- Key modules:
  - `main.rs` — Axum web server, room manager, device registry
  - `ws.rs` — WebSocket upgrade
  - `room.rs` — Room state, message relay
  - `pairing.rs` — Device pairing, token persistence
  - `rate_limit.rs` — Rate limiting middleware
  - `health.rs` — Health check
  - `config.rs` — Configuration loading from relay-config.toml
- Deploy: `deploy/` contains systemd service and Caddy reverse proxy config

**.aui/ (Project Metadata)**
- Purpose: Persistent app state and layouts
- Generated at runtime:
  - `tree.json` — Hierarchy, positions, group definitions, owner info
  - `remote.json` — Remote server configuration
  - `layouts/` — Named layout snapshots
  - `schedules/` — Generated deployment scripts

**.claude/ (Project Structure)**
- Purpose: User-managed source files for agents, skills, settings
- Organization:
  - `agents/` — Agent markdown files (one file per agent)
  - `skills/{skillName}/SKILL.md` — Skill definitions (one directory per skill)
  - `settings.json`, `settings.local.json` — Global project configuration
  - `rules/` — Context/rule markdown files
- Scanned on project load; changes watched for external updates

## Key File Locations

**Entry Points:**
- `src/main.tsx` — React entry point (mounts App to DOM)
- `src/App.tsx` — Root app component (layout, initialization, file watching)
- `src-tauri/src/main.rs` — Tauri window initialization
- `relay/src/main.rs` — Cloud relay service (if deployed)

**Configuration:**
- `vite.config.ts` — Vite bundler config (includes `@/` alias, gray-matter fs stub)
- `tsconfig.json` — TypeScript frontend config (includes `@/` path mapping)
- `tsconfig.node.json` — TypeScript build tools config
- `src-tauri/Cargo.toml` — Rust dependencies
- `src-tauri/tauri.conf.json` — Tauri app configuration (window, capabilities, bundle)
- `relay/relay-config.toml` — Relay service configuration

**Core Logic:**
- `src/store/tree-store.ts` — All node tree operations
- `src/store/ui-store.ts` — UI state and remote config
- `src/services/file-scanner.ts` — Project file discovery
- `src/services/agent-parser.ts`, `skill-parser.ts` — Parse disk files
- `src/services/file-writer.ts` — Atomic write-back
- `src/services/file-watcher.ts` — Sync external changes
- `src/services/scheduler.ts` — OS task scheduling
- `src/services/remote-sync.ts` — Remote protocol and crypto

**Testing:**
- No tests committed (testing infrastructure not visible in initial commit)

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `TreeCanvas.tsx`, `OrgNode.tsx`)
- Services: camelCase with descriptive suffix (e.g., `file-scanner.ts`, `agent-parser.ts`)
- Types/Utils: camelCase (e.g., `paths.ts`, `validation.ts`)
- Stores: camelCase with `-store` suffix (e.g., `tree-store.ts`, `ui-store.ts`)
- Hooks: camelCase with `use` prefix (e.g., `useAutosave.ts`)
- Rust: snake_case (e.g., `relay_client.rs`, `auth.rs`)

**Directories:**
- Feature directories: lowercase plural (e.g., `components/`, `services/`, `types/`, `utils/`)
- Component groups: lowercase with hyphens (e.g., `components/tree/`, `components/context-hub/`)
- Backend modules: lowercase with underscores (e.g., `remote/`, `src-tauri/`)

## Where to Add New Code

**New Feature (e.g., "Add Timeline View"):**
- Component code: `src/components/{feature}/` (new directory with React components)
- Types: Add to `src/types/aui-node.ts` or create new schema in `src/types/{feature}.ts`
- Store actions: Add methods to `src/store/tree-store.ts` and/or `src/store/ui-store.ts`
- Services: Create `src/services/{feature}.ts` if complex logic needed
- Integration: Wire into `src/App.tsx` or parent component

**New Parser (e.g., "Add Template Parser"):**
- Service: `src/services/{type}-parser.ts` (follow pattern of `agent-parser.ts`, `skill-parser.ts`)
- Type: Define config schema in `src/types/{type}.ts` using Zod
- Scanner: Update `file-scanner.ts` to discover new file pattern
- Store: Add parse/load logic to `tree-store.ts::loadProject()` and `syncFromDisk()`

**New Tauri Command (e.g., "Add Git Integration"):**
- Backend: Add command function in `src-tauri/src/lib.rs`
- Frontend: Call via `invoke()` in a service function (e.g., `src/services/{feature}.ts`)
- Type: Export command result type from Rust if complex

**New Remote Feature (e.g., "Add Device Telemetry"):**
- Backend: Extend `src-tauri/src/remote/` (add new ws message type or REST endpoint)
- Frontend: Add message handler in `src/services/remote-sync.ts`
- Types: Define message type in `src/types/remote.ts`
- UI: Wire into remote component in `src/components/remote/`

## Special Directories

**src-tauri/capabilities/:**
- Purpose: Tauri capability definitions (fine-grained permissions)
- Generated: No (manually created)
- Committed: Yes
- File: `default.json` — Capability list for app

**src-tauri/icons/:**
- Purpose: App icons for all platforms
- Generated: No (manually created)
- Committed: Yes
- Formats: PNG, ICO (Windows), ICNS (macOS)

**.aui/ (Created at Runtime):**
- Purpose: Project metadata and layouts
- Generated: Yes (created automatically on first run and on save)
- Committed: No (gitignored)
- Contains: tree.json, remote.json, layouts/, schedules/

**.claude/ (User-Managed):**
- Purpose: Source files for agents and skills
- Generated: Partially (new files via create dialog or import)
- Committed: Varies (user's choice)
- Structure: Users create `.claude/agents/`, `.claude/skills/{name}/`, etc.

**relay/deploy/:**
- Purpose: Deployment configuration for cloud relay
- Generated: No (manually created)
- Committed: Yes
- Files: `atm-relay.service` (systemd), `Caddyfile` (reverse proxy)

---

*Structure analysis: 2026-03-27*
