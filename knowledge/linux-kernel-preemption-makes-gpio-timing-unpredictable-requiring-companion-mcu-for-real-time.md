---
description: "Linux is not an RTOS -- kernel scheduling preempts user code at microsecond scales, making GPIO timing unreliable for motor PWM, sensor polling, or protocol bit-banging"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Linux kernel preemption makes GPIO timing unpredictable requiring a companion MCU for real-time tasks

Linux is a general-purpose operating system with a preemptive kernel scheduler. When a Python script toggles a GPIO pin, the kernel may interrupt it at any point to service a network packet, flush a disk buffer, or run a background process. The resulting GPIO timing jitter is unpredictable at microsecond scales -- potentially hundreds of microseconds or even milliseconds of delay.

This makes the Raspberry Pi unsuitable as a sole controller for:
- **Motor PWM** -- inconsistent pulse widths cause motor stuttering, audible noise, and position errors in servos
- **WS2812 (NeoPixel) LEDs** -- the protocol requires 800KHz bit-banging with nanosecond precision; Linux jitter corrupts the data stream
- **DHT11/DHT22 sensors** -- single-wire protocol with microsecond-level timing windows that Linux cannot reliably meet
- **Software UART / bit-banged protocols** -- any protocol that requires precise timing at the GPIO level
- **High-frequency sensor polling** -- consistent sample rates above ~1kHz are unreliable

The proven solution is the **companion MCU pattern**: use the RPi for what it is good at (networking, UI, decision-making, data logging) and offload real-time control to a microcontroller:

| RPi Role (brain) | MCU Role (reflexes) | Connection |
|-------------------|---------------------|------------|
| Navigation algorithm | Motor PWM generation | USB or UART |
| Telemetry dashboard | Sensor polling loop | USB or UART |
| Computer vision | Servo control | USB or UART |
| Web API server | LED animation | USB or UART |

The Pi Pico is the natural companion -- same 3.3V logic (no level shifter needed), USB native, and the PIO state machines provide hardware-level protocol implementation. An Arduino works too but requires a level shifter for the 5V-to-3.3V GPIO mismatch.

**ProtoPulse implication:** The architecture block diagram should visually distinguish the SBC "brain" layer from the MCU "reflex" layer and prompt users to add a companion MCU when real-time peripherals (motors, addressable LEDs, bit-banged sensors) appear in a design that only contains an RPi.

---

Relevant Notes:
- [[an-sbc-runs-linux-and-replaces-a-microcontroller-when-you-need-os-filesystem-networking-or-multitasking]] -- the SBC vs MCU selection boundary
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] -- PIO provides the real-time capability that Linux lacks
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] -- even MCUs can have software PWM limitations, but Linux is categorically worse

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
