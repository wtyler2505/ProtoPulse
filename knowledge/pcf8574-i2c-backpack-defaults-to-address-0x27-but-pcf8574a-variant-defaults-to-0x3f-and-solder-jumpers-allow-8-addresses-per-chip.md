---
description: "LCD I2C backpacks use either PCF8574 (default 0x27) or PCF8574A (default 0x3F), and three solder jumpers (A0-A2) allow 8 addresses per chip variant — if the display does not respond, run an I2C scanner sketch to find the actual address"
type: claim
source: "docs/parts/hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[communication]]"
---

# pcf8574 i2c backpack defaults to address 0x27 but pcf8574a variant defaults to 0x3f and solder jumpers allow 8 addresses per chip

The PCF8574 I2C GPIO expander used on HD44780 LCD backpacks comes in two variants with different default addresses:

| Chip Variant | Default Address | Jumper Range |
|-------------|----------------|--------------|
| PCF8574 | 0x27 | 0x20 - 0x27 |
| PCF8574A | 0x3F | 0x38 - 0x3F |

Three solder jumpers on the backpack (A0, A1, A2) set the low 3 bits of the I2C address, giving 8 possible addresses per chip variant. Most tutorials and library examples hardcode `0x27`, but cheap modules from different suppliers may use the PCF8574A variant at `0x3F` with no external indication.

This creates a debugging trap that parallels [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]]: the module looks identical, the wiring is correct, the code compiles, but the display shows nothing because the I2C address is wrong. The failure is silent — no error message, no crash, just a blank screen that looks exactly like a contrast problem or a wiring fault.

**The diagnostic workflow:**
1. Upload an I2C scanner sketch (built into Arduino IDE examples)
2. Open Serial Monitor at 9600 baud
3. The scanner reports all responding I2C addresses
4. Use the reported address in the `LiquidCrystal_I2C` constructor

**Multiple LCDs on one bus:** If a project needs two HD44780 LCDs, set one backpack's jumpers to a different address. With 8 addresses per variant (16 total across both chip types), you can theoretically have up to 16 LCDs on one I2C bus — though in practice 2-3 is the realistic maximum before bus capacitance becomes a concern.

**ProtoPulse implication:** When the bench coach detects an HD44780 with I2C backpack and the user's code uses a hardcoded address, it should warn that the address may not match the physical module and recommend the I2C scanner as a first step.

---

Source: [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]

Relevant Notes:
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — same pattern: identical-looking module, different I2C address
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C address conflicts from a different angle

Topics:
- [[displays]]
- [[communication]]
