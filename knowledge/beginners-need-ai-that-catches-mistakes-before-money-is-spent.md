---
description: "The target user is learning electronics while building real hardware -- AI must proactively prevent costly errors"
type: need
source: "docs/MASTER_BACKLOG.md (Epic E, Epic F)"
confidence: likely
topics: ["[[maker-ux]]"]
related_components: ["server/ai.ts", "server/ai-tools/"]
---

# Beginners need AI that catches mistakes before money is spent on wrong PCBs or mismatched components

Epic E states it directly: "This is where 'cool demo' turns into 'real tool I trust before spending money.'" The target user is someone ordering their first PCB from JLCPCB. A DFM violation caught before ordering saves $25 and two weeks. A wrong component footprint caught before soldering saves hours of rework. A pin conflict between schematic and firmware caught before upload saves a board from damage.

The backlog has 125 AI tools specifically because the alternative to AI guidance is domain expertise the target user does not have. BL-0161 (AI safety mode for beginners) adds classification badges and teaching explanations. BL-0164 (AI BOM optimization) suggests alternate components and package consolidation. BL-0165 (AI routing copilot) provides explainable PCB routing guidance. BL-0460 (AI tutor persona with Socratic questioning) asks questions instead of giving answers.

The proactive pattern matters more than the reactive one. BL-0457 (self-healing assistant with approval gates) detects 12 hazard types and proposes fixes. BL-0444 (smart reminders for unfinished critical steps) prevents the user from exporting before validation passes. The AI is not just answering questions -- it is a safety net for a user who does not yet know which questions to ask.

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- AI is the differentiator, and proactive error catching is its highest-value expression for beginners
- [[all-procurement-data-is-ai-fabricated]] -- AI must be trustworthy or it is worse than nothing; fabricated data is the anti-pattern
- [[architecture-first-bridges-intent-to-implementation]] -- beginners describe intent; AI must catch mistakes in the gap between intent and implementation
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- visible feedback catches mistakes faster than error logs
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- the GPIO12 boot trap is exactly the costly mistake proactive AI must catch
- [[esp32-adc2-unavailable-when-wifi-active]] -- ADC2 silent failure with WiFi is the archetype of invisible errors AI must surface
- [[esp32-six-flash-gpios-must-never-be-used]] -- flash GPIOs must be hard-error flagged before a beginner wires to them
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- physical fit constraints beginners cannot see without AI coaching
- [[bldc-stop-active-low-brake-active-high]] -- inverted STOP/BRAKE logic is a costly wiring mistake AI should catch before motor damage
- [[hall-sensor-wiring-order-matters-for-bldc]] -- hall sensor permutation debugging is exactly where AI guidance prevents hours of trial-and-error
- [[protopulse-ai-breadth-is-6x-flux-ai]] -- the 125 AI tools are the mechanism by which proactive error catching is delivered
- [[exports-are-only-accessible-via-ai-chat]] -- export-via-chat-only blocks beginners who need Gerber files but don't know the right AI command

Topics:
- [[maker-ux]]
