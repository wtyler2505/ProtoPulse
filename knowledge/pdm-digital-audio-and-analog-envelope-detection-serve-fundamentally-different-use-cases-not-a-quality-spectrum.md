---
description: "PDM/I2S mics (SPH0645LM4H) capture actual audio samples for recording/FFT/ML, while analog sound sensors (LM393) detect only loudness envelope for clap/threshold detection — these are different tool categories, not better/worse versions of each other"
type: claim
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[sensors]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
---

# PDM digital audio and analog envelope detection serve fundamentally different use cases not a quality spectrum

Beginners often assume microphone modules are interchangeable — just "better or worse at hearing sound." In reality, they serve completely different purposes:

**Analog sound sensor (e.g., LM393-based modules):**
- Output: Digital HIGH/LOW (threshold crossed) or analog voltage (envelope)
- Information: "How loud is it right now?" (scalar)
- Use cases: Clap detection, noise level monitoring, sound-activated relay
- MCU requirement: Any GPIO or ADC pin
- Data rate: One sample per ADC read (trivial)
- Cannot do: Record audio, identify sounds, run FFT, voice commands

**PDM/I2S digital microphone (e.g., SPH0645LM4H):**
- Output: 16-bit PCM audio samples at 16-48kHz
- Information: Full audio waveform (time series)
- Use cases: Audio recording, FFT spectral analysis, voice commands (TFLite Micro), sound classification, streaming
- MCU requirement: Hardware I2S peripheral (ESP32, RP2040, STM32)
- Data rate: 768kbps minimum (16kHz × 16bit × mono)
- Cannot do: Work on ATmega boards, function without I2S driver code

**The bench coach implication:** When a user says "I want to detect sounds," the first question is WHAT they want to detect:
- "Is it loud?" → Analog sound sensor (simpler, works on anything)
- "What is the sound?" → PDM/I2S mic (complex, needs capable MCU)
- "Record/stream audio" → PDM/I2S mic
- "Count claps" → Either works, but analog is simpler

This parallels the LDR vs. photodiode distinction: presence/threshold detection is a fundamentally different problem from measurement/characterization, even though both involve the same physical phenomenon.

---

Relevant Notes:
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Same pattern: qualitative vs quantitative sensing
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] -- MCU gate for the digital option

Topics:
- [[sensors]]
