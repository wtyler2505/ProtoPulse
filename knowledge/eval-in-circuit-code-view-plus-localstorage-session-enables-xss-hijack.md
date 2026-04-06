---
description: "CircuitCodeView calls eval() on user code in the main thread while sessions are stored in localStorage — XSS leads to full session hijack"
type: debt-note
source: "conductor/comprehensive-audit.md §15"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/components/views/CircuitCodeView.tsx", "client/src/lib/client-state-scope.ts"]
---

# eval() in CircuitCodeView combined with localStorage session tokens creates a full XSS-to-hijack chain

`CircuitCodeView.tsx` explicitly calls `debouncedEval(newCode)`, allowing arbitrary JavaScript execution in the React application context. Session tokens live in `localStorage` via `client-state-scope.ts`, making them permanently accessible to any JavaScript running on the page.

Attack chain: shared project with malicious code → eval executes it → attacker reads session token from localStorage → full session hijack. Combined with the Tauri `withGlobalTauri` exposure, this escalates to OS-level RCE.

The DSL Worker sandbox (`circuit-dsl-worker.ts`) attempts to sandbox by deleting dangerous globals, but this is trivially bypassed via prototype chains (e.g., `({}).constructor.constructor('return fetch')()`).

Fix: evaluate user code in a secure Web Worker sandbox (not the main thread), migrate sessions to `SameSite=Strict; HttpOnly; Secure` cookies.

---

Relevant Notes:
- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- the escalation path from XSS to RCE

Topics:
- [[architecture-decisions]]
