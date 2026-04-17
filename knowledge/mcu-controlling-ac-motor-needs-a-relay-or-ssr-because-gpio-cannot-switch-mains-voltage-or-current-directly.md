---
description: "A microcontroller cannot directly control an AC motor — GPIO pins produce 3.3V/5V DC at milliamps, while AC motors need 120V/240V AC at hundreds of milliamps to tens of amps — so the MCU must drive a mechanical relay or solid-state relay (SSR) whose contacts/triac actually switch the mains"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
---

# MCU controlling AC motor needs a relay or SSR because GPIO cannot switch mains voltage or current directly

When a project needs MCU control of an AC motor (synchronous timer, gearmotor, fan, pump), you cannot wire the MCU output pin to the motor. The mismatch is fundamental:

| Property | MCU GPIO | AC motor |
|----------|----------|----------|
| Voltage | 3.3V or 5V DC | 100-240V AC |
| Current | <=20mA typical | 0.1-20A |
| Isolation | None | Required (safety) |
| Polarity | DC, must match | AC, bidirectional |

**Two interface options:**

**1. Mechanical relay**
- MCU drives a transistor that energizes a relay coil (typically 5V/12V at 50-100mA)
- Relay contacts physically close and carry mains current
- Works with any AC/DC load up to the contact rating
- Pros: cheap, rugged, survives inductive spikes, works with any load waveform, provides isolation via air gap
- Cons: slow (5-20ms switching), audible click, mechanical contact wear limits cycles to ~100k at rated load, contact arcing requires a snubber on inductive loads

**2. Solid-state relay (SSR)**
- MCU drives an opto-isolator LED directly (or through a current-limit resistor)
- Opto triggers a triac (for AC loads) or MOSFET (for DC loads) on the output side
- Output switches the mains load
- Pros: silent, fast (sub-millisecond), no mechanical wear, zero-crossing SSRs reduce inrush spikes
- Cons: more expensive, output leakage current (up to 5mA) can flicker small loads like LED bulbs, fails short-circuit (dangerous), needs heatsinking at high current

**When to choose which:**
- **Mechanical relay** — infrequent switching (once per session or less), load currents > 10A continuous, cost-sensitive, noisy environment that masks clicks, simpler mental model
- **SSR** — frequent switching (PWM-like control of heating elements, dosing pumps), silent required, fast response needed, long cycle life

**Always add:**
- **Back-EMF diode on relay coil** (1N4148 or similar) — protects MCU from coil flyback when the relay de-energizes
- **Snubber across AC load terminals** for inductive AC loads — typically 0.1uF X2 cap + 100 ohm resistor — reduces arcing on relay contact opening and protects SSR triac from dv/dt trigger

**Diagnostic tell:**
"I hear a click but the motor doesn't start" — relay coil energizes but contacts may be pitted/welded. Measure continuity across the contacts with the relay energized; it should be near zero.
"The motor runs but won't stop" — SSR failed short-circuit (common failure mode). Replace with new SSR + add fusing upstream.

---

Source: docs_and_data

Relevant Notes:
- [[ac-synchronous-motor-locks-rotor-speed-to-line-frequency-making-it-the-standard-choice-for-wall-clock-precision-timing-without-feedback]] — a specific AC motor this interface serves
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] — related switching topology issue

Topics:
- [[actuators]]
- [[power-systems]]
