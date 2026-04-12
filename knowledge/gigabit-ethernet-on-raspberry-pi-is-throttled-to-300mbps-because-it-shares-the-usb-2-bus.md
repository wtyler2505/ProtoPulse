---
description: "The RPi 3B+ advertises Gigabit Ethernet but the controller runs through the USB 2.0 hub, limiting real throughput to ~300Mbps -- a spec-vs-reality gotcha"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Gigabit Ethernet on Raspberry Pi is throttled to 300Mbps because it shares the USB 2.0 bus

The Raspberry Pi 3B+ has a "Gigabit Ethernet" port -- the LAN7515 Ethernet controller supports 1000BASE-T negotiation and will link at gigabit speeds. However, the Ethernet controller is connected through the USB 2.0 hub chip (which also serves the 4 USB ports). USB 2.0's theoretical maximum is 480Mbps, and after protocol overhead and shared bandwidth with USB peripherals, real-world Ethernet throughput peaks at roughly 300Mbps.

This is a specification-vs-reality gotcha that misleads beginners expecting gigabit performance. The marketing says "Gigabit Ethernet" because the PHY is gigabit-capable, but the bus architecture throttles it to less than a third of that.

Practical impact:
- **NAS / file server use:** 300Mbps is fine for a home NAS serving a few clients, but noticeably slower than true gigabit for large file transfers
- **Network-intensive workloads:** Video streaming, security camera recording, or database replication will hit the ~300Mbps ceiling
- **USB peripheral contention:** Active USB devices (keyboard, mouse, USB storage, USB WiFi dongle) share the same USB 2.0 bus, further reducing available Ethernet bandwidth

The RPi 4 fixed this with a dedicated USB 3.0 bus for Ethernet, achieving true gigabit speeds. The 3B+ cannot be fixed -- it is an architectural limitation of the board design.

This pattern (peripheral sharing a bus bottleneck creating misleading specs) appears elsewhere: the ESP32's ADC2 channels are unusable during WiFi activity because they share hardware, and the ESP8266's single ADC limits analog capability despite having 11 GPIO pins.

---

Relevant Notes:
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] -- resource contention pattern: one subsystem consuming shared resources
- [[an-sbc-runs-linux-and-replaces-a-microcontroller-when-you-need-os-filesystem-networking-or-multitasking]] -- networking as a key SBC selection criterion, but actual bandwidth matters

Topics:
- [[microcontrollers]]
- [[communication]]
