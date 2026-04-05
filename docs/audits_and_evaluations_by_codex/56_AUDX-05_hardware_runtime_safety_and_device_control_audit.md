# AUDX-05: Hardware Runtime Safety and Device Control Audit

Date: 2026-03-30  
Author: Codex  
Wave: Deep Systems Expansion  
Purpose: Evaluate whether ProtoPulse’s Arduino, serial, firmware-runtime, and device-control surfaces are safe enough for real hardware interaction, then define how to mature them into a trustworthy maker workflow.

## Current Hardware Risk Posture
- `Harmless confusion risk`: present
- `Can disrupt workflow or waste time`: present
- `Can target the wrong device or create unsafe ambiguity`: present
- `Ready for broad beginner-safe hardware trust`: no

ProtoPulse now has real hardware-oriented route and service surfaces, but the product is still ahead of its safety choreography. The backend is materially more real than the frontend experience implies, and the contract/spec discipline is ahead of the current surfaced workflow.

## What Was Reviewed
- Prior client/runtime audit:
  - `docs/audits_and_evaluations_by_codex/13_FE-13_hardware_serial_client_audit.md`
- Current Arduino and runtime implementation:
  - `server/routes/arduino.ts`
  - `server/arduino-service.ts`
  - `server/routes/firmware-runtime.ts`
- Hardware and runtime contracts:
  - `docs/arduino-ide-integration-spec.md`
  - `docs/arduino-ide-api-contracts.md`
- Runtime UX context:
  - `docs/audits_and_evaluations_by_codex/33_UIUX-00_master_rollup.md`
  - `docs/audits_and_evaluations_by_codex/37_UIUX-04_learning_ai_advanced_views_audit.md`
- AI trust/safety context:
  - `docs/audits_and_evaluations_by_codex/50_UIUX-17_ai_trust_safety_operating_model.md`

## What Was Verified
- Confirmed that project-owned Arduino routes exist for:
  - workspace
  - file operations
  - board discovery
  - compile/upload jobs
  - job cancellation and SSE streams
  - serial open/close
  - firmware co-debug support
- Confirmed that `ArduinoService.runJob(...)` includes basic process tracking and cancellation, but the inspected implementation sections do not show explicit per-port serialization, idempotency replay handling, or process timeout enforcement that the integration spec calls for.
- Confirmed that `discoverBoards()` currently logs and returns an empty list on failure.
- Confirmed that frontend Web Serial code remains partially separate from the server-managed Arduino/serial contract and still was previously found to be under-integrated into real UI flows.
- Confirmed that the advanced Arduino surface was previously observed as shell-heavy / near-blank in the runtime UI pass.

## Findings By Severity

### 1) `P1` The product still has two serial/hardware models instead of one coherent device-control story
Evidence:
- `13_FE-13_hardware_serial_client_audit.md`
- `server/routes/arduino.ts`
- `docs/arduino-ide-integration-spec.md`
- Prior FE audit confirmed browser-direct Web Serial logic exists separately from the server-managed Arduino serial/session contract.

Why this matters:
- Split transport models create duplicated bugs, inconsistent UX, and unclear recovery behavior.
- The user should not have to care whether serial is browser-direct or server-managed; ProtoPulse should.

Recommended direction:
- Pick one primary device-control model for the product surface and wrap any alternate transport behind one adapter.

### 2) `P1` The current Arduino runtime appears materially behind its own safety contract in several key areas
Evidence:
- `docs/arduino-ide-integration-spec.md`
- `docs/arduino-ide-api-contracts.md`
- `server/routes/arduino.ts`
- `server/arduino-service.ts`
- The inspected route/service implementation shows:
  - compile/upload queueing and cancellation
  - no obvious route-level `PORT_BUSY` enforcement
  - no obvious upload idempotency handling
  - no obvious explicit process timeout/watchdog in the inspected `runJob(...)` path

Inference note:
- This is a code-inspection inference from the inspected route/service path, not a fresh live exploit or route test.

Why this matters:
- Hardware flows need stronger guarantees than ordinary CRUD flows.
- Without device-contention, timeout, and replay policy, the app can become unpredictable around real boards.

Recommended direction:
- Bring runtime behavior into explicit parity with the published Arduino spec before broadening hardware claims.

### 3) `P1` Wrong-device and wrong-port risk is not yet counterbalanced by strong trust UI
Evidence:
- `33_UIUX-00_master_rollup.md`
- `37_UIUX-04_learning_ai_advanced_views_audit.md`
- `docs/arduino-ide-integration-spec.md`
- Runtime UI audit already observed an Arduino surface that was closer to a blank shell than a guided bench workflow, while the spec expects clear board/port flows and actionable recovery.

Why this matters:
- Real hardware mistakes are materially different from ordinary UI mistakes.
- ProtoPulse needs to make it obvious which board, which port, which profile, and which action the user is about to run.

Recommended direction:
- Add explicit device trust cards, board fingerprints, recent-device history, and confirmation surfaces for risky actions.

### 4) `P1` Failure-to-empty behavior can hide real hardware/runtime problems
Evidence:
- `server/arduino-service.ts:202-209`
- `discoverBoards()` logs and returns `[]` on failure.
- `13_FE-13_hardware_serial_client_audit.md`
- Prior client audit also documented cancellation/error-mapping gaps on the browser-direct side.

Why this matters:
- “No devices found” and “device discovery failed” are not the same thing.
- Empty-state masking is especially harmful for beginners trying to debug cables, permissions, or drivers.

Recommended direction:
- Distinguish discovery failure, permission failure, busy-device, and true no-device states in the UI and API.

### 5) `P2` Cancellation and streaming exist, but recovery policy is still under-productized
Evidence:
- `server/routes/arduino.ts`
- `server/arduino-service.ts`
- `server/routes/firmware-runtime.ts`
- Current implementation includes SSE streams, process cancellation, and runtime event streams, but the current surfaced audit corpus does not show a full user-facing recovery flow for disconnects, stale sessions, and retry-safe resumes.

Why this matters:
- Hardware tooling earns trust through how it fails and recovers, not just through the happy path.

Recommended direction:
- Productize cancel/retry/reconnect state with visible terminal statuses and recovery suggestions.

### 6) `P2` Hardware-sensitive AI behavior still needs stronger explicit gates
Evidence:
- `50_UIUX-17_ai_trust_safety_operating_model.md`
- AI trust model already called for hardware-sensitive action gates for flashing, serial, and physical-device operations.

Why this matters:
- The more AI participates in code generation, upload planning, or co-debugging, the more dangerous vague autonomy becomes around physical devices.

Recommended direction:
- Make all hardware-touching AI actions preview-first and confirmation-bound by default.

## Why It Matters
ProtoPulse’s desktop-native vision gets very real the moment it touches a USB cable, serial port, or board flash operation. This is where the product stops being a design tool and starts being a lab bench. That is a huge opportunity, but it also raises the bar. Hardware tooling needs explicit device identity, contention policy, timeouts, cancellation, terminal receipts, and recovery guidance. Right now ProtoPulse has real backend bones here, but not yet the complete safety choreography.

## Improvement Directions
1. Collapse hardware control onto one primary transport and state model.
2. Close route/spec drift for contention, timeout, and idempotency behavior.
3. Build a visible device trust layer around board, port, profile, and action identity.
4. Separate `no device`, `device busy`, `permissions issue`, and `runtime failure` states.
5. Make hardware AI flows opt-in, preview-first, and rollback-aware.

## Enhancement / Addition / Integration Ideas
- Add a `Bench` surface that combines board selection, port status, last upload, serial state, and firmware runtime status in one place.
- Add `safe upload` preflight that checks board detectability, profile validity, dirty files, pending compile success, and known port conflicts.
- Add dry-run and simulated-upload modes for beginners.
- Add a `wrong device?` recovery path with port re-scan, device fingerprinting, and known-board hints.
- Add hardware-in-loop smoke tests for a supported board matrix.
- Add device-lab integrations for classroom or makerspace environments with shared hardware pools.
- Add `explain this failure` AI actions that operate on compile/upload/serial logs without taking autonomous physical actions.

## Quick Wins
1. Distinguish board-discovery failure from genuine empty-device state.
2. Add explicit board/port identity display and confirmation text to upload flows.
3. Add terminal state receipts for cancel, disconnect, timeout, and retry paths.
4. Gate hardware-touching AI actions behind explicit review by default.
5. Make the Arduino surface show setup-oriented starter actions instead of shell-like emptiness.

## Medium Lifts
1. Bring route behavior into parity with the published Arduino contract for `PORT_BUSY`, timeout, and idempotency expectations.
2. Unify browser-direct serial and server-managed serial behind one product abstraction.
3. Add a device/session health model with stale-session cleanup and reconnect guidance.
4. Add firmware-runtime and upload watchdogs with visible timeout reasons.
5. Build integration tests that cover disconnect, wrong-port, port-busy, and cancel flows end to end.

## Big Swings
1. Build a first-class `ProtoPulse Hardware Bench` with device trust, preflight, upload, serial, and runtime simulation in one coherent workspace.
2. Add hardware-in-the-loop validation that compares expected outputs to observed device behavior.
3. Create beginner-safe physical build workflows where ProtoPulse stages the user through connect, detect, compile, upload, observe, and recover.

## Residual Unknowns
- No live board was connected and exercised in this wave.
- The current corpus does not yet prove how robust the Arduino service is under repeated port contention or CLI hangs.
- Device-driver and OS-permission behavior outside the repo’s test surface remains unverified.

## Related Prior Audits
- `13_FE-13_hardware_serial_client_audit.md` — confirmed
- `33_UIUX-00_master_rollup.md` — extended
- `37_UIUX-04_learning_ai_advanced_views_audit.md` — extended
- `50_UIUX-17_ai_trust_safety_operating_model.md` — extended
