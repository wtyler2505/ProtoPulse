---
description: "The correct level shifter for a given pin pair depends primarily on signal topology (open-drain vs push-pull) and clock speed, not on the voltage pair — the same 3.3V-to-5V translation demands different shifter architectures for I2C versus SPI versus NeoPixel data, and voltage compatibility alone does not constrain the choice"
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
---

# Signal topology not voltage alone determines level shifter selection

Beginners approach level shifting as a voltage-matching problem: "my MCU is 3.3V, my peripheral is 5V, I need a 3.3V-to-5V shifter." This framing is incomplete and leads to wrong choices. The primary selection axis is signal topology and speed; voltage is a secondary constraint that rules out chips that cannot span the required rails.

**The topology axes that actually matter:**

| Axis | Options | Consequence |
|------|---------|-------------|
| Direction | unidirectional / bidirectional | Determines whether auto-direction, pull-up-based, or buffered topology applies |
| Drive type | push-pull / open-drain | Determines whether an auto-direction chip will work or fail |
| Speed | <400kHz / <1MHz / >1MHz | Determines whether BSS138 RC limits are tolerable |
| Edge sensitivity | continuous clock / async / strict setup-hold | Determines whether propagation jitter breaks the protocol |

**Each combination selects a different shifter:**

- **I2C (bidirectional, open-drain, <=400kHz):** BSS138/HW-221. Auto-direction chips fail on open-drain — see [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]].
- **SPI MOSI (unidirectional, push-pull, 1-10MHz):** 74HCT245 buffer. BSS138 too slow; TXS0108E works but overkill.
- **SPI MISO in bidirectional SPI with >1MHz clock:** TXS0108E. BSS138's body-diode path is the bottleneck — see [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]].
- **UART (unidirectional per wire, push-pull, <1MHz):** voltage divider for TX→RX, direct connection or buffer for RX→TX. Doesn't need a full shifter.
- **NeoPixel data (unidirectional, push-pull, strict timing at 800kHz):** 74HCT125 or 74HCT245. BSS138 edge rates corrupt timing; TXS0108E auto-detect adds jitter.
- **I2S (bidirectional continuous clock, push-pull, 1-3MHz):** none — see [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]]. Must use voltage-native peripherals.

**The voltage constraint is a filter, not a selector:** any shifter with appropriate LV/HV rails can pass the voltage check. The BSS138 works 1.8-5V, TXS0108E works 1.2-3.6V/1.65-5.5V, 74HCT requires 4.5-5.5V supply. These constraints eliminate candidates but do not select among them.

**Why beginners get this wrong:** vendor product pages list shifters primarily by voltage range ("3.3V-to-5V shifter!"). This matches the beginner's mental model and sells chips, but it hides the topology question that actually determines whether the chip will work. The DRC-level fix is to include signal topology and clock speed as first-class selection inputs alongside voltage, and to warn when an auto-direction shifter is placed on an I2C net or a BSS138 shifter is placed on a >400kHz SPI net.

---

Source: [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]

Relevant Notes:
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — mechanism of the pull-up-based option
- [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] — why topology matters for I2C specifically
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — speed axis for the BSS138 case
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the unidirectional buffered option
- [[i2s-timing-requirements-make-level-shifting-a-non-solution-for-voltage-incompatible-mcus]] — the case where no shifter works
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — the broader level-shifting landscape

Topics:
- [[eda-fundamentals]]
- [[shields]]
- [[communication]]
