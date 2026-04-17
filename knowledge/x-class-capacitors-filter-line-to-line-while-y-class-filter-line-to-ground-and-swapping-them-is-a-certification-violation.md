---
description: "X-class and Y-class safety capacitors serve different roles in a mains EMI filter — X-class sits across live-neutral (differential-mode path), Y-class sits from line to earth ground (common-mode path) — and substituting one for the other is a safety-certification failure because failure-mode requirements are different"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
  - "[[power-systems]]"
---

# X-class capacitors filter line-to-line while Y-class filter line-to-ground, and swapping them is a certification violation

A complete AC-mains EMI filter uses two different capacitor classes because two different noise modes need different current paths:

- **X-class (X1, X2) — line-to-line (L to N)** — shunts differential-mode noise (noise that appears between the two conductors)
- **Y-class (Y1, Y2) — line-to-ground (L to PE or N to PE)** — shunts common-mode noise (noise that appears on both conductors with respect to earth)

The classes are NOT interchangeable. A Y-class failure short would energize the chassis/ground; its certification requires failure-open behavior and much stricter leakage current limits. An X-class failure short only trips the line fuse. Using an X cap in a Y position creates a shock hazard on fault; using a Y cap in an X position works electrically but wastes the stricter (more expensive) part.

In real filter topologies X and Y caps appear together — common-mode chokes and Y caps on either side handle common-mode noise; X caps handle differential-mode noise. A filter with only one class is incomplete.

---

Source: docs_and_data

Relevant Notes:
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — companion note on the X-class position specifically
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] — the earth reference that makes Y-class filtering possible

Topics:
- [[passives]]
- [[power-systems]]
