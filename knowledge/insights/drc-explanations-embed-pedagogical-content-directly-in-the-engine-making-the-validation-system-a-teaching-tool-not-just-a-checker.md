---
summary: 28 plain-language DRC/ERC rule explanations are embedded in drc-engine.ts as a Record<string, string>, making the validation engine double as a learning tool for electronics beginners
type: pattern
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
