---
description: "Medium-voltage film cap for filtering and coupling — 0.075uF (75nF), 400V rated, 5% tolerance. Stable and non-polarized"
topics: ["[[passives]]"]
status: needs-test
quantity: 1
voltage: [400]
interfaces: []
manufacturer: "Generic"
warnings: ["400V rated — handle with respect in power circuits"]
datasheet_url: ""
---

# 753J 400V Polyester Film Capacitor 75nF

Medium-voltage film capacitor for filtering and coupling applications. The marking "753J" decodes as 75 x 10^3 pF = 75,000 pF = 75nF = 0.075uF, with "J" indicating ±5% tolerance. Non-polarized, so orientation doesn't matter.

## Specifications

| Parameter | Value |
|-----------|-------|
| Capacitance | 75nF (0.075uF) |
| Voltage Rating | 400V DC |
| Tolerance | ±5% (J) |
| Dielectric | Polyester (Mylar) film |
| Polarized | No |
| Temperature Range | -40°C to +85°C (typical) |
| Package | Radial through-hole |
| Dissipation Factor | < 1% at 1kHz |

## Capacitor Code Decoding

| Marking | Meaning |
|---------|---------|
| 753 | 75 x 10^3 pF = 75,000 pF = 75nF |
| J | ±5% tolerance |
| 400V | Maximum DC voltage rating |

### Common Tolerance Codes

| Code | Tolerance |
|------|-----------|
| J | ±5% |
| K | ±10% |
| M | ±20% |

## Characteristics

Polyester film capacitors have several properties that make them useful for general-purpose work:

- **Non-polarized** — no polarity to worry about, wire either direction.
- **Low ESR** — better high-frequency performance than electrolytics.
- **Self-healing** — minor dielectric breakdowns can self-repair.
- **Stable over temperature** — less capacitance drift than ceramic caps (no piezoelectric effect either).
- **Long lifespan** — no electrolyte to dry out. These last essentially forever in normal conditions.

## Typical Applications

- **AC coupling** — Block DC while passing AC signals between amplifier stages.
- **EMI filtering** — Across power lines to suppress high-frequency noise.
- **Snubber circuits** — Across relay contacts or switch contacts to suppress arcing.
- **Tone circuits** — Guitar tone controls and audio crossover networks commonly use film caps in this value range.
- **Timer circuits** — Paired with resistors for RC timing.

## Handling Notes

- The 400V rating means this cap is intended for use in circuits with significant voltage. While the capacitance is small (75nF), respect the voltage rating — it indicates the intended application domain.
- At 75nF and 400V, the stored energy is very small (about 6mJ), so discharge risk is minimal. But in the circuit context where 400V caps are used, other components may store much more energy.

---

## Related Parts

(none cataloged yet)

## Categories

- [[passives]]
