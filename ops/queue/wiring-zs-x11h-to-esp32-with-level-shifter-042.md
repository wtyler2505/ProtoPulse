---
type: enrichment
target_note: "[[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add motor PWM as a second use case alongside buzzers with concrete ledcSetup(PWM_CHANNEL, 1000, 8) for 1kHz motor control and the analogWrite portability warning"
source_lines: "126-179, 289"
---

# Enrichment 042: [[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 126-179, 289)

## Reduce Notes

Enrichment for the ESP32 tone()/LEDC note. Existing note frames the LEDC pattern around piezo buzzers. Source extends the pattern to motor PWM, which is a distinct application of the same API:

```cpp
ledcSetup(PWM_CHANNEL, 1000, 8);    // 1kHz, 8-bit resolution for motor control
ledcAttachPin(PIN_SPEED, PWM_CHANNEL);
ledcWrite(PWM_CHANNEL, duty);       // 0-255 duty, use ledcWrite not analogWrite
```

And adds the "analogWrite won't compile on ESP32 (actually does compile via shim on some board packages, but unreliable)" warning to the Common Mistakes framing. Existing note already mentions this but source gives the motor-specific LEDC setup numbers (1kHz is good for motor control, distinct from buzzer audio frequencies).

Rationale: Core claim (LEDC is the replacement, not drop-in) is unchanged. Source extends reach beyond buzzers to motors.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
