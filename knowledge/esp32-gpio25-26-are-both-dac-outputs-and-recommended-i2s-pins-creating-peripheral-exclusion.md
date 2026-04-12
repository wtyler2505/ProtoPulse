---
description: "ESP32 GPIO25/26 are the ONLY two DAC channels AND commonly recommended I2S pins — projects needing both audio input (I2S mic) and analog output (DAC waveform) must remap I2S to alternate pins, which not all libraries default to"
type: tension
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[communication]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
  - "esp32-devkit-v1"
---

# ESP32 GPIO25 26 are both DAC outputs and recommended I2S pins creating peripheral exclusion

**The conflict:**
- GPIO25 = DAC1 (the only way to output true analog voltage on channel 1)
- GPIO26 = DAC2 (the only way to output true analog voltage on channel 2)
- GPIO25 is commonly used as I2S DIN (data in from microphone) in tutorials and library defaults

If a project uses an I2S microphone on GPIO25 AND needs DAC output (e.g., for generating audio tones, driving a VU meter analog needle, or producing control voltages), the pin allocation collides.

**Resolution paths:**
1. **Remap I2S pins** — ESP32 I2S is fully remappable to any GPIO. Move I2S DIN to any free pin (e.g., GPIO32, GPIO33, GPIO34, GPIO35). This is the correct solution but requires changing library configuration.
2. **Use I2S for BOTH input and output** — ESP32 has TWO I2S peripherals (I2S0, I2S1). Use one for mic input and the other for audio output through an external I2S DAC chip (PCM5102A or similar). Better audio quality than the 8-bit internal DAC anyway.
3. **Accept the trade-off** — If you only need mic OR DAC (not both simultaneously), use GPIO25/26 for whichever peripheral is active.

**DRC rule:** When both an I2S device and DAC usage appear in the same project, check for GPIO25/26 collision and suggest pin remapping if detected.

---

Relevant Notes:
- [[esp32-dac-on-gpio25-26-provides-true-8bit-analog-output]] -- The DAC constraint this conflicts with
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] -- I2S requirement context

Topics:
- [[sensors]]
- [[communication]]
