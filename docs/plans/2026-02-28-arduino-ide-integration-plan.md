# Arduino IDE Integration Implementation Plan

> **Planning document only.** No runtime implementation was performed.

**Goal:** Deliver a production-ready Arduino Workbench in ProtoPulse using the existing React/Express/Drizzle stack.  
**Architecture:** Add a project-scoped Arduino vertical slice: schema -> storage -> routes/services -> React context -> workspace UI -> tests/docs.  
**Tech Stack:** React 19, TypeScript, TanStack React Query, Express 5, Drizzle ORM, `arduino-cli`.

## 1. Locked Ground Rules
1. Feature flag key: `FEATURE_ARDUINO_WORKBENCH`.
2. Route namespace: `/api/projects/:id/arduino/*`.
3. Job status enum: `pending|running|completed|failed|cancelled`.
4. Primary stream transport: SSE.
5. Storage model: hybrid (filesystem for sketch content, DB for metadata/jobs/sessions).
6. Command palette integration uses existing `Ctrl/Cmd+K` flow.

## 2. Scope and Phases

### 2.1 P1 (MVP)
1. Arduino workspace shell and new `arduino` view.
2. File tree/edit/save for sketch files.
3. Board/port discovery.
4. Platform/library list + install/uninstall basics.
5. Compile/upload job lifecycle with live logs.
6. Serial monitor open/write/close/stream.
7. CLI preflight health endpoint.

### 2.2 P2
1. LSP diagnostics + navigation.
2. Split editor.
3. Serial plotter.
4. Profile UX polish (`sketch.yaml` mapping tools).

### 2.3 P3
1. Debugger (supported-board gated).
2. Cloud pull/push endpoints.
3. Firmware updater + certificate upload.

### 2.4 P4
1. Controlled extension points (no untrusted VSIX execution).

## 3. Definition of Done (Strict P1 Gate)
P1 is not complete until every item below is true:
1. Feature flag gate is verified both directions:
- ON: Arduino tab/routes available.
- OFF: Arduino tab hidden and Arduino routes blocked.
2. User can create/edit/save/delete sketch files with safe path enforcement.
3. User can detect/select board and port with deterministic errors for busy/missing states.
4. Compile and upload jobs run through `pending|running|completed|failed|cancelled` and stream logs over SSE.
5. Serial monitor open/write/stream/close is stable, including disconnect recovery.
6. Routes are authenticated and project-scoped for every endpoint.
7. `sketch.yaml` profile mapping (including `default_profile`) is verified end-to-end.
8. Required test matrix in section 12 passes with artifacts attached.
9. `npm run check` and `npm test` pass with zero new failures.

## 4. Research and Validation Tasks
1. Confirm `arduino-cli` version support matrix and pin supported range.
2. Validate command behavior across Linux/macOS/Windows in CI docs.
3. Confirm board families for GA support:
- `arduino:avr`
- `arduino:samd`
- `esp32:esp32`
- `rp2040:*`
4. Validate upload/monitor behavior with and without `sketch.yaml default_profile`.
5. Validate path normalization/security boundaries for sketch files.
6. Validate CLI compatibility policy for pinned version range (`>=1.2.0 <2.0.0`).

## 5. Architecture Tasks
1. Keep source of truth in `docs/arduino-ide-integration-spec.md`.
2. Keep wire-level route contracts in `docs/arduino-ide-api-contracts.md`.
3. Add ADR: Arduino process orchestration + persistence decisions.
4. Add sequence diagrams for compile/upload and serial streaming.

## 6. Environment Setup (Execution Phase)
1. Create branch `feature/arduino-ide-integration`.
2. Verify toolchain:
- `npm install`
- `npm run check`
- `arduino-cli version`
3. Add environment keys:
- `FEATURE_ARDUINO_WORKBENCH`
- `ARDUINO_CLI_PATH`
- `ARDUINO_DATA_DIR`
- `ARDUINO_SKETCH_ROOT`
- `ARDUINO_ALLOWED_FQBNS`

### 6.1 Capability Probe Checklist
1. `arduino-cli version` returns supported range.
2. `arduino-cli board list --json` works in target env.
3. `arduino-cli core update-index` succeeds.
4. Process user has permission to read/write `ARDUINO_DATA_DIR` and `ARDUINO_SKETCH_ROOT`.

## 7. Database Plan

### 7.1 New Tables
1. `arduino_workspaces`
2. `arduino_build_profiles`
3. `arduino_jobs`
4. `arduino_serial_sessions`
5. `arduino_sketch_files` (metadata only)

### 7.2 Migration Rules
1. Use additive migrations only.
2. Maintain backward compatibility for existing project flows.
3. Add indexes for project-scoped lookups and job history queries.
4. Document retention policy for job logs and serial session records.

## 8. Backend Plan

### 8.1 Storage Layer
1. Extend `IStorage` with Arduino methods.
2. Add `server/storage/arduino.ts` module.
3. Expose methods via `DatabaseStorage` composition pattern.

### 8.2 Service Layer
1. Implement `arduino-service.ts` for command construction and validation.
2. Implement `arduino-process-manager.ts` for process lifecycle and cancellation.
3. Harden allowlisted command set:
- board discovery
- platform install/upgrade
- library install/uninstall/search/index update
- compile
- upload
- monitor

### 8.3 Routes
1. Add `server/routes/arduino.ts`.
2. Register route module in `server/routes.ts`.
3. Apply Zod validation to all request payloads.
4. Keep non-2xx errors in `{ message, code?, details? }` shape.

## 9. Frontend Plan

### 9.1 Core Wiring
1. Add `arduino` to `ViewMode`.
2. Add sidebar item and workspace tab.
3. Add lazy-loaded `ArduinoWorkbenchView`.

### 9.2 Context and Queries
1. Add `client/src/lib/contexts/arduino-context.tsx`.
2. Add React Query hooks for workspace/boards/libraries/jobs/serial.
3. Ensure optimistic updates are used only where safe.

### 9.3 Panels
1. Workspace file tree/editor.
2. Boards/platform manager.
3. Library manager.
4. Build console with streamed logs.
5. Serial monitor dock.
6. Arduino command group inside existing command palette.

## 10. Security Plan
1. No raw shell interpolation from client payloads.
2. Canonicalize all file paths under per-project root.
3. Strict command allowlist and arg shape validation.
4. Enforce auth + ownership middleware on all Arduino routes.
5. Add stream abuse protections (session concurrency + rate limits + timeout).
6. Redact sensitive strings from logs.

## 11. Performance Plan
1. Queue jobs asynchronously and prevent per-port upload contention.
2. Stream logs incrementally to client via SSE.
3. Add TTL caches for board/platform/library listings.
4. Add job log truncation + pagination policy.
5. Debounce board refresh in the UI.

### 11.1 Concrete Limits for P1
1. File write payload limit: 1 MiB.
2. Job log retention cap: 2 MiB per job.
3. SSE inactivity timeout: 120s.
4. SSE absolute timeout: 300s.
5. Max concurrent Arduino jobs per project: 2.

## 12. Testing Plan

### 12.1 Unit
1. Command builder correctness.
2. Job state transitions.
3. Path guard and workspace root enforcement.
4. `sketch.yaml` profile/default mapping behavior.

### 12.2 Integration
1. Route tests with mocked CLI adapter.
2. Storage tests for Arduino entities.
3. Auth/project ownership tests on Arduino endpoints.
4. Streaming tests for job log SSE and serial SSE endpoints.

### 12.3 E2E
1. Open Arduino tab -> edit file -> compile.
2. Select board/port -> upload.
3. Open serial monitor -> send/receive.

### 12.4 Break-It Matrix (Required)
All failure scenarios below are required for P1 sign-off:

| ID | Failure Scenario | Expected Behavior |
| --- | --- | --- |
| BRK-01 | CLI missing (`ARDUINO_CLI_PATH` invalid) | `/health` returns `503` + `ARDUINO_CLI_NOT_FOUND`; compile/upload blocked. |
| BRK-02 | CLI version out of supported range | `/health` reports incompatible version; jobs blocked with clear error. |
| BRK-03 | Hung compile/upload process | Process timeout + kill; job ends `failed` with `ARDUINO_CLI_TIMEOUT`. |
| BRK-04 | Workspace path traversal attempt (`../`) | Request rejected with `PATH_OUTSIDE_WORKSPACE`; no write side effect. |
| BRK-05 | File payload exceeds 1 MiB | Request rejected (`413`); no partial write. |
| BRK-06 | Compile with invalid sketch path | Request rejected with `INVALID_SKETCH_PATH`. |
| BRK-07 | Concurrent uploads on same port | First runs; second rejected with `409` + `PORT_BUSY`. |
| BRK-08 | Cancel running job | Process terminated; final status `cancelled`; stream closes cleanly. |
| BRK-09 | Serial disconnect while streaming | Stream emits error/status and session closes without server crash. |
| BRK-10 | SSE disconnect + reconnect | Reconnect gets current status quickly; no duplicate terminal transitions. |
| BRK-11 | Duplicate idempotency key | Existing job returned; duplicate process not created. |
| BRK-12 | Board not detected at upload time | Request fails deterministically with `BOARD_NOT_DETECTED`. |

### 12.5 Required Test Matrix (Pass/Fail)
| Test ID | Layer | What Must Pass |
| --- | --- | --- |
| TST-U01 | Unit | Path guard blocks traversal + absolute escapes. |
| TST-U02 | Unit | Command builder allows only approved CLI command set. |
| TST-U03 | Unit | Job state machine rejects illegal transitions. |
| TST-I01 | Integration | Auth + ownership enforced on all Arduino endpoints. |
| TST-I02 | Integration | Compile/upload job lifecycle and SSE event contract. |
| TST-I03 | Integration | Upload contention returns `PORT_BUSY`. |
| TST-I04 | Integration | Idempotency key returns same job ID for duplicate request. |
| TST-I05 | Integration | Serial open/write/close + disconnect behavior is stable. |
| TST-E01 | E2E | Happy path: edit -> compile -> upload -> serial output. |
| TST-E02 | E2E | Error UX path: missing CLI, busy port, board not found. |
| TST-B01 | Break-It | BRK-01 through BRK-12 pass and are recorded in PR checklist. |

## 13. Documentation Plan
1. Update `docs/DEVELOPER.md` with architecture and route details.
2. Update `docs/USER_GUIDE.md` with Arduino Workbench usage.
3. Add troubleshooting for:
- CLI missing/misconfigured
- board not detected
- port busy
- upload failure
- serial session interruptions
4. Add runbook for Arduino preflight health checks.

## 14. Commit Plan (Execution Phase)
1. `feat(schema): add arduino workspace/profile/job/session tables`
2. `feat(storage): add arduino storage module and interface methods`
3. `feat(server): add arduino service/process manager/routes`
4. `feat(client): add arduino context, workbench view, and command palette actions`
5. `test(arduino): add unit/integration/e2e coverage`
6. `docs(arduino): update spec/contracts/dev+user docs`

## 15. PR Plan
1. Include architecture diagram + sequence diagrams.
2. Include API matrix linked to contracts doc.
3. Include screenshots of key panels (workbench, boards, build, serial).
4. Include tested board/OS matrix.
5. Include feature-flag rollout and rollback instructions.

## 16. Rollout Plan
1. Internal rollout behind `FEATURE_ARDUINO_WORKBENCH`.
2. Observe compile/upload success and latency metrics.
3. Expand gradually to beta cohorts.
4. Roll back by disabling feature flag and route guard.

## 17. Out-of-Scope for First Merge
1. Full VSIX ecosystem execution.
2. Full Arduino Cloud account management UX.
3. Universal debugger support across all probes.
4. Serial plotter and advanced debugger UX.
