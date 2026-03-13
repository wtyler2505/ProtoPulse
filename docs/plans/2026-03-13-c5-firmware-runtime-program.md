# C5 Program Plan — Firmware Runtime, Simulation, and Debugger

> **For Claude:** Use the `executing-plans` skill when this program is converted into delivery waves.

**Goal:** Turn ProtoPulse's Arduino workbench into a real firmware runtime platform that can compile, execute, simulate, and debug supported embedded projects without forcing users back out to external tools.
**Architecture:** Keep the browser as the primary UX shell, but introduce a hybrid execution model: browser-managed state and visualization, local helper-managed native toolchains and debug transports, and a shared firmware-to-circuit adapter contract that can later support curated in-browser simulation.
**Tech Stack:** React 19, TypeScript, existing Arduino workbench routes/context, `arduino-cli`, `simavr`, `QEMU`, `OpenOCD`, GDB, Chromium Web Serial / WebUSB, Express SSE/WebSocket, Drizzle ORM.

## Backlog Scope

- Primary C5 items: `BL-0631`, `BL-0632`, `BL-0635`, `BL-0461`
- Closely related items: `BL-0613`, `BL-0614`, `BL-0633`, `BL-0634`, `BL-0619`, `BL-0620`, `BL-0622`, `BL-0515`, `BL-0516`, `BL-0598`, `BL-0599`, `BL-0600`
- Existing spec anchors: `docs/arduino-ide-integration-spec.md`, `docs/arduino-ide-api-contracts.md`

## Executive Recommendation

Choose a **hybrid runtime architecture**:

1. **Browser-first UX shell**
   The browser owns editing, board/profile selection, visual circuit state, sensor controls, serial UI, and debugging panels.
2. **Local helper for native execution**
   A local helper owns the hard parts that already want native processes or privileged device access: toolchains, `simavr`, `QEMU`, `OpenOCD`, GDB, and long-running job orchestration.
3. **Curated browser simulation later**
   Once the helper-backed runtime contract exists, add a curated browser-only path for a narrow supported subset (`AVR` + selected libraries + supported peripherals) instead of pretending all Arduino code will run in-browser on day one.

This is the shortest path that unlocks all four C5 items without lying to users about capability breadth.

## Why This Direction Wins

| Option | Strength | Failure Mode |
|--------|----------|--------------|
| Browser-only WASM | Great demo UX and lowest install friction | Unrealistic library/peripheral coverage, hard debugger story, high maintenance burden for serious boards |
| Local-helper only | Most feasible for native tooling, simulation, and debugging | Risks feeling like a thin remote control unless the browser keeps strong visual ownership |
| **Hybrid** | Best balance of feasibility, trust, and future browser-native upside | Requires a helper protocol and clear security boundary up front |

## Current Repo Readiness

### Already in place

- [`server/arduino-service.ts`](/home/wtyler/Projects/ProtoPulse/server/arduino-service.ts) already manages workspace files, library/core operations, sketch generation, and background compile/upload jobs.
- [`server/routes/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/arduino.ts) already exposes health, workspace, files, libraries, cores, profiles, jobs, and basic serial-session routes under `/api/projects/:id/arduino/*`.
- [`server/storage/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/storage/arduino.ts) and the Arduino tables in [`shared/schema.ts`](/home/wtyler/Projects/ProtoPulse/shared/schema.ts) already provide persistence for workspaces, profiles, jobs, serial sessions, and file metadata.
- [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx) and [`client/src/lib/contexts/arduino-context.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/lib/contexts/arduino-context.tsx) already provide a credible compile/upload/profile UI shell.
- The existing simulation stack under [`client/src/lib/simulation/`](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation/) already has circuit solving, overlays, visual state, current animation, sensor controls, and analysis infrastructure that a firmware bridge can feed.
- The browser already has hardware-adjacent UX precedent via [`client/src/components/panels/SerialMonitorPanel.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/SerialMonitorPanel.tsx) and [`client/src/lib/web-serial.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/web-serial.ts).

### Not in place yet

- No runtime abstraction for "compiled firmware artifact -> execution target -> pin/serial/time events".
- No true streaming log transport for Arduino jobs yet; [`server/arduino-service.ts`](/home/wtyler/Projects/ProtoPulse/server/arduino-service.ts) explicitly notes DB log flushing as a stand-in for real SSE/WS streaming.
- No helper/agent process model for privileged local integrations.
- No debugger session model, probe inventory, or GDB/OpenOCD orchestration layer.
- No shared contract mapping MCU pins/peripherals to schematic/breadboard/simulation entities.
- No clear support matrix that separates "instant beginner-safe simulation" from "native helper required" flows.

## External Research Notes

- Chrome's Web Serial API is well-suited for direct serial monitor UX, but it is explicitly user-grant and port-oriented, not a replacement for native toolchain or debugger orchestration. Source: Chrome for Developers, "Read from and write to a serial port" (`https://developer.chrome.com/docs/capabilities/serial`).
- Chrome's WebUSB API can reach vendor-specific USB interfaces, but official docs call out a major limitation: a page can only claim interfaces not already owned by OS or vendor drivers. That is a weak foundation for broad debugger support by itself. Source: Chrome for Developers, "Building a device for WebUSB" (`https://developer.chrome.com/docs/capabilities/build-for-webusb`).
- `simavr` advertises working GDB support and Arduino support, which makes it the best MVP candidate for AVR execution/debug experiments. Source: `simavr` README (`https://github.com/buserror/simavr`).
- PlatformIO's debug surface is configuration-heavy and assumes native debug tools and debug servers (`debug_tool`, `debug_server`, `debug_svd_path`, etc.), which reinforces the helper-first direction for real probe support. Source: PlatformIO docs, "Debugging options" (`https://docs.platformio.org/en/latest/projectconf/sections/env/options/debug/index.html`).
- QEMU's official docs show broad Arm and RISC-V support, including some microcontroller-class targets, but board fidelity still varies a lot. Treat QEMU as a later-expansion lane, not the v1 AVR MVP path. Sources: QEMU docs (`https://www.qemu.org/docs/master/system/target-arm.html`, `https://www.qemu.org/docs/master/system/target-riscv.html`).

## Program Phases

### Phase 0 — Runtime ADRs and Capability Probe

**Purpose:** Lock the architecture before implementation starts mutating the workbench.

**Deliverables**

- ADR: firmware execution architecture (`browser-only` vs `helper` vs `hybrid`)
- ADR: debugger integration model
- Supported-target matrix v1 (`Arduino Uno/Nano` first, explicit non-goals)
- Helper trust model and local install story

**Likely files**

- Create: `docs/adr/0007-firmware-runtime-architecture.md`
- Create: `docs/adr/0008-debugger-integration-model.md`
- Create: `docs/plans/2026-03-13-c5-firmware-runtime-program.md`

### Phase 1 — Finish the Workbench Control Plane

**Purpose:** Close the trust gaps in compile/upload/serial before adding runtime complexity on top.

**Backlog dependencies**

- `BL-0515`, `BL-0516`, `BL-0598`, `BL-0599`, `BL-0600`

**Deliverables**

- Real streamed logs over SSE/WS
- Better structured diagnostics and error linking
- Stable board/profile/session persistence
- Explicit artifact storage for compiled outputs

**Likely files**

- Modify: [`server/arduino-service.ts`](/home/wtyler/Projects/ProtoPulse/server/arduino-service.ts)
- Modify: [`server/routes/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/arduino.ts)
- Modify: [`server/storage/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/storage/arduino.ts)
- Modify: [`client/src/lib/contexts/arduino-context.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/lib/contexts/arduino-context.tsx)
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

### Phase 2 — Local Helper and Runtime Session Foundation

**Purpose:** Introduce the privileged execution surface once, then reuse it for simulation and debugging.

**Deliverables**

- Helper daemon/process with signed protocol versioning
- Runtime sessions table(s) and artifact registry
- Per-project process watchdog, logs, cancellation, and lease cleanup
- Transport contract for logs, pin changes, serial output, and control commands

**Likely files**

- Create: `server/runtime-helper/README.md`
- Create: `server/runtime-helper/protocol.ts`
- Create: `server/runtime-helper/session-manager.ts`
- Create: `server/routes/arduino-runtime.ts` or extend [`server/routes/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/arduino.ts)
- Modify: [`shared/schema.ts`](/home/wtyler/Projects/ProtoPulse/shared/schema.ts)

### Phase 3 — Simulator-Based Firmware Execution MVP (`BL-0631`)

**Purpose:** Run compiled firmware in a helper-backed simulator before trying to make it fully visual and browser-native.

**MVP target**

- AVR only (`Arduino Uno` / `Nano` class) using `simavr`

**Deliverables**

- Compile artifact handoff into simulator sessions
- Reset / pause / resume / fast-forward controls
- Serial output capture
- Breakpoint and register inspection support where simulator allows it

**Likely files**

- Create: `server/runtime-helper/targets/simavr-runner.ts`
- Create: `server/runtime-helper/runtime-events.ts`
- Create: `server/__tests__/arduino-runtime-simavr.test.ts`
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

### Phase 4 — Firmware-to-Circuit Bridge (`BL-0461`)

**Purpose:** Make runtime output affect the circuit views instead of staying trapped in a code/debug silo.

**Deliverables**

- Pin adapter contract: digital outputs, PWM, ADC inputs, timing
- Bridge between runtime events and simulation state
- Sensor/input injection from UI controls back into the runtime
- Shared board/pin mapping source of truth

**Likely files**

- Create: `shared/firmware-runtime-contract.ts`
- Create: `client/src/lib/simulation/firmware-bridge.ts`
- Modify: [`client/src/lib/simulation/visual-state.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation/visual-state.ts)
- Modify: [`client/src/lib/simulation/interactive-controls.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation/interactive-controls.ts)
- Modify: [`client/src/components/simulation/SimulationPanel.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/simulation/SimulationPanel.tsx)

### Phase 5 — Hardware Debugger MVP (`BL-0632`)

**Purpose:** Reuse the helper channel for real probes instead of trying to bolt debugging onto browser APIs alone.

**MVP target**

- One probe family first: `CMSIS-DAP` or `ST-LINK`, whichever has the cleanest helper/OpenOCD story in the target environment

**Deliverables**

- Probe discovery inventory
- Debug session lifecycle
- Breakpoints, step, continue, stack, locals/registers
- SVD-driven peripheral register panel for one supported target family

**Likely files**

- Create: `server/runtime-helper/debug/openocd-manager.ts`
- Create: `server/runtime-helper/debug/gdb-session.ts`
- Create: `client/src/components/views/arduino/DebuggerPanel.tsx`
- Create: `client/src/lib/arduino/debug-client.ts`

### Phase 6 — Curated Browser Code Simulation (`BL-0635`)

**Purpose:** Ship the magic demo path only after the runtime contract is honest and testable.

**Guardrail**

- Treat this as a **curated beginner mode**, not general "run any Arduino sketch in the browser".

**Deliverables**

- Supported library whitelist
- Deterministic pin/timer/serial emulation contract
- Worker/WASM runtime or helper-backed fallback with the same event protocol
- "This project is outside instant-sim support" detection and handoff

**Likely files**

- Create: `client/src/lib/arduino/browser-runtime.ts`
- Create: `client/src/lib/arduino/browser-runtime-worker.ts`
- Create: `client/src/lib/arduino/supported-libs.ts`
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

## ADRs Required Before Coding Deeply

1. **Runtime authority:** Does the helper own the canonical execution state, with the browser as a subscriber/controller?
2. **Support matrix:** Which boards/frameworks are in v1, which are helper-only, and which are explicitly unsupported?
3. **Bridge granularity:** Are circuit updates driven at GPIO/ADC/timer level, or via a higher-level board-abstraction layer?
4. **Debugger transport:** Is OpenOCD the default bridge, or do we support probe-specific adapters?
5. **Security model:** How are helper permissions scoped, updated, and surfaced to the user?

## Open Questions

- Should the first firmware-aware simulation target be schematic-only, breadboard-only, or both?
- Do we treat RP2040 and ESP32 as second-wave helper targets, or wait until AVR is fully stable?
- Does the helper live inside the main server process for local dev or as a separate desktop-side service from day one?
- What is the smallest supported library set for instant browser simulation that still feels magical to beginners?

## Exit Criteria

This C5 program is "real" only when all of the following are true:

1. A user can compile and run a supported firmware target without hardware.
2. Serial output, timing, and at least basic GPIO state are visible in ProtoPulse.
3. At least one supported hardware probe can debug a real target through ProtoPulse.
4. The UI clearly distinguishes `instant simulation`, `helper-backed simulation`, and `real hardware debugging`.
5. Unsupported boards/frameworks fail honestly with upgrade paths, not fake success states.

## Suggested First Delivery Cut

If only one slice gets funded first, do this:

1. Finish workbench trust gaps.
2. Build the helper/runtime session layer.
3. Ship `AVR + simavr + serial + GPIO bridge` MVP.

That path unlocks the largest share of `BL-0631`, `BL-0461`, and `BL-0635` while keeping `BL-0632` on a believable trajectory.
