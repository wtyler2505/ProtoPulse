---
description: "ESP32 has no tone() function -- ledcWriteTone() requires explicit channel setup, pin attachment, and channel-based addressing that breaks Arduino sketch portability"
type: claim
source: "docs/parts/passive-piezo-buzzer-3-5v-pwm-driven-tone-generator.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[actuators]]"
related_components:
  - "passive-piezo-buzzer"
  - "nodemcu-esp32s"
---

# ESP32 replaces tone() with ledcWriteTone() and the API is not a drop-in substitution

Arduino's `tone(pin, frequency)` does not exist on ESP32. The replacement is `ledcWriteTone(channel, frequency)`, which requires a three-step setup that has no equivalent in the AVR API:

```cpp
// ESP32 requires explicit channel management
ledcSetup(channel, frequency, resolution);  // configure LEDC channel
ledcAttachPin(pin, channel);                // bind channel to GPIO
ledcWriteTone(channel, frequency);          // generate tone
```

**What breaks when porting:**

1. **Channel abstraction:** `tone()` takes a pin number. `ledcWriteTone()` takes a channel number (0-15). The programmer must manage channel allocation, which doesn't exist on AVR. Two buzzers on different pins need different channels.

2. **Setup ceremony:** `tone()` is a single call that configures everything internally. ESP32 requires `ledcSetup()` + `ledcAttachPin()` before any tone output. Forgetting either step produces silence with no error.

3. **Silence API differs:** `noTone(pin)` becomes `ledcWriteTone(channel, 0)`. The semantic shift from pin-based to channel-based addressing means search-and-replace won't work.

4. **Resolution parameter:** `ledcSetup()` requires a bit resolution (typically 8) that affects available frequencies. This concept doesn't exist in the AVR tone API.

**Why this matters beyond buzzers:** The `ledcWriteTone()` / `ledcWrite()` pattern applies to ALL ESP32 PWM -- servos, LED dimming, motor control. Any AVR sketch using `analogWrite()` hits the same portability wall. The buzzer case is just the most visible because `tone()` is a named function that produces an immediate "function not found" compile error, while `analogWrite()` is actually shimmed on some ESP32 board packages, masking the LEDC requirement.

**ProtoPulse implications:** The firmware scaffold generator should detect the target MCU and emit the correct tone API. When generating code for ESP32 + passive buzzer, emit LEDC boilerplate, not `tone()`. The bench coach should warn users porting Uno sketches to ESP32 that all `tone()` / `noTone()` calls need rewriting.

---

Relevant Notes:
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] -- ESP8266 has its own PWM limitations distinct from ESP32's LEDC approach
- [[samd51-and-other-arm-arduino-boards-break-atmega-library-compatibility-silently]] -- same class of cross-platform API breakage
- [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]] -- the AVR-side timer conflict that ESP32's LEDC avoids

Topics:
- [[microcontrollers]]
- [[actuators]]
