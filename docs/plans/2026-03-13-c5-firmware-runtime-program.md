# C5 Program Plan — Firmware Runtime, Simulation, and Debugger

> **For Claude:** Use the `executing-plans` skill when this program is converted into delivery waves.

**Goal:** Turn ProtoPulse's Arduino workbench into a real firmware runtime platform that can compile, execute, simulate, and debug supported embedded projects without forcing users back out to external tools.
**Architecture:** Native desktop application with direct toolchain access. Native toolchains (`arduino-cli`, `simavr`, `QEMU`, `OpenOCD`, GDB) run as direct child processes managed by the application. No helper daemon, no browser-mediated hardware access. Installation friction is accepted in exchange for full, uncompromised hardware and toolchain access.
**Tech Stack:** React 19, TypeScript, existing Arduino workbench routes/context, `arduino-cli`, `simavr`, `QEMU`, `OpenOCD`, GDB, Electron/Tauri (future native packaging), Express SSE/WebSocket, Drizzle ORM.

## Backlog Scope

- Primary C5 items: `BL-0631`, `BL-0632`, `BL-0635`, `BL-0461`
- Closely related items: `BL-0613`, `BL-0614`, `BL-0633`, `BL-0634`, `BL-0619`, `BL-0620`, `BL-0622`, `BL-0515`, `BL-0516`, `BL-0598`, `BL-0599`, `BL-0600`
- Existing spec anchors: `docs/arduino-ide-integration-spec.md`, `docs/arduino-ide-api-contracts.md`

## Executive Recommendation

Choose a **pure-local native runtime architecture**:

1. **Native desktop application**
   The application owns everything: editing, board/profile selection, visual circuit state, sensor controls, serial UI, debugging panels, **and** direct access to native toolchains, simulators, debuggers, and hardware ports. No privilege boundary between UI and execution.
2. **Direct child process management**
   `arduino-cli`, `simavr`, `QEMU`, `OpenOCD`, and GDB run as direct child processes spawned by the application. No intermediary daemon, no helper protocol, no signed handshakes. Standard Node.js `child_process` / Electron IPC.
3. **Curated in-app simulation later**
   Once the native runtime contract exists, add a curated in-app simulation path for a narrow supported subset (`AVR` + selected libraries + supported peripherals). This is a convenience layer on top of the native foundation, not a separate execution model.

Installation friction (users install native toolchains) is explicitly accepted. The tradeoff is correct: compromised hardware access is a worse outcome than a one-time install step. ProtoPulse targets makers who already have (or will have) `arduino-cli` installed.

## Why This Direction Wins

| Option | Strength | Failure Mode |
|--------|----------|--------------|
| Browser-only WASM | Great demo UX and lowest install friction | Unrealistic library/peripheral coverage, hard debugger story, high maintenance burden for serious boards |
| Hybrid (browser + helper daemon) | Keeps browser as primary shell | Adds protocol complexity, security boundary, signed versioning — all overhead with no real user benefit when running locally |
| **Pure-Local Native** | Full toolchain access, simplest architecture, best debugger/hardware story, zero protocol overhead | Requires native toolchain installation (acceptable for target audience) |

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
- No debugger session model, probe inventory, or GDB/OpenOCD orchestration layer.
- No shared contract mapping MCU pins/peripherals to schematic/breadboard/simulation entities.
- No clear support matrix that separates "instant in-app simulation" from "native toolchain required" flows.
- No native desktop packaging (Electron/Tauri) — currently runs as a local web app via `npm run dev`.

## External Research Notes

- Chrome's Web Serial API is well-suited for direct serial monitor UX, but it is explicitly user-grant and port-oriented, not a replacement for native toolchain or debugger orchestration. Source: Chrome for Developers, "Read from and write to a serial port" (`https://developer.chrome.com/docs/capabilities/serial`).
- Chrome's WebUSB API can reach vendor-specific USB interfaces, but official docs call out a major limitation: a page can only claim interfaces not already owned by OS or vendor drivers. That is a weak foundation for broad debugger support by itself. Source: Chrome for Developers, "Building a device for WebUSB" (`https://developer.chrome.com/docs/capabilities/build-for-webusb`).
- `simavr` advertises working GDB support and Arduino support, which makes it the best MVP candidate for AVR execution/debug experiments. Source: `simavr` README (`https://github.com/buserror/simavr`).
- PlatformIO's debug surface is configuration-heavy and assumes native debug tools and debug servers (`debug_tool`, `debug_server`, `debug_svd_path`, etc.), which reinforces the native-first direction for real probe support. Source: PlatformIO docs, "Debugging options" (`https://docs.platformio.org/en/latest/projectconf/sections/env/options/debug/index.html`).
- QEMU's official docs show broad Arm and RISC-V support, including some microcontroller-class targets, but board fidelity still varies a lot. Treat QEMU as a later-expansion lane, not the v1 AVR MVP path. Sources: QEMU docs (`https://www.qemu.org/docs/master/system/target-arm.html`, `https://www.qemu.org/docs/master/system/target-riscv.html`).

## Program Phases

### Phase 0 — Runtime ADRs and Capability Probe ✅ RESOLVED

**Purpose:** Lock the architecture before implementation starts mutating the workbench.

**Status:** Complete. Architecture decision made: **pure-local native**.

**Deliverables (done)**

- ADR 0007: Firmware runtime architecture — decided pure-local native over hybrid/browser-only (`docs/adr/0007-firmware-runtime-architecture.md`)
- ADR 0008: Debugger integration model — decided direct OpenOCD/GDB child processes (`docs/adr/0008-debugger-integration-model.md`)
- Supported-target matrix v1: `Arduino Uno/Nano` (AVR) first, explicit non-goals documented
- No helper trust model needed — native processes run with application-level permissions

### Phase 1 — Finish the Workbench Control Plane

**Purpose:** Close the trust gaps in compile/upload/serial before adding runtime complexity on top.

**Backlog dependencies**

- `BL-0515`, `BL-0516`, `BL-0598`, `BL-0599`, `BL-0600`

**Deliverables**

- Real streamed logs over SSE/WS (replace DB log flushing stand-in)
- Better structured diagnostics and error linking
- Stable board/profile/session persistence
- Explicit artifact storage for compiled outputs (`.hex`, `.elf` files)

**Likely files**

- Modify: [`server/arduino-service.ts`](/home/wtyler/Projects/ProtoPulse/server/arduino-service.ts)
- Modify: [`server/routes/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/routes/arduino.ts)
- Modify: [`server/storage/arduino.ts`](/home/wtyler/Projects/ProtoPulse/server/storage/arduino.ts)
- Modify: [`client/src/lib/contexts/arduino-context.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/lib/contexts/arduino-context.tsx)
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

### Phase 2 — Simulator-Based Firmware Execution MVP (`BL-0631`)

**Purpose:** Run compiled firmware in a locally-spawned simulator as a direct child process.

**MVP target**

- AVR only (`Arduino Uno` / `Nano` class) using `simavr`

**Approach**

- `simavr` runs as a direct child process spawned via Node.js `child_process.spawn()`
- Compiled `.hex`/`.elf` artifacts from Phase 1 are passed directly to the `simavr` process
- No intermediary daemon or protocol — stdin/stdout/stderr pipes for control and log capture
- Process lifecycle (start/stop/restart) managed by a `SimulatorProcessManager` class

**Deliverables**

- Compile artifact handoff into simulator child process
- Reset / pause / resume / fast-forward controls
- Serial output capture via `simavr` VCD/UART output
- Breakpoint and register inspection support where `simavr` allows it (via built-in GDB stub)

**Likely files**

- Create: `server/firmware-runtime/simavr-runner.ts`
- Create: `server/firmware-runtime/runtime-events.ts`
- Create: `server/firmware-runtime/process-manager.ts`
- Create: `server/__tests__/arduino-runtime-simavr.test.ts`
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

### Phase 3 — Firmware-to-Circuit Bridge (`BL-0461`)

**Purpose:** Make runtime output affect the circuit views instead of staying trapped in a code/debug silo.

**Approach**

- Direct IPC between the simulator child process and the circuit visualization layer
- Pin state changes from `simavr` are parsed from VCD output or GDB memory reads and forwarded to the simulation engine
- No protocol translation layer — the bridge reads native `simavr` output formats directly

**Deliverables**

- Pin adapter contract: digital outputs, PWM, ADC inputs, timing
- Bridge between runtime events and simulation state (direct in-process)
- Sensor/input injection from UI controls back into the runtime
- Shared board/pin mapping source of truth

**Likely files**

- Create: `shared/firmware-runtime-contract.ts`
- Create: `client/src/lib/simulation/firmware-bridge.ts`
- Modify: [`client/src/lib/simulation/visual-state.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation/visual-state.ts)
- Modify: [`client/src/lib/simulation/interactive-controls.ts`](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation/interactive-controls.ts)
- Modify: [`client/src/components/simulation/SimulationPanel.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/simulation/SimulationPanel.tsx)

### Phase 4 — Hardware Debugger MVP (`BL-0632`)

**Purpose:** Run OpenOCD and GDB as direct child processes for real hardware debugging.

**MVP target**

- One probe family first: `CMSIS-DAP` or `ST-LINK`, whichever has the cleanest OpenOCD configuration for the target environment

**Approach**

- `OpenOCD` runs as a direct child process; its telnet/GDB server ports are consumed locally
- `GDB` (or `gdb-multiarch`) runs as a direct child process connecting to OpenOCD's GDB server
- No proxy layer — the application spawns, monitors, and communicates with these processes directly via stdin/stdout and TCP
- Process lifecycle, port allocation, and cleanup handled by a `DebugSessionManager`

**Deliverables**

- Probe discovery via `openocd --search` or device enumeration
- Debug session lifecycle (launch, attach, detach, terminate)
- Breakpoints, step, continue, stack, locals/registers via GDB/MI protocol
- SVD-driven peripheral register panel for one supported target family

**Likely files**

- Create: `server/firmware-runtime/debug/openocd-manager.ts`
- Create: `server/firmware-runtime/debug/gdb-session.ts`
- Create: `server/firmware-runtime/debug/gdb-mi-parser.ts`
- Create: `client/src/components/views/arduino/DebuggerPanel.tsx`
- Create: `client/src/lib/arduino/debug-client.ts`

### Phase 5 — Curated In-App Simulation (`BL-0635`)

**Purpose:** Ship the magic demo path only after the runtime contract is honest and testable. This is a curated beginner-friendly simulation mode that runs a supported subset of Arduino sketches within the application without requiring external hardware or native toolchain installation.

**Guardrail**

- Treat this as a **curated beginner mode**, not general "run any Arduino sketch in the app".
- This layer sits **on top of** the native runtime foundation — it reuses the same runtime event contract and pin adapter from Phases 2-3.

**Deliverables**

- Supported library whitelist (e.g., `Servo`, `Wire`, basic `Serial`)
- Deterministic pin/timer/serial emulation contract
- Worker/WASM runtime that implements the same event protocol as the native `simavr` path
- "This project is outside instant-sim support" detection and graceful handoff to native toolchain path

**Likely files**

- Create: `client/src/lib/arduino/curated-runtime.ts`
- Create: `client/src/lib/arduino/curated-runtime-worker.ts`
- Create: `client/src/lib/arduino/supported-libs.ts`
- Modify: [`client/src/components/views/ArduinoWorkbenchView.tsx`](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)

## ADRs Required Before Coding Deeply

1. ✅ **Runtime authority (ADR 0007):** The application owns the canonical execution state directly. Native toolchains run as child processes. No helper daemon.
2. **Support matrix:** Which boards/frameworks are in v1, which require specific native toolchains, and which are explicitly unsupported?
3. **Bridge granularity:** Are circuit updates driven at GPIO/ADC/timer level, or via a higher-level board-abstraction layer?
4. ✅ **Debugger transport (ADR 0008):** OpenOCD is the default bridge. GDB/MI protocol for debugger communication. Direct child processes.
5. **Native packaging:** When does the app move from `npm run dev` local web app to Electron/Tauri native packaging? (Not blocking for C5, but shapes Phase 5.)

## Open Questions

- Should the first firmware-aware simulation target be schematic-only, breadboard-only, or both?
- Do we treat RP2040 and ESP32 as second-wave native targets, or wait until AVR is fully stable?
- What is the smallest supported library set for curated in-app simulation that still feels magical to beginners?
- When do we introduce Electron/Tauri packaging — before or after the firmware runtime is functional?
- How do we handle toolchain installation UX? Bundle `arduino-cli` or guide users through installation with in-app detection?

## Exit Criteria

This C5 program is "real" only when all of the following are true:

1. A user can compile and run a supported firmware target without external hardware (via native `simavr` child process).
2. Serial output, timing, and at least basic GPIO state are visible in ProtoPulse's circuit views.
3. At least one supported hardware probe can debug a real target through ProtoPulse (via native OpenOCD/GDB).
4. The UI clearly distinguishes `curated in-app simulation` (beginner mode) from `native toolchain simulation` (full mode) and `real hardware debugging`.
5. Unsupported boards/frameworks fail honestly with upgrade paths, not fake success states.

## Suggested First Delivery Cut

If only one slice gets funded first, do this:

1. Finish workbench trust gaps (Phase 1).
2. Ship `AVR + simavr + serial + GPIO bridge` MVP as direct child processes (Phases 2-3).

That path unlocks the largest share of `BL-0631`, `BL-0461`, and `BL-0635` while keeping `BL-0632` on a believable trajectory. No daemon overhead, no protocol design — just spawn the process and pipe the output.
