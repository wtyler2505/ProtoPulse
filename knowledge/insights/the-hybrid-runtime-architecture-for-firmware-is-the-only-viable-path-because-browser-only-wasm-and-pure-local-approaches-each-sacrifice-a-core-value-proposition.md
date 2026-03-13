---
summary: Browser-only WASM cannot access USB/serial hardware; pure-local loses zero-install accessibility — hybrid (browser UX + local helper) is the only viable firmware architecture
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's C5 preplanning evaluated three firmware runtime architectures and concluded that the hybrid model is the only viable path. Browser-only via WASM can compile code but cannot access USB or serial hardware for upload — a fundamental platform boundary that no amount of engineering can overcome. Pure-local (desktop app) provides full hardware access but sacrifices the zero-install, works-anywhere accessibility that defines ProtoPulse's value proposition. The hybrid model — browser owns the UX while a local helper agent handles native toolchain operations (compilation, upload, serial communication) — preserves both properties but introduces installation friction as a managed cost. The recommended delivery sequence: browser-owned code editor and project management first, local helper as an optional enhancement that unlocks hardware features.

## Topics

- [[index]]
