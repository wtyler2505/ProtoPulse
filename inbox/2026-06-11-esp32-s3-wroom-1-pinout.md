# ESP32-S3-WROOM-1 module pinout — verified

Source: web verification session 2026-06-11, for the `core:esp32-s3-wroom-1`
seed part (the last M1 straggler part). Two sources cross-checked and
agreeing on all 41 pins:

1. Espressif ESP32-S3-WROOM-1 & -1U datasheet, pin-definition table
   (https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
2. atomic14/esp32-s3-pinouts community pin table
   (https://github.com/atomic14/esp32-s3-pinouts)

| Pin | Name | Notes |
|---|---|---|
| 1 | GND | |
| 2 | 3V3 | |
| 3 | EN | pull high to run |
| 4–7 | IO4–IO7 | |
| 8–11 | IO15–IO18 | |
| 12 | IO8 | |
| 13 | IO19 | USB D- |
| 14 | IO20 | USB D+ |
| 15 | IO3 | strapping |
| 16 | IO46 | strapping |
| 17–22 | IO9–IO14 | |
| 23 | IO21 | |
| 24 | IO47 | |
| 25 | IO48 | |
| 26 | IO45 | strapping |
| 27 | IO0 | strapping (boot) |
| 28–31 | IO35–IO38 | not available on Octal-PSRAM variants — note for later |
| 32 | MTCK (IO39) | JTAG |
| 33 | MTDO (IO40) | JTAG |
| 34 | MTDI (IO41) | JTAG |
| 35 | MTMS (IO42) | JTAG |
| 36 | RXD0 (IO44) | |
| 37 | TXD0 (IO43) | |
| 38 | IO2 | |
| 39 | IO1 | |
| 40 | GND | |
| 41 | EPAD | thermal pad, tie to GND |

Honest cut recorded in the part: NO footprint yet — the land pattern
(18×25.5mm module, castellated pads) is a later datasheet-exact slice;
the part is schematic-usable and the unplaced tray flags it on the
board side.
