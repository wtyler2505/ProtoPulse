# Arduino IDE Integration Spec for ProtoPulse

**Status:** Draft for implementation planning only  
**Date:** February 28, 2026  
**Owner:** ProtoPulse Engineering

## 1. Summary
ProtoPulse will add a first-class **Arduino Workbench** that brings Arduino IDE 2.x capabilities into the existing browser workspace. The integration will be project-scoped, API-driven, and compatible with the current React/Express/Drizzle architecture.

The goal is not to embed the official Electron app, but to provide equivalent workflows (editor, board/library management, build/upload, serial tools, diagnostics, cloud sync hooks, and extension-ready architecture) through ProtoPulse.

## 2. Product Goals
1. Let engineers write, build, upload, and monitor Arduino firmware inside the same ProtoPulse project workflow.
2. Preserve Arduino CLI compatibility and reproducibility with explicit board/core/library versions.
3. Provide an IDE-grade experience: command palette, navigation, diagnostics, split editor, and serial tools.
4. Keep architecture safe and scalable for concurrent sessions and long-running compile/upload operations.

## 3. Non-Goals (Initial Delivery)
1. Embedding full Arduino IDE Electron/Theia runtime in-app.
2. Full remote debugging parity for every board/debug probe on day one.
3. Arbitrary VSIX execution from untrusted sources (security risk).
4. Complete Arduino Cloud account management in v1 (only scoped sync endpoints and link status).

## 4. User Personas
1. **Hardware Engineer:** writes sketches, compiles often, checks serial monitor/plotter.
2. **Firmware Engineer:** needs IntelliSense/navigation, build profiles, and deterministic dependencies.
3. **Lab Technician:** selects board/port, uploads firmware, runs serial diagnostics.

## 5. Feature Mapping (Arduino IDE 2.x -> ProtoPulse)
| Arduino IDE capability | ProtoPulse target | Delivery phase |
|---|---|---|
| Command palette | Unified command palette in Arduino Workbench + global shortcuts | P1 |
| Themes/high contrast | Use existing theme system + Arduino panel-level overrides | P1 |
| Split editor | Horizontal/vertical split Monaco editors | P2 |
| Localization | i18n-ready strings; start English-first | P3 |
| IntelliSense (clangd) | Language server bridge (clangd + compile_commands) | P2 |
| Go to def/peek/references | Monaco language features over LSP | P2 |
| Live linting | Diagnostics pipeline from clangd + arduino-cli preflight | P2 |
| Auto-formatting | clang-format endpoint + editor action | P2 |
| Board auto-discovery | Poll-based board/port discovery API | P1 |
| Boards manager | Search/install/update board cores UI | P1 |
| Library manager | Search/install/list/update libraries UI | P1 |
| Build profiles | Per-project build profile entities | P2 |
| Hierarchical sketchbook | Project sketch tree with nested folders | P1 |
| Debugger | Debug session API + supported-board gating | P3 |
| Verbose build/upload logs | Toggleable verbose modes in compile/upload requests | P1 |
| Serial monitor | Dockable monitor panel with history/timestamp/copy | P1 |
| Serial plotter | Multi-channel real-time plotter panel | P2 |
| Arduino Cloud sketchbook | Link + pull/push sketch endpoints | P3 |
| Firmware updater | Guided board-module firmware jobs | P3 |
| SSL certificate uploader | Certificate upload workflow for supported boards | P3 |
| Plugin ecosystem | Controlled extension points (internal provider model) | P4 |

## 6. Functional Requirements

### 6.1 Workspace & Editor
1. Add new view mode: `arduino`.
2. Provide file tree for `.ino`, `.h`, `.hpp`, `.c`, `.cpp`, `.json`, and config files.
3. Provide editor tabs, dirty indicators, save-all, and split view.
4. Command palette commands include: compile, upload, monitor, board select, port select, library search/install, format, toggle verbose logs.

### 6.2 Board & Library Management
1. List detected boards/ports with refresh support.
2. Install/update board platforms (AVR, SAMD, ESP32, RP2040 initially).
3. Search/install/uninstall libraries with dependency awareness.

### 6.3 Build & Upload
1. Compile sketch with selected board profile.
2. Upload compiled sketch to selected port.
3. Show structured logs and result states (`queued`, `running`, `success`, `failed`, `canceled`).
4. Support verbose compile/upload options.

### 6.4 Serial Tooling
1. Dockable Serial Monitor with timestamp toggle, command history, and output copy.
2. Baud rates up to 2,000,000.
3. Serial Plotter for delimited numeric streams (single and multi-channel).

### 6.5 Diagnostics & Debugging
1. Preserve full compile/upload output and metadata for troubleshooting.
2. Debug actions gated by board/debugger support matrix.

## 7. Non-Functional Requirements
1. **Security:** no shell injection, strict command allowlist, per-project workspace isolation.
2. **Performance:** compile/upload jobs async with streaming logs; UI must remain responsive.
3. **Reliability:** recover from CLI crashes; stale port/session cleanup.
4. **Auditability:** persist job logs and operation metadata.
5. **Accessibility:** keyboard-first operation and WCAG-compliant command palette/panels.

## 8. Proposed Architecture

## 8.1 High-Level Components
1. **Frontend (React):** `ArduinoWorkbenchView`, `CodeEditorPanel`, `BoardLibraryPanel`, `SerialDock`, `BuildConsole`, `CommandPalette`.
2. **Backend (Express):** `server/arduino-routes.ts` + `server/arduino-service.ts` (process orchestration).
3. **Persistence (Drizzle):** project-scoped Arduino workspace/profile/job/session tables.
4. **Execution Layer:** hardened wrapper over `arduino-cli` plus serial monitor/plotter streams.

## 8.2 Integration with Current ProtoPulse
1. Add `arduino` to `ViewMode` and workspace tabs.
2. Add new domain context: `arduino-context.tsx` (React Query + mutations).
3. Register Arduino routes in existing server route registration.
4. Keep existing auth/session middleware and `projectId` scoping.

## 9. Proposed Data Model (Drizzle)

### 9.1 `arduino_workspaces`
- `id`, `projectId`, `rootPath`, `activeSketchPath`, `createdAt`, `updatedAt`

### 9.2 `arduino_build_profiles`
- `id`, `projectId`, `name`, `fqbn`, `port`, `boardOptions` (jsonb), `libOverrides` (jsonb), `verboseCompile`, `verboseUpload`, `isDefault`, timestamps

### 9.3 `arduino_jobs`
- `id`, `projectId`, `profileId`, `jobType` (`compile|upload|firmware|cert_upload|debug`), `status`, `command`, `args` (jsonb), `startedAt`, `finishedAt`, `exitCode`, `summary`, `log` (text/jsonb)

### 9.4 `arduino_serial_sessions`
- `id`, `projectId`, `port`, `baudRate`, `status`, `startedAt`, `endedAt`, `settings` (jsonb)

### 9.5 `arduino_sketch_files`
- `id`, `projectId`, `relativePath`, `content`, `language`, `updatedAt`

Note: caches for board/library index can remain in memory initially, then move to DB if needed.

## 10. API Contract Draft
All endpoints are project-scoped under `/api/projects/:id/arduino`.

### 10.1 Workspace
1. `GET /workspace` -> workspace metadata + file tree + active profile.
2. `PUT /workspace/files` -> create/update file.
3. `DELETE /workspace/files` -> remove file.
4. `POST /workspace/format` -> formatted source.

### 10.2 Boards & Libraries
1. `GET /boards/discover`
2. `GET /boards/platforms`
3. `POST /boards/platforms/install`
4. `GET /libraries`
5. `POST /libraries/install`
6. `DELETE /libraries/:name`

### 10.3 Build & Upload
1. `POST /jobs/compile`
2. `POST /jobs/upload`
3. `GET /jobs/:jobId`
4. `GET /jobs/:jobId/logs` (SSE or chunked polling)
5. `POST /jobs/:jobId/cancel`

### 10.4 Profiles
1. `GET /profiles`
2. `POST /profiles`
3. `PATCH /profiles/:profileId`
4. `DELETE /profiles/:profileId`

### 10.5 Serial
1. `POST /serial/open`
2. `POST /serial/write`
3. `POST /serial/close`
4. `GET /serial/stream` (SSE/WebSocket)

### 10.6 Cloud & Maintenance (Phased)
1. `GET /cloud/status`
2. `POST /cloud/pull`
3. `POST /cloud/push`
4. `POST /firmware/update`
5. `POST /certificates/upload`

## 11. Security Model
1. Enforce strict validation with Zod for all payloads.
2. Allowlist supported `arduino-cli` subcommands and argument patterns.
3. Never execute raw client-supplied shell commands.
4. Scope every mutation by authenticated `projectId`.
5. Redact secrets/tokens in logs.

## 12. Performance & Scalability
1. Run compile/upload jobs async via worker queue abstraction (in-process queue first).
2. Stream logs incrementally to reduce memory spikes.
3. Apply pagination/retention for historical job logs.
4. Cache board and library indexes with TTL.

## 13. Testing Strategy
1. **Unit tests:** command builder, validators, job lifecycle state machine.
2. **Integration tests:** API routes with mocked CLI adapters.
3. **E2E tests:** workspace file edit -> compile -> upload (mock hardware).
4. **Hardware-in-loop tests (optional env):** real board discovery/upload/serial smoke tests.

## 14. Observability
1. Structured log events: `arduino_job_started`, `arduino_job_finished`, `arduino_serial_opened`, `arduino_serial_error`.
2. Metrics: compile duration p50/p95, upload success rate, board detection latency, serial reconnect count.
3. Error taxonomy: validation errors, CLI errors, device errors, permission errors.

## 15. Rollout Strategy
1. Ship behind feature flag: `feature_arduino_workbench`.
2. Enable in dev/internal projects first.
3. Gradual enablement by project/user cohort.
4. Keep kill switch at server route guard + client tab visibility.

## 16. Acceptance Criteria (Definition of Done)
1. Users can open Arduino Workbench and edit sketch files.
2. Users can detect/select board and port.
3. Users can compile and upload with visible logs.
4. Users can open Serial Monitor and exchange data.
5. Build profiles persist and can be selected per project.
6. Tests pass for new API/contexts and no regressions in existing views.

## 17. Risks & Mitigations
1. **CLI runtime dependency issues:** preflight health endpoint + actionable errors.
2. **Serial port contention:** single-owner session model and forced-close endpoint.
3. **Long-running compile jobs:** async queue + cancellation + timeouts.
4. **Security risk from extension execution:** defer untrusted VSIX execution; use vetted extension points.

## 18. Open Questions
1. Should sketch files live fully in DB, filesystem, or hybrid cache?
2. Do we require multi-user locking for same project workspace edits?
3. Should serial stream use SSE or WebSocket as default transport?
4. Which boards are officially supported in GA vs experimental?
5. What subset of Arduino Cloud integration is mandatory for first public release?
