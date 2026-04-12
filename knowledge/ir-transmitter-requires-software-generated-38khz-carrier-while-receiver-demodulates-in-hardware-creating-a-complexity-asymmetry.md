---
description: "IR transmitting requires software-generated 38kHz PWM carrier on a timer-capable pin, while receiving is handled entirely by the TSOP IC on any digital pin — this asymmetry constrains pin selection and adds code complexity on the transmit side"
type: claim
source: "docs/parts/osepp-ir-transmitter-irf01-38khz-led-module.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-irf-01"
  - "ky-022-ir-receiver"
  - "arduino-mega-2560"
---

# IR transmitter requires software-generated 38kHz carrier while receiver demodulates in hardware creating a complexity asymmetry

Receiving IR is simple: the TSOP IC handles 38kHz demodulation internally and outputs clean digital pulses on any GPIO pin. Transmitting IR is harder: the microcontroller must generate the 38kHz carrier frequency itself using a hardware timer, which constrains the transmitter to specific PWM-capable pins (e.g., D3 on Arduino Uno/Mega using Timer 2).

**Practical consequences:**

1. **Pin selection is non-trivial:** The IRremote library uses specific hardware timers to generate the carrier. On ATmega328P (Uno/Nano), `IrSender` defaults to Timer 2 / pin D3. On ATmega2560 (Mega), it's also pin D3 by default but can be reconfigured. The timer used for IR sending may conflict with other PWM-dependent features (servo control, tone generation).

2. **Timer conflicts:** If the project uses Servo.h (Timer 1) AND IRremote sending (Timer 2), that's fine. But if a third feature needs a timer, conflicts arise. The Mega's 6 timers provide more headroom than the Uno's 3.

3. **Beginners expect symmetry:** "If receiving works on any pin, why doesn't transmitting?" The answer is that receiving leverages the TSOP's dedicated demodulator hardware, while transmitting must create the carrier from scratch using MCU resources.

**ProtoPulse implications:**
- DRC should flag timer conflicts when IR transmitting is combined with servo control or tone generation on timer-limited boards
- Pin assignment suggestions should restrict IR transmitter output to PWM-capable pins with available timers
- The bench coach should explain the asymmetry when a project uses both transmit and receive

---

Relevant Notes:
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — receiver-side gotcha (complementary)
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] — PWM as a control paradigm with pin/timer constraints

Topics:
- [[communication]]
- [[breadboard-intelligence]]
