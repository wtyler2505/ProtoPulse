---
summary: 28 plain-language DRC/ERC rule explanations are embedded in drc-engine.ts as a Record<string, string>, making the validation engine double as a learning tool for electronics beginners
type: pattern
areas: ["[[simulation]]", "[[pcb-layout]]", "[[gotchas]]"]
---

# DRC explanations embed pedagogical content directly in the engine, making the validation system a teaching tool

At the bottom of `shared/drc-engine.ts` (lines 1457-1519), a `DRC_EXPLANATIONS` record maps every rule type to a beginner-friendly paragraph explaining:
1. What the rule checks
2. What physically happens if the rule is violated
3. How to fix it

Example for `thermal-relief`:
> "A pad connected to a large copper area (like a ground plane) is missing thermal relief — small spoke-like connections that limit heat flow. Without them, the plane acts as a heat sink and makes the pad nearly impossible to solder by hand."

This is unusual in EDA tooling. Professional DRC engines (KiCad, Altium) provide terse error codes with documentation links. ProtoPulse embeds the full educational context directly in the shared module, meaning:

- **The explanation is available on both server and client** without an API call
- **Every DRC rule type has a corresponding explanation** — 11 component-level rules, 10 PCB-level rules, 7 ERC rules = 28 total
- **The explanations reference physical consequences** ("solder bridges", "drill bit may break", "components would collide on the real board") rather than abstract specification violations
- **The language assumes zero EE knowledge** — terms like "copper pour" and "differential pair" are explained inline

This makes the DRC engine serve double duty: it validates designs AND teaches electronics. The ValidationView and ERCPanel consume these explanations to show expandable help text alongside each violation.

**Design implication:** Any new DRC rule added to `DRCRuleType` or `PcbDrcRuleType` in `component-types.ts` should have a corresponding entry in `DRC_EXPLANATIONS`. The current implementation doesn't enforce this at the type level (it's a `Record<string, string>` not a `Record<DRCRuleType, string>`), so a missing explanation is a silent gap rather than a compile error.

---

Related:
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — pedagogical DRC is how ProtoPulse serves the maker end: beginners learn from violations instead of being confused by them
- [[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — DRC explanations make validation feel accessible the way sim overlays make simulation feel powerful; both close perception gaps
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — progressive disclosure and pedagogical DRC share the same principle: show complexity only when the user is ready
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — both make the system beginner-resilient: DRC teaches through real errors, ErrorBoundary hides spurious ones
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — DRC rules span all three views (component-level, PCB-level, ERC); a missing explanation in one view's rules creates a pedagogical gap
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — DRC explanations live in the shared/ module precisely to avoid cross-tool ownership problems

Areas:
- [[simulation]]
- [[pcb-layout]]
- [[gotchas]]
