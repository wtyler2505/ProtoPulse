---
description: "The glass envelope of a reed switch contains an inert gas protecting contacts from oxidation — bending leads close to the body (like beginners do with resistors) cracks the seal, exposing contacts to air and causing eventual contact degradation"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[passives]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Glass reed switch envelope is fragile and bending leads near body cracks hermetic seal

Reed switches use a glass envelope hermetically sealed with an inert gas (typically nitrogen or a nitrogen-hydrogen mix). This gas fill prevents oxidation of the contact surfaces, which would increase contact resistance over time. The glass-to-metal seal at the lead exit points is the weakest structural point.

**The handling mistake:**
Beginners used to bending resistor leads close to the body for breadboard insertion will do the same with reed switches. A resistor is a solid ceramic body that tolerates bending forces. A reed switch is a thin-walled glass tube that fractures under stress at the glass-metal interface.

**What happens when the seal breaks:**
1. Inert gas escapes
2. Ambient air (oxygen, moisture) enters the envelope
3. Contact surfaces oxidize over days/weeks
4. Contact resistance increases from <150 milliohms to hundreds of ohms
5. Switch appears to "work" initially but becomes intermittent over time
6. Eventually contacts corrode enough that the switch fails open or has unreliable closure

**This failure is insidious** because:
- The switch works perfectly on day 1 after handling damage
- Degradation is gradual (days to weeks depending on humidity)
- There's no visual indication of a cracked seal (microscopic crack)
- The developer blames code/wiring/MCU long after the real damage occurred during assembly

**Correct handling:**
- Bend leads at least 3mm from the glass body
- Use needle-nose pliers as a heat sink / strain relief between bend point and glass
- Better: use a mounting clip or PCB footprint that holds the switch by its leads without bending
- On breadboard: insert leads straight (they're usually already the right length for 0.4" row spacing)

**For the bench coach:** Flag this as a physical handling warning whenever a reed switch appears in a BOM destined for breadboard prototyping. Include in any "first time using this part" guidance.

---

Relevant Notes:
- [[strong-magnets-permanently-magnetize-reed-switch-contacts-causing-stuck-closed-failure]] -- Another physical damage failure mode for the same component

Topics:
- [[sensors]]
- [[passives]]
