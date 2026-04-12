---
description: "GP26-28 are the only 3 ADC inputs (12-bit, 0-3.3V) plus 1 internal temp sensor -- analog-intensive projects need an external MCP3008 or ADS1115"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Pico has only 3 ADC channels making analog-heavy projects require an external ADC

The RP2040 provides just 3 external ADC channels on GP26, GP27, and GP28 (plus one internal temperature sensor on channel 4). These are 12-bit (0-4095) with a 0-3.3V input range and 500ksps sample rate. Compared to other maker MCUs:

| Board | ADC Channels | Resolution | Caveats |
|-------|-------------|-----------|---------|
| Pi Pico | 3 | 12-bit | Fewest channels |
| Arduino Uno | 6 (4 with I2C) | 10-bit | A4/A5 shared with I2C |
| Arduino Mega | 16 | 10-bit | Most channels |
| ESP32 | 18 (8 with WiFi) | 12-bit | ADC2 locked by WiFi |
| ESP8266 | 1 | 10-bit | 0-1V range only |

For a project with a joystick (2 channels), a potentiometer (1 channel), and a light sensor (1 channel), the Pico already exceeds its analog capacity. The standard solution is an external I2C ADC like the ADS1115 (4 channels, 16-bit) or SPI ADC like the MCP3008 (8 channels, 10-bit).

The Pico's ADC is otherwise well-behaved -- linear across its full range (unlike the ESP32's nonlinearity above 2.5V), no WiFi interference (the basic Pico has no WiFi), and the ADC_VREF pin allows using an external reference voltage for improved accuracy.

---

Relevant Notes:
- [[esp8266-a0-analog-input-has-0-1v-range-not-0-3v3]] -- ESP8266 is even more limited (1 channel, 0-1V)
- [[esp32-adc2-unavailable-when-wifi-active]] -- ESP32's 18 channels drop to 8 with WiFi
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] -- Uno's 6 channels drop to 4 with I2C
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- Pico ADC is linear; ESP32 is not

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
