---
description: "Long leg = anode, short leg = cathode, flat edge = cathode, larger internal plate = cathode -- reversed polarity produces zero light with no damage, a silent failure that confuses beginners into thinking the LED is dead"
type: knowledge-note
source: "docs/parts/5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# LED polarity has four physical identification methods and getting it wrong is a silent failure

Through-hole LEDs have four visual cues for identifying anode (+) and cathode (-):

1. **Leg length** -- Long leg = anode (+), short leg = cathode (-)
2. **Flat edge** -- The flat side of the lens housing marks the cathode
3. **Internal structure** -- Looking inside the clear/translucent epoxy, the larger internal plate is the cathode (it serves as the reflector)
4. **Coin cell test** -- Touch leads to a CR2032 battery; the LED lights when polarity is correct (definitive method when legs have been trimmed)

**The silent failure mode:** A reversed LED passes zero current through the PN junction (LEDs block reverse current up to their reverse breakdown voltage, typically 5V). The result is zero light emission with no damage to the LED or the circuit. This produces a confusing diagnostic scenario for beginners -- the LED appears dead, the circuit appears broken, but everything is actually fine except the orientation.

This is the same polarity-confusion pattern seen in 7-segment displays, where common-cathode and common-anode variants are electrically incompatible and swapping them silently breaks firmware without visible damage.

**Bench coach implication:** When an LED first appears in a project, polarity guidance should be included. "LED not lighting" should trigger a polarity check before any other troubleshooting.

---

Relevant Notes:
- [[common-cathode-and-common-anode-7-segment-displays-are-electrically-incompatible-and-swapping-them-silently-breaks-firmware]] -- Same silent polarity failure pattern in a different component
- [[led-forward-voltage-varies-by-color-creating-a-graduated-resistor-selection-problem]] -- Once polarity is correct, resistor selection is the next concern

Topics:
- [[passives]]
- [[eda-fundamentals]]
