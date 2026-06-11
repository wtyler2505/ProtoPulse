---
description: "3.3V output is above the 2.0V minimum HIGH for 5V TTL but below the ~3.5V minimum HIGH for 5V CMOS, making direct 3.3V-to-5V connections a per-unit gamble depending on the receiver's specific logic family implementation"
type: claim
source: "docs/parts/wiring-zs-x11h-to-esp32-with-level-shifter.md"
confidence: proven
topics:
  - "[[eda-fundamentals]]"
  - "[[microcontrollers]]"
  - "[[communication]]"
related_components:
  - "zs-x11h"
  - "esp32"
---

# 3.3V output sits in the TTL-to-CMOS threshold boundary making direct connection to 5V logic inputs a per-unit gamble rather than a reliable connection

When driving a 5V logic input with a 3.3V output (like an ESP32 or Raspberry Pi Pico), the success of the connection depends entirely on the receiver's logic family threshold, not the driver. 

- **5V TTL Thresholds:** The minimum voltage recognized as logic HIGH is 2.0V. A 3.3V signal clears this easily.
- **5V CMOS Thresholds:** The minimum voltage recognized as logic HIGH is typically 0.7 * VCC. At 5V VCC, this is 3.5V. A 3.3V signal is below this threshold and will not reliably trigger a HIGH state.

Because many modern 5V boards (like the ZS-X11H motor controller) use components that may sit right on this threshold, a direct 3.3V connection becomes a per-unit gamble. It might work flawlessly on one batch of silicon where the threshold happens to be slightly lower (e.g., 3.2V) and fail completely on another unit from the same manufacturer where the threshold is strictly 3.5V. This leads to the classic "it worked on my bench" trap, where a prototype appears functional but fails in production or when a component is replaced.

This failure mode is distinct from connecting a 5V output to a 3.3V input, which is destructive (as seen with [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]]). Here, the 3.3V signal won't damage the 5V receiver; it simply won't register reliably. 

By contrast, some specific components like the L298N intentionally use TTL thresholds even with a 5V supply ([[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]]), which makes them safely controllable by 3.3V MCUs. However, without consulting the datasheet for the specific logic family on the receiving end, a level shifter (like a 74AHCT buffer or TXS0108E) is mandatory for reliable operation.

---

Relevant Notes:
- [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]] -- Inverse case: 5V into 3.3V is destructive.
- [[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]] -- Exception case: L298N inputs are guaranteed TTL compatible, so 3.3V works.

Topics:
- [[eda-fundamentals]]
- [[microcontrollers]]
- [[communication]]
