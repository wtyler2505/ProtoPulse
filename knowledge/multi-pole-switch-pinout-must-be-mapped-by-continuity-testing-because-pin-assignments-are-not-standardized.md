---
description: "Multi-pole switches with dense pin arrays (18 pins on the Toneluck 6-way) have no standardized pinout across manufacturers — each unit must be mapped with a multimeter in continuity mode before wiring, or incorrect assumptions will short poles together"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"
---

# Multi-pole switch pinout must be mapped by continuity testing because pin assignments are not standardized

The Toneluck 6-way switch has 18 pins (3 per pole: COM, NO, NC). Unlike ICs with published datasheets and universal pinouts, mechanical switch assemblies have:

- No standardized pin numbering across manufacturers
- No markings on the component body indicating function
- Variable physical pin arrangement (linear, staggered, or grid)
- No datasheet URL available for generic units

**Verification procedure (before any wiring):**
1. Set multimeter to continuity/beep mode
2. With no button pressed: probe all pin pairs to find NC (normally-closed) connections
3. Press button 1: probe all pin pairs to find NO (normally-open) connections that close
4. Identify COM (the pin that connects to either NO or NC depending on button state)
5. Repeat for all 6 poles
6. Document the map before committing to a circuit

**What goes wrong without mapping:**
- Connecting two poles' COM pins together (thinking they're the same signal)
- Shorting power rails through unintended NO connections
- Reading the wrong pole and getting "stuck" or "ghost" mode detection

This is the same class of problem as:
- 8x8 LED matrix pin mapping (non-sequential row/column assignments)
- Multi-pin connector identification on salvaged components
- Relay module pinout verification (COM/NO/NC varies by manufacturer)

The 10 minutes spent with a multimeter prevents hours of debugging mysterious behavior.

---

Topics:
- [[input-devices]]

Related:
- [[self-locking-radio-button-switch-provides-hardware-mutual-exclusion-eliminating-software-mode-conflict-logic]]
- [[systematic-part-identification-workflow-for-unidentified-inventory-read-markings-then-cross-reference-then-measure]]
