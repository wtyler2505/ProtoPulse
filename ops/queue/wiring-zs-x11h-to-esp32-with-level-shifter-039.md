---
type: enrichment
target_note: "[[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add the ESP32 LEDC-based inversion pattern ledcWrite(channel, 255 - speed) as the platform-correct translation of the Arduino analogWrite inversion, since ESP32 has no analogWrite"
source_lines: "167-179"
---

# Enrichment 039: [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 167-179)

## Reduce Notes

Enrichment for the EL active-low note. Existing note shows the Arduino inversion pattern (`analogWrite(EL_PIN, 255 - desiredSpeed)`) but does NOT cover the ESP32 equivalent. ESP32 uses LEDC not analogWrite, so the pattern becomes:

```cpp
ledcSetup(PWM_CHANNEL, 1000, 8);
ledcAttachPin(PIN_SPEED, PWM_CHANNEL);
// setSpeed wrapper:
ledcWrite(PWM_CHANNEL, 255 - speed);  // invert for active LOW
```

Plus the safe initialization: `ledcWrite(PWM_CHANNEL, 255)` at boot (full LEDC HIGH = motor stopped) before enabling STOP.

Rationale: The core claim about EL polarity inversion is unchanged. Source adds the ESP32 API translation of the same inversion pattern.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
