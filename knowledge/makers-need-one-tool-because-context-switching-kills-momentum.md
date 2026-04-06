---
description: "ProtoPulse exists because no EDA tool covers schematic-to-Gerber-to-firmware for a maker who is still learning"
type: need
source: "docs/MASTER_BACKLOG.md (Epic C, origin story)"
confidence: proven
topics: ["[[maker-ux]]", "[[competitive-landscape]]"]
related_components: []
---

# Makers need one tool because context-switching between EDA apps kills momentum for learners

The origin story in the AGENTS.md file is specific: the OmniTrek Nexus rover project (Arduino Mega, NodeMCU ESP32, RioRand motor controllers, salvaged hoverboard wheels) required TinkerCAD for simulation, Fritzing for breadboard layout, KiCad for PCB design, Arduino IDE for firmware, and a spreadsheet for BOM management. Each tool switch required re-entering component data, re-learning a UI, and losing context about what was just accomplished.

The backlog quantifies this pain. Epic C lists 20+ integration items just to make ProtoPulse's own internal views share data correctly. BL-0498 (schematic -> BOM auto-populate) was P1 because without it, placing a component on the schematic and then manually adding it to the BOM is the same workflow fragmentation that using separate tools causes. BL-0558 (schematic -> PCB forward annotation) was P1 for the same reason.

The need is not "a better EDA tool." It is "a tool where I never have to leave." The competitive audit (Wave 66) validated this: every competitor excels at one domain (TinkerCAD at simulation, KiCad at PCB, Arduino IDE at firmware) but forces users to leave for the others. ProtoPulse's 26 ViewModes exist because the goal is to internalize every workflow, even if each individual view is less polished than the specialist tool.

---

Relevant Notes:
- [[cross-tool-coherence-is-harder-than-building-features]] -- the architectural cost of "never leave the tool"
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- the bundle that makes staying in one tool worthwhile
- [[competitive-audits-generated-more-work-than-internal-analysis]] -- audits validated that every competitor forces users to leave for other domains
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- native desktop closes the firmware gap that forced leaving for Arduino IDE
- [[bldc-stop-active-low-brake-active-high]] -- motor control wiring on the rover is the use case that proved one tool is needed
- [[hall-sensor-wiring-order-matters-for-bldc]] -- debugging hall sensors required oscilloscope + serial monitor + datasheet across multiple tools
- [[mega-2560-four-hardware-uarts]] -- the Mega's multi-serial rover config required juggling Arduino IDE, serial monitors, and datasheets simultaneously
- [[architecture-first-bridges-intent-to-implementation]] -- architecture diagrams are the entry point that lets beginners stay in one tool from intent to implementation
- [[no-other-eda-tool-starts-from-architecture-diagrams]] -- architecture diagrams are the entry point that lets beginners stay in one tool from idea to Gerber
- [[self-hosted-and-free-is-a-pricing-moat]] -- zero cost removes the last barrier to makers adopting one tool over free-but-fragmented alternatives

Topics:
- [[maker-ux]]
- [[competitive-landscape]]
