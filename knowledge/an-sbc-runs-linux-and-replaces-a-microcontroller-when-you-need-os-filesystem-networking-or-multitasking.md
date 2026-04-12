---
description: "Use an SBC (Raspberry Pi) when you need networking, a filesystem, multitasking, a display, or software too complex for an MCU; use an MCU when you need real-time guarantees or bare-metal simplicity"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# An SBC runs Linux and replaces a microcontroller when you need an OS, filesystem, networking, or multitasking

The Raspberry Pi 3B+ is not a microcontroller -- it is a single-board computer running a full Linux operating system (Raspberry Pi OS, Debian-based). Quad-core ARM Cortex-A53 at 1.4GHz, 1GB RAM, WiFi, Bluetooth, Ethernet, HDMI, USB, and a 40-pin GPIO header. It runs Python, Node.js, Docker, SSH, and anything else you would run on a Linux box.

The selection boundary between SBC and MCU:

**Choose an SBC when you need:**
- Networking (WiFi, Ethernet, Bluetooth -- built-in, no external modules)
- A filesystem (logging, databases, configuration files, media)
- Multitasking (concurrent processes, background services, scheduled tasks)
- A display output (HDMI, DSI touchscreen, web dashboard)
- Complex software (machine learning inference, computer vision, web servers)
- High-level languages with full standard libraries (Python, Node.js, Go, Rust)

**Choose an MCU when you need:**
- Real-time guarantees (precise microsecond GPIO timing, PWM, interrupt response)
- Bare-metal simplicity (no OS boot time, no filesystem corruption risk)
- Ultra-low power consumption (deep sleep in microamps, coin cell operation)
- Minimal cost per unit ($2-10 vs $35+)
- Instant startup (no boot sequence, runs immediately at power-on)

**The companion pattern:** For projects that need both (robotics, complex IoT), use an SBC for the brain (networking, UI, decision-making) and an MCU for the reflexes (motor PWM, sensor polling, real-time control). Connect them via USB or UART. The OmniTrek rover exemplifies this: RPi for navigation/telemetry, Arduino/Pico for motor control.

**ProtoPulse implication:** The architecture block diagram and board selection wizard should present SBC vs MCU as a fundamental first-order decision, not just list all boards alphabetically. A "What kind of brain does your project need?" flow would route beginners to the right board category before they pick a specific model.

---

Relevant Notes:
- [[linux-kernel-preemption-makes-gpio-timing-unpredictable-requiring-companion-mcu-for-real-time]] -- why SBCs need MCU companions for real-time tasks
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] -- MCU simplicity contrast: Pico just works, no OS boot

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
