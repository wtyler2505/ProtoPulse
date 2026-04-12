---
description: "HC-05 compatible Bluetooth 4.0 module — master OR slave mode, AT command configurable, 3.3V logic but 5V VCC safe via onboard regulator"
topics: ["[[communication]]"]
status: verified
quantity: 1
voltage: [3.3, 5]
interfaces: [UART, Bluetooth]
logic_level: "mixed"
logic_notes: "Module power can come from 5V through the onboard regulator, but UART TX/RX are 3.3V logic. Protect RXD from raw 5V TX signals."
manufacturer: "OSEPP"
part_number: "BTH-01"
pinout: |
  VCC  → 5V (onboard 3.3V regulator)
  GND  → GND
  TXD  → MCU RX (3.3V logic out)
  RXD  → MCU TX (3.3V logic in — use voltage divider from 5V boards)
  STATE → HIGH when connected (optional)
  EN/KEY → HIGH to enter AT command mode (optional)
level_shifter_needed: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[osepp-bluetooth-btm-01-hc06-compatible-uart-bt-slave]]"]
used_in: []
warnings: ["RXD is 3.3V — do NOT feed 5V directly from Arduino TX. Use a voltage divider (1K + 2K) or level shifter", "Default baud rate is typically 9600 or 38400 — check with AT commands", "EN/KEY pin must be HIGH before power-on to enter AT command mode"]
datasheet_url: "https://cdn.sparkfun.com/datasheets/Wireless/Bluetooth/HC_Serial_Blue.pdf"
---

# OSEPP Bluetooth BTH-01 — HC-05 Compatible UART BT Module

The BTH-01 is OSEPP's version of the classic HC-05 Bluetooth serial module. The key difference from the HC-06 (BTM-01) is that this one can be both master and slave — it can initiate connections, not just wait for them. This matters if you want two Arduinos talking to each other wirelessly: one needs to be master.

## Specifications

| Spec | Value |
|------|-------|
| Bluetooth Version | 2.0 + EDR (marketed as 4.0 on box) |
| Profiles | SPP (Serial Port Profile) |
| Mode | Master / Slave (configurable via AT commands) |
| Operating Voltage | 3.3V logic, 3.6-6V VCC |
| UART Baud | 9600 default (configurable: 1200-1382400) |
| Range | ~10m (class 2) |
| Default PIN | 1234 |
| Current Draw | ~30-40mA |

## Wiring to Arduino (5V board)

| BTH-01 | Arduino | Notes |
|--------|---------|-------|
| VCC | 5V | Onboard regulator drops to 3.3V |
| GND | GND | |
| TXD | RX (e.g. D19/Serial1 on Mega) | Direct connection OK — 3.3V output is valid HIGH for 5V Arduino |
| RXD | TX via voltage divider | 1K from TX, 2K to GND, junction to RXD |
| STATE | Any digital (optional) | Goes HIGH when paired |
| EN/KEY | Any digital (optional) | Hold HIGH + power cycle = AT mode |

## AT Command Mode

Hold EN/KEY pin HIGH, then power on the module. LED will blink slowly (~2s interval) indicating AT mode. Use Serial Monitor at 38400 baud, NL+CR line ending.

Common AT commands:
- `AT` — test (responds `OK`)
- `AT+NAME=MyDevice` — set device name
- `AT+PSWD=1234` — set pairing PIN
- `AT+UART=9600,0,0` — set baud rate
- `AT+ROLE=1` — set master mode (0=slave)

---

Related Parts:
- [[osepp-bluetooth-btm-01-hc06-compatible-uart-bt-slave]] — slave-only version, simpler but can't initiate connections
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — best match, use Serial1/2/3 to keep Serial0 free for debugging

Categories:
- [[communication]]
