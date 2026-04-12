---
description: "The 78xx datasheet specifies 0.33uF on input and 0.1uF on output placed physically close to the regulator pins -- omitting these caps causes oscillation or output instability especially with long input wires"
type: claim
source: "docs/parts/kia7809a-9v-linear-voltage-regulator-1a.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "kia7809a"
---

# 78xx regulators require input and output capacitors close to pins for stability

Every 78xx-series linear regulator datasheet specifies bypass capacitors on both input and output pins: 0.33uF (330nF) ceramic on the input and 0.1uF (100nF) ceramic on the output. These are not optional -- they are stability requirements.

**Why the input capacitor matters:**
- If the regulator is far from its power source (long wires from a battery or upstream converter), the wire inductance can cause the regulator's internal feedback loop to oscillate
- The 0.33uF ceramic cap provides a local charge reservoir that absorbs transient current demand faster than the wire inductance allows
- Without it, the output may exhibit parasitic oscillation at hundreds of kHz -- visible only on an oscilloscope, but potentially damaging to downstream electronics

**Why the output capacitor matters:**
- The 0.1uF output cap improves transient response (sudden load changes)
- It also ensures the regulator's feedback loop remains stable across all load conditions
- Larger output caps (10-100uF electrolytic in parallel with the 0.1uF ceramic) further improve transient response but aren't strictly necessary for stability

**The "close to pins" part is critical:** Capacitors placed inches away from the regulator pins are less effective because the PCB trace or wire inductance between the cap and the pin adds the very problem the cap is solving. "Close" means within 10mm on a PCB, or with leads as short as possible on a breadboard.

**Common beginner mistake:** Adding capacitors on the breadboard power rails but 20 rows away from the regulator. The intervening breadboard trace inductance defeats the purpose. The caps must be in the first few rows adjacent to the regulator pins.

---

Relevant Notes:
- [[linear-regulator-heat-dissipation-equals-voltage-drop-times-current-making-high-differential-applications-dangerous]] -- the regulator these caps stabilize
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- same principle (local bypass capacitance) for a different application (motor drivers vs regulators)

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
