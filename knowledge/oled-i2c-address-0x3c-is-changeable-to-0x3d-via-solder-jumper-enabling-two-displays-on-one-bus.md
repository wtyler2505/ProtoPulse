---
description: "SH1106/SSD1306 OLED modules default to I2C address 0x3C, with a solder jumper on the PCB back that changes it to 0x3D — enabling two identical OLEDs on the same I2C bus without address conflicts"
type: claim
source: "docs/parts/sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[communication]]"
---

# oled i2c address 0x3c is changeable to 0x3d via solder jumper enabling two displays on one bus

Most I2C OLED modules (SH1106 and SSD1306) default to I2C address 0x3C. A solder jumper on the back of the PCB allows changing the address to 0x3D. This is the entire address range — unlike the PCF8574 LCD backpack with 8 addresses per variant, OLEDs offer only 2 addresses, limiting a single I2C bus to at most 2 identical OLED displays.

**The address jumper mechanism:** The solder jumper connects the SA0 pin of the OLED driver IC to either GND (address 0x3C) or VCC (address 0x3D). On most modules, the default is a small trace connecting SA0 to GND. To change the address, cut the trace and bridge the alternate pad with solder. This is a permanent physical modification — not a software setting.

**Practical use case:** Dual-OLED projects are common in maker builds — one display showing sensor data, another showing status/menu. With both modules on the same I2C bus at different addresses, the MCU can address each independently:

```cpp
U8G2_SH1106_128X64_NONAME_F_HW_I2C display1(U8G2_R0, /* reset=*/ U8X8_PIN_NONE, /* clock=*/ SCL, /* data=*/ SDA);
// Second display at alternate address requires library-specific address override
```

**The 2-address limit:** If a project needs more than 2 identical OLEDs, options include:
- SPI mode (each display gets its own CS pin, no address needed)
- I2C multiplexer (TCA9548A gives 8 independent I2C buses)
- Different display modules with different default addresses

This pattern structurally parallels [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]] but with far fewer address options.

---

Source: [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]

Relevant Notes:
- [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]] — same concept, more addresses
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C address conflicts from sensor perspective

Topics:
- [[displays]]
- [[communication]]
