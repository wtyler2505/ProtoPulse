---
description: "Electret microphone module with LM393 comparator — provides both raw analog audio envelope and threshold-triggered digital output. Good for clap detection and sound-level monitoring, not for voice recognition"
topics: ["[[sensors]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [Analog, Digital]
logic_level: "5V (adjustable threshold via trimpot)"
manufacturer: "Generic"
part_number: "KY-038 (variant)"
pinout: |
  4-pin header:
  AO  → Analog output (raw audio envelope voltage)
  DO  → Digital output (HIGH when sound exceeds threshold)
  GND → Ground
  VCC → 3.3-5V supply

  Trimpot → Adjusts digital threshold sensitivity
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["NOT suitable for voice recognition or audio recording — too noisy and low-bandwidth", "Analog output is an envelope, not a clean audio waveform", "Digital threshold is sensitive to trimpot position — adjust carefully", "Some modules have AO and DO labels swapped — verify with a multimeter"]
datasheet_url: ""
---

# Sound sensor module LM393 electret mic analog digital out

A simple sound detection module built around an electret microphone and an LM393 dual comparator. It gives you two outputs: an analog voltage proportional to the sound level (envelope, not raw audio waveform) and a digital output that goes HIGH when the sound exceeds an adjustable threshold. The trimpot on the board sets the threshold sensitivity.

Good for: clap detection, "loud noise" triggering, basic sound level monitoring, and "is there sound?" presence detection.

Not good for: voice recognition, audio recording, frequency analysis, or anything requiring actual audio fidelity. For that, use the [[adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3]] instead.

## Specifications

| Spec | Value |
|------|-------|
| Microphone | Electret condenser |
| Comparator IC | LM393 |
| Supply Voltage | 3.3-5V DC |
| Analog Output | Voltage proportional to sound level |
| Digital Output | HIGH/LOW based on threshold |
| Threshold | Adjustable via onboard trimpot |
| Frequency Response | ~100Hz - 10kHz (electret mic limitation) |
| Dimensions | ~32 x 17mm |

## Wiring

| Module Pin | Arduino Pin | Notes |
|------------|-------------|-------|
| VCC | 5V (or 3.3V) | |
| GND | GND | |
| AO | Any analog input (A0-A5) | Raw sound level |
| DO | Any digital input | Threshold trigger |

## Using the Analog Output

The analog output gives a voltage centered around VCC/2 (roughly 2.5V on a 5V supply). Sound causes this voltage to fluctuate. To detect sound level:

```cpp
int soundLevel = analogRead(A0);
int baseline = 512;  // ~VCC/2 on 10-bit ADC
int amplitude = abs(soundLevel - baseline);
// Higher amplitude = louder sound
```

For better results, sample multiple readings over ~50ms and take the peak-to-peak difference.

## Using the Digital Output

The digital output triggers when the analog signal crosses the threshold set by the trimpot. Useful for binary "sound detected" applications:

```cpp
if (digitalRead(DO_PIN) == HIGH) {
  // Sound above threshold detected
}
```

Adjust the trimpot until ambient noise doesn't trigger it but claps/voice do.

## Limitations

- The electret mic response rolls off sharply above ~10kHz. It's capturing a narrow slice of the audio spectrum.
- The LM393 comparator has no hysteresis — near the threshold, the digital output can oscillate rapidly (chatter). Add software debouncing.
- The analog output is an envelope signal, not a clean audio waveform. You cannot do FFT or pitch detection on it.
- Background noise (HVAC, fans, electrical hum) raises the baseline and reduces effective sensitivity.

---

Related Parts:
- [[adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3]] — digital audio microphone for actual audio capture
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via analog (AO) + digital (DO) at 5V, direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via analog (AO) + digital (DO) at 5V, direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via analog (AO) + digital (DO) at 5V, direct connection
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via analog (AO) + digital (DO) at 5V, direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible at 3.3V, use DO for digital threshold detection or AO with ADC1 pins
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible at 3.3V, DO works on any GPIO, AO needs voltage divider for A0 (0-1V range)
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible at 3.3V, use ADC pins for AO, any GPIO for DO

Categories:
- [[sensors]]
