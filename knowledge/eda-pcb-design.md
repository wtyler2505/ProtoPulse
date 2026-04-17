---
description: "PCB layout, EDA tools, and design rules"
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-pcb-design

PCB layout, EDA tool specifics, design rules, and simulation gotchas.

## Notes
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- PCB rated missing vs all competitors
- [[fritzing-parts-use-svg-layers-with-xml-connector-defs]] -- FZPZ format: SVG per view + FZP XML manifest
- [[wokwi-chips-use-counterclockwise-pin-ordering]] -- JSON array index = physical pin via CCW convention
- [[kicad-exporter-deterministic-uuid-guarantees-collisions-in-large-projects]] -- fake UUID function in export pipeline
- [[erc-pin-classification-uses-fragile-regex-that-fails-on-nonstandard-names]] -- hardcoded regex instead of parts DB lookup
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- JS solver needs Wasm-ngspice migration
