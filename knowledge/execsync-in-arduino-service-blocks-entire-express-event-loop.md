---
description: "discoverBoards, searchLibraries, and listCores use execSync/execFileSync, completely freezing the API for all users during shell execution"
type: debt-note
source: "conductor/comprehensive-audit.md §9"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/arduino-service.ts"]
---

# execSync in arduino-service blocks the entire Express event loop freezing the API for all users

In `server/arduino-service.ts`, methods like `discoverBoards`, `searchLibraries`, and `listCores` use `execSync` and `execFileSync`. Since these run within the Express server process, they completely block the event loop while waiting for the shell command to return. Every other API request queues up behind it. For the Tauri native desktop path, these should migrate to async Rust Tauri plugin calls.

---

Relevant Notes:
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- hardware ops need non-blocking paths

Topics:
- [[architecture-decisions]]
