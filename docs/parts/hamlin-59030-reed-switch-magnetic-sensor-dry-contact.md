---
description: "Industrial-grade magnetic reed sensor — normally open dry contact that closes in a magnetic field. Use for door/window security, position sensing, or RPM measurement with a magnet on a rotating shaft"
topics: ["[[sensors]]", "[[passives]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Digital]
logic_level: "N/A (passive switch — works at any logic level)"
manufacturer: "Hamlin (Littelfuse)"
part_number: "59030-010"
switch_type: "Normally open (NO)"
max_switching_voltage: "200V DC"
max_switching_current: "500mA"
max_carry_current: "1A"
contact_resistance: "<150 milliohm"
pinout: |
  2-pin device (no polarity):
  Pin 1 → One side of switch (connect to GPIO with pull-up)
  Pin 2 → Other side (connect to GND)

  Wiring with Arduino:
  Pin 1 → Arduino digital input + 10k pull-up to VCC
  Pin 2 → GND
  (Or use Arduino internal pull-up: pinMode(pin, INPUT_PULLUP))
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Reed switches bounce — debounce in software (5-10ms delay) or hardware (RC filter)", "Glass envelope is fragile — don't bend the leads close to the body", "Strong magnets can permanently magnetize the reeds, making the switch stick closed"]
datasheet_url: "https://www.littelfuse.com/~/media/electronics/datasheets/reed_sensors/littelfuse_reed_sensors_hamlin_59030_datasheet.pdf"
---

# Hamlin 59030 reed switch magnetic sensor dry contact

A precision reed switch from Hamlin (now Littelfuse). Two ferromagnetic metal reeds sealed in a glass envelope with an inert gas fill. When a magnetic field is applied (permanent magnet or electromagnet), the reeds attract each other and close the circuit. Remove the magnet, the reeds spring apart, and the circuit opens. No power needed — it's a purely passive device.

This is a proper industrial reed sensor, not a cheap hobby module. The 59030 series is rated for 200V DC switching and up to 1A carry current, which means you can use it to switch real loads (not just signal-level GPIO). For MCU input, just wire it like a button with a pull-up resistor.

## Specifications

| Spec | Value |
|------|-------|
| Type | Reed switch, normally open (NO) |
| Contact Form | Form A (SPST-NO) |
| Max Switching Voltage | 200V DC |
| Max Switching Current | 500mA |
| Max Carry Current | 1A |
| Max Switching Power | 10W |
| Contact Resistance | <150 milliohm |
| Operate Sensitivity | 10-20 AT (ampere-turns) |
| Release Sensitivity | 5-15 AT |
| Operate Time | ~0.5ms |
| Release Time | ~0.1ms |
| Insulation Resistance | >10^9 ohm |
| Dimensions | ~15mm body length, 2 wire leads |
| Package | Glass body, axial leads |

## Wiring as MCU Input

The reed switch is a simple dry contact — wire it the same way you'd wire a pushbutton:

```
Arduino GPIO (INPUT_PULLUP) ──── Reed Pin 1
                                   |
                                Reed Pin 2 ──── GND
```

With `INPUT_PULLUP`, the pin reads HIGH normally and LOW when the magnet closes the switch. No external resistor needed.

```cpp
pinMode(REED_PIN, INPUT_PULLUP);
// ...
if (digitalRead(REED_PIN) == LOW) {
  // Magnet detected (switch closed)
}
```

## Debouncing

Reed switches bounce — the contacts make and break several times in the first few milliseconds of closing. Without debouncing, a single magnet pass can register as multiple events.

**Software debounce**: Ignore state changes for 5-10ms after the first detection.

**Hardware debounce**: 10k pull-up + 100nF cap across the switch. The RC time constant (~1ms) filters out bounce.

## Applications

- **Door/window alarm**: Magnet on the moving part, reed switch on the frame
- **RPM sensing**: Magnet on a rotating shaft, reed switch nearby — count pulses per second
- **Position sensing**: Detect when a mechanism reaches a limit position
- **Liquid level**: Float with embedded magnet rises past reed switch
- **Wake from sleep**: Connect to an interrupt pin — the MCU sleeps until a magnet triggers the reed switch

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via digital GPIO with INPUT_PULLUP, passive switch works at any voltage
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO with INPUT_PULLUP, passive switch works at any voltage
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO with INPUT_PULLUP
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO with INPUT_PULLUP
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, use internal pull-up
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via digital GPIO at 3.3V, use internal pull-up
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, use internal pull-up

Categories:
- [[sensors]]
- [[passives]]
