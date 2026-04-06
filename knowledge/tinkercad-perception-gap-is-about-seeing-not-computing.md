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
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- visual feedback is part of the bundle's appeal to makers
- [[architecture-first-bridges-intent-to-implementation]] -- beginners think in visuals, not equations
- [[competitive-audits-generated-more-work-than-internal-analysis]] -- this was the most impactful finding from the Wave 66 audit
- [[ai-is-the-moat-lean-into-it]] -- AI can bridge the gap by explaining visual results, not just computing them
- [[wokwi-chips-use-counterclockwise-pin-ordering]] -- both Wokwi and TinkerCAD use visual-first simulation that ProtoPulse must match in component rendering
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- visual rendering of the ESP32's tight breadboard fit is where the perception gap matters most
- [[esp32-six-flash-gpios-must-never-be-used]] -- visual red/unusable pin flagging is the bench coach's answer to the perception gap
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- the 160mil gap is invisible in pinout lists but immediately obvious in visual breadboard rendering

Topics:
- [[competitive-landscape]]
- [[maker-ux]]
