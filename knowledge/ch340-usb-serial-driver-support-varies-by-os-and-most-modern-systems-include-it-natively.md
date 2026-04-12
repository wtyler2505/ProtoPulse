---
description: "Linux 2.6+ ships the ch341 module, macOS Big Sur+ works natively, Windows 10/11 auto-installs via Windows Update -- older OS versions need manual WCH driver install"
type: claim
source: "docs/parts/elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "elegoo-mega-2560-r3"
  - "dccduino-nano"
  - "arduino-nano-v3"
---

# CH340 USB-serial driver support varies by OS and most modern systems include it natively

The CH340 (and its CH340G variant) is the most common USB-to-serial bridge chip on Arduino clones. Made by WCH (Nanjing Qinheng Microelectronics), it replaces the more expensive FTDI FT232RL or ATmega16U2 used on official Arduino boards. Driver support as of 2025:

| Operating System | Driver Status | Notes |
|-----------------|---------------|-------|
| Linux kernel 2.6+ | Built-in `ch341` module | Just works -- board appears as `/dev/ttyUSB0` automatically |
| macOS Big Sur (11.0)+ | Native support | Works without manual install on modern macOS |
| macOS Catalina (10.15) and older | Manual install required | Download from WCH or board manufacturer's site |
| Windows 10/11 | Usually auto-installs via Windows Update | May need manual install if offline or behind corporate firewall |
| Windows 7/8 | Manual install required | Download from WCH |
| ChromeOS | Not supported natively | Requires Linux (Crostini) subsystem with `ch341` module |

The diagnostic sequence when a clone board "isn't recognized":
1. **Board plugged in but no COM port / `/dev/ttyUSB*` appears** -- CH340 driver not installed. Install the driver.
2. **COM port appears but upload fails with "avrdude: stk500_getsync(): not in sync"** -- driver is fine, bootloader mismatch. Switch to "ATmega328P (Old Bootloader)" in IDE processor setting.
3. **COM port appears, upload succeeds but board doesn't run** -- wrong board type selected in IDE.

Steps 1 and 2 are the two most common first-experience failures with clone Arduinos. They are distinct problems with distinct fixes, but beginners often conflate them because both present as "upload failed."

**ProtoPulse implication:** The Arduino IDE integration should detect CH340 via USB VID (0x1A86) / PID (0x7523) and surface this driver compatibility table in the troubleshooting panel. The "board not recognized" diagnostic flow should distinguish between driver absence (no COM port) and bootloader mismatch (COM port exists but sync fails).

---

Relevant Notes:
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] -- the second failure mode (bootloader, not driver)
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] -- NodeMCU uses CP2102/CH340 variants; same driver ecosystem

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
