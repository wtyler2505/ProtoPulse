---
description: "The cheap HW-130 motor shield is a direct pin-for-pin clone of the Adafruit Motor Shield V1 -- the original AFMotor library works unmodified, making a $5 shield software-compatible with a discontinued $20 reference design"
type: claim
source: "docs/parts/dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[actuators]]"
related_components:
  - "dk-electronics-hw-130-motor-shield"
---

# hw-130 motor shield is an adafruit motor shield v1 clone that uses the afmotor library unchanged

The DK Electronics HW-130 is not an original design -- it is a direct clone of the Adafruit Motor Shield V1, which Adafruit discontinued in favor of the V2 (I2C-based) years ago. The clone preserves the V1's pinout, the dual L293D topology, the 74HC595 direction-control shift register, and the PWM pin assignments exactly. Because of this fidelity, the original Adafruit `AFMotor.h` library works on the HW-130 without modification.

**Why this matters practically:** A beginner buying the cheapest motor shield available (HW-130 is often under $5) gets access to mature library support, documented tutorials, and a decade of accumulated community code samples written for the Adafruit original. They do not need to find clone-specific library forks or manually bit-bang the shift register. `#include <AFMotor.h>` then `AF_DCMotor motor(1)` just works.

**The catch -- V1 vs V2 library divergence:** The Adafruit Motor Shield V2 uses an I2C-based design with PCA9685 PWM driver and TB6612 drivers, NOT L293D + 74HC595. The V2 library (`Adafruit_MotorShield.h`) is NOT pin-compatible with the HW-130. Beginners who pick up a V2 tutorial will hit non-obvious compile or runtime failures because they installed the wrong library. The correct library for HW-130 is the legacy V1 `AFMotor`, not the current Adafruit Motor Shield library.

**The clone-library compatibility principle:** Since [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]], this is another instance of the general pattern -- clones that preserve the original's interface contract inherit the original's entire software ecosystem. The HW-130 inherits a decade of AFMotor V1 knowledge by being pin-for-pin faithful, even though the underlying company has moved on.

**ProtoPulse implication:** The component registry should flag the HW-130 with a library pointer to `AFMotor` (V1) and an explicit warning that the newer `Adafruit_MotorShield` (V2) library will NOT work. The bench coach should prefer AFMotor code examples when a user selects the HW-130.

---

Source: [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]

Relevant Notes:
- [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]] -- same pattern of clone inheriting reference design's software support
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] -- when clone compatibility breaks, failure modes are silent
- [[74hc595-latch-separates-data-shifting-from-output-update-preventing-glitches-during-serial-load]] -- the shield's direction-control mechanism depends on this 74HC595 behavior

Topics:
- [[shields]]
- [[actuators]]
