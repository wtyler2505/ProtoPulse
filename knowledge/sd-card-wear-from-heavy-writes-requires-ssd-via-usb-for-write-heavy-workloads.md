---
description: "The RPi boots from microSD with limited write endurance -- heavy logging or databases wear out the card, requiring an SSD via USB for write-heavy applications"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# SD card wear from heavy writes requires SSD via USB for write-heavy workloads

The Raspberry Pi has no onboard storage. It boots and runs entirely from a microSD card. Consumer microSD cards have limited write endurance -- typically 500-3000 P/E (program/erase) cycles for TLC NAND, with wear leveling extending practical life but not eliminating the constraint.

Write-heavy workloads that stress the SD card:
- **Data logging** -- continuous sensor data recording (temperature, telemetry, GPS tracks)
- **Databases** -- SQLite, PostgreSQL, or any database with frequent write transactions
- **Swap file** -- if RAM (1GB on 3B+) is exhausted, swap thrashes the SD card
- **System logging** -- `/var/log/` accumulates writes from syslog, kernel, journald
- **Docker** -- container layer writes and image pulls generate heavy I/O
- **Security camera recording** -- continuous video write is the fastest way to kill an SD card

This failure mode has no MCU parallel. Microcontrollers store firmware in flash that is written once (during upload) and read millions of times. The MCU's flash endurance (10,000-100,000 cycles for AVR, 100,000 for RP2040) is never a practical concern because you don't continuously write to it during operation. The RPi's reliance on SD storage for its runtime filesystem inverts this: every application log entry, every database transaction, every temp file erodes the medium.

**Mitigations:**
1. **SSD via USB** -- boot from SD, mount SSD for `/home`, databases, and logs. USB 2.0 bandwidth (480Mbps shared) is ample for most storage workloads.
2. **Reduce writes** -- mount `/var/log` as tmpfs, disable swap, use `log2ram` to buffer logs in RAM
3. **Industrial SD cards** -- SLC or pSLC cards have 10-100x the write endurance but cost 5-10x more
4. **USB boot** -- RPi 3B+ supports USB mass storage boot (enabled via OTP bit), eliminating the SD card entirely

**ProtoPulse implication:** When a project's architecture includes data logging, database operations, or continuous recording on an RPi, the design validation should flag SD card wear as a reliability concern and suggest the SSD-via-USB or log-to-RAM mitigations.

---

Relevant Notes:
- [[circuitpython-filesystem-can-consume-half-of-pico-2mb-flash]] -- storage constraint on MCU side, but wear is not the issue there
- [[underpowering-a-raspberry-pi-causes-crashes-and-sd-card-corruption]] -- power-related SD corruption is a separate but compounding risk

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
