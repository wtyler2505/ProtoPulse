---
description: "The SRD-05VDC relay coil draws ~70mA at 5V (70 ohm resistance) while Arduino pins max at 20mA and ESP32/Pi Pico at 12mA -- direct GPIO drive will damage the MCU"
type: claim
source: "docs/parts/songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
related_components:
  - "songle-srd-05vdc-sl-c"
  - "2n2222"
  - "p30n06le"
---

# Relay coil draws 70mA which exceeds GPIO limits on every common MCU

Standard 5V relay coils (Songle SRD-05VDC-SL-C, the ubiquitous blue cube relay) have a coil resistance of approximately 70 ohms. At 5V, this means ~70mA of current. No common MCU GPIO pin can source this safely:

| MCU | Max GPIO current | Relay draw | Margin |
|-----|-----------------|------------|--------|
| Arduino Uno/Mega (ATmega) | 20mA per pin, 200mA total | 70mA | 3.5x over per-pin limit |
| ESP32 | 12mA recommended, 40mA absolute max | 70mA | 1.75x over absolute max |
| Raspberry Pi Pico (RP2040) | 12mA per pin | 70mA | 5.8x over limit |
| ESP8266 | 12mA per pin | 70mA | 5.8x over limit |

**The required driver circuit:** An NPN transistor (PN2222A, rated 600mA collector) or logic-level N-channel MOSFET (P30N06LE) between the GPIO and the relay coil. The GPIO drives the transistor base/gate, the transistor switches the coil current from the 5V supply. Current through the GPIO is limited to the base drive (~1-5mA for BJT, essentially zero for MOSFET gate).

**Base resistor selection for 70mA relay coil (PN2222A, hFE_min=100):**
- 5V GPIO: 1K-2.2K (gives 2-4.3mA base, 2-6x overdrive for 0.7mA minimum)
- 3.3V GPIO: 1K (gives 2.6mA base, 3.7x overdrive -- adequate but less margin)

**Why beginners wire it wrong:** Tutorials for relay "modules" (the pre-built PCBs with opto-isolated inputs) don't mention the driver transistor because it's already on the module board. When a beginner buys a bare relay and follows a module tutorial, they connect GPIO directly to the coil. It may appear to work briefly (the relay might click weakly) before the GPIO pin suffers cumulative damage.

**ProtoPulse implications:** DRC should flag any direct GPIO-to-relay-coil connection as an overcurrent violation. When a relay is placed on the schematic, the bench coach should automatically suggest the transistor driver subcircuit and warn about the current mismatch.

---

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- relay/solenoid paradigm: digital HIGH/LOW but through a driver, not direct GPIO
- [[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]] -- similar theme: control logic vs power delivery separation

Topics:
- [[actuators]]
- [[power-systems]]
