# ADR-0008: Multi-Platform Embedded Scope — Beyond Arduino

**Status:** Accepted
**Date:** 2026-03-13
**Deciders:** Tyler
**Tracking:** C5-SCOPE, BL-0648

## Context

ProtoPulse originally focused on Arduino (AVR-based boards like the Mega 2560) because that was the hardware in the OmniTrek Nexus rover. However, the maker/hobbyist ecosystem spans far more platforms: ESP32, ESP8266, Raspberry Pi Pico (RP2040/RP2350), STM32 (Blue Pill, Nucleo, Discovery), Teensy, nRF52, SAMD, and others.

Limiting ProtoPulse to Arduino-only would:

1. Exclude the fastest-growing segments of the hobby market (ESP32 for IoT, Pico for education, STM32 for performance).
2. Miss the opportunity to be the "one tool for everything" — makers routinely use multiple platforms in a single project (e.g., Arduino Mega for motor control + ESP32 for WiFi telemetry).
3. Create artificial constraints on the firmware toolchain architecture (C5), which must support platform-specific compilation, upload protocols, and debug interfaces anyway.

## Decision

ProtoPulse will support **multiple embedded platforms** through a platform-abstraction layer, with Arduino as the first-class default and incremental support for additional platforms.

### Platform Tiers

| Tier | Platforms | Support Level |
| ---- | --------- | ------------- |
| **Tier 1** (full support) | Arduino (AVR, SAMD, Mbed), ESP32, Raspberry Pi Pico (RP2040) | Compile, upload, debug, simulate, serial monitor, pinout diagrams, AI-assisted coding |
| **Tier 2** (compile + upload) | STM32 (via STM32duino or PlatformIO), Teensy, ESP8266 | Compile, upload, serial monitor. Debug and simulation best-effort. |
| **Tier 3** (basic) | nRF52, RISC-V boards, other PlatformIO-supported targets | Compile and upload via PlatformIO. No custom pinout or simulation support. |

### Abstraction Model

Each platform is described by a `PlatformProfile` that encodes:

- **Board identifiers**: FQBN (Arduino) or PlatformIO board ID.
- **Toolchain**: Which compiler and uploader to invoke (`arduino-cli`, `platformio`, `esptool.py`, `picotool`, `openocd`).
- **Upload protocol**: Serial (STK500, AVRDUDE), USB DFU, UF2 drag-and-drop, JTAG/SWD.
- **Debug interface**: OpenOCD + GDB target config, or "not supported."
- **Simulator**: `simavr` (AVR), `QEMU` (ARM Cortex-M), Wokwi engine (ESP32), or "not supported."
- **Pinout map**: GPIO pin definitions, alternate functions, ADC/DAC channels, PWM timers.
- **Memory map**: Flash size, RAM size, EEPROM, stack/heap defaults.

The `ToolchainRunner` (see ADR-0007) dispatches to the correct toolchain based on the active project's `PlatformProfile`. The user selects their board from a searchable list; the profile handles the rest.

### Firmware Template System

Each Tier 1 platform ships with starter templates:

- **Blink**: GPIO output basics.
- **Serial echo**: UART communication.
- **WiFi scan** (ESP32/Pico W): Network connectivity.
- **Sensor read**: ADC input with value display.
- **Motor control**: PWM output patterns.

Templates are parameterized by the platform's pin definitions, clock speed, and peripheral availability. The AI assistant can generate platform-specific code using the active `PlatformProfile` context.

## Rationale

- **Reflects how makers actually work**: Multi-board projects are the norm, not the exception. Supporting only Arduino would immediately force users to leave ProtoPulse for their ESP32 or Pico work.
- **PlatformIO as a force multiplier**: PlatformIO already supports 1,000+ boards. By integrating with PlatformIO as a Tier 2/3 backend, ProtoPulse inherits broad hardware support without maintaining per-board toolchains.
- **arduino-cli for Tier 1 Arduino**: `arduino-cli` is the official Arduino toolchain and handles board package management, library dependencies, and compilation. It's the natural choice for Arduino-first support.
- **Incremental rollout**: Tier 1 platforms are the most popular in the maker community. Tier 2 and 3 can be added incrementally based on user demand without architectural changes.
- **AI benefits from platform context**: When the AI knows the target platform (pin count, peripherals, memory constraints), it generates better firmware code. A platform-aware AI is more useful than a generic one.

## Consequences

- **PlatformProfile schema**: Requires a new data model for platform descriptions. This will live in `shared/` as a TypeScript type with runtime validation.
- **Toolchain discovery**: The app must detect which toolchains are installed (`arduino-cli`, `platformio`, `esptool.py`, etc.) and guide the user through installation of missing ones.
- **Pinout database**: Tier 1 platforms need complete pinout maps. This is a data entry effort (~50-100 pins per board, ~10-15 Tier 1 boards initially).
- **Test matrix expansion**: Firmware compilation tests must cover at least Tier 1 platforms. CI needs access to toolchain binaries (or mock them).
- **UI complexity**: Board selection, platform-specific settings, and per-platform upload protocols add UI surface area. Must remain simple for beginners (auto-detect board, suggest defaults) while exposing full control for advanced users.
- **Simulation coverage**: Not all platforms have simulators. Must clearly communicate when simulation is unavailable and suggest alternatives (e.g., "ESP32 simulation is Tier 2 — use Wokwi for now").
