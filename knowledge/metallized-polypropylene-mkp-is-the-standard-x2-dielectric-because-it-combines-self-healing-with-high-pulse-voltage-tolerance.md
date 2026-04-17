---
description: "X2 safety caps use metallized polypropylene (MKP) dielectric rather than polyester (MKT) because polypropylene's higher dielectric strength and better pulse-voltage behavior make the self-healing mechanism more reliable under repeated mains transients"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
---

# Metallized polypropylene (MKP) is the standard X2 dielectric because it combines self-healing with high pulse-voltage tolerance

Within the metallized-film capacitor family, two dielectrics dominate:

- **MKP (Metallized Polypropylene)** — higher dielectric strength, lower dissipation factor, better pulse-voltage tolerance, preferred for safety-critical and high-transient applications
- **MKT (Metallized Polyester / PET)** — cheaper, higher capacitance density, more temperature-stable, preferred for general-purpose bypass and decoupling

X2 safety capacitors are overwhelmingly MKP. The reason is not just self-healing (both have it) — it's that MKP tolerates the repeated pulse voltage stress of mains transients (lightning, switching surges, motor brush noise) without accumulating dielectric damage as quickly as MKT.

For a safety part whose whole value proposition is graceful failure over a long service life, MKP is the material choice that makes the self-healing mechanism reliable in practice.

This refines the generic "metallized film caps self-heal" principle: the self-healing mechanism exists in both polyester and polypropylene variants, but only MKP is considered reliable enough for across-the-line safety certification.

---

Source: docs_and_data

Relevant Notes:
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] — the self-healing mechanism common to both dielectrics
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — the safety role that requires reliable self-healing

Topics:
- [[passives]]
