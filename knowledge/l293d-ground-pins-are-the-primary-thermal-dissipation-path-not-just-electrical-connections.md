---
description: "The 4 GND pins (4,5,12,13) on the L293D DIP-16 are bonded to the die lead frame -- they conduct heat out of the package, and leaving any unconnected reduces thermal capacity even on a breadboard"
type: claim
source: "docs/parts/l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# l293d ground pins are the primary thermal dissipation path not just electrical connections

The L293D's DIP-16 package dedicates 4 of its 16 pins (pins 4, 5, 12, 13) to ground -- an unusually high ratio that reveals their dual purpose. These pins are not merely electrical ground connections; they are the IC's primary thermal exit path. The die is bonded to the ground lead frame inside the package, and heat flows out through these pins into whatever copper they contact.

**On a breadboard:** Even in a prototype, connect ALL four GND pins. The breadboard's contact strips provide minimal copper area, but connecting all four pins still meaningfully reduces junction temperature compared to connecting just one or two. Beginners often connect only pin 4 or pin 5 (whichever is convenient for routing) and leave others floating -- this works electrically but reduces thermal headroom.

**On a PCB:** TI's datasheet recommends a minimum of 6 square inches of copper connected to the ground pins for the full 600mA continuous rating. Without adequate copper pour, the current must be derated. This makes the L293D's PCB footprint larger than its DIP-16 package suggests -- the thermal requirement dominates the mechanical requirement.

**Power dissipation context:** At 600mA per channel with a 12V motor supply, the L293D dissipates approximately 600mA x 2.8V (total saturation drop) = 1.68W per channel, 3.36W for both channels simultaneously. The DIP-16 package without thermal management can only handle a few watts before junction temperature becomes unsafe. The ground pins ARE the thermal management for this package.

**ProtoPulse implication:** The bench coach should flag L293D layouts where fewer than 4 GND pins are connected, and PCB DRC should verify adequate ground copper pour around the IC footprint.

---

Source: [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]

Relevant Notes:
- [[l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops]] -- the L298N uses a tab+heatsink; the L293D uses ground pins for the same purpose in a different package
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- bypass caps should be placed near these ground pins for both thermal and electrical reasons

Topics:
- [[actuators]]
- [[eda-fundamentals]]
