---
description: "8-bit serial-to-parallel shift register — 3 GPIO pins in, 8 digital outputs. Daisy-chainable for 16, 24, 32+ outputs. 2-6V operating range. The classic IO expander for LED arrays, 7-segment displays, and any situation where you're running out of pins"
topics: ["[[passives]]", "[[shields]]"]
status: needs-test
quantity: 0
voltage: [2, 3.3, 5]
interfaces: [SPI-like]
logic_level: "Matches VCC (2-6V)"
manufacturer: "Various (TI, NXP, ON Semi)"
part_number: "74HC595"
pinout: |
  74HC595 DIP-16:
  Pin 1  (QB)    → Output B (bit 1)
  Pin 2  (QC)    → Output C (bit 2)
  Pin 3  (QD)    → Output D (bit 3)
  Pin 4  (QE)    → Output E (bit 4)
  Pin 5  (QF)    → Output F (bit 5)
  Pin 6  (QG)    → Output G (bit 6)
  Pin 7  (QH)    → Output H (bit 7)
  Pin 8  (GND)   → Ground
  Pin 9  (QH')   → Serial data out (to next 595's SER pin for daisy-chaining)
  Pin 10 (SRCLR) → Shift register clear (active LOW, tie to VCC for normal operation)
  Pin 11 (SRCLK) → Shift register clock (clock pulse shifts data in)
  Pin 12 (RCLK)  → Storage register clock / latch (pulse HIGH to update outputs)
  Pin 13 (OE)    → Output enable (active LOW, tie to GND for always-on)
  Pin 14 (SER)   → Serial data input (from MCU or previous 595)
  Pin 15 (QA)    → Output A (bit 0)
  Pin 16 (VCC)   → 2-6V power
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]"]
used_in: []
warnings: ["Outputs can source/sink ~6mA per pin at 5V — enough for LEDs with resistors, NOT for motors or relays. Use a ULN2003 or MOSFET for higher current", "OE pin (pin 13) is active LOW — tie to GND for normal operation, or connect to a PWM pin for brightness control of all outputs simultaneously", "SRCLR (pin 10) is active LOW — tie to VCC or outputs will stay cleared", "Maximum output current for entire chip is 70mA — if driving 8 LEDs, keep each under ~8mA", "Daisy-chaining adds propagation delay — clock all data in, then pulse latch once to update all outputs simultaneously"]
datasheet_url: "https://www.ti.com/product/SN74HC595"
---

# 74HC595 8-Bit Shift Register — Serial to Parallel (DIP-16)

The 74HC595 is the classic "I need more output pins" solution. Three GPIO pins from your MCU (data, clock, latch) give you 8 digital outputs. Chain two together and you get 16 outputs from the same 3 pins. Chain ten together? 80 outputs, still 3 pins.

It works by shifting data in serially (one bit at a time on the SER pin, clocked by SRCLK), then latching all 8 bits to the outputs simultaneously when you pulse RCLK. This means outputs don't change while you're clocking in new data — no glitching.

Common uses:
- Driving arrays of LEDs (with current-limiting resistors)
- Controlling multiple 7-segment displays (with [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] being better for this)
- GPIO expansion for status indicators
- Any digital output expansion when I2C expanders are overkill

## Specifications

| Spec | Value |
|------|-------|
| IC | 74HC595 (CMOS) |
| Outputs | 8 digital (parallel) |
| Input Pins | 3 (SER, SRCLK, RCLK) + 2 control (OE, SRCLR) |
| Supply Voltage | 2-6V |
| Output Current | ~6mA per pin (source/sink) at 5V |
| Total IC Current | 70mA maximum |
| Max Clock Frequency | 25 MHz at 5V |
| Package | DIP-16 (through-hole) |
| Daisy-Chain | Yes, via QH' → next SER |
| Operating Temp | -40C to +125C |

## Wiring to Arduino (3 pins)

| 74HC595 Pin | Arduino | Notes |
|-------------|---------|-------|
| Pin 14 (SER) | D11 (MOSI) | Serial data input |
| Pin 11 (SRCLK) | D13 (SCK) | Shift clock |
| Pin 12 (RCLK) | D8 (any GPIO) | Latch — pulse to update outputs |
| Pin 13 (OE) | GND | Active LOW — always enabled |
| Pin 10 (SRCLR) | VCC | Active LOW — never clear |
| Pin 16 (VCC) | 5V | Power |
| Pin 8 (GND) | GND | Ground |

## Arduino Code

```cpp
#define DATA_PIN  11  // SER
#define CLOCK_PIN 13  // SRCLK
#define LATCH_PIN 8   // RCLK

void setup() {
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
}

void updateOutputs(byte data) {
  digitalWrite(LATCH_PIN, LOW);          // Hold latch LOW while shifting
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, data);  // Shift 8 bits
  digitalWrite(LATCH_PIN, HIGH);         // Pulse latch to update outputs
}

void loop() {
  for (int i = 0; i < 256; i++) {
    updateOutputs(i);  // Binary count on 8 LEDs
    delay(100);
  }
}
```

## Daisy-Chaining

```
MCU SER ──→ [595 #1 SER → QH'] ──→ [595 #2 SER → QH'] ──→ [595 #3 SER]
MCU SRCLK ──→ All SRCLK pins (parallel)
MCU RCLK ──→ All RCLK pins (parallel)
```

Shift out 24 bits (3 bytes) for 3 chained 595s, then pulse latch once to update all 24 outputs.

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V host; most benefit from pin expansion since Uno only has 14 digital I/O
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 5V host; less need for expansion but useful for LED arrays
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — 3.3V host; run 74HC595 at 3.3V VCC to match logic levels
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same 5V compatibility
- [[4-digit-7-segment-display-hs420561k-common-cathode]] — can drive this display via shift register outputs (alternative to MAX7219)
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] — one 595 can drive all 7 segments + DP of a single digit
- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] — chain two 595s (one for rows, one for columns) to drive the matrix with multiplexing
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] — dedicated LED driver; better than 595 for displays since it handles multiplexing and brightness in hardware
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] — the HW-130 motor shield uses a 74HC595 internally for direction control

Categories:
- [[passives]]
- [[shields]]
