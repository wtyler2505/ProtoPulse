---
description: "When a relay, motor, or solenoid connects directly to a GPIO pin, the DRC should flag two errors: missing driver transistor/MOSFET (GPIO cannot source enough current) and missing flyback diode (inductive kick will damage the driver)"
type: methodology
source: "docs/parts/pn2222a-npn-transistor-40v-600ma-general-purpose-to92.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# DRC should flag direct GPIO to inductive load connections and suggest driver plus flyback subcircuit

Inductive loads (relay coils, solenoid valves, DC motors) require a driver subcircuit between the MCU GPIO and the load. A direct connection fails in two ways:

1. **Current overload:** Relay coils draw 40-80mA; motors draw 100mA-2A. GPIO pins source 20-40mA max (Arduino) or 12mA (ESP32). Direct drive either fails to actuate the load or damages the MCU pin.

2. **Inductive kickback:** When the driver turns off, the collapsing magnetic field generates a voltage spike that can reach hundreds of volts. Without a flyback diode, this spike destroys the driver transistor and potentially the MCU.

**The required subcircuit (both elements mandatory):**

```
GPIO → base resistor → BJT/MOSFET → load → V+
                                       ↕
                                  flyback diode
                                  (cathode to V+)
```

**DRC detection rules for ProtoPulse:**

| Pattern Detected | Severity | Message |
|-----------------|----------|---------|
| Inductive load connected to GPIO | Error | "Relay/motor/solenoid requires a driver transistor or MOSFET between GPIO and load" |
| Driver transistor present but no flyback diode | Error | "Inductive load requires flyback diode (1N4001 or equivalent) across load" |
| BJT driver with load >600mA | Warning | "Load current exceeds BJT maximum; use MOSFET (P30N06LE or equivalent)" |
| BJT driver without base resistor | Error | "Base resistor required to limit GPIO current" |

**Component selection guidance the DRC should offer:**

| Load Current | Driver Type | Base/Gate Resistor | Flyback Diode |
|-------------|-------------|-------------------|---------------|
| <100mA | PN2222A/S8050 (BJT) | 1K-4.7K | 1N4001 |
| 100-600mA | PN2222A (BJT) | 470R-2.2K | 1N4001 |
| 600mA-5A | P30N06LE (MOSFET) | 10K pull-down | 1N4001 or 1N5819 |
| 5A-30A | P30N06LE (MOSFET) | 10K pull-down | SB560 or equivalent |

---

Source: [[pn2222a-npn-transistor-40v-600ma-general-purpose-to92]]

Relevant Notes:
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] -- the current problem that necessitates drivers
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] -- the voltage spike that necessitates flyback diodes
- [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]] -- the BJT/MOSFET selection boundary

Topics:
- [[passives]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
