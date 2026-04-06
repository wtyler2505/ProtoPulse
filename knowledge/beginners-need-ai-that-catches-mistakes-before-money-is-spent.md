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
- [[ai-is-the-moat-lean-into-it]] -- AI is the differentiator
- [[all-procurement-data-is-ai-fabricated]] -- AI must be trustworthy or it is worse than nothing

Topics:
- [[maker-ux]]
