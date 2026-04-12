---
description: "Heat dissipation is (Vin - 5V) x Iload watts -- at 12V/500mA that's 3.5W, enough to trigger thermal shutdown on the LD1117 or NCP1117"
type: claim
source: "docs/parts/arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Mega 5V regulator thermal math constrains practical input voltage to 7-9V

The Arduino Mega's onboard 5V regulator (LD1117S50CTR or NCP1117ST50T3G depending on board revision) accepts 7-12V input on the spec sheet, but thermal reality narrows the useful range to 7-9V. The heat dissipated by a linear regulator is simply (Vin - 5V) x Iload watts. At 12V input drawing 500mA from the 5V rail, that's 3.5W -- more than the small SOT-223 package can shed without getting dangerously hot, and enough to trigger thermal protection on both regulator variants.

The lower bound is set by dropout voltage: the LD1117 needs ~1.1V headroom above its output, so the input must exceed 6.1V. The Vin path also includes a protection diode (Schottky, ~0.3V drop), pushing the minimum practical barrel-jack input to about 6.5V. Below that, the 5V rail sags and the MCU becomes unreliable.

The two regulator variants have different current limits -- LD1117 maxes at 800mA, NCP1117 at 1500mA -- but thermal constraints dominate well before either limit in typical enclosed projects. The regulator's quiescent current is 6-10mA, which adds to the Mega's base draw of 50-75mA.

**Design rule:** For any project powering a Mega from a battery or wall adapter, recommend 7.5-9V input. At 9V/500mA the regulator dissipates 2W -- manageable without a heatsink. At 12V the same load doubles to 3.5W and needs active cooling or a switching pre-regulator.

---

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the 7-12V Vin tier is the Mega's native input range, but thermal math limits the practical upper end
- [[mega-2560-too-wide-for-any-breadboard]] -- physical size limits cooling options; an enclosed Mega runs hotter
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] -- the 3.3V regulator's 50mA limit means WiFi modules need their own supply, not the Mega's header pin

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]
