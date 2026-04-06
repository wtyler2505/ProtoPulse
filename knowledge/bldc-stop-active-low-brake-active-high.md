---
description: "STOP and BRAKE use opposite logic levels — mixing them up leaves the motor running or permanently braked"
type: claim
source: "shared/verified-boards/riorand-kjl01.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/riorand-kjl01.ts"]
---

# BLDC motor controller STOP is active-low and BRAKE is active-high

The RioRand KJL-01 BLDC controller uses opposite logic polarities for its two motor-halting functions: STOP is active-low (connect to GND to stop, leave floating or HIGH to run) and BRAKE is active-high (connect to 5V to engage dynamic braking, leave floating for no brake). This inverted-pair convention is standard across most Chinese BLDC controllers in this class, but it is a persistent source of wiring mistakes because the two signals look functionally similar ("both stop the motor") yet require opposite electrical treatment.

STOP is a soft disable — it de-energizes the motor phases and lets the motor coast to a halt. BRAKE is a dynamic brake — it shorts the motor phases together, converting kinetic energy into heat and stopping the motor quickly. Using BRAKE as your primary stop mechanism generates significant heat in the motor windings and FETs, so it should be a momentary operation for deceleration rather than a sustained hold.

From a microcontroller wiring perspective: an Arduino digital pin defaults to INPUT (high-impedance, effectively floating) at startup, which means STOP defaults to "motor runs" and BRAKE defaults to "no brake" — both safe power-on states. But if you configure both pins as OUTPUT and set them both LOW by mistake, STOP engages (motor off) but BRAKE does not (no braking) — the motor coasts. Setting both HIGH gives you the opposite: STOP disengages (motor can run) while BRAKE engages (motor locked). The safe emergency-stop pattern is: set STOP LOW, wait for deceleration, then set BRAKE HIGH briefly.

---

Relevant Notes:
- [[hall-sensor-wiring-order-matters-for-bldc]] -- another BLDC wiring trap on the same controller
- [[mega-2560-four-hardware-uarts]] -- the Mega can drive this controller via a dedicated UART
- [[architecture-first-bridges-intent-to-implementation]] -- "motor controller" as an architecture block hides this polarity complexity that AI must surface
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- another "opposite logic level" trap where pin state has non-obvious consequences

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
