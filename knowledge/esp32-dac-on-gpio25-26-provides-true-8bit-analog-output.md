---
description: "Two 8-bit DAC channels output 0-3.3V continuously -- rare among maker MCUs (Arduino and Pi Pico have no DAC) enabling waveform generation and audio without PWM+filter"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 DAC outputs on GPIO25 and GPIO26 provide true 8-bit analog voltage generation

The ESP32 has two 8-bit Digital-to-Analog Converter (DAC) channels on GPIO25 (DAC1) and GPIO26 (DAC2), capable of outputting continuous analog voltages from 0 to 3.3V in 256 steps (~12.9mV per step). This is a true analog output -- not PWM filtered to approximate DC, but a resistor-ladder DAC that produces a steady voltage proportional to the digital value written to it.

This is uncommon in the maker MCU world. Arduino boards (Uno, Mega, Nano) have no DAC at all -- their `analogWrite()` produces PWM that must be low-pass filtered to approximate an analog voltage. The Raspberry Pi Pico also has no DAC. Only the Arduino Due (SAM3X8E, 2 DACs) and some STM32 boards share this capability.

Practical uses for maker projects include: generating audio waveforms (buzzer tones, simple synth), providing reference voltages for comparators or analog circuits, creating bias voltages for sensors, and driving analog meters. The 8-bit resolution (256 levels) is coarse for precision applications but adequate for audio and control signals.

**Caveat:** GPIO25 and GPIO26 are also ADC2 channels. If WiFi is active, ADC2 is locked out, but the DAC functionality remains available -- the DAC uses different hardware from the ADC on these pins.

---

Relevant Notes:
- [[esp32-adc2-unavailable-when-wifi-active]] -- GPIO25/26 lose ADC but keep DAC when WiFi is active
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] -- GPIO25 and GPIO26 are in the safe pin list

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
