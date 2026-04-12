---
description: "WS2812B addressable RGB LED ring for rover status indication — each LED individually controllable via single data pin. 5V, 60mA max per LED (all white full brightness). Color-coded system status: green=ready, red=fault, blue=GPS lock, etc."
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [Digital]
logic_level: "5V (data pin needs 5V logic for reliable operation — use level shifter from 3.3V MCUs)"
manufacturer: "WorldSemi / Generic"
part_number: "WS2812B"
pinout: |
  NeoPixel Ring (3 connections):
  5V   → 5V power (dedicated supply recommended for >8 LEDs)
  GND  → Ground (common with MCU ground)
  DIN  → Data input (from MCU GPIO)
  DOUT → Data output (to next LED in chain, if daisy-chaining)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["60mA per LED at full white brightness — 8 LEDs = 480mA, 16 LEDs = 960mA. Use dedicated 5V supply for larger rings, do NOT power from Arduino 5V pin", "Add a 300-500 ohm resistor on the data line (between MCU pin and DIN) to prevent signal reflections", "Add a 1000uF electrolytic capacitor across 5V and GND near the ring to absorb power supply surges", "3.3V data signal from ESP32 is technically out of spec for WS2812B (needs >3.5V for logic HIGH at 5V supply) — works sometimes but unreliable. Use a level shifter or run LEDs at 3.3V (dimmer)", "First LED in chain handles timing — if it dies, the entire chain goes dark"]
datasheet_url: ""
---

# WS2812B NeoPixel Ring — Status LED Array for System Feedback

Addressable RGB LEDs in a circular ring form factor. Each WS2812B has a tiny controller built into the LED package — you send a stream of 24-bit color data (8 bits each for green, red, blue) on a single data pin, and each LED grabs its color value and passes the rest down the chain. One GPIO pin controls the entire ring.

For the rover, this is the visual status indicator. Instead of a bunch of individual LEDs with separate wires, one ring gives you multi-color, multi-pattern feedback:

- **Solid green**: System ready, all nominal
- **Pulsing blue**: GPS acquiring satellites
- **Solid blue**: GPS locked
- **Amber**: Low battery warning
- **Red**: Fault condition
- **Rainbow chase**: Startup self-test
- **All off**: System powered down

## Specifications

| Spec | Value |
|------|-------|
| LED Type | WS2812B (integrated controller + RGB LED) |
| Typical Configuration | 8, 12, 16, or 24 LEDs per ring |
| Supply Voltage | 5V DC |
| Current per LED | ~50mA max (white, full brightness) |
| Current per LED | ~20mA typical (single color, full brightness) |
| Interface | Single-wire serial (800kHz) |
| Color Depth | 24-bit (16.7 million colors) |
| Data Protocol | NZR (WS2812B proprietary timing) |
| Operating Temp | -25C to +80C |
| Refresh Rate | ~30fps typical (depends on LED count) |
| Dimensions (8-LED ring) | ~32mm outer diameter |
| Dimensions (16-LED ring) | ~68mm outer diameter |

## Power Budget

| Ring Size | Max Current (all white) | Typical Current | Power at 5V |
|-----------|------------------------|-----------------|-------------|
| 8 LEDs | 400mA | 160mA | 2W max |
| 12 LEDs | 600mA | 240mA | 3W max |
| 16 LEDs | 800mA | 320mA | 4W max |
| 24 LEDs | 1200mA | 480mA | 6W max |

## Wiring

```
Arduino/ESP32                    NeoPixel Ring
    GPIO Pin ──[330 ohm]──→ DIN
    5V ──────────────────→ 5V  ←── [1000uF cap to GND]
    GND ─────────────────→ GND
```

**Three rules for reliable NeoPixel operation:**
1. 300-500 ohm resistor on data line
2. 1000uF capacitor across power
3. Common ground between MCU and ring

## Arduino Code (Adafruit NeoPixel)

```cpp
#include <Adafruit_NeoPixel.h>

#define LED_PIN    6    // Data pin
#define LED_COUNT  8    // Number of LEDs in ring

Adafruit_NeoPixel ring(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  ring.begin();
  ring.setBrightness(50);  // 0-255, keep low for status indication
  ring.show();             // Initialize all off
}

void setStatus(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < LED_COUNT; i++) {
    ring.setPixelColor(i, ring.Color(r, g, b));
  }
  ring.show();
}

// Usage:
// setStatus(0, 255, 0);    // Green = ready
// setStatus(255, 0, 0);    // Red = fault
// setStatus(0, 0, 255);    // Blue = GPS lock
// setStatus(255, 165, 0);  // Amber = low battery
```

## ESP32 3.3V Compatibility Issue

The WS2812B data spec requires logic HIGH > 0.7 * VDD = 0.7 * 5V = 3.5V. The ESP32 outputs 3.3V, which is below this threshold. It often works in practice, but it's out of spec and unreliable — especially with long wires or noisy environments.

**Solutions:**
1. **Level shifter** — use [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] or a simple single-channel 74HCT125 buffer
2. **Power NeoPixels at 3.3V** — they work but are dimmer and colors shift
3. **Use a 74HCT245 buffer** — converts 3.3V logic to 5V, purpose-built for this

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 5V logic, drives data line directly, no level shifter needed
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V logic, direct drive; use external 5V supply for rings >8 LEDs
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — 5V logic, direct drive
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same 5V compatibility
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — works but 3.3V data is out of spec; use level shifter for reliability
- [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] — level shifter for ESP32's 3.3V data line to 5V NeoPixel data
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] — alternative level shifter; works but slower than TXS0108E (fine for NeoPixel 800kHz data rate)

Categories:
- [[displays]]
