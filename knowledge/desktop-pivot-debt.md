---
description: Desktop-pivot risks — Tauri CSP disabled, node sidecar not self-contained, and the security/distribution debts the native pivot introduced
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# desktop-pivot-debt

Risks introduced when ProtoPulse pivoted from browser-based to native desktop via Tauri. The pivot unblocked hardware access and native toolchains but traded away the browser's sandboxing model and created new distribution constraints.

## The Pattern: Traded Sandboxing for Hardware Access

```
Browser mode
  → strict sandbox, no filesystem / serial / native exec
  → limited functionality, but limited blast radius
Tauri desktop mode
  → full filesystem, serial, native spawn_process
  → sandbox trade-off: XSS → session → window.__TAURI__ → RCE
  → distribution trade-off: sidecar requires Node.js installed on user machine
```

## Notes

- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- disabled CSP + `withGlobalTauri` turns any XSS into OS-level RCE (cross-listed in security-debt)
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- the desktop app depends on a system Node.js install and crashes without one
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- the positive side of the pivot: three C5 programs became feasible only in native mode

## Related Debt

- [[security-debt]] -- the Tauri attack chain is documented in full there
- [[architecture-decisions]] -- the decision to pivot is recorded alongside the core-stack decisions

---

Topics:
- [[gaps-and-opportunities]] — What ProtoPulse is missing, what's broken, and where the biggest opportunities are — the radar for development priorities
- [[architecture-decisions]] — Why ProtoPulse is built the way it is — trade-offs, constraints, and key architectural choices
