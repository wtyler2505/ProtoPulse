---
description: "The SC pin outputs one 5V pulse per Hall state change -- 6 per electrical revolution, 90 per mechanical revolution on a 15-pole-pair motor -- enabling interrupt-based RPM calculation with the formula RPM = (pulse_freq / (6 * pole_pairs)) * 60"
type: claim
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
---

# SC speed pulse output enables closed-loop RPM measurement via interrupt counting

The ZS-X11H's SC pin provides a consolidated speed feedback signal derived from the Hall sensors. Instead of requiring the MCU to read three individual Hall sensor lines and decode the commutation sequence, SC outputs a single digital pulse on every Hall state transition. This simplifies closed-loop speed control from a 3-channel state machine problem to a single-channel frequency measurement.

**The math for hoverboard motors (15 pole pairs):**
- 6 Hall state changes per electrical revolution
- 15 electrical revolutions per mechanical revolution
- = 90 pulses per wheel revolution

**RPM calculation from pulse counting:**
```
RPM = (pulseCount_per_second / 90) * 60
```

Or from period measurement between pulses:
```
RPM = 60 / (pulse_period_seconds * 90)
```

**Implementation pattern:** Connect SC to an interrupt-capable pin on the Arduino and count rising edges. Sample the count at a fixed interval (e.g., every 500ms or 1 second), compute frequency, then calculate RPM. The interrupt-based approach is essential because at full speed a 15-pole-pair motor spinning at 200 RPM produces 300 pulses per second (3.3ms period) -- polling would miss pulses.

**3.3V MCU caution:** The SC output is 5V (pulled up to the controller's internal 5V rail from the 78L05 regulator). For 3.3V MCUs like the ESP32, a voltage divider (10K + 20K) or a level shifter is required. Feeding 5V directly into an ESP32 GPIO technically exceeds its absolute maximum rating and may cause damage or unreliable readings.

**Why SC matters for ProtoPulse:** Closed-loop speed control -- where firmware adjusts PWM based on actual vs. desired RPM -- transforms the motor from an open-loop "send PWM and hope" system to a controlled actuator. The bench coach should guide users toward interrupt-based SC measurement whenever a ZS-X11H appears in the schematic, since [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] provides the pole pair count needed for the RPM formula.

**The dual-motor use case that makes SC feedback essential, not optional.** On a single-motor application, open-loop PWM often suffices — if the motor runs a little slow or fast, nothing cares. On a dual-motor tank-steered rover (see [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]]), open-loop control fails at the first asymmetric load: one wheel on carpet and the other on hardwood, or one motor with slightly higher friction, or battery sag hitting one ZS-X11H a few millivolts harder than the other. The motors spin at different RPMs despite identical PWM commands. The robot veers to the slower side. The veer accumulates over distance and the robot cannot drive straight.

SC-based PID speed matching solves this:
```
1. Count left SC pulses and right SC pulses independently
2. Compute left RPM and right RPM from each count
3. Compute error = left_rpm - right_rpm
4. Apply small PWM correction to the slower motor (reduce the inverted value, since EL is active-low)
5. Repeat every 50-100ms
```

The feedback loop closes the gap — slow motor gets a duty-cycle bump, fast motor stays level, measured RPMs converge. Without SC feedback this is impossible; the firmware has no way to know which motor is lagging. With SC on both motors and a modest PID (Kp=1, Ki=0.1, Kd=0 is often enough), the robot drives straight across mixed terrain without manual trim. This is the headline use case for closed-loop speed control on multi-motor rovers, and it justifies the interrupt pin cost per motor that single-motor systems might skip.

---

Source: [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md]]
Enriched from: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] -- the pole pair count this RPM formula depends on
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] -- SC is a consolidated version of the underlying 6-state Gray code
- [[reed-switch-on-rotating-shaft-enables-contactless-rpm-measurement-via-pulse-counting]] -- an alternative RPM measurement technique for motors without Hall feedback
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] -- the control paradigm that makes dual-motor PID speed matching necessary rather than optional

Topics:
- [[actuators]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
