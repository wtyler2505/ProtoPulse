---
description: "W5100-based Ethernet shield — adds wired 10/100 Mbps networking to Arduino via SPI, includes micro-SD card slot, standard Arduino shield form factor"
topics: ["[[communication]]", "[[shields]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [SPI, Ethernet]
logic_level: "5V"
manufacturer: "Velleman"
part_number: "PKA042"
chip: "WIZnet W5100"
pinout: |
  Uses SPI via ICSP header (compatible with Uno and Mega)
  D10 → Ethernet SS (chip select)
  D4  → SD card SS (if using SD slot)
  D11/MOSI → SPI data (via ICSP on Mega)
  D12/MISO → SPI data (via ICSP on Mega)
  D13/SCK  → SPI clock (via ICSP on Mega)
  D2  → Optional interrupt (W5100 INT)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["Uses D10 (Ethernet CS) and D4 (SD CS) — cannot use these pins for other purposes when shield is mounted", "W5100 supports max 4 simultaneous socket connections", "Uses SPI via ICSP header, so it works on both Uno and Mega without rewiring", "Draws significant current (~150mA) — don't power from USB alone if also driving other loads"]
datasheet_url: ""
---

# Velleman PKA042 Ethernet Shield — W5100 for Arduino

Adds wired Ethernet to any Arduino with an ICSP header. The W5100 chip handles the TCP/IP stack in hardware, so your sketch just calls `Ethernet.begin()` and starts making HTTP requests or running a web server. Includes a micro-SD card slot for serving files or logging data.

## Specifications

| Spec | Value |
|------|-------|
| Ethernet IC | WIZnet W5100 |
| Speed | 10/100 Mbps |
| Interface | SPI (via ICSP header) |
| Sockets | 4 simultaneous TCP/UDP |
| Connector | RJ-45 with integrated magnetics |
| SD Card | Micro-SD slot (SPI, CS on D4) |
| Form Factor | Arduino Uno/Mega shield |
| Current Draw | ~150mA |

## Pin Usage

| Pin | Function | Notes |
|-----|----------|-------|
| D10 | Ethernet CS | Reserved — even if not using Ethernet, keep as OUTPUT |
| D4 | SD card CS | Only used if accessing SD card |
| ICSP | SPI bus | MOSI, MISO, SCK via 6-pin ICSP header |
| D2 | INT (optional) | W5100 interrupt, rarely used |

**Library:** `Ethernet` (built into Arduino IDE)

```cpp
#include <Ethernet.h>
byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};
Ethernet.begin(mac); // DHCP
```

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — shield uses ICSP for SPI, works without rewiring
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — standard shield form factor, plugs directly in
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same ICSP/SPI compatibility
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — Uno clone, shield fits directly
- [[rc522-mfrc522-rfid-reader-13mhz-spi-3v3]] — also uses SPI, watch for CS pin conflicts

Categories:
- [[communication]]
- [[shields]]
