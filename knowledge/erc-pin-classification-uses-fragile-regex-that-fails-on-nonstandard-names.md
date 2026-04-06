---
description: "classifyPin relies on hardcoded regex matching (vcc|vdd|vin...) rather than parts database lookup — false positives for non-standard or localized pin names"
type: debt-note
source: "conductor/comprehensive-audit.md §8"
confidence: proven
topics: ["[[eda-fundamentals]]"]
related_components: ["client/src/lib/circuit-editor/erc-engine.ts"]
---

# ERC pin classification uses fragile regex heuristics that fail on non-standard component names

In `erc-engine.ts`, the `classifyPin` function relies strictly on hardcoded regex string matching (e.g., `/^(vcc|vdd|vin...)$/i`) rather than an explicit parts database lookup or metadata definition. This will produce false-positive DRC errors for any non-standard component or localized pin names.

The core DRC/ERC engine traverses the node graph entirely in JavaScript. Leading 2026 web EDA tools compile their ERC rule engines to WebAssembly (Rust → Wasm) for 5-20x faster numeric geometric rule checks, running in a background Web Worker.

---

Relevant Notes:
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- another engine that should be Wasm + Worker

Topics:
- [[eda-fundamentals]]
