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
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] -- keyboard-only navigation is broken (WCAG AA violation)
- [[voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching]] -- voice is the most natural input for beginners who don't know what to type
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- fake pricing destroys trust in the one-tool promise
- [[vite-manual-chunks-defeats-dynamic-import-and-tree-shaking]] -- slow initial load is the first impression for new users
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- canvas stuttering breaks the "seeing" that makers need

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

Agent Notes:
- 2026-04-06: audit notes revealed 5 maker-impacting quality issues: (1) WCAG keyboard focus broken, (2) voice AI is fake, (3) mock pricing erodes trust, (4) slow initial load, (5) canvas stuttering. These undermine "one tool" promise more than missing features do.

Topics:
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
- [[competitive-landscape]] — How Fritzing, Wokwi, KiCad, TinkerCad, and other EDA tools compare to ProtoPulse
- [[breadboard-intelligence]] — Bench coach logic, verified breadboard layouts, layout quality rules, and hardware debugging patterns
- [[goals]] — Current active threads, priorities, and open questions in ProtoPulse development
