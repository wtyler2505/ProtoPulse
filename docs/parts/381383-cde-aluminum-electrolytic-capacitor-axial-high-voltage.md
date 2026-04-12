---
description: "Industrial-grade axial electrolytic — Cornell Dubilier 381LX series. High-voltage power supply filtering, likely 200-450V rated"
topics: ["[[passives]]"]
status: unidentified
quantity: 1
voltage: []
interfaces: []
manufacturer: "Cornell Dubilier"
warnings: ["POLARIZED — observe polarity", "High-voltage rated — treat as dangerous even when disconnected"]
datasheet_url: ""
---

# 381383 CDE Aluminum Electrolytic Capacitor Axial High Voltage

Industrial-grade axial aluminum electrolytic from Cornell Dubilier (CDE). The 381LX series is a well-known line of high-voltage, long-life electrolytics used in industrial power supplies, UPS systems, and professional audio equipment. This unit needs identification — the exact capacitance and voltage rating should be read from the part markings or looked up via the full part number.

## Specifications (Partial — Needs Identification)

| Parameter | Value |
|-----------|-------|
| Manufacturer | Cornell Dubilier (CDE) |
| Series | 381LX (likely) |
| Part Number Fragment | 381383 |
| Capacitance | **UNKNOWN — read from markings** |
| Voltage Rating | **UNKNOWN — likely 200-450V based on series** |
| Type | Aluminum electrolytic |
| Polarized | **Yes** |
| Mount | Axial (leads exit from both ends) |
| Temperature Rating | 85°C or 105°C (varies by exact part) |
| Lifespan | 2000-5000 hours at rated temperature |

## Identification Steps

This part is marked `status: unidentified` because the exact capacitance and voltage rating are not confirmed. To fully catalog:

1. **Read the markings** — CDE prints capacitance (uF), voltage (V), and temperature rating on the sleeve. Look for a format like "470uF 200V" or similar.
2. **Look up the full part number** — The "381383" fragment should map to a specific CDE 381LX series part. CDE's catalog or distributor sites (Mouser, Digi-Key) can cross-reference.
3. **Measure if markings are unreadable** — Use an LCR meter or capacitance meter to measure capacitance. Voltage rating cannot be measured — it must be read from markings or documentation.

## CDE 381LX Series Characteristics

The 381LX series is a cut above generic electrolytics:

- **Long life** — designed for 5000+ hour operation at rated temperature, compared to 2000 hours for cheap parts.
- **Low ESR** — better ripple current handling than standard electrolytics.
- **High ripple current** — can handle the continuous AC ripple in power supply filter applications.
- **Axial form factor** — leads exit from both ends, which is common in older equipment and point-to-point wiring. Less common in modern PCB designs.
- **Industrial pedigree** — CDE is a reputable manufacturer. These aren't bargain bin caps.

## Safety Notes

Given that this is a high-voltage electrolytic (the 381LX series goes up to 450V in some variants):

- **Assume it is charged until proven otherwise.** Measure across terminals with a multimeter before handling.
- **Discharge through a resistor** — 10K ohm, rated for the voltage. Never short the terminals.
- **Dielectric absorption** — large electrolytics can recover voltage after discharge. Check again after waiting 60 seconds.
- **Axial mounting** — the cylindrical body with leads on both ends means this part can roll off a workbench. Secure it.

## Stored Energy Estimate

Without knowing the exact specs, here's the energy range for typical 381LX parts:

| Capacitance | Voltage | Stored Energy |
|-------------|---------|---------------|
| 100uF | 450V | 10.1 J |
| 220uF | 350V | 13.5 J |
| 470uF | 200V | 9.4 J |
| 1000uF | 100V | 5.0 J |

Any of these values represent enough energy to cause injury. Handle accordingly.

---

## Related Parts

- [[200mxr470m-electrolytic-capacitor-470uf-200v-radial]] — Another high-voltage electrolytic in inventory (Rubycon, radial mount, identified)

## Categories

- [[passives]]
