---
description: "Most OLED I2C breakout modules have onboard pull-up resistors on SDA/SCL — adding external pull-ups creates parallel resistance that can lower the effective pull-up too much. Only add external pull-ups when wire runs exceed 30cm or bus capacitance from many devices degrades signal edges."
type: claim
source: "docs/parts/sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[communication]]"
---

# oled i2c modules include onboard pull-ups and external pull-ups should only be added for bus lengths exceeding 30cm

Most I2C OLED breakout modules (SH1106, SSD1306) include onboard pull-up resistors on the SDA and SCL lines, typically 4.7K-10K ohm to VCC. This is a convenience for the common case — plug in power and two data wires, and it works. But it creates a subtle problem when multiple modules with onboard pull-ups share the same I2C bus.

**The parallel resistance trap:** Pull-up resistors in parallel have a combined resistance of 1/(1/R1 + 1/R2 + ...). Three modules with 10K pull-ups each produce 3.3K effective pull-up. Five modules produce 2K. As the effective resistance drops, the pull-up current increases, and at some point the open-drain drivers on the I2C bus cannot pull SDA/SCL LOW against the pull-up current. The I2C specification requires the pull-up to be weak enough for the bus driver to overcome — typically no lower than ~1K ohm for standard mode.

**The inverse gotcha:** The vault already captures "I2C without pull-ups causes bus stuck low" in breadboard debugging notes. This is the inverse: I2C with too many pull-ups can cause communication errors because the drivers cannot assert LOW against the excessive pull-up current. Symptoms include intermittent communication failures, ACK/NACK errors, and data corruption — all of which look like wiring problems.

**When to add external pull-ups:**
- Wire runs exceed ~30cm (bus capacitance attenuates signal edges)
- Only one device on the bus has no onboard pull-ups
- The I2C bus operates at 400kHz and signal integrity is marginal

**Level shifters add to the parallel-resistance math:** a BSS138-based shifter (e.g., HW-221) includes 10K pull-ups on each channel on BOTH the LV and HV sides — that is the mechanism by which the shifter works, not an optional feature ([[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]]). When such a shifter bridges to a bus full of modules with their own onboard pull-ups, the shifter's 10K contributes another parallel resistor on each side. Two sensor modules (10K each) plus an HW-221 channel produces ~3.3K effective pull-up on the bus side facing the sensors — below the comfortable range but still workable. Four modules plus the shifter drops the effective pull-up below 2K and can push open-drain drivers out of spec. The fix is the same as for multi-module buses without a shifter: desolder onboard pull-ups on all but one or two devices, or desolder the shifter's side-specific pull-ups if the bus already has adequate external ones.

**When to remove onboard pull-ups:**
- More than 3-4 I2C devices with onboard pull-ups share the bus
- Desolder or cut the pull-up resistors on all but one module
- Or use one external pair of carefully chosen pull-ups and remove all onboard ones

---

Source: [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]

Relevant Notes:
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] — ESP32 I2C is software-based, so pull-up sizing affects it differently than hardware I2C
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] — another I2C gotcha category
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — level shifters contribute additional pull-ups to the parallel-resistance math
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — the pull-up RC behavior that makes this sizing matter

Topics:
- [[displays]]
- [[communication]]
