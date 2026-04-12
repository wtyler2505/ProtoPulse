---
description: "Self-driven piezo buzzer with built-in 2.5kHz oscillator — just apply 5V DC and it screams. No PWM needed, no tone() needed. Dead simple for alarms and status beeps, but you only get one fixed frequency"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [GPIO]
logic_level: "5V"
manufacturer: "Generic"
part_number: ""
pinout: |
  2-pin:
    + (marked) → 5V or digital GPIO HIGH
    -          → GND
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Has polarity — positive pin is marked", "Louder than you'd expect at 5V", "Cannot change tone frequency — built-in oscillator is fixed at ~2.5kHz", "ESP32/3.3V boards need a MOSFET or transistor driver since the buzzer wants 5V"]
datasheet_url: ""
---

# Active Piezo Buzzer — 5V DC, 2.5kHz Built-In Oscillator

An active buzzer has its own oscillator circuit built in. Apply DC voltage and it produces a continuous tone at ~2.5kHz. No PWM signal needed, no tone() library, no frequency generation on the MCU side. Just HIGH = beep, LOW = silence.

This makes it dead simple for binary status indicators: alarm on, alarm off. But you cannot play melodies or vary the pitch — for that, use the [[passive-piezo-buzzer-3-5v-pwm-driven-tone-generator]] instead.

**How to tell active from passive:** An active buzzer typically has a sealed top with no exposed piezo element and is often slightly taller. If you apply 5V DC and it beeps on its own, it's active. If it just clicks or stays silent, it's passive.

## Specifications

| Spec | Value |
|------|-------|
| Type | Active (built-in oscillator) |
| Operating Voltage | 5V DC |
| Frequency | ~2.5kHz (fixed) |
| Current Draw | ~30mA |
| Sound Output | ~85dB @ 10cm |
| Pins | 2 (+ marked for positive) |

## Wiring

### Direct drive from 5V Arduino GPIO

```
Arduino Digital Pin → Buzzer (+)
GND                → Buzzer (-)
```

This works because 5V Arduino pins source ~20mA and the buzzer draws ~30mA — it's slightly over spec for a single pin but works in practice for short bursts. For continuous operation or to be safe, use a transistor:

### Transistor-driven (recommended)

```
Arduino GPIO → 1K resistor → 2N2222 Base
                              Emitter → GND
                              Collector → Buzzer (-)
                              Buzzer (+) → 5V
```

### For 3.3V boards (ESP32, Pico)

The buzzer needs 5V, so you cannot drive it directly from a 3.3V GPIO. Use an N-channel MOSFET like the [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] (in inventory) as a low-side switch:

```
ESP32 GPIO → MOSFET Gate
             MOSFET Source → GND
             MOSFET Drain → Buzzer (-)
             Buzzer (+) → 5V supply
```

## Active vs Passive Buzzer Comparison

| Feature | Active (this one) | Passive |
|---------|-------------------|---------|
| Drive signal | DC voltage | PWM / square wave |
| Frequency control | No (fixed ~2.5kHz) | Yes (tone() function) |
| Melodies | No | Yes |
| Complexity | Trivial | Needs PWM pin + code |
| Use case | Alarms, beeps | Music, variable alerts |

---

Related Parts:
- [[passive-piezo-buzzer-3-5v-pwm-driven-tone-generator]] — passive version that can play tones/melodies via PWM
- [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] — logic-level MOSFET for driving from 3.3V boards
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — direct drive from 5V digital pin
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — direct drive from 5V digital pin

Categories:
- [[actuators]]
