---
description: "Using a neodymium magnet to test a reed switch can permanently magnetize the ferromagnetic reeds, causing the switch to latch closed even without an external field — a silent, permanent hardware failure with no software recovery"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[passives]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Strong magnets permanently magnetize reed switch contacts causing stuck-closed failure

Reed switch contacts are made from ferromagnetic material (nickel-iron alloy) — this is what makes them respond to magnetic fields. But this same property means they can be permanently magnetized by exposure to a strong field:

**The failure mode:**
1. Developer tests reed switch with a strong neodymium magnet (common in maker kits)
2. The magnet's field strength exceeds the coercivity of the reed material
3. The reeds become permanently magnetized — they now attract each other without external field
4. Switch stays closed permanently, regardless of magnet proximity
5. No software diagnostic can detect this — `digitalRead()` just returns LOW forever
6. Developer thinks code is broken, replaces MCU, changes wiring — nothing helps because the switch itself is physically damaged

**Prevention:**
- Test with weak magnets first (ceramic/ferrite magnets, ~3mm distance)
- Never leave strong neodymium magnets in direct contact with the glass envelope
- Use the intended actuator magnet at the intended distance, not a random rare-earth magnet from a drawer

**Diagnosis:**
- Remove all magnets from vicinity
- Check switch with multimeter in continuity mode
- If it shows closed with no magnet nearby → contacts are magnetized → switch is destroyed
- Note: partially magnetized contacts show reduced sensitivity (switch triggers at larger distance than spec)

**Recovery:**
- None practical. A degaussing coil can theoretically demagnetize the reeds, but the glass envelope prevents physical access and the process risks cracking the seal.
- Replace the switch (~$1-2 for standard types)

**For the bench coach:** When a user reports "my reed switch is always triggered" or "reed switch works but won't turn off," the first diagnostic question should be "Did you test it with a strong magnet?" before investigating wiring or code.

---

Relevant Notes:
- [[glass-reed-switch-envelope-is-fragile-and-bending-leads-near-body-cracks-hermetic-seal]] -- Another physical handling failure mode for the same component

Topics:
- [[sensors]]
- [[passives]]
