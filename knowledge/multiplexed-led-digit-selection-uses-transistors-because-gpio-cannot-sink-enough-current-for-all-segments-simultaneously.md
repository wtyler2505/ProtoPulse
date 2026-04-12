---
description: "When multiplexing 7-segment digits manually, NPN transistors switch the common cathode pins because a single GPIO cannot sink the combined current of all lit segments (up to 160mA for 8 segments at 20mA each)"
type: knowledge-note
source: "docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Multiplexed LED digit selection uses transistors because GPIO cannot sink enough current for all segments simultaneously

When manually multiplexing multiple 7-segment digits, each digit's common cathode pin is switched by an NPN transistor (for common cathode) or PNP transistor (for common anode). A single MCU GPIO pin controls the transistor base to enable/disable each digit.

**Why transistors are required:**
- A single 7-segment digit with all segments lit (digit "8") draws up to 160mA (8 segments x 20mA each).
- Arduino GPIO pins can sink/source only ~20-40mA per pin.
- Connecting the common cathode directly to a GPIO pin would either damage the pin or produce dim, unreliable display output.
- The transistor acts as a current amplifier: a small base current (~1-2mA from GPIO) controls the full segment current flow through the collector-emitter path.

**Wiring pattern (common cathode, NPN):**
- MCU GPIO → 1k resistor → NPN base
- Display common cathode → NPN collector
- NPN emitter → GND
- When GPIO HIGH: transistor conducts, digit active (segments can light)
- When GPIO LOW: transistor off, digit dark

This is the same pattern as [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] but at lower current levels where a BJT is sufficient.

**3.3V GPIO consideration:** For ESP32, Pico, and other 3.3V MCUs, the reduced base drive voltage (2.6V remaining after Vbe vs 4.3V at 5V) means the 1K base resistor gives only 2.6mA instead of 4.3mA. For 8 segments at 20mA = 160mA, this still provides adequate overdrive with hFE_min of 100 (need 1.6mA minimum). But for higher-current displays or multiple digits in parallel, use a 680R or 470R base resistor from 3.3V GPIO to maintain saturation margin.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
