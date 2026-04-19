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
- [[skeleton-loading-without-status-text-reads-as-broken-during-multi-second-waits]] -- blank skeletons past 2s read as failure; status text preserves the user's mental model
- [[visible-enabled-action-buttons-without-prerequisites-teach-users-to-distrust-the-ui]] -- enabled-but-failing buttons are interface betrayal; disabled+tooltip teaches the prerequisite
- [[trust-receipts-should-pair-with-a-guided-setup-path-or-they-surface-problems-without-fixing-them]] -- transparency without agency strands beginners at the diagnosis
- [[empty-state-panes-should-offer-a-one-click-on-ramp-not-just-describe-emptiness]] -- empty states are invitations, not announcements
- [[usb-device-unplugged-mid-upload-is-the-failure-mode-that-defines-whether-arduino-tooling-feels-robust-or-fragile]] -- hardware-layer disturbances are core workflow, not edge cases
- [[compile-output-panels-need-virtualization-at-the-line-count-real-sketches-produce-not-at-demo-sketch-scale]] -- benchmark at real-sketch scale, not Blink scale
- [[library-manager-offline-behavior-should-show-the-local-cache-not-an-error-because-makers-often-work-without-internet]] -- offline-first is a maker concept, not a mobile concept

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
- Enabled action buttons with unmet prerequisites (disable + tooltip the prerequisite instead of letting the user click and fail)
- Blank skeleton states on multi-second loads (show status text like "Connecting to Arduino CLI…")
- Empty-state panes that only describe emptiness (offer a one-click on-ramp like "Open Blink example")
- Transparency without agency — diagnostic panels that list unchecked preconditions without offering a guided path to resolve them

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
- 2026-04-18: Arduino tab E2E walkthrough validated the trust-receipt pattern (excellent transparency) but exposed 4 concrete UX gaps: 4s blank skeleton, enabled Verify/Upload with no board profile, trust receipt with no setup-wizard follow-through, and "No File Selected" empty state with no one-click entry. Pattern across all four: the UI describes problems without offering resolution paths. The Arduino surface is a worked example of transparency-without-agency as the dominant failure mode.
- 2026-04-18 (edge cases): Walkthrough also surfaced 3 resilience gaps worth engineering-in-advance: USB-unplug-mid-upload (the canonical Arduino stress test — recovery state matters as much as the error), compile-output scaling (virtualize at real-sketch size, not Blink size), and Library Manager offline behavior (show cached index + installed libraries instead of erroring). All three are "benches are not clean rooms" problems — makers hit them routinely and switch IDEs when they're unhandled.
- 2026-04-18 (reflect pass): The 7 Arduino-tab notes form a tight cluster around a single meta-claim — **transparency-without-agency is the dominant UX failure mode** — where each note instantiates it at a different layer: skeleton (loading layer), enabled-buttons (action layer), trust-receipt (diagnosis layer), empty-state (first-run layer), usb-unplug (hardware-event layer), compile-output (scale layer), library-manager (network layer). This suggests a future synthesis note naming that pattern explicitly. Also cross-linked compile-output ↔ reactflow-stringify — same virtualization-by-default pattern applied to log lines vs canvas nodes.

Topics:
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
- [[competitive-landscape]] — How Fritzing, Wokwi, KiCad, TinkerCad, and other EDA tools compare to ProtoPulse
- [[breadboard-intelligence]] — Bench coach logic, verified breadboard layouts, layout quality rules, and hardware debugging patterns
- [[goals]] — Current active threads, priorities, and open questions in ProtoPulse development
