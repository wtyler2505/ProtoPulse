---
description: "GPIO12 is a strapping pin that selects flash voltage — HIGH forces 1.8V and brown-outs most ESP-WROOM-32 modules"
type: claim
source: "shared/verified-boards/nodemcu-esp32s.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/nodemcu-esp32s.ts"]
---

# ESP32 GPIO12 must remain LOW at boot or the module crashes from 1.8V flash voltage

GPIO12 on the ESP32 is one of five strapping pins sampled during the power-on reset sequence. Its state at that instant determines the operating voltage of the internal SPI flash: LOW selects 3.3V (correct for ESP-WROOM-32 modules), HIGH selects 1.8V. Since virtually every common ESP32 dev board ships with 3.3V flash, driving GPIO12 HIGH at boot causes an immediate brown-out — the flash cannot operate at 1.8V, and the module fails to start.

This is the most dangerous strapping pin because it looks like any other GPIO after boot. You can freely use it as an output, ADC (ADC2_CH5), touch sensor (T5), HSPI MISO, or JTAG TDI once the chip is running. The trap is that whatever peripheral or pull-up resistor you wire to it also determines its state during the brief boot window. A 10K pull-up to 3.3V, an I2C sensor that idles HIGH, or even a long wire picking up noise — any of these can latch GPIO12 HIGH and brick the boot process.

Practical mitigation: if you must use GPIO12, add a strong pull-down (4.7K or lower to GND) to guarantee it reads LOW at power-on. Alternatively, on ESP32 chips that support efuse programming, you can burn the VDD_SDIO efuse to permanently set 3.3V flash regardless of GPIO12 state — but that is a one-way operation.

---

Relevant Notes:
- [[esp32-adc2-unavailable-when-wifi-active]] -- another ESP32 pin restriction that surprises beginners
- [[esp32-six-flash-gpios-must-never-be-used]] -- the even more absolute pin restriction
- [[bldc-stop-active-low-brake-active-high]] -- another "opposite logic level" trap where pin state has non-obvious consequences
- [[hall-sensor-wiring-order-matters-for-bldc]] -- another "wiring determines behavior" trap on the same rover project

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
