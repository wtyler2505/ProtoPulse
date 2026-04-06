---
description: "tauri.conf.json sets csp:null and withGlobalTauri:true — any XSS escalates to arbitrary remote code execution on the host OS"
type: debt-note
source: "conductor/comprehensive-audit.md §5, §16, §20"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["src-tauri/tauri.conf.json", "src-tauri/src/lib.rs", "src-tauri/capabilities/main.json"]
---

# Tauri CSP is disabled and withGlobalTauri exposes native APIs so any XSS becomes instant RCE

Three compounding Tauri security failures create a critical attack chain:

1. **CSP disabled**: `"csp": null` in `tauri.conf.json` completely disables Content Security Policy in the WebView. XSS payloads execute uninhibited.
2. **Global Tauri API**: `"withGlobalTauri": true` injects the Rust Tauri API into `window.__TAURI__`. An attacker can directly invoke `window.__TAURI__.invoke('spawn_process', ...)` for instant RCE.
3. **No command allowlisting**: The `spawn_process` command is exposed without validation in `capabilities/main.json`.

External threat intelligence confirms this is the most dangerous Tauri configuration possible — security researchers (Huntress) explicitly cite `withGlobalTauri: true` + missing CSP as a critical escalation path.

Combined with the `eval()` vulnerability in CircuitCodeView, a shared project containing malicious code achieves full OS-level code execution.

---

Relevant Notes:
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- another security boundary failure
- [[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]] -- eval() provides the XSS entry point that CSP-disabled Tauri escalates to RCE
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- three compounding Tauri configuration failures
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- both are boundary failures: CSP at the browser level, session at the WebSocket level
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- the pivot introduced these Tauri-specific security risks that didn't exist in browser mode

Topics:
- [[architecture-decisions]]
