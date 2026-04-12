---
description: "Driving two SPI TFT displays simultaneously with smooth animation requires hardware floating-point (FPU) and DMA — Cortex-M4F MCUs like the SAMD51 meet this threshold while Cortex-M0+ (SAMD21, RP2040) and AVR (ATmega328P) cannot"
type: claim
source: "docs/parts/adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[microcontrollers]]"
---

# dual SPI displays require Cortex-M4F class processing with FPU and DMA for usable animation frame rates

The Adafruit Monster M4SK drives two 240x240 ST7789 IPS TFT displays simultaneously with smooth animated eye graphics. This is possible because the ATSAMD51G19 (Cortex-M4F at 120MHz) provides:

1. **Hardware FPU** — eye animation involves trigonometric calculations for iris movement, pupil dilation, and eyelid curves. Software floating-point on a Cortex-M0+ or AVR would bottleneck frame rate.
2. **DMA (Direct Memory Access)** — SPI pixel data transfer to the displays happens via DMA channels, freeing the CPU to compute the next frame while the current frame is still being pushed to the display. Without DMA, the CPU would stall during each SPI transaction.
3. **Clock speed** (120MHz vs 48MHz SAMD21 or 16MHz ATmega328P) — the raw computational throughput for bitmap manipulation and sensor processing.

**The hard constraint:** A single 240x240 16-bit display requires pushing 240 * 240 * 2 = 115,200 bytes per frame. Two displays double this to 230,400 bytes per frame. At SPI clock rates of 24MHz, a single frame transfer takes ~77ms (about 13 FPS). DMA allows the CPU to overlap computation with transfer, effectively hiding the SPI latency. Without DMA, the CPU must wait for each byte to clock out, halving the effective frame rate.

This creates a processing tier boundary for multi-display projects:

| MCU Class | FPU | DMA | Dual TFT Animation |
|-----------|-----|-----|---------------------|
| AVR (ATmega328P/2560) | No | No | Not feasible |
| Cortex-M0+ (SAMD21, RP2040) | No | Yes (limited) | Marginal — static or very slow |
| Cortex-M4F (SAMD51) | Yes | Yes | Smooth animation possible |
| ESP32 (dual-core Xtensa) | Yes | Yes | Smooth — dual cores help |

**ProtoPulse implication:** When a project includes two or more SPI displays, the bench coach should verify the MCU has DMA-capable SPI and sufficient clock speed. Pairing dual TFTs with an ATmega328P should trigger a hardware capability warning.

---

Source: [[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]]

Relevant Notes:
- [[samd51-and-other-arm-arduino-boards-break-atmega-library-compatibility-silently]] — the ARM capability gap includes DMA and FPU
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — MCU capability is an implicit constraint in the dependency chain

Topics:
- [[displays]]
- [[microcontrollers]]
