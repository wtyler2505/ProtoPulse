---
description: "The L293 (without D) has NO internal flyback protection diodes -- substituting it for an L293D leaves motor outputs unprotected against back-EMF spikes, silently risking driver destruction under load"
type: claim
source: "docs/parts/l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# the d suffix on l293d denotes built-in clamp diodes and the non-d variant is a destructive substitution

The L293 and L293D are functionally identical motor driver ICs EXCEPT for one critical difference: the L293D includes internal clamp diodes on all four outputs, while the L293 does not. This single-letter suffix represents the difference between a self-protected circuit and one vulnerable to inductive kickback destruction.

**Why this is a dangerous trap:** Both parts are pin-compatible, same DIP-16 package, same pinout, same voltage/current ratings. They look identical. Online component distributors sometimes show them interchangeably or substitute one for the other. A schematic designed for the L293D that gets populated with an L293 will work perfectly during initial testing with unloaded motors -- and then destroy the driver the first time a motor stalls or reverses under load, because the back-EMF spike has no clamping path.

**The "D" suffix is the standard for hobby projects** precisely because it eliminates the need for external protection diodes. This is why the L293D dominates Arduino tutorials and maker projects -- it is genuinely plug-and-play with inductive loads. The non-D variant exists for professional applications where the designer wants to specify external Schottky diodes with faster recovery times or higher current ratings than the internal silicon diodes provide.

**Part number parsing rule:** When sourcing L293 family parts, the FULL part number matters:
- L293D = clamp diodes included (safe for beginners)
- L293 = NO clamp diodes (requires external protection)
- L293DD = L293D in SOIC-20 package (SMD variant, still has diodes)
- L293B = obsolete variant

Since [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]], the L298N is in the same category as the L293 (no D) -- no internal protection. The L293D is unique in the family for including diodes, which is why it is the recommended choice for breadboard prototyping where adding external components increases wiring complexity and error opportunity.

---

Source: [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]

Relevant Notes:
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] -- the L298N shares the "no internal diodes" characteristic with the L293 (non-D)
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- part number suffix is another dimension beyond architecture and current rating

Topics:
- [[actuators]]
- [[eda-fundamentals]]
