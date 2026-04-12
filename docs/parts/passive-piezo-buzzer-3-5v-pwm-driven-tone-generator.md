---
description: "Bare piezo element that plays whatever frequency you feed it — use tone() for melodies, alarms with variable pitch, or multi-tone status indicators. Needs PWM, but works at 3.3V or 5V"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [PWM]
logic_level: "3.3V"
manufacturer: "Generic"
part_number: ""
pinout: |
  2-pin (no polarity marking on most passive buzzers):
    Pin 1 → PWM-capable GPIO
    Pin 2 → GND
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["No built-in oscillator — applying DC voltage produces no sound (just a click)", "Some passive buzzers DO have polarity — check for markings before assuming they don't", "tone() on Arduino uses Timer2, which conflicts with PWM on pins 3 and 11 (Uno/Nano) — plan your pin assignments", "ESP32 uses ledcWriteTone() instead of tone() — different API"]
datasheet_url: ""
---

# Passive Piezo Buzzer — 3-5V PWM-Driven Tone Generator

A passive buzzer is just a piezo element with no built-in oscillator. Feed it a square wave at a specific frequency and it vibrates at that frequency, producing a tone. Change the frequency = change the pitch. This means you can play melodies, create multi-tone alarms, or generate any frequency in the audible range (~20Hz - 20kHz, though these small piezos are loudest around 2-4kHz).

The trade-off vs the [[active-piezo-buzzer-5v-2p5khz-built-in-oscillator]]: you need a PWM-capable pin and code to generate the tone, but you get full frequency control.

## Specifications

| Spec | Value |
|------|-------|
| Type | Passive (no oscillator) |
| Operating Voltage | 3-5V |
| Frequency Range | ~20Hz - 20kHz (piezo resonance ~2-4kHz) |
| Current Draw | ~10-30mA (varies with frequency) |
| Pins | 2 (often no polarity) |
| Drive Signal | Square wave (PWM) at desired frequency |

## Wiring

```
PWM-capable GPIO → Buzzer Pin 1
GND              → Buzzer Pin 2
```

That's it. No resistor needed (the buzzer is high impedance). No transistor needed at these current levels. Works at 3.3V or 5V — just quieter at 3.3V.

## Arduino Code — Playing Tones

```cpp
// Simple tone
tone(8, 1000);    // 1kHz on pin 8
delay(500);
noTone(8);        // Silence

// Play a melody
int melody[] = {262, 294, 330, 349, 392, 440, 494, 523};  // C4 to C5
for (int i = 0; i < 8; i++) {
  tone(8, melody[i], 200);  // frequency, duration in ms
  delay(250);
}
```

## ESP32 Code — Using LEDC

```cpp
// ESP32 doesn't have tone() — use LEDC PWM
#define BUZZER_PIN 25
#define BUZZER_CHANNEL 0

ledcSetup(BUZZER_CHANNEL, 2000, 8);  // channel, freq, resolution
ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);

ledcWriteTone(BUZZER_CHANNEL, 1000);  // 1kHz
delay(500);
ledcWriteTone(BUZZER_CHANNEL, 0);     // silence
```

## Common Frequencies

| Note | Frequency | Use Case |
|------|-----------|----------|
| C4 | 262 Hz | Low alert tone |
| E4 | 330 Hz | Medium tone |
| A4 | 440 Hz | Standard tuning reference |
| C5 | 523 Hz | Higher alert |
| E5 | 659 Hz | Notification |
| A5 | 880 Hz | Urgent |
| C6 | 1047 Hz | Alarm |
| Piezo resonance | ~2500 Hz | Loudest possible tone |

---

Related Parts:
- [[active-piezo-buzzer-5v-2p5khz-built-in-oscillator]] — active version, simpler but fixed frequency
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — tone() on any digital pin, PWM on 3/5/6/9/10/11
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — ledcWriteTone() on any GPIO

Categories:
- [[actuators]]
