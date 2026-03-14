# ADR-0009: Tauri v2 over Electron for Native Desktop Shell

**Status:** Accepted
**Date:** 2026-03-14
**Deciders:** Tyler

## Context

ProtoPulse has pivoted from a browser-based/hybrid platform to a pure-local native desktop application. The desktop shell needs to provide hardware access (USB/serial ports), native toolchain execution (Arduino CLI, firmware compilers), and local filesystem operations.

Electron ships a bundled Chromium (~150MB), resulting in 200-400MB RAM at idle. ProtoPulse targets makers and hobbyists who often run on older or resource-constrained hardware (Raspberry Pi, older laptops) where memory and disk footprint matter. Electron's process model (main + renderer + GPU) compounds the overhead.

## Decision

Use Tauri v2 with the system webview and a Rust backend for IPC commands, replacing Electron as the desktop shell.

## Rationale

- **10-30x smaller bundle**: Tauri uses the OS-provided webview (WebKitGTK on Linux, WebView2 on Windows, WKWebView on macOS) instead of shipping Chromium. Typical bundle: 5-10MB vs 150MB+.
- **3-5x less RAM**: No bundled browser engine. Typical idle: 30-80MB vs 200-400MB.
- **Rust backend for IPC**: Native process spawning (Arduino CLI, serial monitors), filesystem access, and USB communication are natural fits for Rust's `std::process::Command` and `serialport` crate. Faster than Node.js child_process for latency-sensitive operations.
- **Security**: Tauri's IPC is allowlist-based — only explicitly permitted commands are callable from the frontend. Electron's `contextBridge` requires manual hardening.
- **Native desktop features**: System tray, native menus, file dialogs, auto-updater, and deep links are first-class in Tauri v2.

## Consequences

### Positive

- Dramatically smaller installer and runtime footprint — critical for the maker/hobbyist audience
- Rust backend enables direct, low-latency hardware communication (serial ports, USB) without Node.js bridges
- System webview means automatic security patches from OS updates
- Tauri v2's mobile support (iOS/Android) opens future possibilities without additional frameworks

### Negative

- Rust learning curve for backend extensions beyond the thin IPC command layer
- System webview may have minor rendering differences across Linux distributions (WebKitGTK versions)
- Smaller ecosystem than Electron — fewer community plugins and examples

### Mitigated

- All complex business logic stays in the Express server (TypeScript). The Rust backend is a thin command layer for hardware IPC, process spawning, and filesystem operations — not a rewrite of the application.
- WebKitGTK rendering differences are minimal for the CSS/JS features ProtoPulse uses (Tailwind, React, shadcn/ui). Tested on Ubuntu 22.04+ and Linux Mint 21+.
- Tauri v2 has matured significantly with strong documentation and active community support.
