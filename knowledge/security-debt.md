---
description: Security vulnerabilities found in the comprehensive audit — Tauri RCE chain, XSS/eval exploits, DoS vectors, and auth boundary gaps
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# security-debt

Security vulnerabilities identified in the April 2026 comprehensive audit. These cluster into an attack chain: XSS entry → session hijack → Tauri RCE escalation, plus independent DoS and auth boundary gaps.

## The Attack Chain (XSS → Session Hijack → RCE)

```
eval() in CircuitCodeView
  → executes arbitrary JS in main thread
  → reads session token from localStorage
  → full session hijack
  → if Tauri: window.__TAURI__.invoke('spawn_process')
  → arbitrary OS-level code execution
```

## Notes

- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- CSP null + withGlobalTauri = any XSS becomes RCE
- [[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]] -- eval + localStorage = the XSS entry point
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- burst OOM via 10 concurrent login requests
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- revoked users retain full WebSocket access
- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- gradual memory leak until OOM crash

## Previously Fixed

- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- fixed in Wave E (CORS allowlist)

---

Topics:
- [[gaps-and-opportunities]] — What ProtoPulse is missing, what's broken, and where the biggest opportunities are — the radar for development priorities
- [[architecture-decisions]] — Why ProtoPulse is built the way it is — trade-offs, constraints, and key architectural choices
