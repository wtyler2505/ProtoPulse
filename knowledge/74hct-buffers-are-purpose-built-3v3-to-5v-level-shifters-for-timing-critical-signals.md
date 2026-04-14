---
description: "74HCT125 (1-channel) and 74HCT245 (8-channel) accept 3.3V logic as valid HIGH input (HCT threshold ~1.4V) and output 5V logic -- faster and more reliable than bidirectional BSS138/TXS0108E shifters for unidirectional timing-critical signals like WS2812B data"
type: knowledge-note
source: "docs/parts/ws2812b-neopixel-ring-status-led-array-for-system-feedback.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# 74HCT buffers are purpose-built 3.3V-to-5V level shifters for timing-critical signals

The 74HCT logic family (HCT = High-speed CMOS with TTL-compatible inputs) has a key property: the logic HIGH threshold is ~1.4V (TTL-compatible), far below the standard CMOS threshold of ~2.5V at 5V supply. This means 3.3V logic outputs are comfortably recognized as HIGH.

**Why this matters for WS2812B + ESP32:**
- The WS2812B data spec requires logic HIGH > 0.7 * VDD = 3.5V when powered at 5V.
- The ESP32 outputs 3.3V, which is below this threshold.
- A 74HCT125 (single channel) or 74HCT245 (8 channels) placed between the ESP32 output and the NeoPixel DIN converts 3.3V logic to clean 5V logic, meeting the WS2812B spec.

**Comparison with other level shifters in the inventory:**
| Shifter | Direction | Speed | NeoPixel Suitability |
|---------|-----------|-------|---------------------|
| 74HCT125/245 | Unidirectional (3.3V→5V) | ~25ns propagation | Ideal -- fast, clean output |
| TXS0108E | Bidirectional (auto-detect) | ~6ns | Overkill -- bidirectional not needed, auto-detect can glitch |
| BSS138-based (HW-221) | Bidirectional (pull-up) | ~100ns | Works for 800kHz NeoPixel but marginal -- slower rise times |

**When to use each:**
- **74HCT125/245:** Single-direction signals where 3.3V MCU drives 5V peripherals (NeoPixel data, SPI MOSI to 5V devices).
- **TXS0108E/BSS138:** Bidirectional buses (I2C, SPI with MISO) where both sides need to drive the line.

The WS2812B data line is strictly unidirectional (MCU → LED), making the 74HCT the correct choice by design.

**16-channel bulk shifting at 4WD rover scale** (from [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]): a 4-motor ESP32 rover needs 16 unidirectional control signals shifted from 3V3 to 5V (EL, Z/F, CT, STOP × 4 controllers). Two 74HCT245 octal buffers cover this entirely — one handles MC1+MC2, the other handles MC3+MC4. The part count is minimal (two 20-pin DIPs), the topology is bulletproof (shared direction, shared enable, all 16 channels running the same direction), and the 74HCT245's 3V3-tolerant HCT input stage absorbs the level shifting without needing a separate bidirectional shifter. When three of those 16 channels happen to originate from ESP32 strapping pins, the same 74HCT245 also provides the boot-time isolation that [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] describes, eliminating the need for a separate 74HC14. See [[74hc14-inverting-and-74hct245-non-inverting-buffers-trade-firmware-complexity-against-level-shifting-integration]] for the decision framework.

---

Enriched from: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Topics:
- [[displays]]
- [[eda-fundamentals]]
- [[wiring-integration]]
