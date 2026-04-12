---
description: "Structural metal frame salvaged from hoverboard — two motor mount points, battery compartment, main pivot joint. Used as rover chassis base"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: []
interfaces: []
manufacturer: "Generic (hoverboard salvage)"
compatible_with: ["[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]", "[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]"]
used_in: []
warnings: ["Heavy — the metal frame adds significant weight to any rover build", "Motor mounts are hoverboard-specific — may need adapters for non-hoverboard motors"]
datasheet_url: ""
---

# Salvaged Hoverboard Metal Frame for Rover Chassis

The metal frame salvaged from a standard hoverboard. This is the structural backbone — two halves connected by a central pivot joint, each half housing a BLDC hub motor and sharing a central battery compartment. Repurposed here as a rover chassis base, because the motor mounts, weight distribution, and battery bay are already engineered for exactly the kind of load a rover needs.

## Physical Layout

```
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  [LEFT MOTOR MOUNT]    [BATTERY BAY]    [RIGHT MOTOR MOUNT]
  │       ○                ┌────────┐              ○     │
  │      /│\               │        │             /│\    │
  │     / │ \              │  PACK  │            / │ \   │
  │    /  │  \             │        │           /  │  \  │
  │   ────┼────            └────────┘          ────┼──── │
  │       │                    │                   │     │
  │  LEFT HALF ════════ PIVOT JOINT ════════ RIGHT HALF  │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

## Key Features

| Feature | Details |
|---------|---------|
| Material | Stamped steel / aluminum (varies by brand) |
| Motor mounts | Two — one per side, sized for standard hoverboard hub motors |
| Battery compartment | Center bay, fits standard 10S hoverboard packs |
| Pivot joint | Central articulating joint (the part riders twist to steer) |
| Footpads | Two pressure-sensor pads (one per side) — can be removed or repurposed |
| Weight | ~3-5 kg for the frame alone (varies by model) |
| Approximate dimensions | ~60cm long x 20cm wide (varies by model) |

## Rover Conversion Considerations

### The Pivot Joint Problem

The central pivot joint is designed for hoverboard steering — the rider twists the two halves relative to each other. For a rover, you almost certainly want to **lock this joint rigid**. Options:

1. **Weld it** — Permanent, strongest. Requires a welder.
2. **Bolt a steel plate across** — Reversible, nearly as strong. Drill holes on both sides and bridge with flat steel stock.
3. **3D-print a locking bracket** — Weakest option, but works for lighter loads and prototyping.
4. **Leave it free** — If you want articulated steering (like a tank with independent track control), the pivot can act as a differential joint. But you'll need a mechanical stop to limit rotation range.

### Battery Mounting

The center compartment is sized for the [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]. If using the original battery, it drops right in. If using a different battery:

- Measure the compartment dimensions
- 3D print or fabricate mounting brackets
- Ensure the battery is secured against vibration — a loose battery bouncing around a metal frame is a puncture/fire risk

### Motor Mounting

The hub motor mounts are designed for the [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]. The axle fits through a bearing in the frame, and the motor is secured with a nut on the outside. If you want to mount different motors:

- You'll need to fabricate adapter plates
- The existing holes may not align — drill new mounting points
- Consider weight distribution if using lighter or heavier motors

### Electronics Mounting

The frame has flat surfaces suitable for mounting:

- Motor controllers ([[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] or similar)
- Microcontroller (Arduino Mega, ESP32)
- Buck converters ([[lm2596-adjustable-buck-converter-module-3a-step-down]])
- Sensors, antennas, camera mounts

Use standoffs or 3D-printed brackets to mount electronics. Do NOT let bare PCBs contact the metal frame — that's a short circuit waiting to happen. Use nylon standoffs or insulating tape as a barrier.

### Wiring Routing

The frame has internal channels where the original hoverboard wiring ran. Use these channels for:

- Battery to motor controller power cables (high current, keep short)
- Hall sensor cables from motors to controllers
- Signal wires from microcontroller to motor controllers

Keep high-current power wires (battery, motor) separated from signal wires (Hall sensors, I2C, SPI) to avoid electromagnetic interference.

## Weight Budget

A rover built on this frame will be heavy. Plan accordingly:

| Component | Approximate Weight |
|-----------|--------------------|
| Frame | 3-5 kg |
| Battery pack | 1-2 kg |
| Two hub motors | 2-3 kg each (4-6 kg total) |
| Electronics | 0.5 kg |
| **Total estimate** | **8.5-13.5 kg** |

The hub motors are designed to move a 100kg human on a hoverboard, so moving 10-15 kg of rover is well within their capability. The weight is actually an advantage for traction on rough terrain.

## Disassembly Notes

If you haven't fully disassembled the hoverboard yet:

1. Remove the outer plastic shell (screws on the bottom)
2. Disconnect the battery connector
3. Remove the gyroscope/control boards from each half (usually screwed to the footpad area)
4. Disconnect Hall sensor cables from each motor
5. Remove the original motor controller board
6. You're left with the bare frame, motors, and battery

Save all screws and small hardware — hoverboard fasteners are metric and the sizes are useful for reassembly.

---

Related Parts:
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — the motors this frame is designed to hold
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — the battery pack that fits the center compartment
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — motor controller for driving the hub motors
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — buck converter for powering control electronics from the 36V battery

Categories:
- [[actuators]]
