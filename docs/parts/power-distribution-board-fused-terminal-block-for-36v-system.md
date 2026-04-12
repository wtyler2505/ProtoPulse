---
description: "Central power distribution hub for 36V rover — fused terminal block with individual circuit protection per output. 100A input capacity, 6+ independent output circuits with blade fuses. Sits between main disconnect switch and all loads"
topics: ["[[power]]"]
status: needs-test
quantity: 1
voltage: [36]
interfaces: [Terminal]
logic_level: "N/A (power distribution, no logic)"
manufacturer: "Various (Blue Sea Systems, Bussmann)"
pinout: |
  Input:
    +36V IN  → From main disconnect switch output (#4 AWG)
    GND IN   → From battery negative (star ground)
  Output circuits (6+ fused outputs):
    Circuit 1 → RioRand MC1 (Front Left) - 20A fuse
    Circuit 2 → RioRand MC2 (Front Right) - 20A fuse
    Circuit 3 → RioRand MC3 (Rear Left) - 20A fuse
    Circuit 4 → RioRand MC4 (Rear Right) - 20A fuse
    Circuit 5 → LM2596 Buck #1 (12V out) - 5A fuse
    Circuit 6 → LM2596 Buck #2 (5V out) - 5A fuse
compatible_with: ["[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]", "[[main-power-switch-anl-fuse-100a-disconnect-for-36v]]", "[[emergency-stop-nc-button-with-dc-contactor-for-36v]]", "[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[lm2596-adjustable-buck-converter-module-3a-step-down]]"]
used_in: []
warnings: ["100A main input — use #4 AWG minimum for input wiring", "Individual fuses MUST be rated for 36V DC — standard automotive blade fuses may only be rated for 32V", "Use DC-rated fuses only — AC fuses cannot safely interrupt DC arcs", "Torque all terminal screws to manufacturer spec — loose connections cause heating and fire", "Label every circuit — you will thank yourself when troubleshooting at 2 AM", "Keep total load below 80% of input capacity for derating"]
datasheet_url: ""
---

# Power Distribution Board — Fused Terminal Block for 36V System

The central hub that takes the single 36V positive rail from the main disconnect switch and fans it out to individual circuits, each with its own fuse. This is how you prevent one shorted motor controller from killing the entire rover — if Circuit 1's RioRand shorts, its 20A fuse blows and everything else keeps running.

The board has both positive and negative bus bars. All positive outputs run through individual fuses. The negative side is a star ground — every circuit's ground returns to this single point to avoid ground loops.

## Specifications

| Spec | Value |
|------|-------|
| Input Voltage | 30-42V DC (36V nominal, 10S lithium) |
| Maximum Input Current | 100A (from main disconnect switch) |
| Input Wire Gauge | #4 AWG minimum |
| Output Circuits | 6 minimum (expandable) |
| Fuse Type | ATC/ATO blade fuses (rated for 32-58V DC) or bolt-down |
| Output Wire Gauge | #10-14 AWG per circuit (depends on load) |
| Mounting | DIN rail or panel mount (vibration-resistant) |
| Operating Temp | -40C to +85C |

## Circuit Layout

| Circuit | Load | Fuse Rating | Wire Gauge | Notes |
|---------|------|-------------|------------|-------|
| 1 | RioRand MC1 (Front Left) | 20A | #14 AWG | Motor controller |
| 2 | RioRand MC2 (Front Right) | 20A | #14 AWG | Motor controller |
| 3 | RioRand MC3 (Rear Left) | 20A | #14 AWG | Motor controller |
| 4 | RioRand MC4 (Rear Right) | 20A | #14 AWG | Motor controller |
| 5 | LM2596 Buck #1 (12V) | 5A | #18 AWG | Electronics power |
| 6 | LM2596 Buck #2 (5V) | 5A | #18 AWG | Sensor/logic power |
| Spare | Future expansion | TBD | TBD | Keep 2-3 spare circuits |

## Power Budget

```
Motor circuits (4x):
  Continuous per motor:    16A (4 motors x 16A = 64A total)
  Peak per motor:          20A (4 motors x 20A = 80A total)
  Fuse per motor:          20A blade fuse

Electronics:
  12V buck converter:      <2A (relays, contactor coil)
  5V buck converter:       <3A (Arduino, sensors, ESP32, LEDs)
  Total electronics:       <5A

System total:
  Continuous:              ~69A
  Peak:                    ~85A
  Main fuse upstream:      100A ANL (in main power switch)
```

## Wiring Diagram

```
From Main Switch ──[#4 AWG]──→ +BUS BAR ──┬── [20A fuse] ──→ MC1 (+36V)
                                           ├── [20A fuse] ──→ MC2 (+36V)
                                           ├── [20A fuse] ──→ MC3 (+36V)
                                           ├── [20A fuse] ──→ MC4 (+36V)
                                           ├── [5A fuse]  ──→ Buck 12V IN
                                           └── [5A fuse]  ──→ Buck 5V IN

From Battery (-) ──[#4 AWG]──→ -BUS BAR ──┬── MC1 GND
                                           ├── MC2 GND
                                           ├── MC3 GND
                                           ├── MC4 GND
                                           ├── Buck 12V GND
                                           └── Buck 5V GND
```

## Installation Notes

- Mount board in a location protected from water and debris
- Use vibration-resistant mounting (lock washers, Loctite on bolts)
- Route input wires as short as possible from main switch
- Use ring terminals crimped with proper tool (not pliers)
- Test each circuit with a multimeter before connecting loads
- Label every circuit on both the board and the wire

---

Related Parts:
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — 36V source; battery negative goes to GND bus (star ground)
- [[main-power-switch-anl-fuse-100a-disconnect-for-36v]] — upstream; fuse + switch output feeds the +36V input
- [[emergency-stop-nc-button-with-dc-contactor-for-36v]] — upstream; contactor sits between main switch and this board
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — load on circuits 1-4 (20A fused each)
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — load on circuits 5-6 (5A fused); steps 36V down to 12V and 5V for electronics

Categories:
- [[power]]
