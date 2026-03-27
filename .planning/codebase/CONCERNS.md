# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**Monolithic Store File:**
- Issue: `tree-store.ts` is 2,767 lines, combining state management, file I/O, deployment logic, and data transformation in a single file
- Files: `src/store/tree-store.ts`
- Impact: Difficult to test individual features, high risk of regressions when making changes, poor code reusability
- Fix approach: Extract into focused modules (e.g., `services/tree-persistence.ts`, `services/team-deployment.ts`, `services/layout-management.ts`) with clear interfaces, then have the store coordinate these services

**Large Component Files:**
- Issue: Multiple UI components exceed 1,000 lines: `SettingsPanel.tsx` (1,087), `GroupEditor.tsx` (1,041), `MobileTreeView.tsx` (1,029), `ContextHub.tsx` (935)
- Files: `src/components/settings/SettingsPanel.tsx`, `src/components/inspector/GroupEditor.tsx`, `src/components/remote/MobileTreeView.tsx`, `src/components/context-hub/ContextHub.tsx`
- Impact: Hard to maintain, test, or refactor individual features within these panels; cognitive load for developers
- Fix approach: Extract sub-components for each logical section (e.g., `VariableEditor`, `TeamEditor`, `SkillAssignment` as separate files)

**Inconsistent Error Handling:**
- Issue: Frontend code has 55 console.log/warn/error statements scattered throughout; no structured error logging or telemetry
- Files: All `src/**/*.ts` and `src/**/*.tsx`
- Impact: Errors are not captured in production; debugging issues in the field is impossible
- Fix approach: Implement a centralized error logging service that publishes to a remote service or local log file, replace ad-hoc console calls

**Service Layer Missing Contracts:**
- Issue: Services like `agent-parser.ts`, `file-writer.ts`, `remote-sync.ts` lack error types and comprehensive error documentation
- Files: `src/services/*.ts`
- Impact: Callers don't know what exceptions to expect; easy to miss error cases in calling code
- Fix approach: Define error types for each service (e.g., `FileNotFoundError`, `ValidationError`, `SyncConflictError`) and document in JSDoc

## Known Bugs

**Nonce Reuse Risk in Crypto Session:**
- Symptoms: If a `CryptoSession` is long-lived and sends more than Number.MAX_SAFE_INTEGER messages (9e15), the sendNonce counter wraps and nonces are reused, breaking authenticated encryption
- Files: `src/services/remote-sync.ts` (lines 62-100), `src-tauri/src/remote/auth.rs`
- Trigger: Keep a remote session open and send billions of messages (unlikely in practice but theoretically possible in a long-running app)
- Workaround: Restart the app to reset the session. Better: Limit session lifetime to prevent counter wraparound

**Relay Server Hard-coded Message Size Limit:**
- Symptoms: If a remote client sends a WebSocket message larger than the configured `max_message_size`, the connection is closed without graceful error communication
- Files: `relay/src/ws.rs` (line 94)
- Trigger: A malformed or extremely large state sync message from a remote client
- Workaround: None; connection drops. Better: Send a detailed error message before closing

**Temporary File Cleanup Incomplete:**
- Symptoms: If `writeAgentFile()` or `writeSettingsFile()` fails during atomic rename, the `.tmp` file is cleaned up but exceptions from `remove()` are silently ignored, leaving orphaned files in rare edge cases
- Files: `src/services/file-writer.ts` (lines 31-39, 78-85)
- Trigger: File system permission errors or race conditions during concurrent writes
- Workaround: Manually clean up `.tmp` files in `.claude/` directories. Better: Log cleanup failures and implement a periodic cleanup routine

## Security Considerations

**Self-Signed Certificates Without Pinning:**
- Risk: Remote access uses self-signed TLS certificates generated per session. Mobile clients trust the certificate fingerprint from QR code, but there's no certificate pinning in the app, leaving HTTPS vulnerable to MITM if a client stores the fingerprint and later the cert changes
- Files: `src-tauri/src/remote/server.rs` (lines 59-83), `src/components/remote/RemoteSetup.tsx`
- Current mitigation: Certificates are generated fresh on each server start; fingerprint is displayed in QR code and manually verified by user
- Recommendations:
  1. Add certificate pinning: Store the server certificate public key hash and validate it on reconnection
  2. Generate a persistent certificate per project (or per machine) rather than per session, so users can trust long-term
  3. Add explicit certificate verification warnings to the mobile UI

**Sensitive Variable Values Stored Plaintext:**
- Risk: Agent/skill variables with type "api-key" or "password" are stored in plaintext in `.claude/` markdown files on disk. If the project directory is backed up or shared, secrets are exposed
- Files: `src/types/aui-node.ts` (variables array), `src/services/file-writer.ts`, `src/store/tree-store.ts`
- Current mitigation: Variables are redacted in remote responses (`types/remote.ts` redactNode function), but local files are unencrypted
- Recommendations:
  1. Store secrets in a separate encrypted vault file (e.g., `.aui/secrets.encrypted`) instead of in node markdown
  2. Implement key derivation from a master password and encrypt/decrypt on load
  3. Warn users when saving a project with unencrypted secrets

**Command Injection in Scheduler (Rust):**
- Risk: On Unix, the scheduler escapes single quotes in script paths but doesn't validate cron syntax deeply. A malformed cron expression could cause schtasks to misbehave or be misinterpreted
- Files: `src-tauri/src/lib.rs` (lines 103-138)
- Current mitigation: Null bytes are rejected, file extension is validated, dangerous characters (`&`, `|`, `` ` ``) are rejected
- Recommendations:
  1. Add strict cron syntax validation (validate each field is numeric or `*`/`?`)
  2. Use a dedicated cron parser library instead of manual string manipulation
  3. Test edge cases: extremely large hour/minute values, invalid day-of-month for certain months

**Relay Server Pairing Token Storage:**
- Risk: Cloud relay stores pairing tokens on disk in `config.data_dir`. If the relay server filesystem is compromised, attackers can forge pairings and access any paired desktop
- Files: `relay/src/pairing.rs` (line 263), `relay/src/main.rs` (line 55)
- Current mitigation: Tokens are hashed before storage, but hash algorithm and pepper are not specified
- Recommendations:
  1. Document the hashing algorithm used (likely SHA256, but not stated)
  2. Use a constant-time comparison function when validating token hashes
  3. Implement token rotation: expire old pairings after 90 days
  4. Add audit logging for pairing creation/revocation on the relay

## Performance Bottlenecks

**Full Tree Traversal on Every Node Change:**
- Problem: When a node is updated, the entire tree is re-serialized and synced to all remote clients. No diffing or delta updates
- Files: `src/services/remote-sync.ts` (lines 43-50), `src/store/tree-store.ts` (updateNode method)
- Cause: Remote sync publishes the entire serialized nodes array on every tree mutation
- Improvement path:
  1. Implement delta syncing: Only send changed node + parent chain
  2. Add a version field to each node and track client-side version to avoid unnecessary updates
  3. Batch updates: Defer sync for 100ms to combine multiple rapid changes into one message

**Large Layout Re-calculations:**
- Problem: When toggling collapsed groups or changing layout, `layoutNodes()` re-calculates positions for all nodes via dagre, even if only a few nodes changed
- Files: `src/components/tree/layout.ts`, `src/components/tree/TreeCanvas.tsx`
- Cause: No caching or incremental layout algorithm
- Improvement path:
  1. Cache layout results keyed by (collapsed groups, layout type)
  2. Implement incremental dagre updates: only re-layout the affected subtree
  3. Memoize component render to prevent React Flow from re-rendering unchanged nodes

**Parsing All Files on Project Load:**
- Problem: Loading a project with 100+ agents/skills requires parsing every `.md` file sequentially. No indexing or lazy loading
- Files: `src/services/file-scanner.ts`, `src/services/agent-parser.ts`, `src/store/tree-store.ts` (loadProject)
- Cause: File discovery and parsing are synchronous/blocking
- Improvement path:
  1. Implement lazy parsing: Load file metadata (name, ID) from a `.aui/index.json` cache, only parse full content when needed
  2. Parallel parsing: Use Promise.all() to parse multiple files concurrently
  3. Invalidate cache only when `.claude/` watch events fire

**Relay Server Message Broadcasting Without Rate Limiting:**
- Problem: When a desktop sends a message, it's broadcast to all waiting mobile clients without checking total message volume. If a desktop sends 1,000 large messages/second, the relay broadcasts them all, consuming bandwidth
- Files: `relay/src/ws.rs` (message forwarding logic), `relay/src/rate_limit.rs`
- Cause: Per-connection rate limiting exists but not for broadcast volume per room
- Improvement path:
  1. Add per-room rate limiting: Max messages/second that can be broadcast to waiting clients
  2. Implement message batching: Buffer incoming messages for 10ms before broadcasting
  3. Add backpressure: If a mobile client's receive queue is full, drop or buffer on the relay

## Fragile Areas

**Remote Sync Encryption Without Perfect Secrecy:**
- Files: `src/services/remote-sync.ts`, `src-tauri/src/remote/relay_client.rs`
- Why fragile:
  1. Nonce reuse bug (mentioned above) breaks encryption
  2. Handshake protocol assumes the relay can't see encrypted content, but if relay is modified, it could intercept and re-encrypt messages
  3. No session key refresh; key derivation is one-time per pairing
- Safe modification: Never change nonce generation or key derivation without a full security audit. Always have a security expert review crypto changes
- Test coverage: No unit tests for CryptoSession or message encryption/decryption
- Fix: Add unit tests that verify nonce uniqueness and proper decryption

**Tree Structure Sync with File System:**
- Files: `src/store/tree-store.ts` (syncFromDisk method), `src/services/file-watcher.ts`
- Why fragile:
  1. If a file is deleted externally while the desktop is running, syncFromDisk removes it from the tree, but open references (e.g., in inspector panel or clipboard) become stale
  2. If files are renamed externally, the mapping from node.sourcePath to node.id is broken
  3. Concurrent edits (user edits in UI, file changes on disk) can cause conflicts
- Safe modification: Never skip the `syncFromDisk` debounce; always validate node.sourcePath exists before reading. Test external file operations (delete, rename) while app is running
- Test coverage: No tests for file watcher + tree sync
- Fix: Add integration tests that simulate external file operations and verify tree consistency

**Relay Server Async Task Management:**
- Files: `relay/src/main.rs` (background cleanup task), `relay/src/ws.rs` (WebSocket task spawning)
- Why fragile:
  1. Background cleanup task runs every 30 seconds but doesn't hold locks; if cleanup runs while a connection is being added, the cleanup might remove a newly created room
  2. Tokio task panics are not caught; if a WebSocket handler panics, the connection is dropped without logging
  3. No graceful shutdown: When the relay binary exits, spawned tasks may not complete, leaving rooms in an inconsistent state
- Safe modification: Review all tokio::spawn calls for panic safety. Test graceful shutdown behavior
- Test coverage: No tests for concurrent connection management
- Fix: Add mutex protection around room cleanup, wrap task handlers in catch_unwind, implement shutdown hooks

## Scaling Limits

**In-Memory Relay Room Management:**
- Current capacity: RoomManager uses HashMap<String, Room> in memory; max_rooms is configured but defaults to 10,000
- Limit: If a relay serves 100 instances of ATM, each creating multiple rooms, you'll hit memory limits at ~100,000 rooms. Each room holds two DashMaps of client connections
- Scaling path:
  1. Implement room persistence: Periodically snapshot room state to RocksDB or SQLite, evict idle rooms from memory
  2. Shard rooms across multiple relay instances: Use consistent hashing to route room codes to specific relay servers
  3. Monitor room count and implement auto-eviction when threshold is reached

**Local Project File System Limits:**
- Current capacity: Tree loading is O(N) where N = number of agent/skill files. Parsing each file takes ~10ms. At 1,000 files, load time is ~10 seconds
- Limit: UI becomes unresponsive during load; no pagination or progressive rendering
- Scaling path:
  1. Implement pagination: Load 100 agents at a time, show "Load more" button
  2. Add search before load: Require a search term to narrow results before loading all agents
  3. Defer visualization: Load metadata only, render nodes in the tree, parse full content on click

**Remote WebSocket Connection Count:**
- Current capacity: Relay config default is `max_connections: 10000` per process
- Limit: Each connection holds a tokio task and memory for WebSocket buffers. At 10,000 connections with 10MB buffer each, you'd need ~100GB RAM
- Scaling path:
  1. Reduce buffer sizes: Use a ring buffer of fixed size instead of unbounded Vec
  2. Connection pooling: Reuse WebSocket tasks for multiple logical connections
  3. Load balancing: Run multiple relay instances behind a TCP load balancer

## Dependencies at Risk

**gray-matter (gray-matter v4.0.1):**
- Risk: gray-matter is used for YAML frontmatter parsing. It's a mature library but maintained by a single developer. No recent updates in the browser stub version
- Impact: If a YAML parsing bug is discovered, the app can't parse agent/skill files
- Migration plan:
  1. Evaluate alternatives: `js-yaml` + `Front Matter` or a Rust-based parser in Tauri backend
  2. Implement gradual migration: Parse YAML on the Rust backend instead, send pre-parsed JSON to frontend
  3. Add fallback: If YAML parsing fails, prompt user to fix the markdown manually

**tokio-tungstenite (WebSocket library):**
- Risk: Dependency tree has 20+ transitive dependencies; WebSocket protocol has a history of security issues
- Impact: Vulnerability in tungstenite or one of its deps could expose remote connections
- Migration plan:
  1. Monitor security advisories via dependabot
  2. Consider switching to axum's native WebSocket support for the Rust backend
  3. For the relay, evaluate hyper + tungstenite as a more modern stack

**Tauri v2 Plugin Ecosystem:**
- Risk: The `@tauri-apps/plugin-fs` API is relatively new; Tauri plugins have a history of breaking changes between minor versions
- Impact: A Tauri update could break file operations, scheduling, or remote access
- Migration plan:
  1. Pin Tauri and plugin versions strictly; test upgrades in a staging environment
  2. Implement abstraction layer: Wrap all Tauri plugin calls in a `platform-bridge` module so swapping implementations is easier
  3. Monitor Tauri releases and participate in community feedback

## Missing Critical Features

**No Conflict Resolution for External Edits:**
- Problem: If a user edits `agents/alice.md` externally while ATM is running, the file-watcher detects the change and calls `syncFromDisk`. But if the user also made changes in the ATM UI (in memory but not yet saved), those changes are lost. There's no merge or conflict detection
- Blocks: Users cannot reliably use external editors alongside ATM; collaborative editing is impossible
- Recommendation: Implement a three-way merge (user changes vs. disk changes vs. last-known-state) and prompt user to resolve conflicts

**No Audit Log:**
- Problem: There's no record of when nodes were created, modified, or deleted, who made the change (if multiple users), or what changed
- Blocks: Debugging issues, understanding history, revoking access in multi-user scenarios
- Recommendation: Add an audit log to `tree-store.ts` that records all mutations; persist to `.aui/audit.log`

**No Data Validation on Remote Writes:**
- Problem: When a remote client sends an `update_node` message, the tree-store accepts it directly without re-validating the node config
- Blocks: Malicious or buggy remote clients could corrupt the tree state
- Recommendation: Add validation middleware that checks all incoming remote commands against the same Zod schemas used for local edits

**No Graceful Degradation for Missing Files:**
- Problem: If a `.claude/agents/alice.md` file is deleted externally, the node remains in the tree with a stale sourcePath. Trying to edit or delete the node causes errors
- Blocks: Tree becomes inconsistent if files are deleted
- Recommendation: On tree save, validate that all sourcePaths exist; if not, prompt user to remove orphaned nodes

## Test Coverage Gaps

**No Tests for File Watcher + Tree Sync:**
- What's not tested: External file deletion, renaming, modification during app runtime
- Files: `src/services/file-watcher.ts`, `src/store/tree-store.ts` (syncFromDisk)
- Risk: Tree can become inconsistent with file system without detection
- Priority: High

**No Tests for Relay Pairing Protocol:**
- What's not tested: Desktop registration, mobile pairing, token expiry, concurrent pairing attempts
- Files: `relay/src/pairing.rs`, `relay/src/ws.rs`
- Risk: Pairing logic could have race conditions or validation gaps that allow unauthorized access
- Priority: High

**No Unit Tests for Crypto Session:**
- What's not tested: Nonce generation, encryption/decryption, key derivation, nonce reuse under load
- Files: `src/services/remote-sync.ts` (CryptoSession class)
- Risk: Encryption bugs go undetected; nonce reuse could break authentication
- Priority: Critical

**No Integration Tests for Tree Export/Import:**
- What's not tested: Round-trip JSON/ZIP export and import preserves all data correctly
- Files: `src/store/tree-store.ts` (exportTreeAsJson, importTreeFromJson, exportTreeAsZip, importTreeFromZip)
- Risk: Exported trees could be incomplete or corrupted; imported trees could lose data
- Priority: High

**No Tests for Scheduler Script Generation:**
- What's not tested: Generated PowerShell and bash scripts are syntactically valid and executable
- Files: `src/services/scheduler.ts`
- Risk: Generated scripts fail at runtime, deployment fails silently
- Priority: Medium

**No Tests for Relay Message Routing:**
- What's not tested: Messages from desktop correctly route to waiting mobiles and vice versa under concurrent load
- Files: `relay/src/ws.rs` (message forwarding loop)
- Risk: Messages could be dropped, duplicated, or routed to wrong clients
- Priority: High

---

*Concerns audit: 2026-03-27*
