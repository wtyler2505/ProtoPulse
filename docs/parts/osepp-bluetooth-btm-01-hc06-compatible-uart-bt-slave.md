---
description: "HC-06 compatible Bluetooth serial slave — simpler than HC-05, pairs automatically with any master device, 3.3V logic with 5V VCC via regulator"
topics: ["[[communication]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [UART, Bluetooth]
logic_level: "mixed"
logic_notes: "Module power can come from 5V through the onboard regulator, but UART TX/RX are 3.3V logic. Protect RXD from raw 5V TX signals."
manufacturer: "OSEPP"
part_number: "OSEPP-BTM-01"
pinout: |
  VCC  → 5V (onboard 3.3V regulator)
  GND  → GND
  TXD  → MCU RX (3.3V logic out)
  RXD  → MCU TX (3.3V logic in — use voltage divider from 5V boards)
level_shifter_needed: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module]]"]
used_in: []
warnings: ["RXD is 3.3V — use voltage divider from 5V TX lines", "Slave only — cannot initiate connections, only accept them", "AT commands only work when NOT paired (LED blinking fast)"]
datasheet_url: ""
---

# OSEPP Bluetooth BTM-01 — HC-06 Compatible UART BT Slave

The BTM-01 is the slave-only version of a Bluetooth serial module. Simpler than the HC-05/BTH-01 because there's no master/slave configuration — it just waits for a phone or computer to connect. Once paired, it's a transparent UART bridge: bytes in on RXD come out the Bluetooth link, and vice versa.

Use this when you want to send data from an Arduino to a phone app (like Bluetooth Terminal or a custom app). If you need two Arduinos to talk to each other, you need at least one HC-05 (BTH-01) as master.

## Specifications

| Spec | Value |
|------|-------|
| Bluetooth Version | 2.0 + EDR |
| Profiles | SPP (Serial Port Profile) |
| Mode | Slave only |
| Operating Voltage | 3.3V logic, 3.6-6V VCC |
| UART Baud | 9600 default |
| Range | ~10m (class 2) |
| Default PIN | 1234 |
| Current Draw | ~25mA |

## Wiring to Arduino (5V board)

| BTM-01 | Arduino | Notes |
|--------|---------|-------|
| VCC | 5V | Onboard regulator |
| GND | GND | |
| TXD | RX (e.g. D19/Serial1 on Mega) | 3.3V is valid HIGH for 5V inputs |
| RXD | TX via voltage divider | 1K + 2K divider to drop 5V to ~3.3V |

## AT Commands

AT commands work only when the module is NOT connected (LED blinking rapidly). No special mode entry needed — just send commands over UART at 9600 baud, no line ending.

- `AT` → `OK`
- `AT+NAMEMyDevice` → sets name (no `=` sign, unlike HC-05)
- `AT+PIN1234` → sets PIN
- `AT+BAUD4` → sets 9600 (1=1200, 2=2400, 3=4800, 4=9600, 5=19200, 6=38400, 7=57600, 8=115200)

---

Related Parts:
- [[osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module]] — master/slave version, more capable but more complex
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — use hardware UART to avoid SoftwareSerial issues

Categories:
- [[communication]]
