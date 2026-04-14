---
description: "Class X2 safety capacitors are rated for across-the-line (L-N) connection on AC mains because their failure modes (open circuit, or short that trips upstream protection) cannot expose a user to dangerous voltage — this is what makes them safe in positions where a plain film cap would be a shock hazard"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
  - "[[power-systems]]"
---

# Class X2 capacitors connect across live and neutral where short-circuit failure only trips a fuse, not shocks a user

A Class X2 capacitor is defined by where it is allowed to go in a mains-connected circuit: directly across live and neutral (L-N) on the primary side of a power supply or appliance. The "X" class designation is a safety certification that guarantees the part's failure modes are non-lethal in that position.

The failure logic:
- **Open circuit failure** — loss of filter function, no hazard
- **Short circuit failure** — produces a dead short across L-N, which immediately trips the upstream fuse or breaker, clearing the fault

Neither mode puts live voltage on an exposed metal part or through a user. Compare this to a generic metallized-polypropylene film cap of the same capacitance and voltage rating — it might have identical electrical characteristics but lacks the certification testing that proves controlled failure behavior. Using an uncertified cap across AC mains is a safety violation even if the circuit appears to work.

X2 specifically allows pulse voltages from typical household mains transients (2.5 kV class). The stricter X1 class is for environments with higher surge exposure (4 kV class, industrial).

---

Source: [[docs_and_data]]

Relevant Notes:
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] — the self-healing mechanism that makes X2 failure modes graceful
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] — same upstream-protection-as-safety-mechanism principle in a different domain

Topics:
- [[passives]]
- [[power-systems]]
