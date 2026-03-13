---
summary: Firmware compilation and upload cannot run in a browser, forcing a hybrid architecture decision between browser-only WASM, local helper agent, or hybrid approach
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's browser-only architecture works for everything until firmware execution. Compiling Arduino sketches and uploading to hardware requires native toolchain access that browsers cannot provide. The three options — browser-only via WASM compilation, a local helper agent that handles native operations, or a hybrid approach — each have fundamental tradeoffs around accessibility, capability, and installation friction. This is the #1 blocker in the backlog.

## Topics

- [[index]]
