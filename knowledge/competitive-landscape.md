---
description: How Fritzing, Wokwi, KiCad, TinkerCad, and other EDA tools compare to ProtoPulse
type: moc
topics:
  - "[[index]]"
  - "[[maker-ux]]"
  - "[[goals]]"
---

# competitive-landscape

Analysis of competing EDA tools — their strengths, gaps, and what ProtoPulse can learn from or surpass.

## Tool Profiles

### TinkerCad Circuits
**Strengths:** Truly beginner-accessible, browser-based, real-time simulation, great for Arduino learning.
**Gaps:** Limited component library, no PCB export, no BOM management, no custom components.
**Lesson:** The simulation-first, learn-by-doing model is what makes it sticky. ProtoPulse must match this.

### Fritzing
**Strengths:** Breadboard-first view is intuitive for makers. Multi-view (breadboard/schematic/PCB). Component library.
**Gaps:** Abandoned/unmaintained. No simulation. Routing is weak. Export quality is poor.
**Lesson:** Breadboard view is not optional for the maker market. The multi-view approach is right.

### Wokwi
**Strengths:** Browser-based, simulation-first, huge component library, excellent for ESP32/Arduino. Fast.
**Gaps:** No PCB output. No BOM. No schematic editor worth using. No AI integration.
**Lesson:** Simulation quality and component fidelity are table stakes. ProtoPulse needs to match Wokwi's sim depth.

### KiCad
**Strengths:** Professional-grade. Full PCB workflow. Large community. Free and open-source.
**Gaps:** Steep learning curve. Not accessible to beginners. No AI. No simulation (relies on ngspice plugin).
**Lesson:** The target user will graduate to KiCad. ProtoPulse should export KiCad-compatible files and ease migration.

### Altium / OrCAD
**Strengths:** Industry standard. Best-in-class routing. Full signal integrity toolchain.
**Gaps:** Expensive. Enterprise-only. No beginner on-ramp.
**Lesson:** These are the aspirational ceiling, not the current competition.

### EveryCircuit
**Strengths:** Animated, real-time circuit simulation with beautiful visuals. Great for intuition building.
**Gaps:** No PCB. No BOM. Mobile-first (limited desktop).
**Lesson:** Animated simulation (showing current flow, charge) builds intuition faster than numbers alone.

### Falstad Circuit Simulator
**Strengths:** Immediate, browser-based, great for AC/transient visualization. Free.
**Gaps:** No PCB, no BOM, no project management. Very bare-bones UI.
**Lesson:** The Falstad-style oscilloscope view is worth building into ProtoPulse's simulation panel.

## Knowledge Notes
- [[no-other-eda-tool-starts-from-architecture-diagrams]] -- uncontested niche
- [[protopulse-ai-breadth-is-6x-flux-ai]] -- quantifiable AI moat
- [[flux-ai-is-the-primary-competitive-threat]] -- complete EDA tool vs AI-first tool
- [[self-hosted-and-free-is-a-pricing-moat]] -- zero cost vs $20-$158/month
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- the three-part value prop
- [[ai-is-the-moat-lean-into-it]] -- strategic direction from all 5 phases
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- biggest competitive gap
- [[eda-market-is-16b-growing-9-percent-toward-35b-by-2035]] -- market context
- [[dual-ai-providers-prevent-single-vendor-lock-in]] -- Claude + Gemini failover
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- desktop enables hardware access competitors have
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- visual feedback beats computation depth
- [[competitive-audits-generated-more-work-than-internal-analysis]] -- 80+ items from Wave 64/66
- [[greatness-manifest-pushed-beyond-parity-into-innovation]] -- features no competitor has
- [[makers-need-one-tool-because-context-switching-kills-momentum]] -- core competitive insight

## ProtoPulse's Differentiators
1. **AI with 125 tools** that directly manipulate project state — no other tool does this
2. **Full workflow** from schematic → BOM → PCB → Gerber without leaving the tool
3. **Maker-first UX** — progressive disclosure, contextual AI guidance, learning mode
4. **Native desktop** — full hardware access (USB/serial), local filesystem, native toolchains
5. **Circuit Design as Code** — DSL for programmatic circuit generation (Wave 50)

---

Topics:
- [[index]]
- [[maker-ux]]
- [[goals]]
