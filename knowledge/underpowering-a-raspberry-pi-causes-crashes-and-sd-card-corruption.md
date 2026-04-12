---
description: "The Pi 3B+ requires 5V/2.5A via micro-USB; powering from a computer USB port (500mA) causes voltage drops, random crashes, and potential SD card filesystem corruption"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Underpowering a Raspberry Pi causes crashes and SD card corruption

The Raspberry Pi 3B+ requires a 5V / 2.5A power supply via micro-USB. The power budget is real: WiFi active draws ~200mA, CPU under load draws ~700mA, USB peripherals draw up to 1.2A total. Peak current easily exceeds 2A during boot or under combined CPU + WiFi + USB load.

Powering from a computer USB 2.0 port (500mA max) or a cheap phone charger (often 500mA-1A despite label claims) triggers cascading failures:

1. **Voltage sag** -- load current exceeds supply capacity, voltage drops below 4.63V
2. **Lightning bolt icon** -- the kernel's undervoltage detector shows a warning icon on the HDMI display (only visible if a monitor is connected)
3. **Random crashes** -- the SoC brown-outs during current spikes (WiFi transmission, SD card write bursts), causing kernel panics or silent reboots
4. **SD card corruption** -- the most dangerous consequence. A brown-out during a filesystem write can leave the ext4 filesystem in an inconsistent state. This can corrupt the OS installation, requiring a complete reflash

This failure mode has no parallel in the MCU world. An Arduino running at 5V draws 20-50mA; an ESP32 peaks at ~500mA. Both tolerate sloppy power supplies within their voltage range because their current draw is modest. The RPi's ~2A peak current makes power supply quality a critical design parameter.

**Signs of undervoltage:**
- Lightning bolt icon on HDMI display
- `dmesg | grep -i voltage` shows undervoltage warnings in the kernel log
- Random reboots, especially during WiFi activity
- USB peripherals disconnecting and reconnecting
- SD card "read-only filesystem" errors after a crash

**The fix is simple:** Use the official Raspberry Pi power supply (5.1V / 2.5A) or any supply rated for 5V / 3A with a quality micro-USB cable (cable resistance matters -- thin cables cause additional voltage drop).

**ProtoPulse implication:** The power budget calculator should treat RPi differently from MCUs. When an RPi is in the design, the power section should explicitly validate supply current capacity against the 2.5A minimum, flag USB-powered configurations as insufficient, and warn about SD card corruption risk.

---

Relevant Notes:
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- MCU power gotcha, but thermal not brown-out
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- ESP32 also has a power ceiling, but lower and without filesystem risk

Topics:
- [[microcontrollers]]
- [[power]]
