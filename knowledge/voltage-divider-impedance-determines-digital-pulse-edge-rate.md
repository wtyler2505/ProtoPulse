---
description: "When using voltage dividers to step down high-frequency digital pulses, low resistor values must be used to minimize RC low-pass filtering effects caused by input capacitance that degrade edge rates."
type: claim
source: "ops/queue/wiring-zs-x11h-to-esp32-with-level-shifter-033.md"
confidence: proven
topics:
  - "[[eda-fundamentals]]"
  - "[[hardware-interfacing]]"
  - "[[signal-integrity]]"
---

# Voltage divider impedance determines digital pulse edge rate

When using a voltage divider to step down a signal (e.g., from 5V to 3.3V), the choice of resistor values depends entirely on whether the signal is analog or high-speed digital.

While analog resistive sensors require matching the divider's fixed resistor to the sensor's midpoint resistance to maximize voltage swing (see [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]]), digital pulse readback requires minimizing the divider's output impedance to preserve edge rates.

**The Thevenin Equivalent and RC Time Constant**

A voltage divider formed by R1 (top) and R2 (bottom) has a Thevenin equivalent output impedance of `Rth = (R1 × R2) / (R1 + R2)`.

This resistance forms an RC low-pass filter with the parasitic capacitance of the circuit, which includes:
- MCU pin input capacitance (typically ~10pF)
- Breadboard/wire parasitic capacitance (typically ~20pF or more)
Total parasitic capacitance (`C_p`) is roughly 30pF.

The time constant (`τ = Rth × C_p`) determines how fast the voltage can change. If `τ` is too large, the sharp edges of a digital pulse (like a PWM or high-frequency tachometer signal) will be rounded off, leading to missed interrupts, jitter, or complete signal loss.

**High Impedance vs. Low Impedance Divider**

*   **High Impedance (10K + 20K):**
    *   `Rth = (10k × 20k) / (10k + 20k) ≈ 6.67 kΩ`
    *   `τ = 6.67 kΩ × 30 pF ≈ 200 ns`
    *   Result: Slower rise/fall times. While this might be fine for very slow signals (like a 10 Hz tachometer), it will severely round off higher frequency pulses (like >100 kHz PWM) and introduce timing jitter.

*   **Low Impedance (1K + 2K):**
    *   `Rth = (1k × 2k) / (1k + 2k) ≈ 667 Ω`
    *   `τ = 667 Ω × 30 pF ≈ 20 ns`
    *   Result: Crisp, clean edges suitable for high-speed digital interrupts.

**Trade-offs**
Using lower resistor values (1K+2K) draws more static current from the signal source. For a 5V signal, a 1K+2K divider draws `5V / 3KΩ ≈ 1.67 mA`. Ensure the signal source can safely source this current without drooping. If the source cannot provide enough current, or if the frequency is extremely high (MHz range), a dedicated active level shifter or buffer IC must be used instead of a passive voltage divider.

---

Relevant Notes:
- [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]] -- The analog counterpart to this claim
- [[bss138-level-shifters-are-too-slow-for-high-speed-digital-signals-due-to-pullup-resistor-rc-time-constant]] -- A related signal integrity issue where pull-up resistors interact with parasitic capacitance

Topics:
- [[eda-fundamentals]]
- [[hardware-interfacing]]
- [[signal-integrity]]