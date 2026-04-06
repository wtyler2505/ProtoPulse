---
description: "TinkerCAD's simulation feels 10x more powerful than ProtoPulse's because users SEE results on circuit components"
type: insight
source: "docs/MASTER_BACKLOG.md (Wave 66 Competitive Audit)"
confidence: proven
topics: ["[[competitive-landscape]]", "[[maker-ux]]"]
related_components: []
---

# TinkerCAD's simulation perception gap is about seeing results on components, not computing better results

The Wave 66 competitive audit produced a critical insight: TinkerCAD's simulation is technically weaker than ProtoPulse's (no AC analysis, no Monte Carlo, no real SPICE) but it "FEELS 10x more powerful because you SEE results on the circuit." This is a perception gap, not a capability gap.

The backlog identified six specific features that close the gap (BL-0619 through BL-0626, all now DONE): LED brightness proportional to current, motor animation at simulated RPM, 7-segment displays showing lit segments, a unified "Start Simulation" play button with auto-detection, interactive components during simulation (toggle switches, drag potentiometers), and virtual instruments (oscilloscope, multimeter, function generator) that live on the canvas.

The strategic lesson is that maker tools are judged by visible feedback, not computational depth. A beginner who sees an LED light up understands the circuit. A beginner who reads "V_LED = 1.82V, I = 14.3mA" does not. ProtoPulse had the harder engine and the weaker experience. Waves 69-87 systematically closed this gap by making simulation results visual, tactile, and on-canvas.

---

Relevant Notes:
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- visual feedback is part of the bundle
- [[architecture-first-bridges-intent-to-implementation]] -- beginners think in visuals

Topics:
- [[competitive-landscape]]
- [[maker-ux]]
