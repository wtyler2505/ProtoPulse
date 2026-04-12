---
description: "Kit IR remotes ship with a CR2025 coin cell that may be dead on arrival or have a pull-tab still inserted — beginners blame code/wiring when the battery is the real issue"
type: claim
source: "docs/parts/ir-remote-control-handheld-38khz-nec-protocol.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "ir-remote-control"
  - "cr2025-coin-cell"
---

# Dead coin cell is the invisible first failure mode on kit IR remotes because beginners don't know the battery exists

Kit IR remotes (the small plastic TV-style remotes in Arduino starter kits) are powered by a CR2025 3V coin cell hidden inside the back panel. Three failure modes exist before any code runs:

1. **Dead on arrival:** Cheap kit remotes may ship with nearly-depleted cells from sitting on shelves for months
2. **Pull-tab still inserted:** Some remotes ship with a plastic insulator tab between the battery and contacts -- the user must pull it out before first use
3. **Battery inserted wrong:** The coin cell only works in one orientation, and there's often no clear polarity marking inside the battery compartment

**The debugging spiral:** The beginner assumes the remote "just works" because it came in the kit. When pressing buttons produces no response from the receiver, they check their wiring (fine), their code (fine), their library version (fine), then assume the receiver module is broken. They never think to check the battery because they don't know there IS a battery -- or they assume it's a standard "included battery" that's guaranteed fresh.

**ProtoPulse implications:**
- The bench coach's first diagnostic question when IR isn't working should be: "Is the remote's battery alive? Point it at your phone camera -- you should see the IR LED flash purple on the camera screen when you press a button."
- The phone-camera trick is the universal quick test for any IR transmitter (phone cameras can see near-IR that human eyes cannot)
- Design validation for IR projects should include a "transmitter verification" step before debugging receiver code

---

Relevant Notes:
- [[kit-ir-receiver-modules-from-different-manufacturers-are-functionally-identical-tsop-38khz-demodulators]] — the receiver side of the same system
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — dead battery = wasted debugging hours

Topics:
- [[communication]]
- [[breadboard-intelligence]]
