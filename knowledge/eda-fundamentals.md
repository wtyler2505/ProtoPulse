---
description: "Core EDA domain hub -- MCU pin constraints, protocol fundamentals, simulation algorithms, PCB design rules, and standards; cross-links to all hardware topic maps"
type: moc
topics:
  - "[[index]]"
  - "[[breadboard-intelligence]]"
  - "[[architecture-decisions]]"
---

# eda-fundamentals

Core electronics and EDA knowledge. Claims here are verifiable facts about components, protocols, design rules, and simulation fundamentals.

## Hardware Topic Maps
- [[microcontrollers]] -- MCU-specific pin maps and peripheral constraints
- [[actuators]] -- motors, H-bridges, brake logic
- [[sensors]] -- measurement, calibration, interface gotchas
- [[displays]] -- display protocols and driver ICs
- [[power-systems]] -- regulators, batteries, protection
- [[passives]] -- discrete components and biasing
- [[communication]] -- wired and wireless protocols
- [[shields]] -- Arduino shield ecosystem
- [[input-devices]] -- human-to-MCU interfaces
- [[wiring-integration]] -- multi-component system wiring

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
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] -- single UART shared with USB is the #1 Uno beginner wall
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] -- ATmega328P GPIO current limits require external drivers
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] -- I2C/analog pin conflict on AVR boards
- [[uno-only-2-external-interrupts-on-d2-d3-is-a-hard-project-sizing-constraint]] -- only 2 interrupts limits project scope
- [[uno-defines-the-standard-arduino-shield-header-layout]] -- Uno is the reference shield form factor
- [[uno-d10-must-stay-output-for-hardware-spi-master-mode]] -- D10 as INPUT silently breaks SPI master mode
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] -- 5 safe GPIOs out of 11 total
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] -- 3 boot strapping pins
- [[esp8266-a0-analog-input-has-0-1v-range-not-0-3v3]] -- 0-1V ADC range, not 0-3.3V
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] -- GPIO16 on separate RTC domain
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] -- 1kHz software PWM inadequate for servos
- [[esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio]] -- flash-connected, unusable
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] -- WiFi stack dominates 80KB SRAM
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] -- I2C pull-ups on boot pins prevent boot
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] -- PIO state machines for sub-microsecond protocol timing
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] -- 12mA/50mA is strictest among maker MCUs
- [[rp2040-peripheral-pin-mapping-eliminates-most-conflicts-because-all-peripherals-remap]] -- all peripherals remappable
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] -- only 3 ADC channels
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] -- UF2 bootloader is beginner-proof
- [[pico-vsys-accepts-1v8-to-5v5-enabling-direct-battery-operation]] -- buck-boost regulator accepts 1.8-5.5V
- [[pico-3v3-en-pin-disables-regulator-for-external-sleep-control]] -- regulator disable for hardware sleep

## Sub-Topics (to be populated)

### Component Knowledge
- For a full list of physical parts and specifications, see [[hardware-components]]
- Passive components (R, C, L) — values, tolerances, packages
- Active components (BJT, MOSFET, op-amp) — Ebers-Moll, Level-1 MOSFET models
- ICs and microcontrollers — [[hardware-component-atmega328p|ATmega328P]], [[hardware-component-esp32-wroom-32|ESP32]], STM32 specifics
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
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
- [[breadboard-intelligence]] — Bench coach logic, verified breadboard layouts, layout quality rules, and hardware debugging patterns
- [[architecture-decisions]] — Why ProtoPulse is built the way it is — trade-offs, constraints, and key architectural choices
