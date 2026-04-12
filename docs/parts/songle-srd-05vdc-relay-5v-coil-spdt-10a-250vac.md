---
description: "5V coil SPDT relay — switches up to 10A at 250VAC or 30VDC, needs a transistor/MOSFET driver since coil draws ~70mA (too much for GPIO)"
topics: ["[[power]]", "[[actuators]]"]
status: needs-test
quantity: 2
voltage: [5]
interfaces: [Relay]
logic_level: "5V"
manufacturer: "Songle"
part_number: "SRD-05VDC-SL-C"
pinout: |
  Coil:
    Pin 1 → Coil + (5V via transistor)
    Pin 2 → Coil - (GND)
  Contacts:
    COM → Common (load connection)
    NO  → Normally Open (closed when energized)
    NC  → Normally Closed (open when energized)
compatible_with: ["[[p30n06le-n-channel-logic-level-mosfet-60v-30a]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["NEVER drive coil directly from Arduino GPIO — draws ~70mA, exceeds 20mA pin limit. Use NPN transistor (2N2222) or MOSFET", "ALWAYS use a flyback diode (1N4007) across coil terminals to suppress back-EMF spikes", "HIGH VOLTAGE on contact side — if switching mains AC, use proper insulation and safety practices", "Relay module boards include the transistor driver and flyback diode — bare relays need external circuitry"]
datasheet_url: "https://datasheet.lcsc.com/lcsc/1811071112_SONGLE-SRD-05VDC-SL-C_C35404.pdf"
---

# Songle SRD-05VDC Relay — 5V Coil SPDT 10A 250VAC

A standard electromechanical relay. The 5V coil creates a magnetic field that flips the contacts — you can switch high-voltage/high-current loads (lamps, fans, appliances) with a low-voltage control signal. SPDT (Single Pole Double Throw) means you get both normally-open and normally-closed contacts.

## Specifications

| Spec | Value |
|------|-------|
| Coil Voltage | 5V DC |
| Coil Current | ~70mA |
| Coil Resistance | ~70 ohm |
| Contact Rating | 10A @ 250VAC / 10A @ 30VDC |
| Contact Type | SPDT (COM, NO, NC) |
| Switching Time | ~10ms |
| Mechanical Life | 10M cycles |
| Electrical Life | 100K cycles (at rated load) |

## Drive Circuit

```
Arduino GPIO → 1K resistor → 2N2222 Base
                              Emitter → GND
                              Collector → Relay Coil-
                              Relay Coil+ → 5V
                              1N4007 across coil (cathode to +)
```

Or use a P30N06LE MOSFET (in inventory) — logic-level gate threshold means it can be driven directly from a 3.3V or 5V GPIO.

---

Related Parts:
- [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] — can drive the relay coil from GPIO

Categories:
- [[power]]
- [[actuators]]
