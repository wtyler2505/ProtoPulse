---
description: What makes EDA features accessible to beginners — UX patterns, progressive disclosure, and maker-first design principles
type: moc
topics:
  - "[[index]]"
  - "[[competitive-landscape]]"
  - "[[breadboard-intelligence]]"
  - "[[goals]]"
---

# maker-ux

Knowledge about UX patterns, interaction design, and accessibility principles that make ProtoPulse useful for makers, hobbyists, and learners — not just engineers.

## Knowledge Notes
- [[self-hosted-and-free-is-a-pricing-moat]] -- zero cost is decisive for makers
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- the unique three-part value prop
- [[architecture-first-bridges-intent-to-implementation]] -- beginners describe intent, not topology
- [[all-procurement-data-is-ai-fabricated]] -- simulated data more dangerous than missing data
- [[exports-are-only-accessible-via-ai-chat]] -- features invisible without AI command knowledge
- [[zero-form-elements-means-no-native-input-paradigm]] -- missing input mechanism
- [[makers-need-one-tool-because-context-switching-kills-momentum]] -- core user need
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- proactive AI as safety net
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- visual feedback over numbers
- [[cross-tool-coherence-is-harder-than-building-features]] -- fulfilling the one-tool promise
- [[project-provider-monolith-is-the-biggest-remaining-frontend-debt]] -- UX performance impact

## Core Principle
**If a feature requires the user to already understand electronics to use it, it's not done yet.** Add AI guidance, tooltips, contextual explanations, or a learning mode.

## Progressive Disclosure Patterns

### DRC Results
- Don't show all 40 violations at once. Show the highest-severity, most actionable ones first.
- Group by type (clearance, ERC, DFM) with expandable sections.
- Each violation should have: plain-language description, suggested fix, "why does this matter?" tooltip.

### Simulation Output
- Show the waveform FIRST, the numbers second.
- Animated current flow (EveryCircuit-style) builds intuition faster than a table of voltages.
- "What does this mean?" AI button on every simulation result.

### BOM Management
- JLCPCB-ready export is the primary action (that's what makers care about).
- Stock alerts before they become a blocker, not after.
- Alternates view: "out of stock? here are 3 equivalents."

## Key UX Wins Already Implemented
- ChatPanel: streaming AI with 125 tools, action parsing, model selection
- Engineering calculators (Wave 27): 6 modules covering common maker calculations
- Camera component ID (Wave 31): point camera at a mystery component, get an ID
- Pinout hover (Wave 31): hover over a pin, see the pinout diagram
- Tutorial system (Wave 35): 5 built-in tutorials with step navigation
- Knowledge hub (Wave 33): 20 searchable electronics articles
- Keyboard shortcuts (Wave 30): 19 defaults with custom overrides
- i18n framework (Wave 34): internationalization for global maker community

## Anti-Patterns (what breaks maker UX)
- Jargon without explanation ("ERC violation" → "connection error: pin without net")
- Modal dialogs for common actions (use inline, contextual controls instead)
- Required fields with no guidance (label + example value + tooltip)
- Error messages that describe the symptom, not the cause or fix
- Features that only work if you already know the tool exists

## Target User Model
Tyler building his OmniTrek Nexus rover (Arduino Mega, ESP32, motor controllers, hoverboard wheels):
- Learning electronics while building real hardware
- Needs to go from schematic → BOM → PCB without external tools
- Benefits from AI that proactively catches mistakes
- Wants to understand WHY something is wrong, not just THAT it's wrong

## Inspiration Sources
- TinkerCad Circuits: simulation-first, learn-by-doing
- EveryCircuit: animated simulation for intuition
- Fritzing: breadboard-first view
- Wokwi: component fidelity + fast iteration
- VS Code: command palette, keyboard shortcuts, extension model

---

Topics:
- [[index]]
- [[competitive-landscape]]
- [[breadboard-intelligence]]
- [[goals]]
