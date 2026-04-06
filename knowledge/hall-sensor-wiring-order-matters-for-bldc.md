---
description: "Swapping hall sensor signals causes erratic commutation — the motor stutters, vibrates, or spins backward"
type: claim
source: "shared/verified-boards/riorand-kjl01.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/riorand-kjl01.ts"]
---

# Hall sensor wiring order matters — wrong order causes erratic motor behavior

A 3-phase BLDC motor with hall feedback has three hall sensor signals (Ha, Hb, Hc) spaced 120 electrical degrees apart inside the motor housing. The controller reads these signals to determine rotor position and commutate the three phase outputs (U, V, W) in the correct sequence. If the hall sensors are wired to the controller in the wrong order, the controller energizes the wrong phase at the wrong time, causing the motor to stutter, vibrate violently, run rough, or spin in the wrong direction.

There are six possible permutations of three hall wires. Only one is correct for forward rotation, and one more gives clean reverse rotation (the mirror sequence). The other four produce various degrees of malfunction. The diagnostic rule from the RioRand KJL-01 documentation and BLDC community knowledge is: if the motor vibrates instead of spinning, swap any two phase wires (U/V/W) first. If it runs but sounds rough or jerky, swap Ha and Hc while keeping Hb in place. This trial-and-error approach converges in at most 2-3 swaps.

The color coding convention (Ha = yellow, Hb = green, Hc = blue, +5V = red, GND = black) is common but not universal — especially on salvaged hoverboard motors, which is exactly what the OmniTrek Nexus rover project uses. The bench coach should warn users to verify hall sensor ordering empirically rather than trusting wire colors from unknown motors.

---

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] -- control signal conventions for the same controller
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- another "wiring determines boot behavior" trap
- [[architecture-first-bridges-intent-to-implementation]] -- the bench coach must warn about hall sensor ordering when a "BLDC motor" block appears
- [[mega-2560-four-hardware-uarts]] -- the Mega's Serial3 is often used to monitor hall sensor state during debugging

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
