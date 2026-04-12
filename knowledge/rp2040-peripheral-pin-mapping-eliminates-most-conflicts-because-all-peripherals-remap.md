---
description: "I2C, SPI, UART, and PWM can all be remapped to nearly any GPIO pin -- unlike ESP32 (I2C only) or AVR (completely fixed), the Pico rarely has pin conflicts"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# RP2040 peripheral pin mapping eliminates most pin conflicts because I2C SPI and UART remap to nearly any GPIO

The RP2040's peripheral multiplexer allows I2C, SPI, UART, and PWM to be assigned to multiple GPIO options in a regular pattern. Each peripheral has 4-6 possible pin assignments repeating every 4-8 pins:

- **I2C0 SDA**: GP0, GP4, GP8, GP12, GP16, GP20 (any even pin in pattern)
- **I2C0 SCL**: GP1, GP5, GP9, GP13, GP17, GP21 (any odd pin in pattern)
- **UART0 TX**: GP0, GP12, GP16
- **SPI0 SCK**: GP2, GP6, GP18

This flexibility means pin conflicts -- the bane of Arduino projects (I2C stealing analog pins, SPI consuming D10-D13) -- are largely eliminated on the Pico. If UART0 needs GP0, just remap I2C0 from GP0/GP1 to GP4/GP5. PWM is available on every single GPIO (16 channels across 8 slices, each with A and B outputs).

The contrast with other platforms is stark:
- **AVR (Uno/Mega)**: Completely fixed pin assignments. I2C is A4/A5 on Uno, period.
- **ESP32**: I2C is software-remappable to any pin, but SPI and UART have preferred hardware pins with boot restrictions.
- **RP2040**: All peripherals have multiple hardware-supported pin options.

**ProtoPulse implication:** Pin conflict DRC for Pico boards needs a fundamentally different algorithm than for AVR boards. Instead of flagging conflicts as errors, the DRC should suggest alternative pin mappings that resolve conflicts.

---

Relevant Notes:
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] -- ESP32 remaps I2C only; Pico remaps everything
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] -- Uno's fixed I2C pins are the problem Pico's flexibility solves
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- fixed SPI pins cause porting bugs; remappable pins avoid this entirely

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
