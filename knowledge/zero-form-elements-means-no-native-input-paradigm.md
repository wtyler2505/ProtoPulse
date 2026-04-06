---
description: "Zero HTML form elements across the entire app means no browser validation, no autofill, no assistive tech form mode"
type: need
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[maker-ux]]"]
---

# Zero form elements in the entire application means there is no native input paradigm

The UX evaluation found exactly zero `<form>` elements across the entire ProtoPulse codebase. All input is imperative — state management through React hooks, no native form validation, no browser autofill, no assistive technology form mode. The `@hookform/resolvers` package is installed but unused. The `cmdk` command palette package is also installed but unused.

This is not just an accessibility gap — it is a missing interaction paradigm. The product analysis elevated the command palette (cmdk) to P0 priority specifically because it fills the input mechanism void: with zero forms, the user has no way to perform actions except through the AI chat or clicking individual buttons. For a tool app where users frequently need to set values, configure exports, enter component parameters, and manage settings, the absence of structured input is a usability bottleneck that affects every persona.

---

Relevant Notes:
- [[exports-are-only-accessible-via-ai-chat]] -- another symptom of the same input gap
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- UX quality affects the bundle's appeal

Topics:
- [[maker-ux]]
