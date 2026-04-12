---
description: "Official Raspberry Pi 7-inch touchscreen — 800x480, capacitive 10-point touch, DSI ribbon cable connection, powered from Pi GPIO or separate 5V"
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [DSI, I2C]
logic_level: "3.3V"
manufacturer: "Raspberry Pi Foundation"
part_number: "RPI-7TOUCH"
compatible_with: ["[[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]]"]
used_in: []
warnings: ["Requires DSI ribbon cable — only works with Raspberry Pi boards that have a DSI connector", "Draws ~400mA at 5V — can be powered from Pi GPIO 5V pins but adds to total Pi current draw", "Mounting standoffs and adapter board included — check you have the right hardware for your Pi model"]
datasheet_url: ""
---

# Raspberry Pi 7-inch Touchscreen — 800x480 DSI

The official Raspberry Pi display. Connects via the DSI ribbon cable on the back of the Pi — no HDMI, no GPIO pins consumed. Capacitive 10-point touch works out of the box on Raspbian/Raspberry Pi OS with no driver installation needed. The adapter board on the back of the display provides the DSI connection and can be powered either from the Pi's GPIO 5V/GND pins or from a separate micro-USB power supply.

## Specifications

| Spec | Value |
|------|-------|
| Screen Size | 7 inches diagonal |
| Resolution | 800 x 480 pixels |
| Touch | Capacitive, 10-point multitouch |
| Interface | DSI (Display Serial Interface) |
| Viewing Angle | ~70 degrees |
| Power | 5V, ~400mA (via Pi GPIO or separate USB) |
| Dimensions | ~194 x 110 x 20mm |

## Setup

1. Connect DSI ribbon cable from Pi to display adapter board
2. Connect 5V and GND jumper wires from Pi GPIO to adapter board (or use separate micro-USB power)
3. Boot — display and touch work automatically on Raspberry Pi OS

No software configuration needed. Rotation can be set in `/boot/config.txt`:
```
lcd_rotate=2  # 180 degree rotation
```

---

Related Parts:
- [[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]] — the Pi this display connects to via DSI ribbon cable; touch works out of the box on Raspberry Pi OS

Categories:
- [[displays]]
