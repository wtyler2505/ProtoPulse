---
description: "A 470uF 200V capacitor stores 9.4 joules at full charge -- enough to cause burns or cardiac arrest -- and this energy persists indefinitely after power is removed, requiring active discharge through a resistor and multimeter verification before handling"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: true
---

# High-voltage capacitors store dangerous energy that persists after circuit power-off

The energy stored in a capacitor is:

```
E = 0.5 x C x V^2
```

For a 470uF cap at 200V: `0.5 x 0.00047 x 200^2 = 9.4 joules`

**Stored energy across typical high-voltage electrolytic values** (CDE 381LX series examples):

| Capacitance | Voltage | Stored Energy |
|-------------|---------|---------------|
| 100uF | 450V | 10.1 J |
| 220uF | 350V | 13.5 J |
| 470uF | 200V | 9.4 J |
| 1000uF | 100V | 5.0 J |

The table shows that stored energy does not scale linearly with either capacitance or voltage alone -- because energy scales with V^2, a smaller cap at higher voltage can store more energy than a larger cap at lower voltage (100uF/450V > 1000uF/100V).

**Energy scale for human context:**
- 1 joule across fingers: painful shock
- 5 joules: can cause muscle contraction that prevents letting go
- 10 joules: potential burns or cardiac arrest under wrong conditions (current path through chest)
- 50+ joules: reliably lethal under adverse conditions

**The persistence problem:** Unlike batteries, which have internal resistance that limits discharge current, capacitors can deliver their entire stored energy in microseconds through a low-resistance path (like human skin). The energy does not dissipate on its own in any reasonable timeframe -- a charged capacitor with no load can hold its voltage for hours to days (limited only by leakage current, which is microamps for quality electrolytics).

**Mandatory discharge procedure:**
1. Verify voltage with a multimeter (DC voltage mode across terminals) BEFORE touching anything
2. Discharge through a suitable resistor: 1K-10K ohm, rated for the power dissipation (`P = V^2 / R`; a 200V cap through 1K = 40W initial -- use a 5W+ wirewound and wait)
3. NEVER short the terminals directly -- the instantaneous current can weld contacts, create arc flash, and damage the capacitor
4. After discharge reads 0V, wait 60 seconds and check again (dielectric absorption can recover voltage -- see [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]])

**ProtoPulse implication:** When high-voltage capacitors (>50V rated) appear in a design, the bench coach should include safety warnings and discharge procedures.

---

Relevant Notes:
- [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]] -- Why a single discharge is not sufficient
- [[reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure]] -- Another electrolytic safety hazard

Topics:
- [[passives]]
- [[power-systems]]
