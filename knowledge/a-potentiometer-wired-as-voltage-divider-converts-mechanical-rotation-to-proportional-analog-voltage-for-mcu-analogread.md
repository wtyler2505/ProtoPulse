---
description: "Pin 1 to GND, Pin 3 to VCC, Pin 2 (wiper) to analog input -- this three-wire voltage divider converts shaft rotation into a 0-VCC voltage that analogRead() digitizes to 0-1023 on a 10-bit ADC"
type: knowledge-note
source: "docs/parts/potentiometer-10k-rotary-b10k-linear-taper.md"
topics:
  - "[[passives]]"
  - "[[input-devices]]"
  - "[[breadboard-intelligence]]"
confidence: proven
verified: false
---

# A potentiometer wired as voltage divider converts mechanical rotation to proportional analog voltage for MCU analogRead

The potentiometer is the simplest human-to-MCU analog input device. Unlike resistive sensors (which also use voltage dividers), a potentiometer IS the complete voltage divider -- no external fixed resistor needed.

**The circuit:**
```
VCC (5V or 3.3V)
    |
  [Pin 3] ─── Pot body ─── [Pin 1]
                 |                     |
              [Pin 2] (wiper)        GND
                 |
              ADC Pin
```

The wiper divides the total resistance into two parts. As the shaft rotates:
- Full CCW: wiper near Pin 1 (GND) → V_out ≈ 0V → ADC reads ~0
- Midpoint: wiper at center → V_out ≈ VCC/2 → ADC reads ~512
- Full CW: wiper near Pin 3 (VCC) → V_out ≈ VCC → ADC reads ~1023

```cpp
int value = analogRead(A0); // 0-1023 for 10-bit ADC
float voltage = value * (5.0 / 1023.0); // Convert to voltage
float position = value / 1023.0; // 0.0 to 1.0 normalized
```

**Why 10K is the standard value:**
- Low enough to provide a stiff voltage source (10K output impedance is fine for most ADCs)
- High enough to limit current draw: 5V / 10K = 0.5mA (negligible for battery or USB power)
- Matches the recommended source impedance for ATmega328P ADC (<10K)
- If using ESP32 (ADC input impedance ~13M), even 100K pots work fine

**Common applications in the inventory:**
- LCD contrast adjustment (V0 pin on HD44780)
- LED brightness control (input to `analogWrite()` via `map()`)
- Motor speed setting
- Threshold adjustment for sensor-based decisions
- Menu/parameter selection in embedded UI

**Distinction from resistive sensors:** A potentiometer is a variable resistor controlled by the user. A resistive sensor (LDR, thermistor, FSR) is a variable resistor controlled by the environment. Both use the voltage divider pattern, but the pot is self-contained while sensors need an external fixed resistor (see [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]]).

---

Source: [[potentiometer-10k-rotary-b10k-linear-taper]]

Relevant Notes:
- [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]] -- the external-resistor version of the same pattern
- [[hd44780-contrast-potentiometer-has-a-narrow-sweet-spot-and-wrong-adjustment-produces-blank-or-solid-rectangle-symptoms]] -- a specific potentiometer application
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC limitation that affects pot readings

Topics:
- [[passives]]
- [[input-devices]]
- [[breadboard-intelligence]]
