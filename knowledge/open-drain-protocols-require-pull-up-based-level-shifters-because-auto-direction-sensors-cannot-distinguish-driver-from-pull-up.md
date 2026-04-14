---
description: "Auto-direction level shifters (TXS0108E) infer signal direction by watching which side drives first, which fundamentally breaks on open-drain buses (I2C) where the initial state is a weak pull-up indistinguishable from a driver asserting HIGH — BSS138-style pull-up shifters avoid this because they have no direction-sensing logic to confuse"
type: claim
source: "docs/parts/hw-221-8-channel-bidirectional-level-shifter-bss138-based.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hw-221-level-shifter"
  - "txs0108e-level-shifter"
---

# Open-drain protocols require pull-up-based level shifters because auto-direction sensors cannot distinguish driver from pull-up

Auto-direction level shifter chips like the TXS0108E look clever on paper: they detect which side is driving and set up the internal buffer direction automatically. For push-pull signals (SPI MOSI, UART TX, NeoPixel data), this works — whichever side transitions first is obviously the driver. On open-drain buses like I2C, the same logic fails pathologically.

**Why auto-direction breaks on I2C:** I2C lines idle HIGH through pull-up resistors. No driver is asserting anything — the line is floating up. When the master begins a START condition and pulls SDA LOW, the TXS0108E sees an edge and decides "this side is driving now." It engages its internal pulldown on the other side to match. So far, so good. But when the slave needs to ACK, it pulls SDA LOW from the other side. The TXS0108E's logic is now fighting: its internal pulldown is already active on that side. The slave's weak open-drain driver and the TXS0108E's active pulldown conflict. Signal integrity collapses. Communication fails intermittently, often with clock-stretching making the symptoms non-reproducible.

**The deeper issue:** auto-direction sensing requires the assumption that drivers behave like drivers. Open-drain drivers behave like pull-downs with pull-ups that are always present. There is no "idle HIGH driven by nothing" state that an auto-direction chip can reason about, because the pull-up IS what produces the HIGH. The chip sees a HIGH and assumes something is driving HIGH, then fights whatever tries to pull LOW from the other side.

**Why BSS138 shifters are immune:** The [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] circuit has no direction-sensing logic to fool. Each side has its own pull-up; the MOSFET and body diode simply pass LOW-state through whichever direction the driver happens to be on. The circuit doesn't "decide" anything — it just propagates. This matches I2C's open-drain topology exactly because BSS138 shifters ARE essentially a pair of open-drain sections joined by a MOSFET, which is structurally the same shape as the bus.

**Design rule:** If the protocol is open-drain (I2C, 1-Wire, SMBus), use a pull-up-based shifter (BSS138/HW-221). If the protocol is push-pull and high-speed (SPI >1MHz, NeoPixel data, Hall sensor quadrature), use either an auto-direction shifter (TXS0108E) for bidirectional or a unidirectional buffer ([[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]]) for one-way signals. Substituting one class for the other does not work, regardless of voltage compatibility.

---

Source: [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]

Relevant Notes:
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — the mechanism that makes BSS138 immune
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the unidirectional alternative for push-pull
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — general selection principle this instantiates
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — the broader context of level-shifting as default concern
- [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]] — the I2C pull-up topology this note depends on

Topics:
- [[shields]]
- [[communication]]
- [[eda-fundamentals]]
