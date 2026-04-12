---
description: "Assorted 5mm through-hole LEDs in 7 colors — Red, Green, Blue, Yellow, White, Clear, and common-cathode RGB. 20mA typical current. ALWAYS use a current limiting resistor or you'll fry the LED and possibly the GPIO pin"
topics: ["[[passives]]"]
status: needs-test
quantity: 35
voltage: [1.8, 2.0, 2.2, 3.0, 3.4]
interfaces: [GPIO]
logic_level: "N/A (passive component)"
manufacturer: "Generic"
part_number: ""
pinout: |
  Standard LED (2 pins):
    Long leg  → Anode (+) — connect to resistor → GPIO or VCC
    Short leg → Cathode (-) — connect to GND
    Flat side of lens = cathode side

  RGB LED (4 pins, common cathode):
    Pin 1 (longest) → Common cathode → GND
    Pin 2 → Red anode → resistor → GPIO
    Pin 3 → Green anode → resistor → GPIO
    Pin 4 → Blue anode → resistor → GPIO
    (pin order varies — check with a coin cell battery)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["ALWAYS use current limiting resistor — direct connection to GPIO will damage LED and possibly the pin", "Long leg = anode (+), short leg = cathode (-)", "Blue and white LEDs have higher forward voltage (~3.0-3.4V) — may be dim at 3.3V without sufficient headroom", "RGB LEDs need 3 resistors — one per color channel", "Max forward current is typically 20mA — exceeding this shortens LED life or destroys it"]
datasheet_url: ""
---

# 5mm LED Assortment — Through-Hole, Red/Green/Blue/Yellow/White/Clear/RGB

A collection of standard 5mm through-hole LEDs in various colors, plus common-cathode RGB LEDs for color mixing. These are the bread-and-butter indicator lights for any electronics project. Simple to use — just add a current limiting resistor and connect to a GPIO pin.

## Inventory

| Color | Qty | Forward Voltage (Vf) | Typical Current | Resistor (5V) | Resistor (3.3V) |
|-------|-----|----------------------|----------------|---------------|-----------------|
| Red | 5 | 1.8-2.2V | 20mA | 150-180 ohm | 56-75 ohm |
| Yellow | 5 | 1.8-2.2V | 20mA | 150-180 ohm | 56-75 ohm |
| Green | 5 | 2.0-2.4V | 20mA | 130-150 ohm | 47-68 ohm |
| Blue | 5 | 3.0-3.4V | 20mA | 68-100 ohm | Marginal* |
| White | 5 | 3.0-3.4V | 20mA | 68-100 ohm | Marginal* |
| Clear | 5 | Varies | 20mA | Varies | Varies |
| RGB (CC) | 5 | R:2.0 G:3.0 B:3.0 | 20mA/ch | Per channel | Per channel |

*Blue and white LEDs at 3.3V: With a 3.0-3.4V forward voltage, there's almost no headroom for a resistor. They'll work but be dim. At 3.3V, you can often connect with just a 10-33 ohm resistor or even direct (the GPIO current limit acts as protection), but this is not recommended practice.

## Resistor Calculation

```
R = (Vsupply - Vf) / If

Example: Red LED on 5V Arduino
R = (5V - 2.0V) / 0.020A = 150 ohm

Example: Blue LED on 5V Arduino
R = (5V - 3.2V) / 0.020A = 90 ohm → use 100 ohm standard value

Quick rule of thumb:
- 5V system: 330 ohm works safely for ALL colors (dimmer but safe)
- 3.3V system: 100 ohm works for red/yellow/green (marginal for blue/white)
```

## Wiring — Single LED

```
GPIO Pin → 330 ohm resistor → LED Anode (+, long leg)
                                LED Cathode (-, short leg) → GND
```

## Wiring — RGB LED (Common Cathode)

```
GPIO Pin R → 150 ohm → Red Anode
GPIO Pin G → 100 ohm → Green Anode
GPIO Pin B → 100 ohm → Blue Anode
                        Common Cathode → GND
```

Use PWM pins to control brightness per channel and mix colors via `analogWrite()`.

## Arduino Code — Blink

```cpp
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}
```

## Arduino Code — RGB Color Mixing

```cpp
const int redPin = 9;    // PWM
const int greenPin = 10; // PWM
const int bluePin = 11;  // PWM

void setColor(int r, int g, int b) {
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
}

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  setColor(255, 0, 0);   // Red
  delay(1000);
  setColor(0, 255, 0);   // Green
  delay(1000);
  setColor(0, 0, 255);   // Blue
  delay(1000);
  setColor(255, 255, 0);  // Yellow
  delay(1000);
  setColor(0, 255, 255);  // Cyan
  delay(1000);
  setColor(255, 0, 255);  // Magenta
  delay(1000);
  setColor(255, 255, 255); // White
  delay(1000);
}
```

## Identifying Anode vs Cathode

1. **Leg length:** Long = anode (+), Short = cathode (-)
2. **Flat edge:** The flat side of the lens housing marks the cathode
3. **Internal structure:** Looking inside, the larger internal plate is the cathode
4. **Coin cell test:** Touch leads to a CR2032 — LED lights when polarity is correct

---

Related Parts:
- [[74hc595-8-bit-shift-register-serial-to-parallel-dip16]] — drive 8 LEDs with only 3 GPIO pins
- [[ws2812b-neopixel-ring-status-led-array-for-system-feedback]] — addressable RGB LEDs, no resistors needed, single data pin
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V GPIO, 20mA per pin, 6 PWM pins for RGB
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — 3.3V GPIO, LEDC PWM on any pin

Categories:
- [[passives]]
