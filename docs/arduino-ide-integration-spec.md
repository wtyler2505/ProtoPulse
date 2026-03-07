# Arduino IDE Integration Spec for ProtoPulse

**Status:** Draft for implementation planning only  
**Date:** February 28, 2026 (updated March 5, 2026)  
**Owner:** ProtoPulse Engineering

## 1. Summary
ProtoPulse will add a first-class **Arduino Workbench** that brings Arduino IDE 2.x workflows into the existing browser workspace.

The integration is intentionally **API-driven** and **project-scoped**. We are not embedding the Arduino IDE Electron app. We are implementing equivalent user flows (edit, board/library management, compile/upload, serial monitor, diagnostics) within ProtoPulse.

## 2. Product Goals
1. Let users write, build, upload, and monitor Arduino firmware without leaving ProtoPulse.
2. Preserve deterministic and reproducible builds by supporting `sketch.yaml` profiles and explicit core/library versions.
3. Match IDE-grade workflows: command palette integration, diagnostics, build logs, serial tools.
4. Keep server execution safe under concurrent sessions and long-running jobs.

## 3. Non-Goals (Initial Delivery)
1. Embedding full Arduino IDE Electron/Theia runtime.
2. Full debugger parity for every board/probe in v1.
3. Untrusted VSIX execution.
4. Full Arduino Cloud account management UI in v1.

## 4. Personas
1. **Hardware Engineer:** frequent compile/upload and serial monitoring.
2. **Firmware Engineer:** deterministic dependencies, diagnostics, navigation.
3. **Lab Technician:** board/port selection, upload, serial diagnostics.

## 5. Locked Decisions (No Longer Open)

### 5.1 Naming and Routing
1. Feature flag env key is **`FEATURE_ARDUINO_WORKBENCH`**.
2. API namespace is **`/api/projects/:id/arduino/*`**.
3. All project scoping uses route param name `:id`.

### 5.2 Job Lifecycle Vocabulary
Arduino job status enum is fixed to:
1. `pending`
2. `running`
3. `completed`
4. `failed`
5. `cancelled`

This aligns with the existing in-process job vocabulary already used in the server.

### 5.3 Command Palette and UX
1. Arduino commands are added to the **existing command palette (`Ctrl/Cmd+K`)**.
2. Optional alias shortcut (`Ctrl/Cmd+Shift+P`) may be added later, but is not required for v1.

### 5.4 Serial Transport
1. v1 server streaming transport is **SSE**.
2. WebSocket support is deferred unless SSE proves insufficient.

### 5.5 Sketch Storage Model
1. **Hybrid model** is required:
- Sketch source files live on a workspace filesystem root for Arduino CLI compatibility.
- Database stores metadata, job history, profile records, and serial session records.

### 5.6 Profile Source of Truth
1. `sketch.yaml` support is first-class.
2. ProtoPulse build profiles must map to `sketch.yaml` concepts and not create conflicting semantics.
3. Default compile/upload behavior should honor `default_profile` when present.

## 6. Functional Requirements

### 6.1 Workspace and Editor
1. Add new `ViewMode`: `arduino`.
2. Support file tree + editing for `.ino`, `.h`, `.hpp`, `.c`, `.cpp`, `.S`, `.json`, `.md`, `.yaml`.
3. Support tabbed editing, dirty indicators, save-all.
4. Command palette actions include compile/upload/monitor/board selection/port selection/library install/format/toggle verbose logs.

### 6.2 Board and Platform Management
1. Detect connected ports and board identity.
2. List/install/upgrade core platforms (initially: AVR, SAMD, ESP32, RP2040).
3. Support refresh and discovery polling.

### 6.3 Library Management
1. Search/install/uninstall libraries.
2. Show installed version and available latest version.
3. Support index refresh.

### 6.4 Build and Upload
1. Compile sketch using selected or default profile.
2. Upload to selected/default port.
3. Stream logs live to UI.
4. Persist final status and summary.
5. Support cancellation.

### 6.5 Serial Tooling
1. Dockable serial monitor with timestamp toggle.
2. Command history and copy output.
3. Baud rate support up to 2,000,000.
4. Delimiter and line-ending configuration.

### 6.6 Diagnostics
1. Preserve compile/upload log history with metadata.
2. Persist exit code and error category for troubleshooting.

## 7. Non-Functional Requirements
1. **Security:** strict allowlisted CLI commands and validated args only.
2. **Performance:** async jobs + streamed logs.
3. **Reliability:** recover from process crash and stale serial sessions.
4. **Auditability:** keep structured job/session records.
5. **Accessibility:** keyboard-first controls and WCAG-compliant panels.
6. **Payload limits:** enforce request/file size limits aligned with server middleware.
7. **Timeout policy:** enforce inactivity and absolute runtime limits for streams/jobs.
8. **Version control:** pin and validate supported `arduino-cli` version range.

## 8. Architecture

### 8.1 High-Level Components
1. Frontend: `ArduinoWorkbenchView`, `ArduinoEditorPanel`, `ArduinoBoardsPanel`, `ArduinoLibrariesPanel`, `ArduinoBuildConsole`, `ArduinoSerialDock`.
2. Backend: `server/routes/arduino.ts`, `server/arduino-service.ts`, `server/arduino-process-manager.ts`.
3. Storage: new Arduino tables in `shared/schema.ts` and new storage module under `server/storage/arduino.ts`.
4. Execution: hardened wrapper around `arduino-cli` + serial process handling.

### 8.2 Integration with Existing App
1. Extend `ViewMode` union and workspace tab mapping.
2. Add sidebar entry and lazy-loaded view.
3. Add `ArduinoProvider` context using React Query.
4. Register Arduino routes in `server/routes.ts`.
5. Reuse existing auth + project ownership middleware.

### 8.3 Job Execution Strategy
1. Arduino jobs are project-scoped and persisted in DB.
2. Runtime execution uses child processes managed by an in-process orchestrator.
3. Status values must match `pending/running/completed/failed/cancelled`.
4. Log stream is emitted over SSE.
5. Upload jobs must be serialized per `projectId+port` to avoid hardware contention.

## 9. Data Model (Drizzle)

### 9.1 `arduino_workspaces`
1. `id`
2. `projectId`
3. `rootPath`
4. `activeSketchPath`
5. `createdAt`
6. `updatedAt`

### 9.2 `arduino_build_profiles`
1. `id`
2. `projectId`
3. `name`
4. `profileName` (maps to `sketch.yaml` profile key when applicable)
5. `fqbn`
6. `port`
7. `protocol`
8. `boardOptions` (jsonb)
9. `portConfig` (jsonb)
10. `libOverrides` (jsonb)
11. `verboseCompile`
12. `verboseUpload`
13. `isDefault`
14. timestamps

### 9.3 `arduino_jobs`
1. `id`
2. `projectId`
3. `profileId` (nullable for some maintenance jobs)
4. `jobType` (`compile|upload|platform_install|library_install|library_uninstall|firmware|cert_upload`)
5. `status` (`pending|running|completed|failed|cancelled`)
6. `command` (allowlisted command key)
7. `args` (jsonb)
8. `startedAt`
9. `finishedAt`
10. `exitCode`
11. `summary`
12. `errorCode` (nullable)
13. `log` (text)

### 9.4 `arduino_serial_sessions`
1. `id`
2. `projectId`
3. `port`
4. `protocol`
5. `baudRate`
6. `status` (`open|closed|error`)
7. `startedAt`
8. `endedAt`
9. `settings` (jsonb)

### 9.5 `arduino_sketch_files` (Metadata Only)
1. `id`
2. `projectId`
3. `relativePath`
4. `language`
5. `sizeBytes`
6. `updatedAt`

Note: file contents remain on disk; DB stores metadata only.

## 10. API Overview
All endpoints are under `/api/projects/:id/arduino`.

### 10.1 Workspace
1. `GET /workspace`
2. `PUT /workspace/files`
3. `DELETE /workspace/files?path=...`
4. `POST /workspace/format`
5. `POST /workspace/attach` (update `sketch.yaml` defaults / profile mapping)

### 10.2 Boards and Platforms
1. `GET /boards/discover`
2. `GET /boards/platforms`
3. `POST /boards/platforms/install`
4. `POST /boards/platforms/upgrade`

### 10.3 Libraries
1. `GET /libraries`
2. `POST /libraries/install`
3. `DELETE /libraries/:name`
4. `POST /libraries/update-index`

### 10.4 Profiles
1. `GET /profiles`
2. `POST /profiles`
3. `PATCH /profiles/:profileId`
4. `DELETE /profiles/:profileId`

### 10.5 Jobs
1. `POST /jobs/compile`
2. `POST /jobs/upload`
3. `GET /jobs/:jobId`
4. `GET /jobs/:jobId/logs` (SSE)
5. `POST /jobs/:jobId/cancel`

### 10.6 Serial
1. `POST /serial/open`
2. `POST /serial/write`
3. `GET /serial/stream?sessionId=...` (SSE)
4. `POST /serial/close`

### 10.7 Health and Preflight
1. `GET /health` (CLI binary + config sanity + data dir/sketch root checks)

### 10.8 Phased Endpoints (P3+)
1. `GET /cloud/status`
2. `POST /cloud/pull`
3. `POST /cloud/push`
4. `POST /firmware/update`
5. `POST /certificates/upload`

## 11. Security Model
1. Validate all payloads with Zod.
2. Allowlist only approved `arduino-cli` commands/subcommands.
3. Never execute raw user shell fragments.
4. Canonicalize and bound file paths to project Arduino root.
5. Redact secrets in logs and error payloads.
6. Enforce per-project ownership and session auth.
7. Add per-session concurrency controls for build/upload streams.

## 12. Performance and Scalability
1. Queue/serialize upload jobs per project+port.
2. Stream logs incrementally to avoid memory spikes.
3. TTL cache board/library index responses.
4. Cap retained log size per job and paginate history.
5. Debounce board discovery refresh in UI.

### 12.1 Operational Limits (P1)
1. Max workspace file write payload: 1 MiB.
2. Max job log retention per job record: 2 MiB (truncate oldest chunks first).
3. SSE inactivity timeout: 120 seconds.
4. SSE absolute timeout: 300 seconds.
5. Default max concurrent Arduino jobs per project: 2.

### 12.2 CLI Version Policy
1. Supported range for first release: `>=1.2.0 <2.0.0`.
2. Preflight endpoint must return detected version and compatibility status.

## 13. Testing Strategy
1. Unit tests: command builder, path guards, status state machine, profile mapping.
2. Integration tests: routes with mocked CLI adapter, project ownership checks.
3. E2E tests: edit -> compile -> upload -> serial monitor flow.
4. Optional hardware-in-loop smoke tests for supported board matrix.

### 13.1 Break-It Scenarios (Required Gate)
Every scenario below must pass before internal rollout:

| ID | Failure Scenario | How We Trigger It | Expected Behavior |
| --- | --- | --- | --- |
| BRK-01 | CLI binary missing | Start server with bad `ARDUINO_CLI_PATH` | `GET /health` returns `503` + `ARDUINO_CLI_NOT_FOUND`; compile/upload routes fail fast with same root error. |
| BRK-02 | CLI version unsupported | Use CLI outside `>=1.2.0 <2.0.0` | `GET /health` returns incompatible status; compile/upload blocked with `ARDUINO_CLI_EXEC_FAILED` and clear message. |
| BRK-03 | CLI process hang | Inject test adapter that never exits | Job is force-killed at timeout; status becomes `failed`; code `ARDUINO_CLI_TIMEOUT`; no zombie process remains. |
| BRK-04 | Path traversal write | `PUT /workspace/files` with `../../` path | Request rejected with `400` + `PATH_OUTSIDE_WORKSPACE`; no file mutation on disk. |
| BRK-05 | Oversized file payload | `PUT /workspace/files` over 1 MiB | Request rejected with `413`; no partial file write; UI shows clear size-limit error. |
| BRK-06 | Invalid sketch path compile | `POST /jobs/compile` with missing path | Job is not created; `400` + `INVALID_SKETCH_PATH`. |
| BRK-07 | Port contention upload | Start two uploads on same `projectId+port` | First job runs; second gets `409` + `PORT_BUSY`; second does not enter `running`. |
| BRK-08 | Cancel running job | Call `POST /jobs/:jobId/cancel` mid-compile | Process stops; final status `cancelled`; no more log events after `done`. |
| BRK-09 | Serial cable disconnect | Drop device during active serial stream | `serial/stream` emits `error` then `status`; session ends cleanly; no server crash. |
| BRK-10 | SSE client reconnect | Disconnect and reconnect to job logs stream | Client receives current status quickly; no duplicate terminal transitions; server cleans stale connection. |
| BRK-11 | Duplicate idempotency key | Same request + same `X-Idempotency-Key` within TTL | Existing job is returned; duplicate process is not spawned. |
| BRK-12 | Board not detected | Compile/upload with no matching board | `400`/`409` with `BOARD_NOT_DETECTED`; UI shows actionable recovery steps. |

## 14. Observability
1. Structured events:
- `arduino_cli_health_checked`
- `arduino_job_started`
- `arduino_job_finished`
- `arduino_serial_opened`
- `arduino_serial_closed`
- `arduino_serial_error`
2. Metrics:
- compile duration p50/p95
- upload success rate
- board discovery latency
- serial disconnect count

## 15. Rollout Strategy
1. Guard all client/server entry points with `FEATURE_ARDUINO_WORKBENCH`.
2. Enable for internal projects first.
3. Expand by cohort.
4. Keep hard kill switch at server route guard and UI visibility.

## 16. Definition of Done
P1 is done only when every gate below is true:
1. Feature flag gates work both ways:
- ON: Arduino tab and routes are available.
- OFF: Arduino tab is hidden and Arduino routes are blocked.
2. Workspace operations are stable:
- file read/write/delete succeeds for valid paths,
- invalid/unsafe paths are rejected without side effects.
3. Board + port flows are stable:
- detect/select works for supported devices,
- busy/missing device states return deterministic errors.
4. Compile/upload lifecycle is stable:
- `pending -> running -> completed|failed|cancelled` is enforced,
- logs stream over SSE and close with final `done` event.
5. Serial lifecycle is stable:
- open/write/stream/close works,
- disconnects are handled without server instability.
6. Profile behavior matches `sketch.yaml` semantics, including `default_profile`.
7. All required matrix tests (below) pass in CI with saved evidence artifacts.
8. `npm run check` and `npm test` pass with zero new failures.

### 16.1 Required Test Matrix (P1)
| Test ID | Layer | What Must Pass | Evidence |
| --- | --- | --- | --- |
| TST-U01 | Unit | Path guard rejects traversal and absolute escape paths. | Server unit test output. |
| TST-U02 | Unit | Command builder emits only allowlisted CLI verbs/args. | Server unit test output. |
| TST-U03 | Unit | Job state machine rejects illegal transitions. | Server unit test output. |
| TST-I01 | Integration | Auth + project ownership enforced on all Arduino routes. | Route integration tests. |
| TST-I02 | Integration | Compile route creates job and streams status/log events. | Route + SSE integration tests. |
| TST-I03 | Integration | Upload contention on same port returns `PORT_BUSY`. | Route integration tests. |
| TST-I04 | Integration | Duplicate idempotency key returns same job ID. | Route integration tests. |
| TST-I05 | Integration | Serial open/write/close and disconnect handling are stable. | Route + SSE integration tests. |
| TST-E01 | E2E | User can edit sketch, compile, upload, then read serial output. | E2E report + screenshots. |
| TST-E02 | E2E | User sees clear errors for missing CLI, busy port, and board not found. | E2E report + screenshots. |
| TST-B01 | Break-It | BRK-01 through BRK-12 all pass. | Break-it checklist artifact in PR. |

## 17. Risks and Mitigations
1. **CLI dependency drift:** pin supported version range and expose preflight endpoint.
2. **Port contention:** enforce single-owner session per port and forced-close endpoint.
3. **Long-running jobs:** cancellation + timeout + process watchdog.
4. **Path traversal risk:** strict canonicalization under workspace root.
5. **Profile mismatch:** validate profile names and defaults against `sketch.yaml` parse rules.

## 18. External References (Primary)
1. Arduino CLI compile command reference.
2. Arduino CLI upload command reference.
3. Arduino CLI board list command reference.
4. Arduino CLI monitor command reference.
5. Sketch project file (`sketch.yaml`) spec.
6. Arduino CLI backward compatibility policy.
