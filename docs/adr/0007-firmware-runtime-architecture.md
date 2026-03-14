# ADR-0007: Firmware Runtime Architecture — Pure-Local Native Execution

**Status:** Accepted
**Date:** 2026-03-13
**Deciders:** Tyler
**Tracking:** C5-FIRMWARE, BL-0647

## Context

ProtoPulse aims to provide a complete firmware development workflow — write, compile, upload, debug, simulate — without leaving the tool. The original architecture was browser-based, which created a fundamental tension: browsers are sandboxed environments with no direct access to USB/serial ports (beyond the limited Web Serial API), no ability to spawn native processes (like `arduino-cli` or `avr-gcc`), and no local filesystem access for toolchain management.

Three approaches were evaluated:

1. **Browser-only with Web Serial**: Limited to serial monitor and upload (no compilation, no debug, no simulation). Web Serial API coverage is incomplete (no Firefox/Safari). Cannot invoke `arduino-cli` or manage board packages.

2. **Browser + local helper daemon**: A companion process (like the Arduino Create Agent) bridges the browser to native toolchains. Adds installation friction, a second update surface, IPC complexity (WebSocket or HTTP tunneling), and security concerns (local HTTP server with CORS). Every native capability requires explicit bridging.

3. **Pure-local native desktop application**: The application runs as a desktop app (Electron or Tauri), with the renderer having full access to Node.js APIs, the local filesystem, and the ability to spawn native processes directly. No bridging layer needed.

## Decision

Adopt **Option 3: Pure-Local Native Desktop Application** as the firmware runtime architecture.

ProtoPulse will package as a native desktop application where:

- **Compilation** invokes `arduino-cli compile` (or `platformio run`) as a child process, streaming stdout/stderr to the UI in real-time.
- **Upload** invokes `arduino-cli upload` with the correct board FQBN and port, discovered via `arduino-cli board list`.
- **Simulation** runs `simavr` or `QEMU` as native subprocesses for hardware-less testing.
- **Debugging** launches `openocd` + `gdb` for on-chip debug sessions, with a GDB Machine Interface (MI) frontend in the UI.
- **Serial monitor** uses native serial port access (Node.js `serialport` package or direct OS APIs) rather than Web Serial.
- **Toolchain management** installs and updates board packages, libraries, and cores via `arduino-cli core install` / `arduino-cli lib install`, with progress streamed to the UI.

All native process invocations go through a single `ToolchainRunner` abstraction that handles spawning, streaming, cancellation, and error normalization.

## Rationale

- **Zero bridging complexity**: No daemon, no WebSocket tunnel, no CORS, no second install. The app IS the native process.
- **Full toolchain access**: `arduino-cli`, `platformio`, `avr-gcc`, `arm-none-eabi-gcc`, `simavr`, `QEMU`, `openocd`, `gdb` — all invocable directly.
- **Filesystem access**: Read/write project files, manage toolchain installations, access board package caches — all without browser storage gymnastics.
- **USB/serial without Web Serial**: Native `serialport` package works on all platforms, all browsers (since there's no browser), with full DTR/RTS control.
- **Installation friction is acceptable**: The target audience (makers building real hardware) already installs Arduino IDE, KiCad, and similar desktop tools. A desktop app is the expected form factor for an EDA tool.
- **Competitive alignment**: KiCad, Altium, Fritzing, Arduino IDE — all desktop applications. Browser-only EDA tools (TinkerCad, Wokwi) are limited to simulation and learning; they don't cover the full design-to-fabrication pipeline.

## Consequences

- **Electron/Tauri adoption required**: Must choose and integrate a desktop shell. Electron is heavier but has mature Node.js integration; Tauri is lighter but requires Rust for native APIs. Decision deferred to implementation phase.
- **Cross-platform builds**: Must produce installers for Windows, macOS, and Linux. CI/CD pipeline needs platform-specific build steps.
- **No more PWA/offline-first**: The service worker and IndexedDB sync layer become unnecessary for the primary distribution. May retain a "viewer-only" web mode for sharing designs.
- **Toolchain dependency management**: The app must detect, install, and update native toolchains. Need graceful UX for missing dependencies (e.g., "arduino-cli not found — install now?").
- **Security model changes**: Native apps have full system access. Must be thoughtful about executing user-provided code (firmware sketches) and AI-generated commands. Sandboxing shifts from browser to OS-level (e.g., running user code in a restricted subprocess).
- **Auto-update mechanism**: Desktop apps need an update channel (electron-updater, Tauri updater, or manual download).
