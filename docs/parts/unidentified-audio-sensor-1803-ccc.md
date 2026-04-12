---
description: "Possibly an electret microphone or PDM mic breakout board marked '1803-CCC' — needs testing to confirm audio sensing capability and interface type"
topics: ["[[unidentified-parts]]"]
status: unidentified
quantity: 1
voltage: []
interfaces: []
logic_level: ""
manufacturer: "Unknown"
part_number: "1803-CCC"
markings: "1803-CCC"
form_factor: "Small PCB module"
physical_notes: "Suspected audio sensor/microphone board. '1803' could be a date code (March 2018). Look for small round electret mic element or tiny MEMS mic on the board."
compatible_with: []
used_in: []
warnings: ["Unidentified — confirm pin functions before connecting to microcontroller"]
datasheet_url: ""
---

# Unidentified Audio Sensor 1803-CCC

A small module suspected to be an audio sensor — possibly an electret microphone breakout or PDM (Pulse Density Modulation) microphone board. The marking "1803-CCC" may be a date code (March 2018) and batch identifier.

## Common Audio Sensor Module Types

| Type | Output | Pins | Typical IC |
|------|--------|------|-----------|
| Electret mic breakout (analog) | Analog voltage (0-3.3V or 0-5V) | 3 (VCC, GND, OUT) | LM393 comparator + op-amp |
| Electret mic with digital trigger | Digital HIGH when sound exceeds threshold | 3-4 (VCC, GND, AO, DO) | LM393 + trim pot |
| PDM MEMS mic | Digital PDM bitstream | 3 (VCC, GND, DATA) | SPH0645, INMP441 |
| I2S MEMS mic | I2S digital audio | 5-6 (VCC, GND, BCLK, LRCLK, DATA) | INMP441, SPH0645 |

## Identification Steps

1. Count pins and check for labels (VCC, GND, AO, DO, OUT, CLK, DATA, etc.)
2. Look for the microphone element — a round metal can (electret) or tiny hole in the PCB (MEMS)
3. Check for a trim potentiometer — indicates analog mic with adjustable sensitivity
4. Look for ICs — LM393 = analog comparator mic, other ICs = possibly digital
5. If 3-pin (VCC, GND, OUT): apply 3.3-5V, measure output with multimeter while making sounds

---

Categories:
- [[unidentified-parts]]
