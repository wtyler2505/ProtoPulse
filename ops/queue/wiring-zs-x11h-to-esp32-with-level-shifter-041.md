---
type: enrichment
target_note: "[[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add ESP32 IRAM_ATTR ISR pattern with attachInterrupt on GPIO4, and the voltage-divider front-end that is mandatory because ESP32 GPIOs are not 5V tolerant"
source_lines: "138-149, 85-106"
---

# Enrichment 041: [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 138-149, 85-106)

## Reduce Notes

Enrichment for the SC speed pulse note. Existing note covers the Arduino ISR pattern (from the Mega wiring doc). Source adds the ESP32 equivalent which has two platform differences:

1. **IRAM_ATTR attribute is mandatory** — ESP32 ISRs must live in IRAM or they fault when flash cache is not resident:
```cpp
volatile unsigned long pulseCount = 0;
void IRAM_ATTR countPulse() { pulseCount++; }
attachInterrupt(digitalPinToInterrupt(PIN_FB), countPulse, RISING);
```

2. **Voltage divider is mandatory on the signal path** — SC is 5V push-pull and ESP32 GPIOs are 3.3V-maximum. A 10K/20K divider scales 5V to 3.33V. Use 1K+2K for fast pulses to minimize edge rounding (see claim 033).

Rationale: Core claim about interrupt-driven RPM measurement is unchanged. Source adds the ESP32 platform translation with its two gotchas (IRAM_ATTR and voltage divider).

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
