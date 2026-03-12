# FE-13 Audit: Hardware/Serial Integration (Client)

Date: 2026-03-06  
Auditor: Codex  
Section: FE-13 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Core FE-13 implementation:
  - `client/src/lib/web-serial.ts`
- FE-13 test surface:
  - `client/src/lib/__tests__/web-serial.test.ts`
- Runtime wiring checks:
  - `client/src/pages/ProjectWorkspace.tsx`
  - `client/src/lib/project-context.tsx`
  - repository-wide usage search for `useWebSerial` / `WebSerialManager`
- Contract alignment checks:
  - `docs/arduino-ide-integration-spec.md`
  - `docs/arduino-ide-api-contracts.md`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact behavior break
- `P2`: medium reliability/interop risk
- `P3`: lower-risk quality/debt issue

## Findings

### 1) `P1` FE-13 serial capability is not wired into real app UX/runtime
Evidence:
- `rg -n "useWebSerial|WebSerialManager|web-serial" client/src --glob '!**/__tests__/**' --glob '!**/*.test.ts*' --glob '!**/*.bak'` only returns `client/src/lib/web-serial.ts`.
- `client/src/pages/ProjectWorkspace.tsx:322`
- `client/src/pages/ProjectWorkspace.tsx:345`
- `client/src/lib/project-context.tsx:106`

What is happening:
- Serial manager + hook exist, but no consuming component/page is mounted in workspace tabs or view mode types.

Why this matters:
- Feature exists as library code only; end users have no path to actually use it in the app.

Fix recommendation:
- Add a dedicated hardware/serial panel (or dock) and wire `useWebSerial` through a provider so this feature is reachable.

---

### 2) `P1` Client serial path is not aligned with the Arduino IDE integration contract model
Evidence:
- `docs/arduino-ide-integration-spec.md:229`
- `docs/arduino-ide-integration-spec.md:230`
- `docs/arduino-ide-integration-spec.md:231`
- `docs/arduino-ide-integration-spec.md:232`
- `docs/arduino-ide-api-contracts.md:490`
- `docs/arduino-ide-api-contracts.md:510`
- `docs/arduino-ide-api-contracts.md:521`
- `docs/arduino-ide-api-contracts.md:537`
- `rg -n "/serial/open|/serial/write|/serial/stream|/serial/close" client/src --glob '!**/__tests__/**' --glob '!**/*.test.ts*'` returns no runtime client calls.

What is happening:
- FE-13 currently uses browser-direct Web Serial logic only.
- Current integration docs define server-managed serial sessions + SSE contracts.

Why this matters:
- Two serial models are now drifting: local browser manager vs server contract model.
- This increases integration risk and rework when Arduino IDE integration implementation starts.

Fix recommendation:
- Decide one primary transport strategy now (browser-direct, server-bridge, or explicit dual-mode).
- Add a thin serial transport adapter so UI code stays stable while backend evolves.

---

### 3) `P1` Read-loop `done` path can leave stale connected state and skip recovery
Evidence:
- `client/src/lib/web-serial.ts:886`
- `client/src/lib/web-serial.ts:889`
- `client/src/lib/web-serial.ts:892`
- `client/src/lib/web-serial.ts:899`
- `client/src/lib/web-serial.ts:915`
- `client/src/lib/web-serial.ts:916`
- `client/src/lib/web-serial.ts:965`

What is happening:
- On `reader.read()` -> `done`, loop breaks and releases reader.
- No state transition to disconnected/error happens on this branch.
- Reconnect scheduling only happens on fatal-error path (`handleDisconnection`), not on `done`.

Why this matters:
- UI can remain in a stale "connected" state while stream is actually ended.
- Recovery behavior can be inconsistent depending on device/browser behavior (`done` vs thrown error).

Fix recommendation:
- Treat unexpected `done` while active as disconnection: close port, set state, and apply reconnect policy.

---

### 4) `P1` Connection profile contract is partially implemented; key serial settings are not actually applied
Evidence:
- `client/src/lib/web-serial.ts:109`
- `client/src/lib/web-serial.ts:681`
- `client/src/lib/web-serial.ts:682`
- `client/src/lib/web-serial.ts:683`
- `client/src/lib/web-serial.ts:684`
- `client/src/lib/web-serial.ts:693`
- `client/src/lib/web-serial.ts:699`
- `client/src/lib/web-serial.ts:470`
- `client/src/lib/web-serial.ts:475`
- `client/src/lib/web-serial.ts:1173`
- `client/src/lib/web-serial.ts:1180`
- `client/src/lib/__tests__/web-serial.test.ts:780`
- `client/src/lib/__tests__/web-serial.test.ts:796`

What is happening:
- `ConnectionProfile` type includes `dataBits`, `stopBits`, `parity`, `flowControl`, `filters`.
- `createProfile()` hard-codes defaults for those fields.
- `applyProfile()` only applies baud/line/dataMode/DTR/RTS.
- Profile validation only checks name/baud/lineEnding.

Why this matters:
- Users can think full serial config is saved/applied, but connection still uses defaults unless manually overridden.
- This can silently break real board communication requiring non-default serial config.

Fix recommendation:
- Make profile fields first-class: capture real current connection options, validate all fields, and apply them during connect.

---

### 5) `P2` Previously authorized ports cannot be re-selected for connection flow
Evidence:
- `client/src/lib/web-serial.ts:436`
- `client/src/lib/web-serial.ts:443`
- `client/src/lib/web-serial.ts:456`
- `client/src/lib/web-serial.ts:459`

What is happening:
- `getPorts()` returns metadata only (`SerialPortInfo[]`), not a selectable handle.
- `connect()` requires internal `_port` to already be set by `requestPort()`.

Why this matters:
- Reconnect UX is weaker than it should be for authorized devices.
- Limits ability to build a deterministic "pick from known devices" experience.

Fix recommendation:
- Add explicit authorized-port selection flow (store handles internally and allow selecting one before connect).

---

### 6) `P2` Request-port cancellation/error mapping is too narrow
Evidence:
- `client/src/lib/web-serial.ts:423`
- `client/src/lib/web-serial.ts:424`
- `client/src/lib/web-serial.ts:427`
- `client/src/lib/web-serial.ts:428`

What is happening:
- Only `NotAllowedError` is treated as a non-error cancellation.
- All other errors are surfaced as hard failures.

Why this matters:
- Browser/device cancellation variants can become noisy "errors" for users.
- UX can look broken when user simply closes picker in a browser that emits a different exception shape.

Fix recommendation:
- Normalize known user-cancel/no-device error variants into a neutral cancelled outcome.

---

### 7) `P2` Abort/cancel lifecycle is incomplete for active read operations
Evidence:
- `client/src/lib/web-serial.ts:250`
- `client/src/lib/web-serial.ts:876`
- `client/src/lib/web-serial.ts:806`
- `client/src/lib/web-serial.ts:828`
- `client/src/lib/web-serial.ts:887`
- `rg -n "_readAbortController" client/src/lib/web-serial.ts` shows create/abort only, no signal-based read cancellation path.

What is happening:
- `AbortController` is created and aborted, but not tied into a cancellable read pipeline.
- Cleanup relies on releasing locks/closing port side effects.

Why this matters:
- Makes stop/disconnect timing less deterministic under certain stream states.
- Harder to reason about race conditions between close, read completion, and reconnect.

Fix recommendation:
- Use an explicit reader cancel strategy and unify shutdown path around one deterministic cancellation flow.

---

### 8) `P2` Text receive processing drops blank lines and risks split-character decoding artifacts
Evidence:
- `client/src/lib/web-serial.ts:930`
- `client/src/lib/web-serial.ts:934`
- `client/src/lib/web-serial.ts:941`
- `client/src/lib/web-serial.ts:949`

What is happening:
- A fresh `TextDecoder()` is created per chunk.
- Empty lines are filtered out from monitor output.

Why this matters:
- Serial monitor output can lose fidelity (empty-line semantics).
- Non-ASCII/multibyte text may decode poorly if bytes split across chunks.

Fix recommendation:
- Keep a persistent decoder (stream mode) and preserve line fidelity with configurable blank-line handling.

---

### 9) `P2` Unit tests are extensive but key reconnect behaviors are weakly asserted
Evidence:
- `client/src/lib/__tests__/web-serial.test.ts:627`
- `client/src/lib/__tests__/web-serial.test.ts:633`
- `client/src/lib/__tests__/web-serial.test.ts:635`
- `client/src/lib/__tests__/web-serial.test.ts:642`
- `client/src/lib/__tests__/web-serial.test.ts:645`
- `client/src/lib/__tests__/web-serial.test.ts:654`

What is happening:
- "doubles delay" test does not verify multiple attempt transitions.
- "caps at 30 seconds" test validates standalone math, not manager state progression.
- reconnect scheduling test checks error state but not reconnect attempt behavior end-to-end.

Why this matters:
- Core reliability logic can regress without detection.

Fix recommendation:
- Add focused reconnect-state tests that step fake timers, assert attempt counters, and verify reconnect success/failure transitions.

---

### 10) `P3` Product checklist marks Web Serial as done even though user-facing integration is missing
Evidence:
- `docs/product-analysis-checklist.md:584`
- `client/src/pages/ProjectWorkspace.tsx:322`
- `client/src/lib/project-context.tsx:106`

What is happening:
- Checklist states serial feature is complete.
- Actual app has no serial view wiring.

Why this matters:
- Status reporting can overstate shipped capability.
- Planning and prioritization can drift from real user-visible delivery.

Fix recommendation:
- Split status into `library complete` vs `user workflow complete` to avoid false "done" signals.

## Test Coverage Assessment (this section)

What exists:
- Large FE-13 unit test surface in one file:
  - `client/src/lib/__tests__/web-serial.test.ts`
- Good low-level checks for manager methods, hook surface, and core success/error paths.

Important gaps:
- No integration tests showing serial UX wired into workspace panels/views.
- No end-to-end tests validating full user flow (select device -> connect -> stream -> disconnect recovery).
- No contract tests against current Arduino serial API contracts (`/serial/open|write|stream|close`).
- Reconnect tests do not fully exercise attempt progression and terminal behavior.

Execution note:
- Per user direction, this pass is inspection-only and did not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Ship a Hardware Console panel
- Add connect/disconnect controls, port picker, monitor, line-ending controls, profile manager, and reset button in a real workspace panel.

### B) Introduce a transport adapter (`browserSerial` vs `serverSerial`)
- Keep UI stable while we choose or evolve transport strategy for Arduino integration.

### C) Promote profile schema to strict validation
- Validate/apply full profile fields and expose active connection settings in UI for transparency.

### D) Add robust reconnect telemetry and UX
- Show reconnect attempt count, current delay, and explicit terminal failure state after max attempts (if capped).

### E) Add hardware-in-the-loop smoke workflow
- One reproducible scripted smoke run: connect, send, receive, unplug, reconnect.

## Decision Questions Before FE-14
1. Do we want FE-13 to stay browser-direct (`navigator.serial`) or align to the server serial session model from the Arduino integration spec as the primary path?
2. Should we treat FE-13 as "not shipped" until a real workspace panel exists, even if library/tests are strong?
3. Do we want to allow any positive baud rate (including uncommon values) or enforce only the common predefined list?

## Suggested Fix Order (practical)
1. `P1`: Wire FE-13 into a real workspace panel/provider so users can actually use the feature.
2. `P1`: Fix read-loop `done` disconnection handling and deterministic shutdown/reconnect behavior.
3. `P1`: Complete profile semantics (capture/apply/validate full serial options).
4. `P2`: Add authorized-port selection flow and improve cancellation/error normalization.
5. `P2`: Improve reconnect test realism (attempt progression and timer-driven behavior).
6. `P3`: Update feature status tracking language to distinguish backend/library completion from UX completion.

## Bottom Line
FE-13 has a solid library foundation and extensive unit tests, but it is not yet a shipped user feature because runtime UI wiring is missing. The highest-value next move is to integrate a real hardware console view, then harden disconnect/reconnect and profile correctness so the serial workflow is trustworthy end-to-end.
