---
description: "MNA solver, Newton-Raphson iteration, and Gaussian elimination all run synchronously on the main thread — freezes React UI during heavy analysis"
type: debt-note
source: "conductor/comprehensive-audit.md §3"
confidence: proven
topics: ["[[architecture-decisions]]", "[[eda-fundamentals]]"]
related_components: ["client/src/lib/simulation/circuit-solver.ts", "client/src/lib/simulation/transient-analysis.ts"]
---

# Simulation engine runs synchronously on the main thread with no WebWorker or WebAssembly path

The custom circuit solver implements Modified Nodal Analysis (MNA), matrix solving, and Newton-Raphson iteration synchronously on the main thread. Transient analysis uses basic Gaussian elimination with partial pivoting — an O(N³) algorithm. For circuits with hundreds of nodes, this guarantees UI freezes during Monte Carlo sweeps and transient analysis.

Native JavaScript solvers max out at ~15% the performance of compiled C++ solvers. The 2026 web EDA standard is WebAssembly-compiled ngspice (Memory64 + Relaxed SIMD) achieving 90-95% native speeds. The custom JS math engine should be deprecated in favor of Wasm-ngspice.

WebGPU compute shaders (WGSL) are the standard for parallelizing Monte Carlo sparse matrix solves — ProtoPulse's `GpuAccelerator` is currently only scoped for UI rendering.

---

Relevant Notes:
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- canvas AND simulation both block the main thread

Topics:
- [[architecture-decisions]]
- [[eda-fundamentals]]
