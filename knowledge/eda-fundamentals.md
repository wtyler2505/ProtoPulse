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
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- strapping pin sets flash voltage, HIGH = brown-out
- [[esp32-adc2-unavailable-when-wifi-active]] -- ADC2 shares hardware with WiFi radio, no arbitration
- [[esp32-six-flash-gpios-must-never-be-used]] -- GPIO 6-11 are internal flash bus, always restricted
- [[mega-2560-four-hardware-uarts]] -- 4 independent UARTs for simultaneous serial peripherals
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- 160mil non-standard gap for Uno shield fit
- [[bldc-stop-active-low-brake-active-high]] -- opposite logic polarities on BLDC halt signals
- [[hall-sensor-wiring-order-matters-for-bldc]] -- wrong hall order causes stutter/vibration/reverse
- [[fritzing-parts-use-svg-layers-with-xml-connector-defs]] -- FZPZ format: SVG per view + FZP XML manifest
- [[wokwi-chips-use-counterclockwise-pin-ordering]] -- JSON array index = physical pin via CCW convention
- [[kicad-exporter-deterministic-uuid-guarantees-collisions-in-large-projects]] -- fake UUID function in export pipeline
- [[erc-pin-classification-uses-fragile-regex-that-fails-on-nonstandard-names]] -- hardcoded regex instead of parts DB lookup
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- SPI remapping is the #1 Uno-to-Mega porting trap
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- linear regulator thermal limits narrow the 7-12V spec to 7-9V practical
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] -- 3.3V header pin cannot power wireless modules
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] -- software I2C remappable to any GPIO, unlike AVR
- [[vspi-is-the-safest-esp32-spi-bus-because-hspi-pins-have-boot-restrictions]] -- VSPI (GPIO18/19/23/5) has no boot conflicts
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC nonlinearity above 2.5V requires calibration
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] -- 4 attenuation levels from 0dB/1.1V to 11dB/3.3V
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- AMS1117 thermal budget limits board current
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] -- 10uA deep sleep for battery IoT
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] -- only 14 unrestricted GPIOs out of 34
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] -- input-only pins need external pull resistors
- [[esp32-dac-on-gpio25-26-provides-true-8bit-analog-output]] -- true analog output, rare among maker MCUs

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
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- JS solver needs Wasm-ngspice migration

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
