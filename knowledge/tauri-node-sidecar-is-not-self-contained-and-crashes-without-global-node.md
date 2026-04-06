---
description: "Tauri app spawns Express backend via global 'node' command — crashes if user doesn't have Node.js installed, violating self-contained desktop app standards"
type: debt-note
source: "conductor/comprehensive-audit.md §5"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["src-tauri/src/lib.rs"]
---

# Tauri desktop app is not self-contained because it spawns Express via the global node command

In production, the Tauri app (`src-tauri/src/lib.rs`) launches the Express backend by spawning a child process calling the global `node` command. The desktop app is NOT self-contained and will crash if the user doesn't have Node.js installed.

A properly bundled executable (via `pkg` or Tauri Sidecar Binaries) must be used. Hardware interaction (arduino-cli, serial ports) should also move from Node.js Express to native Rust Tauri plugins (`tauri-plugin-serialplugin`) for direct, non-blocking hardware buffer access.

---

Relevant Notes:
- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- Tauri has multiple configuration issues
- [[execsync-in-arduino-service-blocks-entire-express-event-loop]] -- hardware ops should go native

Topics:
- [[architecture-decisions]]
