---
description: "NXP MFRC522-based RFID reader/writer for 13.56MHz MIFARE cards and tags — SPI interface, 3.3V only, the standard Arduino RFID module"
topics: ["[[communication]]"]
status: verified
quantity: 1
voltage: [3.3]
interfaces: [SPI]
logic_level: "3.3V"
logic_notes: "RC522 modules are 3.3V parts. Power and SPI lines should be treated as 3.3V-only unless you add proper level shifting."
manufacturer: "Generic (NXP MFRC522)"
part_number: "MFRC522"
pinout: |
  SDA/SS  → SPI chip select (any digital pin)
  SCK     → SPI clock
  MOSI    → SPI MOSI
  MISO    → SPI MISO
  IRQ     → Interrupt (optional, usually unused)
  GND     → GND
  RST     → Reset (any digital pin)
  3.3V    → 3.3V ONLY
level_shifter_needed: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["3.3V ONLY — do NOT power from 5V, it will damage the module", "SPI data pins are also 3.3V — on 5V Arduinos, the module usually survives because the onboard regulator provides some tolerance, but it's technically out of spec. For reliability, use a level shifter", "Reads MIFARE Classic 1K/4K and MIFARE Ultralight — does NOT read all NFC tag types"]
datasheet_url: "https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf"
---

# RC522 MFRC522 RFID Reader — 13.56MHz SPI 3.3V

The go-to RFID module for Arduino projects. Reads and writes MIFARE Classic and Ultralight cards/tags at 13.56MHz (ISO 14443A). Comes with a white card and a blue keyfob in most kits. The MFRC522 library makes it trivial to read UIDs for access control, attendance systems, or inventory tracking.

## Specifications

| Spec | Value |
|------|-------|
| IC | NXP MFRC522 |
| Frequency | 13.56 MHz |
| Supported Cards | MIFARE Classic 1K/4K, Ultralight |
| Protocol | ISO 14443A |
| Interface | SPI (up to 10 Mbps) |
| Operating Voltage | 2.5 - 3.3V |
| Current Draw | 13-26mA |
| Read Range | ~5cm (depends on antenna and tag size) |
| Data Transfer | 106 kbps |

## Wiring to Arduino Uno

| RC522 | Arduino Uno | Arduino Mega |
|-------|-------------|-------------|
| SDA/SS | D10 | D53 |
| SCK | D13 | D52 |
| MOSI | D11 | D51 |
| MISO | D12 | D50 |
| IRQ | Not connected | Not connected |
| GND | GND | GND |
| RST | D9 | D9 |
| 3.3V | 3.3V | 3.3V |

**Library:** `MFRC522` by miguelbalboa (Arduino Library Manager)

```cpp
#include <SPI.h>
#include <MFRC522.h>
MFRC522 rfid(10, 9); // SS, RST
```

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — SPI on D50-D53 for Mega
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — SPI on D10-D13

Categories:
- [[communication]]
