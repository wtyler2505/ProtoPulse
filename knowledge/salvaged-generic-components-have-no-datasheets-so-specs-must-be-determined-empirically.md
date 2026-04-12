---
description: "Hoverboard salvage, generic Chinese modules, and kit parts typically have no datasheets -- specs are estimated from teardowns and bench testing, making empirical verification the default engineering practice"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
---

# salvaged generic components have no datasheets so specs must be determined empirically

The hoverboard hub motors in the inventory have no datasheet. Not a missing datasheet -- there was never one to begin with. The manufacturer produces motors in bulk for hoverboard assembly lines, not for retail sale with documentation. Every specification listed (power rating, pole pair count, KV, continuous current) is estimated from community teardowns, forum posts, and bench testing.

This is not an exception. It is the default condition for an entire class of components that makers routinely use:

| Component Class | Why No Datasheet | What You Do Instead |
|----------------|------------------|---------------------|
| Hoverboard motor salvage | OEM parts not sold retail | Bench test, count pole pairs, measure resistance |
| Generic Chinese breakout modules | Cloned designs with no documentation chain | Read silkscreen, identify IC, find IC datasheet |
| Kit components (Elegoo, OSEPP) | Bundled by kit maker, not by component manufacturer | Identify the underlying component, find its datasheet |
| Salvaged PCB components | Desoldered from unknown boards | Read part markings, cross-reference databases |

The practical impact is that spec sheets in the inventory carry a confidence qualifier. Some values are "measured" (empirically determined), some are "estimated" (derived from similar motors), and some are "advertised" (from a seller's listing, unverified). This distinction matters for design decisions -- you can trust a measured stall current, but an advertised power rating from a Chinese seller might be inflated by 50%.

**For ProtoPulse:** The parts database should support a "confidence" field for each specification value. When a user adds a component with low-confidence specs, the bench coach should recommend bench testing procedures (like the pole pair counting technique) before committing to a design. The AI should never present estimated specs as if they were datasheet-verified values.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[hoverboard-motor-power-ratings-are-unreliable-because-manufacturers-inflate-specs-for-marketing]] -- spec inflation is a specific manifestation of the no-datasheet problem
- [[all-procurement-data-is-ai-fabricated]] -- the AI model generates specs for components that have no verified data, compounding the problem
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] -- a specific empirical technique for characterizing undocumented BLDC motors
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- beginners trust specs at face value; AI must surface the confidence gap

Topics:
- [[actuators]]
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
