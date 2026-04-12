---
description: "High-voltage electrolytic for power supply filtering — 470uF at 200V, radial mount. Rubycon MXR series or equivalent"
topics: ["[[passives]]"]
status: needs-test
quantity: 1
voltage: [200]
interfaces: []
manufacturer: "Rubycon"
warnings: ["POLARIZED — observe polarity markings or it will fail violently", "200V rating — can store dangerous energy even when circuit is off"]
datasheet_url: ""
---

# 200MXR470M Electrolytic Capacitor 470uF 200V Radial

High-voltage electrolytic capacitor for power supply filtering. 470uF at 200V is a substantial energy storage component — this is the kind of cap you find in switch-mode power supplies, amplifier PSUs, and industrial equipment. Rubycon MXR series is a well-regarded line for this application.

## Specifications

| Parameter | Value |
|-----------|-------|
| Capacitance | 470uF |
| Voltage Rating | 200V DC |
| Series | Rubycon MXR (or equivalent) |
| Type | Aluminum electrolytic |
| Polarized | **Yes** — observe markings |
| Mount | Radial through-hole |
| Temperature Rating | 85°C (standard), 105°C (some MXR variants) |
| Ripple Current | ~800mA at 105°C, 120Hz (typical for this size) |
| ESR | ~0.3 ohm (typical at 100kHz) |
| Lifespan | ~2000-5000 hours at rated temperature |

## Part Number Decoding

| Segment | Meaning |
|---------|---------|
| 200 | 200V voltage rating |
| MXR | Rubycon series designation |
| 470 | 470uF capacitance |
| M | ±20% tolerance |

## Stored Energy Warning

At full charge, this capacitor stores:

**E = 0.5 x C x V^2 = 0.5 x 0.00047 x 200^2 = 9.4 joules**

That is enough energy to cause serious injury or damage. For reference, 1 joule across your fingers is painful, and 10 joules can cause burns or cardiac arrest under the wrong conditions.

**Before handling:**
- Verify the capacitor is discharged with a multimeter (DC voltage mode across terminals)
- Discharge through a suitable resistor (1K-10K ohm, rated for the power dissipation) — never short the terminals directly
- Even after discharge, large electrolytics can recover voltage from dielectric absorption — check again after a minute

## Typical Applications

- **Switch-mode power supply output filtering** — smoothing rectified AC in offline SMPS designs.
- **Amplifier power supply** — bulk capacitance after the bridge rectifier in audio amp PSUs.
- **Motor drive bulk capacitance** — energy reservoir for VFDs and motor controllers.
- **Capacitor bank** — parallel combinations for high-energy storage.

## Installation Notes

- **Polarity**: The negative terminal is marked with a stripe and/or arrows on the sleeve. The positive lead is typically longer on new parts. Getting this backwards will cause the cap to fail — potentially explosively.
- **Mounting**: This is a physically large component. Verify board footprint and clearance above the board (these can be 30-40mm tall).
- **Derating**: For reliability, operate at no more than 80% of rated voltage (160V for this cap). Electrolytics degrade faster near their voltage limit.
- **Temperature**: Keep away from heat sources. Every 10°C above rated temperature roughly halves the lifespan.

## Aging and Shelf Life

Aluminum electrolytics have a finite lifespan — the electrolyte slowly evaporates through the seal. If this cap has been sitting unused for years, it may need to be reformed by slowly applying increasing voltage through a current-limiting resistor. Applying full voltage to a long-dormant electrolytic can cause failure.

---

## Related Parts

- [[753j-400v-polyester-film-capacitor-75nf]] — Another high-voltage cap in inventory (film type, different application)

## Categories

- [[passives]]
