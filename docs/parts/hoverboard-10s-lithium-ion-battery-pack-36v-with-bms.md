---
description: "Salvaged hoverboard lithium-ion battery — 10S configuration, 36V nominal (42V full charge, 30V cutoff). Built-in BMS handles over/under voltage, over-current, and thermal protection"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [36, 42]
interfaces: []
manufacturer: "Generic (hoverboard salvage)"
warnings: ["LITHIUM-ION — fire/explosion risk if punctured, overcharged, or short-circuited", "42V at full charge — dangerous voltage, treat with respect", "Do NOT discharge below 30V (3.0V per cell) — permanently damages cells", "BMS may have unknown cutoff thresholds — test before relying on it", "Store at ~3.7V per cell (37V total) for longevity"]
datasheet_url: ""
---

# Hoverboard 10S Lithium-Ion Battery Pack 36V with BMS

Salvaged from a hoverboard. This is a 10S lithium-ion pack — 10 cells in series, each contributing ~3.7V nominal for a 36V total. Full charge hits 42V (4.2V per cell), and the hard cutoff is 30V (3.0V per cell). The built-in BMS should handle protection, but since this is salvage with an unknown BMS, test every threshold before trusting it with your project.

## Voltage Reference Table

| State | Per Cell | Pack (10S) | Notes |
|-------|----------|------------|-------|
| Full charge | 4.20V | 42.0V | NEVER exceed this — overcharge = fire risk |
| Storage charge | 3.70V | 37.0V | Ideal for long-term storage |
| Nominal | 3.70V | 36.0V | Rated voltage, what specs reference |
| Low (stop using) | 3.30V | 33.0V | Performance drops, start recharging |
| Cutoff (BMS trips) | 3.00V | 30.0V | BMS should disconnect here |
| Damaged | <2.50V | <25.0V | Cell is likely dead — do NOT attempt to recharge |

## Capacity and Energy

The exact capacity is unknown (hoverboard salvage — no markings). Typical hoverboard packs range from 2.0Ah to 4.4Ah, which works out to:

| Assumed Capacity | Energy (Wh) | Runtime at 10A | Runtime at 5A |
|-----------------|-------------|----------------|---------------|
| 2.0Ah | 72Wh | ~12 min | ~24 min |
| 4.4Ah | 158Wh | ~26 min | ~53 min |

**To measure actual capacity:** Fully charge to 42V, discharge through a known load at a controlled rate (e.g., 2A) while logging voltage, stop at 30V. Total Ah = current x time.

## BMS (Battery Management System)

The pack has a built-in BMS board. On a typical hoverboard BMS:

| Function | Expected Behavior | Trust Level |
|----------|-------------------|-------------|
| Overcharge protection | Cuts charging above 42V (4.2V/cell) | Test before trusting |
| Over-discharge protection | Cuts load below 30V (3.0V/cell) | Test before trusting |
| Over-current protection | Trips at 15-30A (varies by BMS) | Unknown threshold |
| Short-circuit protection | Immediate disconnect | Should work but don't test intentionally |
| Cell balancing | Passive balancing during charge | Slow — may not fully balance |
| Thermal protection | Cuts at ~65C | Sensor location unknown |

### BMS Testing Protocol

Before using this pack in any project:

1. **Measure open-circuit voltage** — if below 30V, cells may be damaged. Proceed with extreme caution.
2. **Charge to full** (42V) with a compatible charger and verify BMS cuts off charging.
3. **Discharge under load** and verify BMS cuts off at ~30V.
4. **Measure individual cell voltages** if accessible — any cell more than 0.1V different from the others indicates imbalance.
5. **Check for swelling** — any puffy cells mean the pack is unsafe. Dispose properly.

## NMC vs LiFePO4 Chemistry Comparison

If building or replacing the battery pack, the cell chemistry matters:

| Property | NMC (LiNiMnCoO2) | LiFePO4 (LFP) |
|----------|-------------------|---------------|
| Nominal voltage per cell | 3.6V | 3.2V |
| Full charge per cell | 4.2V | 3.65V |
| Cutoff per cell | 3.0V | 2.5V |
| 10S pack nominal | 36V | 32V |
| 10S pack full charge | 42V | 36.5V |
| Energy density | 210-250 Wh/kg | 100-140 Wh/kg |
| Cycle life (100% DoD) | 500-1,000 | 2,000-4,000 |
| Thermal runaway risk | Higher — can ignite | Much lower — inherently safer |
| Weight (same capacity) | Lighter | ~40-50% heavier |
| Cost per Wh | Lower | Higher |
| Best for | Weight-sensitive builds | Safety-critical, long-life builds |

**Note:** LiFePO4's lower nominal voltage (32V vs 36V) means your motors run ~11% slower at nominal. Most hoverboard motors and ZS-X11H controllers work fine at 32V, just with reduced top speed. The 12S LFP configuration (38.4V nominal) is closer to the original 36V spec.

## Runtime Estimates at Various Loads

Assuming a 4.4Ah pack (common mid-range hoverboard battery):

| Load | Current Draw | Power | Estimated Runtime |
|------|-------------|-------|-------------------|
| Electronics only | ~0.5A | ~18W | ~8 hours |
| Light driving (2 motors, 25%) | ~5A | ~180W | ~53 min |
| Normal driving (4 motors, 50%) | ~20A | ~720W | ~13 min |
| Heavy load (4 motors, 75%) | ~35A | ~1,260W | ~7.5 min |
| Max draw (4 motors, 100%) | ~60A | ~2,160W | ~4.4 min |

Real-world runtime is typically 60-70% of these estimates due to voltage sag, BMS protection margins, and varying load.

## Connector Recommendation

| Connector | Rating | Use Case |
|-----------|--------|----------|
| **XT90** (recommended) | 90A continuous | Main discharge — best balance of rating vs. size |
| Anderson Powerpole (PP75/PP120) | 75-120A | Main discharge — tool-free, stackable, genderless |
| XT60 | 60A continuous | **Marginal** for 4-motor builds — OK for 2-motor or electronics-only |
| XT30 | 30A continuous | Charge port only, NOT for discharge |

For a 4WD rover pulling 60A peaks, the **XT90** is the right choice. Anderson Powerpole PP75 is a solid alternative if you want quick-disconnect capability without soldering.

## Charging

Use a 42V lithium-ion charger rated for 10S packs. The original hoverboard charger works if you still have it. Typical specs:

- **Charger output:** 42V DC, 1.5-2A
- **Connector:** Varies by hoverboard brand — 3-pin is common
- **Charge time:** 2-4 hours depending on capacity and charger current

**Do NOT charge with a bench power supply unless you know exactly what you're doing.** Lithium-ion cells require CC/CV (constant current, then constant voltage) charging profiles. A raw power supply won't do this and will overcharge cells.

## Safety

This is not a suggestion section. Lithium-ion batteries store serious energy and can cause fires.

- **Storage:** Keep at 37V (storage charge) if not using for weeks. Never store fully charged or fully discharged.
- **Physical damage:** If the pack is dented, punctured, or has swollen cells — do NOT use it. Dispose at a battery recycling center.
- **Temperature:** Do not charge below 0C or above 45C. Do not discharge above 60C.
- **Short circuits:** A 10S pack can deliver hundreds of amps into a short circuit. Always use a fuse or the BMS as your first line of defense.
- **Fire extinguisher:** Keep a Class D or lithium-rated fire extinguisher nearby. Water does NOT put out lithium fires effectively.
- **Wiring:** Use appropriately rated wire (14AWG minimum for 10A, 12AWG for 15A+). Secure all connections — a loose wire at 42V arcing against a metal chassis is a fire.

## Using with Voltage Regulators

This pack's 30-42V output range is too high for most electronics directly. Use a buck converter to step down:

| Target Voltage | Regulator | Notes |
|---------------|-----------|-------|
| 5V | [[lm2596-adjustable-buck-converter-module-3a-step-down]] | Set pot to 5V output, plenty of headroom |
| 3.3V | [[lm2596-adjustable-buck-converter-module-3a-step-down]] | Set pot to 3.3V output |
| 12V | [[lm2596-adjustable-buck-converter-module-3a-step-down]] | For 12V accessories |
| 36V (direct) | No regulator needed | Motor controllers like [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] take battery voltage directly |

## Physical Notes

The battery pack sits in the hoverboard frame's center compartment. It's a flat rectangular pack with wires terminating in a connector (usually XT60 or proprietary). The BMS board is typically attached to the top of the cell stack.

---

Related Parts:
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — step-down regulator for powering 5V/3.3V logic from this pack
- [[salvaged-hoverboard-metal-frame-for-rover-chassis]] — the frame this pack came from
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motors this pack was designed to power
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — motor controller that runs directly from this pack's voltage

Categories:
- [[power]]
