---
description: "Battery disconnect switch + ANL-100 slow-blow fuse — the first protection between 36V battery and everything else. Fuse must be within 6 inches of battery positive per NEC. Switch must be DC-rated for 100A with arc suppression. NEVER use AC-rated switches for DC"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [36]
interfaces: [Terminal]
logic_level: "N/A (power switching, no logic)"
manufacturer: "Various (Blue Sea Systems, Bussmann, Eaton, Renogy)"
pinout: |
  Power flow (series circuit):
  Battery (+) ──[6" max]──→ ANL Fuse Holder IN
  ANL Fuse Holder OUT ──[12" max]──→ Main Switch IN
  Main Switch OUT ──→ Power Distribution Board

  ANL-100 Fuse:
    Terminal 1 → From battery positive (#4 AWG, M8 ring terminal)
    Terminal 2 → To main switch input (#4 AWG, M8 ring terminal)

  Main Disconnect Switch:
    IN+  → From fuse output (#4 AWG)
    OUT+ → To power distribution board (#4 AWG)
    Coil+ → 12V from buck converter (if DC contactor type)
    Coil- → GND (if DC contactor type)
compatible_with: ["[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]", "[[power-distribution-board-fused-terminal-block-for-36v-system]]", "[[emergency-stop-nc-button-with-dc-contactor-for-36v]]"]
used_in: []
warnings: ["Fuse MUST be within 6 inches of battery positive terminal — NEC requirement, fire prevention", "NEVER use AC-rated switches for DC — AC switches cannot safely interrupt DC arcs (fire/explosion hazard)", "DC interrupt rating must be >500A — battery short-circuit current can exceed 500A", "Use slow-blow (time-delay) fuse — fast-blow fuses will nuisance-trip on motor startup inrush", "NEVER fuse the negative/ground wire — always fuse the positive side only", "All wire connections must use properly crimped ring terminals — never solder high-current connections", "Torque all terminal bolts to spec — loose connections cause arcing and fire"]
datasheet_url: ""
---

# Main Power Switch + ANL Fuse 100A Disconnect for 36V

This is the FIRST line of defense between your battery and everything else. Two components in series on the positive rail:

1. **ANL-100 slow-blow fuse** — overcurrent protection. If a dead short happens, this blows before the wires catch fire. The 100A rating is calculated as 125% of the 80A peak motor draw (NEC Article 240 guideline).

2. **Main disconnect switch** — manual or contactor-based battery disconnect. Flip the switch (or de-energize the contactor) and all 36V power is cut immediately.

The fuse goes FIRST (closest to the battery), then the switch. Fuse must be within 6 inches of the battery positive terminal — this is a fire prevention requirement. Any wire between the battery and the fuse is UNPROTECTED, so you want that stretch as short as possible.

## Component Specifications

### ANL-100 Fuse

| Spec | Value |
|------|-------|
| Type | ANL-100 slow-blow (time-delay) |
| Current Rating | 100A at 25C ambient |
| Voltage Rating | 80V DC (well above 42V max) |
| Interrupt Rating | >1000A DC |
| Physical Size | 58mm length (standard ANL) |
| Terminals | M8 studs |
| Derating at 40C | 95A effective |

### Time-Current Characteristics

| Current | Time to Blow |
|---------|-------------|
| 100A (100%) | Indefinite (no blow) |
| 125A (125%) | >1 hour |
| 200A (200%) | ~60 seconds |
| 300A (300%) | ~1-5 seconds |
| 500A (500%) | <1 second |
| 1000A (1000%) | <100ms |

### Fuse Sizing Calculation

```
Peak system current:        80A (4 motors at max acceleration)
Continuous current:         64A (4 motors at full sustained speed)
NEC fuse rating:            1.25 x 80A = 100A
Wire protection (#4 AWG):  85-95A ampacity
Result:                     100A ANL fuse protects both loads and wiring
```

### Main Disconnect Switch

| Spec | Value |
|------|-------|
| Type | DC-rated contactor or manual battery disconnect |
| Voltage Rating | >=48V DC (margin above 42V max) |
| Current Rating | >=100A continuous at 36V DC |
| Interrupt Rating | >=500A DC (battery fault current) |
| Contact Material | Silver cadmium oxide (arc-resistant, DC-rated) |
| Arc Suppression | Required (magnetic blowout or arc chute) |
| Coil Voltage (contactor) | 12V DC (from buck converter) |
| Mechanical Life | >100,000 operations |

## System Wiring

```
Battery Pack (+36V)
    |
    +-- [6" max, #4 AWG red] --> ANL Fuse Holder
    |                               |
    |                         [ANL-100 Fuse]
    |                               |
    +-- [12" max, #4 AWG red] --> Main Disconnect Switch
    |                               |
    |                         [Switch contacts]
    |                               |
    +-- [variable, #4 AWG] ------> Power Distribution Board

Battery Pack (-)
    |
    +-- [#4 AWG black, direct] --> Power Distribution GND (star ground)
```

## Wire Specifications

| Segment | Gauge | Max Length | Color | Terminals |
|---------|-------|-----------|-------|-----------|
| Battery to fuse | #4 AWG | 6 inches | Red | M8 ring terminals |
| Fuse to switch | #4 AWG | 12 inches | Red | M8 ring terminals |
| Switch to distribution | #4 AWG | Variable | Red | M6/M8 ring terminals |
| Battery (-) to GND bus | #4 AWG | Direct | Black | M8 ring terminals |

---

Related Parts:
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — battery source; fuse must be within 6 inches of battery positive
- [[emergency-stop-nc-button-with-dc-contactor-for-36v]] — downstream; e-stop contactor sits between this switch and the distribution board
- [[power-distribution-board-fused-terminal-block-for-36v-system]] — downstream; switch output feeds the distribution board input

Categories:
- [[power]]
