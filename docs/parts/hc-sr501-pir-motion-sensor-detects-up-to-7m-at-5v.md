---
description: "Passive infrared motion detector — adjustable sensitivity (3-7m range) and delay (5s-5min), digital output goes HIGH when motion detected. Dirt cheap and reliable for room-level presence sensing"
topics: ["[[sensors]]"]
status: needs-test
quantity: 2
voltage: [5, 12]
interfaces: [Digital]
logic_level: "3.3V output (even on 5V supply)"
manufacturer: "Generic"
part_number: "HC-SR501"
detection_range: "3-7m (adjustable)"
detection_angle: "120 degrees"
pinout: |
  3-pin header (looking at component side, lens facing you):
  Pin 1 → VCC (5-12V DC)
  Pin 2 → OUT (3.3V digital output, HIGH = motion detected)
  Pin 3 → GND

  Potentiometers (on back):
  Sensitivity → Adjusts detection range (3-7m)
  Time Delay  → Adjusts output hold time (5s to ~5min)

  Jumper (on back):
  H position → Repeatable trigger (re-triggers while motion continues)
  L position → Single trigger (one pulse per detection event)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]"]
used_in: []
warnings: ["Needs 1 minute warm-up after power-on before readings are reliable", "Output is 3.3V even on 5V supply — safe for ESP8266/ESP32 without level shifting", "False triggers from air currents, pets, and rapid temperature changes", "Fresnel lens is fragile — don't press on it"]
datasheet_url: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR501_english.pdf"
---

# HC-SR501 PIR motion sensor detects up to 7m at 5V

The standard PIR motion sensor for hobby projects. It detects changes in infrared radiation caused by warm bodies (humans, animals) moving through its field of view. Digital output — goes HIGH when motion is detected, LOW when clear. Two trimpots on the back let you adjust sensitivity (detection range) and the time the output stays HIGH after triggering.

The output pin is 3.3V regardless of supply voltage, which makes it directly compatible with 3.3V boards like the [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — no level shifting needed. It's also read correctly as HIGH by 5V Arduinos since 3.3V exceeds the ATmega's 2.0V threshold.

## Specifications

| Spec | Value |
|------|-------|
| Sensor Type | Passive Infrared (PIR) |
| Supply Voltage | 5-12V DC (some modules work down to 3.3V) |
| Output Voltage | 3.3V HIGH / 0V LOW |
| Output Current | ~50mA max (can drive an LED directly) |
| Detection Range | 3-7m (adjustable via trimpot) |
| Detection Angle | ~120 degrees (cone) |
| Trigger Hold Time | 5 seconds to ~5 minutes (adjustable) |
| Re-trigger Delay | ~3 seconds (minimum gap between triggers) |
| Warm-up Time | ~1 minute after power-on |
| Quiescent Current | <50uA |
| Dimensions | ~32 x 24mm (board), Fresnel lens ~23mm diameter |

## Trigger Modes

A jumper on the back selects between two modes:

| Mode | Jumper | Behavior |
|------|--------|----------|
| Repeatable (H) | Jumper in H position | Output stays HIGH as long as motion continues. Timer resets with each new detection. |
| Single (L) | Jumper in L position | One HIGH pulse per detection event. Output goes LOW after delay, then has a ~3s dead zone before it can trigger again. |

**Repeatable mode** is usually what you want — it acts as a "motion is happening" signal. Single mode is useful for counting events or triggering one-shot actions.

## Wiring Notes

- **Power**: 5V from Arduino (current draw is tiny, <1mA during detection). Also works on 12V if that's more convenient.
- **Output**: Connect directly to any digital input pin. Works with 5V and 3.3V boards without level shifting.
- **Mounting**: The Fresnel lens needs a clear line of sight. Don't put it behind glass (blocks IR) or in an enclosure without a window.
- **Orientation**: Mount with the lens facing the area you want to monitor. The detection pattern is roughly a 120-degree cone.
- **Pull-down**: The output has an internal pull-down, so it reads clean LOW when no motion. No external resistor needed.

## Common Issues

- **False triggers at power-on**: The sensor calibrates for ~1 minute after power-on. Ignore output during this period or add a delay in your code.
- **False triggers from airflow**: Hot air from vents, space heaters, or even strong drafts can trigger a PIR. Mount away from HVAC vents.
- **Can't detect stationary warm bodies**: PIR detects CHANGES in IR — a person sitting still in front of it won't trigger after the initial detection. If you need presence detection (not just motion), consider a thermal array sensor.
- **Re-trigger delay**: After the output goes LOW, there's a mandatory ~3-second window where the sensor won't trigger again. This is by design and can't be adjusted.

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller (5V)
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible controller (3.3V output is directly safe)
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] — another proximity sensor (distance, not motion)

Categories:
- [[sensors]]
