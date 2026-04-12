---
description: "Two SPH0645LM4H PDM mics share a single I2S data line by outputting on opposite WS clock phases — SEL pin selects left (GND) or right (3.3V) channel, enabling stereo with only one additional mic module and zero extra MCU pins"
type: claim
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[communication]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
---

# Two PDM mics share one I2S bus for stereo via SEL pin time-multiplexing

The I2S protocol natively supports stereo by time-multiplexing: the WS (word select) signal alternates between LEFT and RIGHT channel. Each clock phase belongs to one channel. PDM microphones exploit this by using a SEL (select) pin to determine which phase they output on:

**Wiring pattern:**
```
Mic 1 (Left):   SEL → GND,   DOUT → MCU I2S DIN
Mic 2 (Right):  SEL → 3.3V,  DOUT → MCU I2S DIN (same pin!)
Both mics:      CLK → MCU I2S BCK (shared)
                WS  → MCU I2S WS (shared, directly connects to SEL on some implementations)
```

Both DOUT pins physically connect to the same MCU input. They never collide because:
- When WS=LOW (left phase), only the mic with SEL=GND drives the line
- When WS=HIGH (right phase), only the mic with SEL=3.3V drives the line

**Why this matters for beginners:**
1. No additional hardware needed for stereo (no mux, no second I2S bus)
2. No additional MCU pins consumed (same 3 I2S pins serve both mics)
3. The software I2S driver automatically separates left/right channels from the interleaved data
4. The wiring is counterintuitive — connecting two outputs to one input looks like a short circuit but works because of time-division

**Applications:**
- Stereo recording
- Sound source localization (direction detection by comparing arrival time between mics)
- Noise cancellation (reference mic + signal mic)
- Beamforming (multiple mics for directional sensitivity)

---

Relevant Notes:
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] -- MCU must have I2S for this to work

Topics:
- [[sensors]]
- [[communication]]
