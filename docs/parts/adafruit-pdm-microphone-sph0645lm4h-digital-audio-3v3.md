---
description: "MEMS PDM microphone for actual digital audio capture — I2S-compatible output, 50Hz-15kHz response, 65dB SNR. Use this when you need real audio data, not the LM393 sound sensor for clap detection"
topics: ["[[sensors]]", "[[communication]]"]
status: needs-test
quantity: 1
voltage: [3.3]
interfaces: [PDM, I2S]
logic_level: "3.3V only"
manufacturer: "Adafruit"
part_number: "Adafruit 3492"
mic_ic: "Knowles SPH0645LM4H"
frequency_response: "50Hz to 15kHz"
snr: "65dB"
sensitivity: "-26 dBFS"
pinout: |
  Adafruit breakout board (6 pins):
  3V   → 3.3V power (NOT 5V)
  GND  → Ground
  BCLK → Bit clock (I2S SCK) — from MCU
  DOUT → Data output (I2S SD) — to MCU
  LRCLK → Left/Right clock (I2S WS) — from MCU
  SEL  → Channel select (GND=left, 3.3V=right)
compatible_with: ["[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]"]
used_in: []
warnings: ["3.3V ONLY — do NOT power from 5V or connect to 5V logic", "Requires I2S peripheral — not all MCUs have hardware I2S (Arduino Uno/Mega do NOT)", "ESP32 has hardware I2S and is the recommended MCU for this mic", "SEL pin selects L/R channel — connect two mics (one SEL=GND, one SEL=3.3V) for stereo"]
datasheet_url: "https://www.adafruit.com/product/3492"
---

# Adafruit PDM microphone SPH0645LM4H digital audio 3.3V

This is the real audio microphone in the inventory — a MEMS PDM mic on an Adafruit breakout with an I2S-compatible digital output. Unlike the [[sound-sensor-module-lm393-electret-mic-analog-digital-out]] which gives you a noisy analog envelope good only for clap detection, this mic outputs actual digital audio samples that you can record, stream, or run through FFT for frequency analysis.

The SPH0645LM4H from Knowles has 65dB SNR and flat response from 50Hz to 15kHz — good enough for voice capture, sound classification, and audio monitoring. The PDM output is compatible with I2S peripherals, which means you need an MCU with I2S hardware. The ESP32 is the best match — Arduino Uno and Mega do NOT have I2S. The ESP8266 has limited I2S support (RX only, which is what you need for a mic).

## Specifications

| Spec | Value |
|------|-------|
| Microphone | Knowles SPH0645LM4H (MEMS) |
| Output | PDM (Pulse Density Modulation), I2S-compatible |
| Frequency Response | 50Hz to 15kHz |
| Signal-to-Noise Ratio | 65dB |
| Sensitivity | -26 dBFS |
| Supply Voltage | 1.6-3.6V (3.3V typical) |
| Supply Current | ~600uA |
| Data Format | I2S, 18-bit samples |
| Sample Rate | Up to 64kHz (PDM clock / decimation ratio) |
| Channel Select | SEL pin (GND=left, VCC=right) |
| Dimensions (breakout) | ~16 x 12mm |

## Wiring to ESP32 (Recommended)

| Adafruit Pin | ESP32 Pin | Notes |
|-------------|-----------|-------|
| 3V | 3.3V | Power |
| GND | GND | |
| BCLK | GPIO26 (or any I2S BCK-capable pin) | Bit clock |
| DOUT | GPIO25 (or any I2S DIN pin) | Audio data |
| LRCLK | GPIO22 (or any I2S WS pin) | Word select |
| SEL | GND | Left channel (or 3.3V for right) |

## Wiring to ESP8266

The ESP8266 has I2S RX support (input only), which works for receiving mic data:

| Adafruit Pin | ESP8266 Pin | Notes |
|-------------|-------------|-------|
| 3V | 3.3V | |
| GND | GND | |
| BCLK | GPIO15 (I2S BCK) | Fixed pin on ESP8266 |
| DOUT | GPIO13 (I2S DIN) | Fixed pin on ESP8266 |
| LRCLK | GPIO2 (I2S WS) | Fixed pin on ESP8266 — has boot mode restriction! |
| SEL | GND | |

**Warning**: GPIO2 (I2S WS) must be HIGH at boot on ESP8266. The LRCLK idle state should be compatible, but test carefully.

## Stereo Configuration

Two SPH0645LM4H mics can share the same I2S bus:
- Mic 1: SEL → GND (left channel data on low WS phase)
- Mic 2: SEL → 3.3V (right channel data on high WS phase)
- Share BCLK and LRCLK between both mics
- Both DOUT pins connect to the SAME MCU I2S data input (they time-multiplex)

## NOT Compatible With

- **Arduino Uno/Mega** — no I2S hardware peripheral. You cannot bit-bang I2S at audio rates on an 8-bit AVR.
- **5V boards** — the mic is 3.3V only. No level shifting will help because I2S signals need clean timing.

## Use Cases

- Voice command detection (with TensorFlow Lite Micro)
- Environmental sound classification
- Audio recording to SD card
- Sound level monitoring (much higher quality than LM393 module)
- Wake word detection

---

Related Parts:
- [[sound-sensor-module-lm393-electret-mic-analog-digital-out]] — analog sound sensor (simpler, lower quality, for clap detection)
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible MCU (limited I2S support)

Categories:
- [[sensors]]
- [[communication]]
