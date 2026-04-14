---
description: "A single board carrying I2C, SPI, and strict-timing signals like NeoPixel data cannot be level-shifted with one chip because each protocol's topology and speed demands a different shifter architecture — the correct design uses multiple shifters partitioned by signal class, not one universal translator"
type: claim
source: "docs/parts/hw-221-8-channel-bidirectional-level-shifter-bss138-based.md"
confidence: proven
topics:
  - "[[eda-fundamentals]]"
  - "[[shields]]"
  - "[[communication]]"
related_components:
  - "hw-221-level-shifter"
  - "txs0108e-level-shifter"
  - "74hct245-buffer"
  - "74hct125-buffer"
---

# Mixed-protocol boards require one level shifter per signal class not one shifter for all signals

The tempting simplification when designing a mixed-voltage board is to pick a single level shifter part — an 8-channel BSS138 module, say — and run every cross-voltage signal through it. This reasoning treats the shifter as a voltage-domain bridge. But since [[signal-topology-not-voltage-alone-determines-level-shifter-selection]], a chip that works for one signal class will silently corrupt another on the same board.

**The partition is forced by the shifter physics, not by preference:**

| Signal class on the board | Required shifter | Why the "universal" option fails |
|---------------------------|------------------|----------------------------------|
| I2C to 5V sensor | BSS138 / HW-221 (pull-up based) | Auto-direction chips misread open-drain — see [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] |
| SPI at 4-10MHz to 5V ADC | 74HCT245 or TXS0108E | BSS138's body-diode charging caps bandwidth near 400kHz — edge degradation corrupts SPI clocks |
| NeoPixel data at 800kHz with strict timing | 74HCT125 or 74HCT245 | BSS138 edge rates and TXS0108E auto-detect jitter both violate WS2812B timing windows |
| UART at 9600-115200 baud | voltage divider or buffer | Full bidirectional shifter is overkill and adds propagation delay |
| I2S continuous clock | no shifter works | Voltage-native peripherals required — see [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]] |

A board with an I2C sensor, an SPI flash, and a NeoPixel strip needs three different shifter families. One HW-221 module for the I2C, one 74HCT245 buffer for the SPI MOSI/SCK lanes, and one 74HCT125 gate for the NeoPixel data line. The cost is three parts and more board area; the alternative is a board that either fails DRC or passes DRC but fails in the field when the NeoPixel strip shows corrupt colors on cold boots.

**Why the single-shifter mental model is sticky:** vendors sell BSS138 and TXS0108E breakouts as "8-channel" modules, which implies eight equivalent channels usable for any signal. The channels are indeed electrically equivalent to each other within one chip, but the chip itself is topology-specific. An 8-channel BSS138 provides eight open-drain-compatible slow bidirectional channels, not eight general-purpose translators. Labeling it "8-channel level shifter" without the topology qualifier creates the exact confusion the physics forbids.

**The DRC-level consequence:** a board that routes mixed-protocol signals through a single shifter chip is not just suboptimal — it is wrong in a way that passes schematic review. The error only surfaces at bring-up, when I2C works but SPI at 4MHz shows setup-time violations, or NeoPixels flicker because edges are too slow. The fix is expensive because it requires reworking copper. Catching this at design time means a rule that partitions the shifter choice by signal class, enforced before layout.

**Counterargument worth acknowledging:** a board with only slow signals (I2C plus bit-banged SPI under 400kHz plus UART) genuinely can use one BSS138 module for all of them, because every signal class happens to fall inside the BSS138 envelope. The claim is not that one chip never suffices — it is that the decision must be made per signal class, and the answer is "one chip suffices" only when the signal set is narrow enough to fit inside one topology-speed envelope.

---

Source: [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]

Relevant Notes:
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the foundational principle this extends to the multi-signal board case
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — why BSS138 fits I2C but caps at 400kHz
- [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] — why the auto-direction "universal" chip fails on I2C
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the purpose-built SPI and NeoPixel option
- [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]] — the case where no shifter in any family works
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — broader context for why mixed-voltage boards are common

Topics:
- [[eda-fundamentals]]
- [[shields]]
- [[communication]]
