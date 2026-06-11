---
description: "Powering the TXS0108E B-side from the 36V motor battery instead of the +5V logic rail instantly destroys the level shifter and likely the connected MCU, as the absolute maximum rating for VCCB is 5.5V (36V is almost seven times the limit)"
type: claim
---
# Direct 36V motor battery to TXS0108E B-side instantly destroys the level shifter

When wiring BLDC motor controllers equipped with Hall sensors to logic-level MCUs (like an ESP32), multiple voltage domains coexist in close proximity: the high-voltage motor rail (e.g., 36V) and the logic rails (3.3V, 5V). 

The B-side of the TXS0108E level shifter is typically used for the higher logic voltage (usually 5V from the controller's thin red Hall sensor power wire). Connecting the B-side supply (VCCB) directly to the 36V motor battery power instead of the 5V logic line instantly destroys the level shifter. The absolute maximum rating for the TXS0108E VCCB pin is 5.5V. Exposing it to 36V (roughly seven times its absolute maximum limit) causes immediate catastrophic failure, which will likely also propagate damaging high voltages back to the 3.3V side and destroy the connected ESP32.

This out-of-range destruction scenario is distinct from the within-spec inversion rule where [[txs0108e-vcca-must-be-the-lower-voltage-rail-because-the-chip-enforces-asymmetric-supply-roles|VCCA must be less than or equal to VCCB]]. In this case, the voltage itself completely violates the hardware's electrical limits, making correct wire identification (thin 5V wire vs. thick 36V wire) critical during assembly.

Topics:
- [[wiring-guides]]
- [[motor-controllers]]
