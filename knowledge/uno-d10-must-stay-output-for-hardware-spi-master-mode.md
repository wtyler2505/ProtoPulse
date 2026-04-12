---
description: "Even when D10 is not used as SS, it must be configured as OUTPUT or the ATmega328P drops out of SPI master mode -- a silent failure that breaks all SPI communication"
type: claim
source: "docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Uno D10 must stay OUTPUT for hardware SPI master mode to function

On the ATmega328P (Uno/Nano), pin D10 is the hardware SS (Slave Select) pin for the SPI peripheral. Even when using a different pin as the chip-select for your SPI device, D10 must be configured as OUTPUT. If D10 is set as INPUT and it goes LOW (from noise, a floating wire, or another peripheral), the ATmega328P's SPI hardware automatically switches from master mode to slave mode, halting all SPI communication.

This is a silicon-level behavior documented in the ATmega328P datasheet but rarely mentioned in Arduino SPI tutorials. The failure mode is bewildering: SPI works perfectly until some unrelated event drives D10 LOW, at which point the SPI bus goes dead. `SPI.begin()` sets D10 as OUTPUT automatically, but if user code later reconfigures it (e.g., `pinMode(10, INPUT)` for a button), SPI breaks without warning.

The SPI library's `SPI.begin()` handles this correctly, but code that manually initializes SPI registers (bit-banged or bare-metal SPI) must explicitly `pinMode(10, OUTPUT)` even if D10 is not being used for anything.

On the Mega, the equivalent pin is D53 (hardware SS) -- same rule applies: D53 must stay OUTPUT for hardware SPI master mode, even if you use a different SS pin.

---

Relevant Notes:
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- D53 is the Mega equivalent of D10; same SS/master-mode rule applies
- [[uno-defines-the-standard-arduino-shield-header-layout]] -- shields that use D10 as SS conflict with shields that use D10 for other purposes

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
