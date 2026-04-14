---
description: "An X2 capacitor rated 275V AC is the correct choice for 230V RMS European mains not because the ratings are close — but because 230V RMS has a 325V peak, and the X2 rating must cover peak plus transient headroom, not just RMS voltage"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
  - "[[power-systems]]"
---

# X2 capacitor rated 275V AC targets 230V mains with headroom for peak voltage and transients, not just RMS

The common X2 safety cap rating of 275V AC RMS looks like a strange number until you decode the math:

- 230V nominal European mains = 230V RMS
- Peak voltage = 230V × √2 ≈ 325V peak
- With ±10% line tolerance: up to 253V RMS / 358V peak
- Continuous transient margin adds further headroom

275V AC RMS (389V peak) is the standard rating that provides reasonable margin for 230V nominal systems. For 120V US mains, 275V is enormous overkill — 150V or 250V ratings are used — but global-market parts default to 275V to cover both regions with one SKU.

The general rule for mains-exposed components: voltage ratings must be sized against RMS plus peak headroom plus transient margin. A 240V component on 230V mains will be stressed to failure even though the numbers look close.

This parallels the 80% derate rule for DC electrolytics but with an additional AC-specific factor: the peak is √2× the nameplate RMS.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] — the DC analog of this AC rule

Topics:
- [[passives]]
- [[power-systems]]
