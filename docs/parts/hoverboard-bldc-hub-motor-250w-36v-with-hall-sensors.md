---
description: "Salvaged hoverboard hub motor — 250-350W brushless DC, 36V nominal, 3-phase with Hall effect position sensors. Built into 6.5-inch wheel, ~15A peak draw"
topics: ["[[actuators]]"]
status: needs-test
quantity: 2
voltage: [36]
interfaces: [3-Phase, Hall]
manufacturer: "Generic (hoverboard salvage)"
pinout: |
  Motor Phase Wires (thick, 3):
    Yellow → Phase A
    Green  → Phase B
    Blue   → Phase C
  Hall Sensor Cable (thin, 5):
    Red    → 5V (Hall power)
    Black  → GND
    Yellow → Hall A
    Green  → Hall B
    Blue   → Hall C
compatible_with: ["[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]"]
used_in: []
warnings: ["36V system — dangerous voltage, observe safety precautions", "Phase wire order matters — wrong order = motor spins backward or vibrates violently", "Hall sensor cable is delicate — strain relief recommended", "~15A peak draw — requires properly rated wiring (14AWG minimum for motor phases)"]
datasheet_url: ""
---

# Hoverboard BLDC Hub Motor 250W 36V with Hall Sensors

Salvaged brushless DC hub motors from a hoverboard — each motor is built into a 6.5-inch wheel, so the wheel IS the motor. These are outrunner-style BLDCs: the outer shell (and tire) spins around a fixed stator. No gearbox, no belt, no external moving parts. Quiet, reliable, and surprisingly powerful for their size.

Each motor is rated 250-350W (hoverboard manufacturers are... flexible with specs) and runs on 36V nominal (42V fully charged from a 10S lithium pack). At full load they pull around 10-15A, so your controller and wiring need to handle that.

The motors have Hall effect sensors built in, which means you get position feedback for proper commutation — no sensorless startup shudder. The Hall sensors output a 3-bit Gray code that tells the controller exactly where the rotor is, so it can energize the right phase at the right time.

## Specifications

| Spec | Value |
|------|-------|
| Type | Brushless DC (BLDC), outrunner hub motor |
| Power Rating | 250-350W (manufacturer varies) |
| Nominal Voltage | 36V (10S lithium, 30-42V operating range) |
| Peak Current | ~15A |
| Continuous Current | ~8-10A |
| Phases | 3 (trapezoidal commutation) |
| Hall Sensors | 3x latching Hall effect (120 degree spacing) |
| Hall Supply | 5V |
| Wheel Diameter | 6.5 inches (~165mm) |
| Tire | Solid rubber (no punctures, no air) |
| Pole Pairs | Typically 15 (30 magnets) |
| Max RPM | ~200-300 RPM (no-load, depends on voltage) |
| KV Rating | ~8-10 RPM/V (estimated) |
| Weight | ~2.5-3kg per motor (including wheel) |

## Power Rating Note

Hoverboard motor manufacturers are notoriously loose with ratings. The same physical motor may be listed as 250W, 350W, or even 500W depending on the seller. In practice, these motors are typically rated 250W continuous and 350W peak. For project planning, use the conservative 250W continuous figure but size your controller and wiring for the 350W peak.

## 4-Motor Configuration for 4WD Rover

In a 4WD rover build (like OmniTrek), four of these motors are used — one per wheel. Key considerations:

| Parameter | Per Motor | 4-Motor Total |
|-----------|-----------|---------------|
| Continuous current | 8-10A | 32-40A |
| Peak current | ~15A | ~60A |
| Continuous power | 250W | 1,000W |
| Peak power | 350W | 1,400W |
| Weight | ~2.5-3kg | ~10-12kg |

The 4-motor total peak draw of ~60A exceeds typical hoverboard BMS ratings (usually 30-40A). Either upgrade the BMS or implement firmware current limiting to keep total draw below BMS trip point.

## Hall Sensor Electrical Angle

The Hall sensors are spaced at **120 electrical degrees** apart (standard BLDC configuration). This is the electrical angle, not the mechanical angle — with 15 pole pairs, 120 electrical degrees corresponds to only 8 mechanical degrees. The 120-degree spacing produces the 6-step commutation sequence that the [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] uses to drive the motor phases.

## Wheel Size Variants

Hoverboard hub motors come in several wheel diameters. All share the same basic electrical design (3-phase BLDC, 5-wire Hall cable) but differ in mechanical specs:

| Wheel Size | Overall Diameter | Tire Width | Weight (approx.) | Speed (no load, 36V) | Torque | Use Case |
|-----------|-----------------|-----------|-------------------|---------------------|--------|----------|
| 6.5 inch | ~165mm | ~45mm | ~2.5 kg | ~200-250 RPM | Standard | Original hoverboard, indoor robots |
| 8 inch | ~200mm | ~50mm | ~3.0 kg | ~180-220 RPM | Higher | Rough surfaces, outdoor robots |
| 10 inch | ~254mm | ~65mm | ~3.5 kg | ~150-200 RPM | Highest | Off-road, heavy rovers, pneumatic option |

The 10-inch variant is sometimes available with a pneumatic (air-filled) tire instead of solid rubber. Pneumatic tires give better traction and shock absorption on rough terrain but can puncture. The motors we have are 6.5-inch with solid rubber tires.

## Hall Sensor Electrical Specifications

The built-in Hall effect sensors provide rotor position feedback for commutation. Understanding their electrical behavior matters when debugging or designing custom controllers.

| Parameter | Value |
|-----------|-------|
| Sensor Type | Latching Hall effect (bipolar) |
| Supply Voltage | 4.5-5.5V (typically 5V from controller's 78L05) |
| Output Type | Open collector (needs pull-up to VCC) |
| Output HIGH | 4.5-5V (pulled up to supply through internal/external resistor) |
| Output LOW | < 0.4V (transistor saturation) |
| Maximum Switching Frequency | ~100 kHz |
| Physical Spacing | 120 electrical degrees apart |

### Position Encoding

The 3 Hall sensors produce a 6-state Gray code per electrical revolution. For a motor with 10 pole pairs (20 magnets, which is common — some hoverboard motors have 15 pole pairs):

| Parameter | 10 Pole Pairs | 15 Pole Pairs |
|-----------|--------------|--------------|
| Electrical revolutions per mechanical revolution | 10 | 15 |
| Hall state changes per electrical revolution | 6 | 6 |
| Hall state changes per mechanical revolution | 60 | 90 |
| Commutation resolution | 6 degrees electrical | 6 degrees electrical |
| Position resolution | 6 degrees mechanical | 4 degrees mechanical |

To determine your motor's pole pair count: slowly rotate the wheel by hand while counting Hall state transitions (connect Hall outputs to Arduino digital pins and log changes). One full wheel rotation = (6 x pole_pairs) state changes. If you count 90 transitions, you have 15 pole pairs.

## Wire Identification

### Motor Phase Wires (Thick, ~14-16 AWG)

These carry the high-current 3-phase power. Color coding is common but NOT standardized across all hoverboard brands.

| Wire Color | Typical Assignment | Notes |
|-----------|-------------------|-------|
| Yellow | Phase A | Thick silicone wire |
| Green | Phase B | Thick silicone wire |
| Blue | Phase C | Thick silicone wire |

**Phase order determines direction.** Swapping any two phase wires reverses the motor direction. If the motor vibrates violently instead of spinning, the phase/Hall alignment is wrong — see troubleshooting below.

### Hall Sensor Cable (Thin, 5-wire JST connector)

The Hall sensor cable is a thin ribbon or bundle with a 5-pin JST connector. These wires are delicate — add strain relief.

| Wire Color | Function | Notes |
|-----------|----------|-------|
| Red | 5V supply | Powers all 3 Hall sensors |
| Black | GND | Common ground |
| Yellow | Hall A | Digital output, corresponds to Phase A |
| Green | Hall B | Digital output, corresponds to Phase B |
| Blue | Hall C | Digital output, corresponds to Phase C |

Hall sensors output 5V logic (open-drain with pull-up to their supply voltage). They produce a 3-bit Gray code pattern as the rotor turns:

## Hall Sensor Commutation Sequence

As the motor rotates through one electrical cycle (360 electrical degrees), the Hall sensors produce this pattern:

| Step | Hall A | Hall B | Hall C | Binary | Decimal | Active Phases |
|------|--------|--------|--------|--------|---------|--------------|
| 1 | 1 | 0 | 1 | 101 | 5 | A+, C- |
| 2 | 0 | 0 | 1 | 001 | 1 | B+, C- |
| 3 | 0 | 1 | 1 | 011 | 3 | B+, A- |
| 4 | 0 | 1 | 0 | 010 | 2 | C+, A- |
| 5 | 1 | 1 | 0 | 110 | 6 | C+, B- |
| 6 | 1 | 0 | 0 | 100 | 4 | A+, B- |

**Note:** The exact sequence depends on your motor's internal winding. If you get vibration instead of rotation, the phase-to-Hall mapping needs adjustment (swap phase wires until it runs smoothly).

States 0 (000) and 7 (111) should never occur — if you see them, a Hall sensor is broken or disconnected.

## Wiring to Controller

The [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] is the matched controller for these motors. Connect:

| Motor Wire | Controller Terminal | Notes |
|-----------|-------------------|-------|
| Phase Yellow | MA (Motor A) | Match phase to Hall — if motor vibrates, swap two phase wires |
| Phase Green | MB (Motor B) | |
| Phase Blue | MC (Motor C) | |
| Hall Red | 5V (Hall supply) | Controller provides 5V from onboard 78L05 |
| Hall Black | GND | Common ground with controller and MCU |
| Hall Yellow | HA | |
| Hall Green | HB | |
| Hall Blue | HC | |

## Troubleshooting

**Motor vibrates but doesn't spin:**
The phase wires don't match the Hall sensor mapping. The controller is energizing the wrong phase for the rotor position. Fix: swap any two motor phase wires (e.g., swap Yellow and Green). There are 6 possible phase/Hall combinations — 3 spin forward, 3 spin backward, and wrong pairings vibrate.

**Motor spins backward:**
Swap any two phase wires to reverse direction. Or use the Z/F (direction) input on the controller if available.

**Motor stutters at low speed:**
Hall sensor connection issue. Check the thin Hall cable for broken wires, especially at solder joints. A loose Hall connection causes intermittent commutation errors.

**Motor runs but makes grinding noise:**
Usually a bearing issue, not electrical. The hub motor bearings are pressed in and can be replaced, but it's fiddly. Check for foreign objects between rotor and stator.

**One Hall sensor reads constant HIGH or LOW:**
Dead Hall sensor. The motor can still run on 2 of 3 Hall sensors with some controllers (sensorless fallback), but performance degrades. Replacement requires opening the motor.

## Warnings

- **36V is dangerous** — can cause burns and fire if short-circuited. Use appropriate fuses (20A automotive fuse inline with battery).
- **Phase wire order matters** — wrong order causes violent vibration, not just wrong direction. Don't trial-and-error this at full voltage; test at low duty cycle first.
- **Hall sensor cable is delicate** — the thin wires break at solder joints. Add strain relief (hot glue, heat shrink) immediately.
- **15A peak draw** — use 14AWG minimum for phase wires, 16AWG for short runs. Undersized wire = fire hazard.
- **These motors are heavy** (~3kg each) — secure them properly in any build. A spinning motor that breaks free is a projectile.
- **No datasheet** — specs are estimated from hoverboard teardowns and testing. Always bench-test before relying on published power ratings.

---

Related Parts:
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] -- the controller that drives these motors
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] -- the battery pack these motors were designed for

Categories:
- [[actuators]]
