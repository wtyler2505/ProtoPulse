---
description: "Arduino libraries that use AVR-specific registers (direct port manipulation, hardware timers, EEPROM.h) fail on ARM boards (SAMD21/51, RP2040) with cryptic errors or silent misbehavior despite sharing the Arduino IDE"
type: claim
source: "docs/parts/adafruit-pygamer-samd51-handheld-gaming-board-with-tft.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# SAMD51 and other ARM Arduino boards break ATmega library compatibility silently because hardware register access differs

The Arduino IDE creates an illusion of portability: install a board package, select the board, and your sketch compiles. But libraries written for AVR (ATmega328P, ATmega2560) often use hardware-specific features that don't exist on ARM MCUs (SAMD21, SAMD51, RP2040, STM32).

**What breaks:**

| AVR-specific feature | What it does on AVR | What happens on ARM |
|---------------------|--------------------|--------------------|
| `PORTB`, `DDRB`, `PINB` | Direct port manipulation for fast I/O | Compile error (registers don't exist) |
| `EEPROM.h` | Read/write onboard EEPROM | Compile error (no EEPROM peripheral on SAMD) |
| `TCCR1A`, `OCR1B` | Hardware timer configuration | Compile error (different timer architecture) |
| `pgm_read_byte()` | Read from program memory (Harvard arch) | Compiles but is a no-op (ARM uses unified memory) |
| `asm("nop")` for delay | Single-cycle delay | Different cycle timing, delays are wrong |
| `attachInterrupt(0, ...)` | Interrupt number 0 = pin 2 on Uno | Wrong pin mapping on ARM boards |

**The silent failures are worse than compile errors:**
- `pgm_read_byte()` compiles fine on ARM but the PROGMEM attribute does nothing -- data lives in RAM anyway, wasting memory
- Timer-based libraries may compile but produce wrong frequencies because ARM timers have different prescaler configurations
- Interrupt number mappings differ silently -- the code runs but the wrong pin triggers the ISR

**How to check before using a library:**
1. Look at the library's `library.properties` for `architectures=*` (claims all) vs `architectures=avr` (honest)
2. Check the library source for `#ifdef __AVR__` guards -- present means the author considered portability
3. Look for `#error` directives in architecture-specific sections
4. Check GitHub issues for "SAMD" or "ARM" reports

**ProtoPulse implications:** The firmware scaffold generator and BOM compatibility checker should cross-reference selected libraries against the target MCU architecture. If a library has no ARM support evidence, warn before generating code.

---

Relevant Notes:
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- even within AVR, pin assumptions break across boards
- [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]] -- the IDE abstracts away architecture differences that matter
- [[native-usb-on-arm-mcus-eliminates-serial-bridge-enabling-direct-hid-and-midi-device-emulation]] -- native USB is one ARM capability that AVR can't match

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
