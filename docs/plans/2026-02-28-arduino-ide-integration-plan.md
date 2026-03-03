# Arduino IDE Integration Implementation Plan

> **Planning document only.** No runtime implementation was performed.

**Goal:** Deliver a full Arduino IDE-style workbench inside ProtoPulse using the existing React/Express/Drizzle stack.  
**Architecture:** Add a project-scoped Arduino vertical slice: shared schema -> storage interface -> API routes -> React domain context -> workspace UI -> tests/docs.  
**Tech Stack:** React 19, TypeScript, TanStack React Query, Express 5, Drizzle ORM, arduino-cli.

## Skill Note
I’m using the Writing Plans and Architecture approaches to produce an implementation-ready spec and phased execution plan.

## 1. Feature Planning

### 1.1 Scope Definition
1. **MVP (Phase P1):** workspace shell, board/port discovery, board manager, library manager, compile/upload jobs, serial monitor, verbose logs.
2. **Phase P2:** language server features, split editor, serial plotter, build profiles.
3. **Phase P3:** debugger integration, cloud sketchbook sync, firmware updater, SSL cert uploader.
4. **Phase P4:** extension/plugin model with controlled security boundaries.

### 1.2 Acceptance Criteria
1. `arduino` tab appears in workspace under feature flag.
2. User can create/edit sketches and compile successfully.
3. User can upload to selected board/port.
4. User can open Serial Monitor and send/receive messages.
5. Board/library management APIs and UI are operational.

## 2. Research and Analysis Tasks
1. Confirm `arduino-cli` availability and version in target environments.
2. Define supported board families for GA (`arduino:avr`, `arduino:samd`, `esp32:esp32`, `rp2040:*`).
3. Evaluate Monaco + LSP integration strategy for C/C++ Arduino flows.
4. Confirm hardware access permissions/security model in deployment environment.

## 3. Architecture Design Tasks
1. Create architecture doc: `docs/arduino-ide-integration-spec.md`.
2. Add ADR for CLI-process model and job orchestration.
3. Define data flow for compile/upload and serial streaming.
4. Define failure-handling strategy for CLI and device disconnects.

## 4. Environment Setup Plan (When Executing)
1. Create branch: `feature/arduino-ide-integration`.
2. Ensure dependencies/tools are up to date (`npm install`, `arduino-cli version`).
3. Add env flags:
- `FEATURE_ARDUINO_WORKBENCH`
- `ARDUINO_CLI_PATH`
- `ARDUINO_DATA_DIR`
- `ARDUINO_SKETCH_ROOT`

## 5. Implementation Strategy (Phased)

### P1 Core Platform
1. Add schema/types for Arduino workspace, profiles, jobs, sessions.
2. Extend storage interface + database implementation.
3. Add server routes + service layer with CLI adapter.
4. Add React `arduino-context` with query/mutation hooks.
5. Add `ArduinoWorkbenchView` and wire into workspace tabs/sidebar.

### P2 Editor Intelligence
1. Add LSP bridge endpoints and diagnostics transport.
2. Add split editor and code navigation interactions.
3. Add format-on-demand and `.clang-format` support.

### P3 Cloud + Debug
1. Add cloud sync APIs and auth-link status.
2. Add debugger session management with board capability checks.
3. Add firmware and SSL upload workflow.

### P4 Extensions
1. Add extension registry with allowlisted providers.
2. Add extension UI settings and permission model.

## 6. Database Change Plan

### New Tables (Proposed)
1. `arduino_workspaces`
2. `arduino_build_profiles`
3. `arduino_jobs`
4. `arduino_serial_sessions`
5. `arduino_sketch_files`

### Migration Rules
1. Add nullable-safe columns where possible.
2. Keep backward compatibility with existing projects.
3. Add down-migration notes and data retention strategy.

## 7. API Development Plan

### Route Namespace
- `/api/projects/:id/arduino/*`

### Initial Endpoints
1. Workspace/file operations.
2. Board discovery and core management.
3. Library search/install/uninstall.
4. Compile/upload job start/status/log/cancel.
5. Serial open/write/close/stream.

### Contract Requirements
1. Zod validation for all request/response boundaries.
2. Standardized error payload `{ message, code?, details? }`.
3. Correct status codes (`200/201/204/400/401/403/404/409/422/500`).

## 8. Frontend Implementation Plan

### Affected UI Areas
1. `client/src/pages/ProjectWorkspace.tsx` (new tab/view)
2. `client/src/components/layout/sidebar/sidebar-constants.ts` (sidebar nav)
3. `client/src/lib/project-context.tsx` (extend `ViewMode` and provider composition)
4. New files under `client/src/components/views/arduino/*`
5. New context: `client/src/lib/contexts/arduino-context.tsx`

### UX Requirements
1. Command palette (`Ctrl+Shift+P`) with Arduino actions.
2. Dockable serial console and optional plot panel.
3. Build console with streaming logs and job status.
4. Clear loading/error/empty states for every panel.

## 9. Testing Plan

### Unit
1. CLI command builder validation.
2. Job lifecycle transitions.
3. Serial parsing and plot channel extraction.

### Integration
1. Express route tests with mocked CLI adapter.
2. Storage tests for new Arduino entities.
3. Auth and project scoping checks.

### E2E
1. Open Arduino tab -> edit file -> compile.
2. Select board/port -> upload.
3. Open serial monitor -> send/receive data.

## 10. Security Plan
1. Hard allowlist for `arduino-cli` subcommands.
2. Argument sanitization and path canonicalization.
3. No direct shell interpolation from client payloads.
4. Rate limits and auth checks on all Arduino endpoints.
5. Secret redaction in logs.

## 11. Performance Plan
1. Async job queue for compile/upload.
2. TTL cache for board/library index queries.
3. Paginated job history and log truncation policy.
4. Debounced board discovery refresh in UI.

## 12. Documentation Plan
1. Update `docs/DEVELOPER.md` with Arduino architecture and APIs.
2. Update `docs/USER_GUIDE.md` with Arduino Workbench usage.
3. Add troubleshooting section for board detection/upload/serial errors.
4. Add runbook entry for `arduino-cli` runtime health checks.

## 13. Code Review Preparation Checklist (For Execution Phase)
1. `npm run check` must pass with zero errors.
2. All new tests pass.
3. No unbounded process spawning or unvalidated command args.
4. Feature flag verified on/off.

## 14. Integration Test Plan
1. Regression test existing views (architecture/bom/validation/chat).
2. Validate sidebar and tab navigation stability.
3. Confirm no breakage in project seeding and auth flows.

## 15. Commit Plan (For Execution Phase)
Suggested atomic commits:
1. `feat(schema): add arduino workspace/profile/job/session tables`
2. `feat(server): add arduino service and API routes`
3. `feat(client): add arduino context and workbench view`
4. `test(arduino): add API/context/e2e coverage`
5. `docs(arduino): add developer and user docs`

## 16. Pull Request Plan
1. Include architecture diagram and API matrix.
2. Include screenshots of Workbench, board manager, serial monitor.
3. Include hardware assumptions and tested board matrix.
4. Include feature-flag rollout instructions.

## 17. QA Plan
1. Manual matrix by OS and board family.
2. Accessibility checks: keyboard-only and screen-reader pass.
3. Failure-path checks: missing CLI, port disconnected mid-upload, compile failure.

## 18. Deployment and Rollout Plan
1. Internal rollout under feature flag.
2. Observe compile/upload success rate and latency.
3. Expand to beta users by cohort.
4. Prepare rollback by disabling feature flag and route guards.

## Suggested Task Breakdown for Engineers (Execution Backlog)
1. Add schema + migrations.
2. Add storage interface + database methods.
3. Implement Arduino service wrapper around CLI.
4. Implement routes and validators.
5. Add frontend Arduino context.
6. Add workbench shell UI.
7. Add board/library management UI.
8. Add compile/upload job UI.
9. Add serial monitor UI.
10. Add tests and docs updates.

## Out-of-Scope for First Merge
1. Full VSIX ecosystem support.
2. Full cloud account management UX.
3. Universal debugger support across all boards/probes.
