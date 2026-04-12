---
description: "60-position board-to-board connector — Amphenol ICC/FCI floating receptacle, surface mount, gold contacts. For high-density I/O connections"
topics: ["[[passives]]"]
status: needs-test
quantity: 1
voltage: []
interfaces: []
manufacturer: "Amphenol ICC"
part_number: "B322-1B7L1-11260-E100"
warnings: ["Surface mount — requires reflow soldering or hot air station"]
datasheet_url: ""
---

# Amphenol 11260 60-Position Floating Receptacle SMD Connector

60-position board-to-board connector from Amphenol ICC (formerly FCI). This is a floating receptacle — the "floating" part means it has mechanical compliance to absorb misalignment between two PCBs. Surface mount with gold-plated contacts for reliable signal integrity across all 60 positions.

## Specifications

| Parameter | Value |
|-----------|-------|
| Manufacturer | Amphenol ICC (formerly FCI) |
| Part Number | B322-1B7L1-11260-E100 |
| Type | Board-to-board floating receptacle |
| Positions | 60 |
| Rows | 2 rows x 30 positions (typical) |
| Pitch | 0.8mm (typical for this series) |
| Contact Finish | Gold plating |
| Mount | Surface mount (SMD) |
| Mating Style | Vertical or right-angle (check specific variant) |
| Float Range | ±0.5mm to ±1.0mm (typical) |
| Current Rating | ~0.5A per contact (typical) |
| Voltage Rating | ~100V (typical) |
| Contact Resistance | < 30 milliohm |
| Operating Temperature | -40°C to +105°C |

## What "Floating" Means

A floating connector has mechanical play built into the housing that allows the contact block to shift laterally relative to the solder pads. This compensates for:

- **PCB manufacturing tolerances** — board-to-board alignment is never perfect
- **Thermal expansion** — two boards may expand at different rates
- **Assembly tolerance** — connectors mounted on opposite boards may not line up exactly

Without float, rigid board-to-board connectors can stress solder joints during assembly or thermal cycling, leading to cracked joints and intermittent connections. The float absorbs this misalignment.

## Soldering Notes

This is a surface mount component with 60 fine-pitch pads. Soldering options:

| Method | Suitability |
|--------|-------------|
| Reflow oven | **Best** — designed for this |
| Hot air station | Good — requires steady hand and proper flux |
| Hand soldering | Difficult — 0.8mm pitch is tight, risk of bridges |
| Wave soldering | Not suitable — SMD component |

**Tips for hot air soldering:**
1. Apply flux paste to all pads before placing the connector.
2. Pre-tin the pads with a thin layer of solder.
3. Place the connector and align carefully — a magnifier or microscope helps.
4. Apply hot air at 300-350°C with moderate airflow. Too much air will blow the part off the pads.
5. Watch for solder reflow on all pins — the solder will visibly wet and settle.
6. Inspect under magnification for solder bridges between pins.

## Mating Connector

This is a receptacle — it mates with the corresponding Amphenol ICC header (plug). The specific mating part number should be cross-referenced from the Amphenol ICC catalog or the full part number. Look for a B322-series header with matching position count and pitch.

## Typical Applications

- **Daughter board connections** — connecting a module PCB to a main board
- **Stacked PCB assemblies** — multi-board systems where boards are parallel
- **Industrial I/O** — high-density signal routing between controller boards
- **Telecommunications** — line cards mating to backplanes

## Handling and Storage

- **ESD sensitive** — gold-plated contacts are fine, but the connector may be part of an ESD-sensitive assembly. Handle with ESD precautions.
- **Moisture sensitive** — SMD components may be MSL rated. If the package has been open for extended periods, bake before reflow (check MSL level on packaging).
- **Do not bend pins** — the fine-pitch contacts are fragile. Store in original packaging or in anti-static foam.

---

## Related Parts

(none cataloged yet)

## Categories

- [[passives]]
