---
description: "A buoyant float carrying a magnet rises/falls with liquid level past a stationary reed switch — the hermetic glass seal means the switch can be outside the container, avoiding contact with corrosive or conductive fluids"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[passives]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Float-mounted magnet with stationary reed switch creates contactless liquid level sensing

A reed switch can detect liquid level without touching the liquid — the magnetic field passes through non-ferromagnetic container walls (plastic, glass, aluminum, stainless steel).

**Setup:**
```
Container wall (non-magnetic)
|                              |
|  [Float + magnet]  ↕ rises  |
|  with liquid level           |
|                              |
|         ---LIQUID---         |
|                              |
└──────────────────────────────┘
              ↕
    [Reed switch OUTSIDE container]
    mounted at target level height
```

**Why this pattern is valuable:**
1. **No liquid contact** — No corrosion, no biofouling, no electrical conductivity concerns
2. **No penetration** — Container stays sealed (no drill holes, no gaskets, no leak paths)
3. **Zero power** — Passive sensing, same as all reed switch applications
4. **Works through walls** — Magnetic field penetrates plastic/glass/thin metal up to 15-25mm (depends on magnet strength)

**Multi-level sensing:**
Stack multiple reed switches at different heights on the outside of the container:
- Switch at 25% height: "Low level"
- Switch at 50% height: "Half full"
- Switch at 75% height: "High level"
- Switch at 95% height: "Overflow warning"

Each switch adds only one GPIO pin. The float's magnet triggers whichever switch it's currently adjacent to.

**Applications:**
- Aquarium auto-top-off (trigger pump when level drops)
- Rain gauge (detect accumulated water level)
- Coffee maker / water dispenser (low water warning)
- Hydroponics reservoir monitoring
- Sump pump activation

**Limitations:**
- Binary per switch (level is at/above threshold or not)
- Float mechanism needs vertical travel clearance
- Turbulent liquids cause false triggers (need debounce)
- Viscous liquids slow float response

**Contrast with alternatives:**
- Capacitive level sensors: require calibration, affected by liquid type
- Ultrasonic sensors: require air gap above liquid, expensive
- Resistive probes: in-liquid, corrode, need AC drive to prevent electrolysis
- Pressure transducers: accurate but expensive and require plumbing

---

Relevant Notes:
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- Same "binary threshold" paradigm in a different physical domain
- [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]] -- Zero-power characteristic applies here too

Topics:
- [[sensors]]
- [[passives]]
