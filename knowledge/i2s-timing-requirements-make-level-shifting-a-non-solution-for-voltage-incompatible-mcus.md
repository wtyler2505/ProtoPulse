---
description: "I2S signals at 1-3MHz bit-clock rates are corrupted by level-shifter propagation delay and edge degradation — unlike SPI/I2C where level shifting is the standard solution, I2S between mismatched voltage domains simply does not work reliably"
type: claim
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[sensors]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
  - "txs0108e-level-shifter"
  - "hw-221-level-shifter"
---

# I2S timing requirements make level shifting a non-solution for voltage incompatible MCUs

The standard advice for 3.3V devices on 5V MCUs is "add a level shifter." For I2S, this advice FAILS. Here's why:

**I2S timing constraints:**
- Bit clock (BCK): 1.024 MHz minimum (16kHz × 32bit × 2ch), up to 3.072 MHz for 48kHz audio
- Data must be stable within ~50ns of clock edge (setup/hold time)
- Clock jitter tolerance: typically <10ns for clean audio

**Level shifter propagation delay:**
- BSS138-based (HW-221): ~5-15ns per transition (borderline acceptable)
- TXS0108E auto-direction: ~4-10ns (better, but adds jitter)
- Voltage divider: Slows edges dramatically (RC time constant) — totally unusable

**The real problem is edge rate degradation:**
Level shifters don't just add delay — they slow the rising/falling edges. A crisp 3ns edge from the MCU becomes a 15-30ns slope after shifting. At 3MHz bit-clock, each bit period is only ~330ns. A 30ns edge transition consumes nearly 10% of the bit period, reducing noise margin and causing intermittent bit errors that manifest as audio clicks, pops, and dropouts.

**Why this is different from SPI:**
SPI at typical Arduino speeds (1-8 MHz) has generous timing budgets because the master controls the clock and data is sampled mid-bit. I2S has a fixed-rate continuous clock where master and slave must maintain lock — there's no "wait for data ready" mechanism.

**The correct solution:**
Don't level-shift I2S. Use a 3.3V MCU (ESP32, RP2040, STM32) that directly interfaces with 3.3V I2S peripherals. If you must use a 5V MCU, you cannot use I2S — choose an analog microphone instead.

**Exception to the level-shifting vault note:** The [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] note correctly identifies level shifting as the default solution for 3.3V modules. I2S audio devices are a specific exception where this solution doesn't apply.

---

Relevant Notes:
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] -- The general rule that this note provides an exception to
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] -- The compatibility gate that makes this constraint academic for ATmega anyway

Topics:
- [[communication]]
- [[sensors]]
