# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

**Anthropic Claude API:**
- Service: Claude API (`https://api.anthropic.com/v1/messages`)
- What it's used for: AI-powered org chart generation, text/prompt generation, auto-suggestions
  - SDK/Client: Browser-side fetch (no official SDK, direct HTTP)
  - Auth: API key (`ANTHROPIC_API_KEY`) stored in `.aui/settings.json`
  - Implementation: `src/services/claude-api.ts`
  - Models: `claude-haiku-4-5-20251001` (default for quick operations), configurable per request
  - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`
  - Features: Text generation with system prompts, max token control, rate limit handling
  - Used by: Agent editor suggestions, org generation, Context Hub AI operations

## Data Storage

**File-based (Primary):**
- `.claude/` directory - Agent and skill markdown files with YAML frontmatter
- `.aui/tree.json` - Tree metadata (hierarchy, node positions, virtual groups)
- `.aui/layouts/` - Named layout definitions (individual JSON files + index)
- `.aui/settings.json` - Project settings including API key (plaintext)

**In-Memory State:**
- Zustand stores (`tree-store.ts`, `ui-store.ts`) hold runtime state
- No persistent database backend detected (file-based only)

**Cloud Relay (Optional):**
- SQLite database (relay service only, in `relay/` directory)
- Location: Relay server's persistent storage
- Purpose: Room codes, device pairings, session management

**File Storage:**
- Local filesystem only (no cloud storage service like S3)
- File access via Tauri plugin: `@tauri-apps/plugin-fs`
- Terminal/scripts written to temporary locations on disk

**Caching:**
- None detected (file system provides natural caching)

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no third-party OAuth/SAML)
- PIN-based pairing for remote access (mobile client)
- Implementation: `src-tauri/src/remote/auth.rs`

**Method:**
- Desktop generates PIN code for mobile clients to pair
- End-to-end encryption via X25519 key exchange + XSalsa20-Poly1305
- Persistent device pairing stored in `.aui/` metadata

**Secrets Handling:**
- API key stored plaintext in `.aui/settings.json` (project-scoped)
- Sensitive variable values redacted during remote sync (`remote-sync.ts` redactNode)
- Cloud relay never sees plaintext (crypto session encrypts before relay)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, LogRocket, or similar)

**Logs:**
- Tauri plugin-log (v2) for backend logging
- Browser console for frontend logging
- No centralized log aggregation detected

**Platform Logging:**
- Windows: Scheduled task logging via schtasks.exe
- macOS/Linux: Cron job logs (system default)

## CI/CD & Deployment

**Hosting:**
- Desktop app: Standalone Tauri binaries (users download and install locally)
- Remote access: Local HTTPS server runs on user's machine on configurable port (default localhost)

**Cloud Relay (Optional):**
- User can deploy relay server to any infrastructure (AWS, DigitalOcean, etc.)
- No pre-built relay service provided by project
- Single relay instance can serve multiple desktop clients

**Build Pipeline:**
- No CI/CD detected (GitHub Actions, Travis, etc.)
- Manual build via `pnpm tauri build`
- Version maintained in: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

## Environment Configuration

**Required env vars:**
- No `.env` file required for runtime
- Build-time: `TAURI_DEV_HOST` (optional, for dev server HMR)

**Optional vars:**
- None detected at runtime

**Secrets location:**
- API key: `.aui/settings.json` (project directory, not in repo)
- No `.env` file convention used

**Per-Project Configuration:**
- Projects specify their own Claude API key
- Settings stored in project's `.aui/` directory (sibling to `.claude/`)

## Webhooks & Callbacks

**Incoming:**
- None detected (not a service that accepts webhooks)

**Outgoing:**
- None detected (no webhooks fired to external services)

**Local Server Endpoints (for remote access):**
- HTTPS server runs locally at user-configurable address
- WebSocket endpoint: `/api/ws` (local or cloud relay)
- QR code generation endpoint: `/api/qr` (local only)
- No webhook-style delivery to external systems

## Remote Access Architecture

**Direct Local Access:**
- HTTPS server with self-signed certificates runs on desktop machine
- Mobile clients (e.g., tablet, phone) connect directly to desktop IP
- Zero external dependencies for local network access
- Uses Tauri's local IP detection (`local-ip-address` crate)

**Cloud Relay (NAT Traversal):**
- Desktop connects to cloud relay via WebSocket
- Cloud relay is a simple message broker (does not store plaintext data)
- Mobile client connects to cloud relay using room code
- End-to-end encryption ensures relay cannot see tree data
- Implementation: `src-tauri/src/remote/relay_client.rs`
- Connection: `tokio-tungstenite` WebSocket client with TLS

**Pairing Flow:**
- Desktop generates PIN code visible in UI
- Mobile scans QR code (contains public key + PIN)
- PIN validated before crypto key exchange
- Devices exchange X25519 public keys
- All subsequent messages encrypted with shared key

## Security & Encryption

**TLS/HTTPS:**
- Local HTTPS server uses self-signed certificates
- Generated at runtime with rcgen 0.13
- Certificate fingerprint displayed in UI for manual verification

**End-to-End Encryption:**
- Algorithm: XSalsa20-Poly1305 (tweetnacl)
- Key exchange: X25519 (tweetnacl)
- Nonce strategy: Counter-based with role prefix (desktop 0x01, mobile 0x02)
- Prevents nonce reuse even if both sides start from 0

**Variable Redaction:**
- API keys, passwords flagged as sensitive in variable definitions
- Values redacted before sending over wire (local or relay)
- Frontend shows placeholder when viewing remote nodes

## Integration Points Summary

| Service | Purpose | Type | Required |
|---------|---------|------|----------|
| Anthropic Claude API | AI suggestions and org generation | REST API | No (optional) |
| Local filesystem | Project files and metadata | Native I/O | Yes |
| Cloud Relay | Remote mobile access with NAT | WebSocket | No (optional) |
| OS Scheduler | Run agent pipelines on schedule | Native API | Yes |
| Terminal/Shell | Execute agents and deploy | Native API | Yes |

---

*Integration audit: 2026-03-27*
