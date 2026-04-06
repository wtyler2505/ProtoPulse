---
description: Electronics design concepts, component specs, protocols, and EDA domain knowledge
type: moc
topics:
  - "[[index]]"
  - "[[breadboard-intelligence]]"
  - "[[architecture-decisions]]"
---

# eda-fundamentals

Core electronics and EDA knowledge. Claims here are verifiable facts about components, protocols, design rules, and simulation fundamentals.

## Knowledge Notes
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- PCB rated missing vs all competitors

## Sub-Topics (to be populated)

### Component Knowledge
- Passive components (R, C, L) — values, tolerances, packages
- Active components (BJT, MOSFET, op-amp) — Ebers-Moll, Level-1 MOSFET models
- ICs and microcontrollers — ATmega328P, ESP32, STM32 specifics
- ESD sensitivity — handling classes, flagging rules

### Protocols
- I2C — pull-up sizing, address conflicts, clock stretching
- SPI — CPOL/CPHA modes, daisy-chaining
- UART — baud rate, framing, flow control
- USB — differential pair requirements, ESD protection

### PCB Design Rules
- Clearance and creepage (IPC-2221, IEC 60950)
- Trace width vs. current capacity (IPC-2152)
- Via models — inductance, resistance, thermal
- Copper pour — thermal relief, hatched vs. solid
- Differential pair routing — length matching, impedance control

### Simulation
- MNA (Modified Nodal Analysis) — DC operating point
- Nonlinear solvers — Newton-Raphson convergence
- Transient — BE/Trapezoidal integration, adaptive timestep
- AC small-signal — frequency sweep, Bode plot
- Monte Carlo — tolerance analysis, sensitivity

### Standards
- IPC-2221 — PCB design standard
- IPC-7351 — land pattern standard (footprint dimensions)
- RoHS — restricted substances in electronics
- WEEE — waste electronics regulations

## Key Resources
- `server/export/` — Gerber, drill, pick-and-place generators
- `client/src/lib/simulation/` — SPICE generator, circuit solver
- `shared/drc-engine.ts` — Design rule checking engine

---

Topics:
- [[index]]
- [[breadboard-intelligence]]
- [[architecture-decisions]]
