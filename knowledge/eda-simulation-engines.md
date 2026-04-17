---
description: "SPICE algorithms, matrix solvers, and discrete-time simulation integration."
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-simulation-engines

Core knowledge regarding circuit simulation, transient analysis, and engine implementations.

## Knowledge Notes
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- JS solver needs Wasm-ngspice migration

## Simulation Algorithms
- MNA (Modified Nodal Analysis) — DC operating point
- Nonlinear solvers — Newton-Raphson convergence
- Transient — BE/Trapezoidal integration, adaptive timestep
- AC small-signal — frequency sweep, Bode plot
- Monte Carlo — tolerance analysis, sensitivity
