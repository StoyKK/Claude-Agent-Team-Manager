# Technology Stack

**Analysis Date:** 2026-03-27

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend application code
- Rust 1.77.2 - Tauri backend and system integration

**Secondary:**
- JavaScript - Browser runtime for React/DOM
- YAML - Configuration and metadata files

## Runtime

**Environment:**
- Node.js 18+ (development)
- Tauri v2 (desktop application runtime)

**Package Manager:**
- pnpm 9+ (configured in `package.json`)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- React 19.2.4 - UI framework with JSX/TSX
- Tauri 2.10.0 - Desktop application framework (wraps Rust backend)
- Vite 7.3.1 - Frontend build tool and dev server

**UI & Visualization:**
- @xyflow/react 12.10.1 - React Flow for interactive node canvas (org chart)
- dagre 0.8.5 - Layout engine for graph visualization (auto-layout)
- @monaco-editor/react 4.7.0 - Code editor for viewing/editing agent/skill markdown

**State Management:**
- Zustand 5.0.11 - Lightweight state store (`tree-store.ts`, `ui-store.ts`)

**Serialization & Parsing:**
- gray-matter 4.0.3 - YAML frontmatter parser (browser-side for agent/skill files)
- yaml 2.8.2 - YAML parsing and generation
- zod 4.3.6 - Schema validation library

**Data & Compression:**
- fflate 0.8.2 - Compression library for export/import zip archives

**Cryptography:**
- tweetnacl 1.0.3 - NaCl cryptography (X25519 key exchange, XSalsa20-Poly1305)
- tweetnacl-util 0.15.1 - Encoding utilities for tweetnacl

**Testing:**
- No testing framework detected (no Jest, Vitest, or similar in dependencies)

**Build/Dev:**
- @tauri-apps/cli 2.10.0 - Tauri CLI for building and bundling
- @vitejs/plugin-react 5.1.4 - React support for Vite
- TypeScript compiler (tsc) - Type checking before build

## Key Dependencies

**Critical:**
- @tauri-apps/api 2.10.1 - Core Tauri API (invoke, events, app info)
- @tauri-apps/plugin-fs 2.4.5 - File system access
- @tauri-apps/plugin-shell 2.3.5 - Terminal spawning and script execution
- @tauri-apps/plugin-dialog 2.6.0 - Native file dialogs

**Infrastructure (Rust backend):**
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

**Cryptography (Rust):**
- sha2 0.10 - SHA-256 hashing for certificate fingerprints
- hex 0.4 - Hex encoding/decoding
- rand 0.9 - Randomness for nonce generation

**Utilities:**
- chrono 0.4 - Datetime handling (for relay)
- uuid 1 - UUID generation for pairing tokens
- serde_json 1.0 - JSON serialization (Rust)
- futures 0.3 - Async utilities for WebSocket handling

## Configuration

**Environment:**
- API key stored in `.aui/settings.json` within project directory (not `.env`)
- No `.env` file requirements detected
- Settings loaded per-project (not global)

**Build:**
- `vite.config.ts` - Vite bundler config with React plugin and path aliases
- `tsconfig.json` - TypeScript compiler options (ES2021 target, strict mode)
- `tsconfig.node.json` - TypeScript config for build-time scripts
- `src-tauri/tauri.conf.json` - Tauri app configuration (window size, resources, CSP)

**Tauri Plugins:**
- Log plugin v2 (built-in logging)
- Dialog plugin v2.6.0 (file dialogs)
- Filesystem plugin v2.4.5 (file I/O)
- Shell plugin v2.3.5 (terminal spawning)

## Platform Requirements

**Development:**
- macOS: `xcode-select --install` (for Rust compilation)
- All platforms: Rust stable toolchain
- Node.js 18+, pnpm 9+

**Production:**
- **Desktop target:** macOS (Intel/Apple Silicon), Windows, Linux
- **Minimum macOS:** 10.15 (Catalina)
- **Remote access:** Runs local HTTPS server with self-signed certificates
- **Cloud relay option:** Connects to external relay server via WebSocket (NAT traversal)

## Deployment

**Frontend Build:**
- `pnpm build` - TypeScript check + Vite production bundle → `dist/` directory
- Output: Minified React app, tree-shaken dependencies

**Desktop Build:**
- `pnpm tauri build` - Bundles frontend + Rust backend → platform-specific installer
- Outputs: `.dmg` (macOS), `.exe` (Windows), `.AppImage` (Linux)

**Relay Server:**
- Standalone binary in `relay/` directory
- Uses SQLite for persistence (local database)
- Listens on WebSocket for cloud relay clients

---

*Stack analysis: 2026-03-27*
