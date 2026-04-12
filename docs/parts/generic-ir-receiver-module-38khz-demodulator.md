---
description: "38kHz IR demodulator receiver module — TSOP-type sensor on breakout board, decodes IR remote signals to digital pulses. Covers KY-022, IR-01, and OSEPP IRR-01 variants"
topics: ["[[communication]]", "[[sensors]]"]
status: needs-test
quantity: 5
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "mixed"
logic_notes: "These TSOP-style breakout modules usually run happily from 3.3V or 5V and output a logic-level signal that follows the board's supply domain."
manufacturer: "Various (Generic, OSEPP)"
part_number: "KY-022 / IR-01 / OSEPP-IRR-01"
pinout: |
  G/- → GND
  V/+ → VCC (3.3-5V)
  S/OUT → Signal (digital — demodulated IR data)
compatible_with: ["[[ir-remote-control-handheld-38khz-nec-protocol]]", "[[osepp-ir-transmitter-irf01-38khz-led-module]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Output is active-LOW — idles HIGH, pulses LOW when receiving IR", "Some modules have pull-up resistor onboard, some don't — check your variant", "Keep away from strong ambient light sources (fluorescent lights can interfere)"]
datasheet_url: ""
---

# Generic IR Receiver Module — 38kHz Demodulator

A TSOP-type 38kHz infrared receiver on a small breakout board. Demodulates the 38kHz carrier from IR remotes and outputs clean digital pulses that the IRremote library can decode into button codes. This record covers multiple variants in the inventory — they're all functionally identical 38kHz IR demodulators on 3-pin breakout boards:

- **KY-022** (x2) — common kit module, 3-pin header
- **IR-01** (x2) — 3-pin G/V/S breakout, identical function
- **OSEPP IRR-01** (x1) — OSEPP branded, same TSOP-type 38kHz demodulator

Total quantity: 5 modules across variants.

## Specifications

| Spec | Value |
|------|-------|
| Receiver IC | TSOP1738 or equivalent |
| Carrier Frequency | 38kHz |
| Protocols Supported | NEC, Sony, RC5, RC6, Samsung (via IRremote library) |
| Operating Voltage | 2.7-5.5V |
| Output | Digital, active-LOW |
| Connector | 3-pin (G/V/S or -/+/S) |

## Wiring

| IR Receiver | Arduino |
|-------------|---------|
| S/OUT | Any digital pin (e.g. D11) |
| V/+ | 5V |
| G/- | GND |

**Library:** `IRremote`

```cpp
#include <IRremote.h>
IRrecv irrecv(11); // signal pin
decode_results results;
irrecv.enableIRIn();
if (irrecv.decode(&results)) {
  Serial.println(results.value, HEX);
  irrecv.resume();
}
```

---

Related Parts:
- [[ir-remote-control-handheld-38khz-nec-protocol]] — the transmitter that sends signals to this receiver
- [[osepp-ir-transmitter-irf01-38khz-led-module]] — IR LED for building your own transmitter

Categories:
- [[communication]]
- [[sensors]]
