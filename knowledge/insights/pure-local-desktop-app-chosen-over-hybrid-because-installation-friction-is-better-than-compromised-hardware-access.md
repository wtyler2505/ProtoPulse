---
summary: Hybrid browser+helper was superseded by pure-local desktop app because installation is a one-time cost while compromised hardware access is a permanent capability ceiling
category: architectural-decision
areas: ["[[architecture]]", "[[index]]"]
wave: "81"
created: 2026-03-13
---

# Pure-local desktop app chosen over hybrid because installation friction is better than compromised hardware access

ProtoPulse's C5 preplanning evaluated three firmware runtime architectures:

1. **Browser-only WASM** -- Can compile code but cannot access USB/serial hardware for upload. A fundamental platform boundary that no engineering can overcome.
2. **Hybrid (browser UX + local helper agent)** -- Browser owns the UX while a local helper handles native toolchain operations (compilation, upload, serial communication). Preserves zero-install accessibility for non-hardware features but introduces protocol complexity and security boundaries between browser and helper.
3. **Pure-local native desktop app** -- Full hardware access, full filesystem access, full toolchain integration. Requires installation.

The hybrid model was initially chosen as the best balance: it preserved browser-based zero-install accessibility while unlocking hardware features through an optional local helper. This seemed like the best of both worlds.

The pivot happened because the trade-off analysis was wrong. Installation friction is a **one-time cost** that users of real tools accept without hesitation -- VS Code, Arduino IDE, KiCad, Fusion 360, and every other serious maker/engineering tool requires installation. Zero-install is a nice-to-have, not a core value proposition for a tool that aspires to replace KiCad and Arduino IDE. Compromised hardware access, on the other hand, is a **permanent capability ceiling** that limits what ProtoPulse can become. The hybrid helper adds protocol complexity (WebSocket communication, security boundaries, process lifecycle management) and a security surface area without solving the fundamental problem: the browser is not the right runtime for a tool that needs deep OS integration.

The pure-local desktop approach (likely Electron/Tauri) accepts installation friction as the better trade-off. One-time installation cost is amortized over thousands of sessions. Compromised hardware access would be paid on every session, forever.

---

Related Insights:
- [[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] -- the prior recommendation this insight supersedes
- [[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] -- the platform boundary that drove this architectural decision
- [[five-architecture-decisions-block-over-30-downstream-features-each]] -- firmware runtime was one of the five blocking architecture decisions

Areas:
- [[architecture]]
- [[index]]
