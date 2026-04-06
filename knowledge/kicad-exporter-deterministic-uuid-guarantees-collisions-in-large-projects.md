---
description: "deterministicUuid() uses a simple FNV-1a-inspired hash that is not a true UUIDv4 — ID collisions are guaranteed in massive PCB projects"
type: debt-note
source: "conductor/comprehensive-audit.md §6"
confidence: proven
topics: ["[[eda-fundamentals]]"]
related_components: ["server/export/kicad-exporter.ts"]
---

# KiCad exporter uses a fake UUID function that guarantees collisions in large PCB projects

The KiCad exporter (`server/export/kicad-exporter.ts`) implements a custom `deterministicUuid()` function using a simple FNV-1a-inspired hash. This avoids `crypto` module dependencies but is not a true UUIDv4 — it guarantees ID collisions in massive PCB projects, leading to corrupted KiCad saves.

More broadly, the entire export pipeline (Gerber, KiCad 8) is built via thousands of lines of fragile string concatenation in TypeScript. The 2026 standard is compiling native C++ KiCad source code to WebAssembly via Emscripten, executing native plotting routines in the browser at 90-95% native speed and eliminating formatting bugs entirely.

---

Relevant Notes:
- [[dual-export-system-is-a-maintenance-trap]] -- string concatenation exports compound the maintenance burden
- [[erc-pin-classification-uses-fragile-regex-that-fails-on-nonstandard-names]] -- both are EDA pipeline fragility: fake UUIDs + regex-based classification
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- export quality gaps contribute to the PCB domain weakness

Topics:
- [[eda-fundamentals]]
