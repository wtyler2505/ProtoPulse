---
description: "The HD44780 in 4-bit parallel mode needs RS, E, D4-D7 = 6 GPIO pins, but a PCF8574 I2C backpack reduces this to 2 data pins (SDA/SCL) plus power — making the backpack the recommended default for any pin-constrained project"
type: claim
source: "docs/parts/hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# hd44780 parallel mode consumes 6 gpio pins minimum making i2c backpack the default wiring choice

The HD44780 character LCD in its native 4-bit parallel mode requires 6 GPIO pins: RS (register select), E (enable), and D4-D7 (data). This is the minimum — 8-bit mode uses D0-D7 plus RS and E for 10 pins, but nobody uses 8-bit mode because it doubles the pin cost for no meaningful speed gain on a character display.

Even 6 pins is expensive. On an Arduino Uno (14 digital + 6 analog = 20 total GPIO), dedicating 6 pins to a text display that shows 32 characters leaves noticeably less room for sensors, buttons, LEDs, or communication modules. On an ESP8266 with ~9 usable GPIO, it is borderline impractical.

The PCF8574 I2C backpack adapter solves this by soldering directly onto the LCD's 16-pin header and exposing a 4-pin interface: VCC, GND, SDA, SCL. The PCF8574 is an I2C GPIO expander — it translates I2C commands into the parallel signals the HD44780 expects. The library changes from `LiquidCrystal` (built-in) to `LiquidCrystal_I2C`, and the constructor changes from `LiquidCrystal lcd(12, 11, 5, 4, 3, 2)` to `LiquidCrystal_I2C lcd(0x27, 16, 2)`.

The backpack also includes an onboard contrast potentiometer, eliminating the need for the external 10K pot on the V0 pin — one fewer component and one fewer wiring step.

**When parallel mode is still justified:** If the I2C bus is already congested (multiple sensors, OLED, RTC all sharing SDA/SCL) and no more I2C addresses are available, parallel mode avoids bus arbitration issues. But this is rare — the PCF8574 address is configurable via solder jumpers, and I2C can handle many devices.

**ProtoPulse implication:** When the bench coach detects an HD44780 LCD wired in parallel mode, it should suggest the I2C backpack as an optimization — especially when the project has other components competing for GPIO.

---

Source: [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]

Relevant Notes:
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — the I2C backpack changes the interface branch of the dependency chain
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] — the I2C backpack uses A4/A5, trading analog inputs for digital pin savings

Topics:
- [[displays]]
