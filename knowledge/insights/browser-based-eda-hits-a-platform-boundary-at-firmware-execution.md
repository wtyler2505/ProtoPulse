---
summary: Firmware compilation and upload cannot run in a browser, forcing a hybrid architecture decision between browser-only WASM, local helper agent, or hybrid approach
areas: ["[[index]]"]
related insights:
  - "[[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] — the architectural conclusion that resolves this platform boundary"
  - "[[five-architecture-decisions-block-over-30-downstream-features-each]] — firmware runtime is one of the five blocking architecture decisions"
  - "[[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — the platform boundary matters because beginners need zero-install while pros need hardware access"
created: 2026-03-13
---

ProtoPulse's browser-only architecture works for everything until firmware execution. Compiling Arduino sketches and uploading to hardware requires native toolchain access that browsers cannot provide.

The C5 preplanning evaluated three architectures and reached a concrete recommendation: the hybrid model (browser-owned UX + local helper agent for native toolchains) is the only viable path. Browser-only via WASM can compile code but cannot access USB or serial hardware — a fundamental platform boundary. Pure-local (desktop app) provides full hardware access but sacrifices the zero-install accessibility that defines ProtoPulse. The hybrid model preserves both properties but introduces installation friction as a managed cost.

The recommended delivery sequence: session/auth hardening first, then browser-owned code editor and project management, then local helper as an optional enhancement that unlocks hardware features (compilation, upload, serial monitoring). Program plan documented in `docs/plans/2026-03-13-c5-firmware-runtime-program.md`.

## Topics

- [[index]]
