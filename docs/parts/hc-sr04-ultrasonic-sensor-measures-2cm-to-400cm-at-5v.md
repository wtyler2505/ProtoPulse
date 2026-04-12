---
description: "Budget ultrasonic rangefinder — Trig/Echo interface, 2cm-400cm range, ~3mm accuracy. 5V only and Echo pin outputs 5V, so you MUST level shift for 3.3V boards or you'll fry them"
topics: ["[[sensors]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [Digital]
logic_level: "5V"
logic_notes: "Runs at 5V and drives a 5V Echo signal. The Trig input usually accepts 3.3V as HIGH, but Echo must be shifted before it reaches a 3.3V MCU."
manufacturer: "Generic"
part_number: "HC-SR04"
measurement_range: "2cm to 400cm"
accuracy: "~3mm"
beam_angle: "~15 degrees"
pinout: |
  4-pin header (left to right, component side facing you):
  VCC  → 5V supply
  Trig → Digital output from Arduino (10us pulse to trigger measurement)
  Echo → Digital input to Arduino (pulse width encodes distance)
  GND  → Ground
level_shifter_needed: ["[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Echo pin outputs 5V — do NOT connect directly to ESP8266/ESP32 3.3V boards without a voltage divider or level shifter", "Minimum range is 2cm — readings below this are unreliable", "Soft surfaces (fabric, foam) absorb sound and give weak/no return", "Multiple HC-SR04s can interfere with each other if fired simultaneously"]
datasheet_url: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf"
---

# HC-SR04 ultrasonic sensor measures 2cm to 400cm at 5V

The go-to distance sensor for hobby robotics. Send a 10us trigger pulse, measure the Echo pulse width, divide by 58 to get centimeters. Works reliably for obstacle avoidance, liquid level measurement, parking sensors, and any application where you need to know "how far away is that thing."

The critical gotcha: **the Echo pin outputs 5V**. On a 5V Arduino, no problem. On a 3.3V board like the ESP8266 or ESP32, connecting Echo directly will damage the MCU. Use a voltage divider (10k + 20k) or a level shifter.

## Specifications

| Spec | Value |
|------|-------|
| Supply Voltage | 5V DC |
| Supply Current | ~15mA |
| Frequency | 40kHz ultrasonic |
| Detection Range | 2cm to 400cm |
| Accuracy | ~3mm |
| Beam Angle | ~15 degrees |
| Trigger Pulse | 10us HIGH on Trig pin |
| Echo Output | HIGH pulse, width = round-trip time |
| Dimensions | 45 x 20 x 15mm |

## How It Works

1. Arduino sends 10us HIGH pulse on Trig pin
2. HC-SR04 emits 8 pulses of 40kHz ultrasound
3. Sound bounces off target and returns
4. Echo pin goes HIGH for the duration of the round trip
5. Distance = (Echo pulse width in us) / 58 = cm
6. Distance = (Echo pulse width in us) / 148 = inches

```cpp
// Basic measurement
digitalWrite(trigPin, LOW);
delayMicroseconds(2);
digitalWrite(trigPin, HIGH);
delayMicroseconds(10);
digitalWrite(trigPin, LOW);
long duration = pulseIn(echoPin, HIGH);
float distance_cm = duration / 58.0;
```

## Wiring to 5V Arduino

| HC-SR04 Pin | Arduino Pin |
|-------------|-------------|
| VCC | 5V |
| Trig | Any digital pin |
| Echo | Any digital pin |
| GND | GND |

Straightforward — no external components needed.

## Wiring to 3.3V Boards (ESP8266/ESP32) — LEVEL SHIFT REQUIRED

The Echo pin outputs 5V. You MUST step it down to 3.3V.

**Voltage divider method (cheapest):**
```
Echo pin → [10k resistor] → junction → [20k resistor] → GND
                              |
                              → ESP GPIO input (~3.3V)
```

**Level shifter method (cleanest):**
Use a BSS138-based bidirectional level shifter. Connect Echo to the 5V side, ESP GPIO to the 3.3V side.

The Trig pin only needs a 3.3V input signal — most 5V devices read 3.3V as HIGH, so Trig can connect directly from a 3.3V board.

## Multi-Sensor Array for Rover Coverage

For a rover obstacle avoidance system, 4-6 HC-SR04s provide coverage around the platform:

| Position | Angle | Coverage |
|----------|-------|----------|
| Front-Center | 0 degrees | Forward obstacles |
| Front-Left | -45 degrees | Left-side approach |
| Front-Right | +45 degrees | Right-side approach |
| Left-Side | -90 degrees | Lateral clearance |
| Right-Side | +90 degrees | Lateral clearance |
| Rear-Center | 180 degrees | Reversing clearance |

### Multiplexed Trigger Timing

Multiple HC-SR04s fired simultaneously interfere with each other (cross-talk). Fire them sequentially with ~60ms between measurements:

```cpp
// Cycle through sensors with staggered timing
for (int i = 0; i < NUM_SENSORS; i++) {
  triggerSensor(i);
  readings[i] = readEcho(i);
  delay(60);  // Wait for echoes to dissipate before next sensor
}
// Full scan of 6 sensors takes ~360ms (~2.8 Hz update rate)
```

For faster scan rates, fire sensors that point in opposite directions simultaneously (e.g., front + rear) since their beams don't overlap.

### Waterproof Variant: JSN-SR04T

The **JSN-SR04T** is a waterproof version with a sealed ultrasonic transducer on a cable (IP67 rated). Same trigger/echo interface as the HC-SR04 but with different specs:

| Spec | HC-SR04 | JSN-SR04T |
|------|---------|-----------|
| Range | 2-400cm | 20-600cm |
| Min range | 2cm | 20cm (much larger dead zone) |
| Waterproof | No | Yes (IP67 transducer) |
| Beam angle | ~15 degrees | ~75 degrees (much wider) |
| Price | ~$2 | ~$5 |

Use the JSN-SR04T for outdoor rovers or wet environments. The larger minimum range (20cm) means it's not suitable for close-obstacle detection — pair with a short-range IR sensor for near-field coverage.

## Limitations

- **Minimum range 2cm**: Objects closer than 2cm return garbage data or no reading at all.
- **Beam angle ~15 degrees**: It's not a laser — the ultrasonic cone is broad. Narrow objects at distance may be missed, and it can't distinguish two objects within the cone.
- **Soft surfaces absorb sound**: Fabric, foam, fur, and angled surfaces give weak or no return signal.
- **Temperature affects accuracy**: Speed of sound varies with temperature (~0.6m/s per degree C). At room temperature, error is negligible. In extreme cold/heat, compensate in code.
- **Multi-sensor interference**: If you have multiple HC-SR04s, trigger them sequentially (not simultaneously) to avoid cross-talk. Add ~50ms between readings.

---

Related Parts:
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] — motion detection (different principle, same project category)
- [[sharp-gp2y0a51sk0f-ir-proximity-sensor-2-to-15cm-analog]] — short-range IR alternative (analog output, 2-15cm)
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via digital GPIO at 5V, direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO at 5V, direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO at 5V, direct connection
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO at 5V, direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — WARNING: needs voltage divider or level shifter on Echo pin (5V output to 3.3V input). Trig works direct.
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — WARNING: needs voltage divider or level shifter on Echo pin (5V output to 3.3V input). Trig works direct.

Categories:
- [[sensors]]
