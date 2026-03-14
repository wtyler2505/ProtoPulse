# OmniTrek Nexus Wiring Diagram: Motor Controllers to Wheel Motors

## Document Overview

This document provides detailed wiring instructions for connecting the four RioRand 350W BLDC Motor Controllers to the four hoverboard wheel motors in the OmniTrek Nexus rover system. This covers the high-current phase connections and the Hall sensor feedback wiring from each motor.

## Motor Specifications

### Hoverboard BLDC Motor Characteristics

The OmniTrek Nexus uses four identical hoverboard-style brushless DC motors, one at each wheel position.

**Electrical Specifications:**
- Nominal voltage: 36V DC
- Rated power: 350W continuous
- Peak power: 500W (short duration)
- No-load current: 0.8-1.2A
- Rated current: 10A continuous
- Maximum current: 15A (peak)
- No-load speed: 180-220 RPM (wheel direct drive)
- Pole pairs: 15 (typical hoverboard motor)
- Resistance per phase: 0.3-0.5Ω

**Physical Specifications:**
- Motor type: Hub motor (wheel integrated)
- Tire diameter: 6.5-10 inches (depending on model)
- Mounting: Axle-through with side brackets
- Weight: 2-3 kg per motor

### Motor Wire Identification

Each hoverboard motor has two cable bundles:

**Power Cable Bundle (3 thick wires):**
- Wire gauge: 14-16 AWG (thick)
- Colors typically: Yellow, Green, Blue
- Purpose: Three-phase AC power from controller
- Current capacity: 15A+ per wire

**Hall Sensor Cable Bundle (5 thin wires):**
- Wire gauge: 22-24 AWG (thin)
- Colors typically: Red (VCC), Black (GND), Yellow (A), Green (B), Blue (C)
- Purpose: Rotor position feedback for commutation
- Signal voltage: 5V logic

**Important:** Wire colors vary by manufacturer. Always verify with multimeter before connecting.

## Phase Wire Connections

### Understanding Three-Phase Motor Wiring

BLDC motors use three-phase power. The controller commutates current through the phases based on Hall sensor feedback. Phase wire order determines rotation direction.

**Phase Wiring Principles:**
- Any two phases swapped = reverse rotation direction
- Incorrect phase order = erratic/jerky motion or no rotation
- Phase wires carry high current - use proper gauge wire

### Controller to Motor Phase Wiring

**RioRand Controller Phase Outputs:**
| Terminal | Label | Wire Color (typical) |
|----------|-------|----------------------|
| U | Phase A | Yellow |
| V | Phase B | Green |
| W | Phase C | Blue |

**Standard Connection (assumes correct motor rotation):**

```
RioRand MC                    Hoverboard Motor
    Phase Terminals               Phase Wires
┌─────────────────┐           ┌──────────────────┐
│                 │           │                  │
│    U (Yellow)  ●│───────────│● Yellow (Phase A)│
│                 │           │                  │
│    V (Green)   ●│───────────│● Green (Phase B) │
│                 │           │                  │
│    W (Blue)    ●│───────────│● Blue (Phase C)  │
│                 │           │                  │
└─────────────────┘           └──────────────────┘
```

### Direction Reversal via Phase Swap

If motor rotates in wrong direction, swap any two phase wires:

**Reversed Connection (swap V and W):**

```
RioRand MC                    Hoverboard Motor
    Phase Terminals               Phase Wires
┌─────────────────┐           ┌──────────────────┐
│                 │           │                  │
│    U (Yellow)  ●│───────────│● Yellow (Phase A)│
│                 │           │                  │
│    V (Green)   ●│─────┐ ┌───│● Green (Phase B) │
│                 │     │ │   │                  │
│    W (Blue)    ●│─────┼─┘   │                  │
│                 │     │     │                  │
│                 │     └─────│● Blue (Phase C)  │
│                 │           │                  │
└─────────────────┘           └──────────────────┘
```

### Phase Wire Specifications

| Parameter | Specification |
|-----------|---------------|
| Wire Gauge | 14 AWG minimum (12 AWG recommended) |
| Wire Type | Stranded copper, high-temp rated |
| Insulation | Silicone or XLPE (heat resistant) |
| Maximum Length | 24 inches (shorter = better efficiency) |
| Connector Type | Bullet connectors (5.5mm) or screw terminals |
| Current Rating | 20A minimum continuous |

### Phase Wire Color Coding per Motor

To maintain organization across all four motors:

**MC1 (Front-Left):**
- Phase U: Yellow with black heat shrink marker
- Phase V: Green with black heat shrink marker
- Phase W: Blue with black heat shrink marker

**MC2 (Front-Right):**
- Phase U: Yellow with white heat shrink marker
- Phase V: Green with white heat shrink marker
- Phase W: Blue with white heat shrink marker

**MC3 (Rear-Left):**
- Phase U: Yellow with red heat shrink marker
- Phase V: Green with red heat shrink marker
- Phase W: Blue with red heat shrink marker

**MC4 (Rear-Right):**
- Phase U: Yellow with gray heat shrink marker
- Phase V: Green with gray heat shrink marker
- Phase W: Blue with gray heat shrink marker

## Hall Sensor Connections

### Hall Sensor Pin Identification

**Standard Hoverboard Motor Hall Connector (JST 5-pin):**
```
     ┌─────────────────────────┐
     │  1    2    3    4    5  │
     │  ●    ●    ●    ●    ●  │
     └─────────────────────────┘
        │    │    │    │    │
       VCC  GND  HA   HB   HC
       Red  Blk  Yel  Grn  Blu
```

**Wire Functions:**
| Pin | Function | Typical Color | Voltage |
|-----|----------|---------------|---------|
| 1 | VCC (5V power) | Red | 5V DC |
| 2 | GND (ground) | Black | 0V |
| 3 | Hall A output | Yellow | 0-5V logic |
| 4 | Hall B output | Green | 0-5V logic |
| 5 | Hall C output | Blue | 0-5V logic |

### Controller Hall Sensor Terminals

**RioRand 350W Hall Sensor Terminals:**
```
┌─────────────────────────────────────┐
│  HALL SENSOR INPUT TERMINALS       │
│                                     │
│  5V  GND  HA   HB   HC              │
│   ●   ●    ●    ●    ●              │
└─────────────────────────────────────┘
```

### Hall Sensor Wiring Diagram

**Complete Hall Sensor Connection (per motor):**

```
RioRand Motor Controller              Hoverboard Motor
    Hall Terminals                    Hall Sensor Wires
┌──────────────────────┐           ┌───────────────────────┐
│                      │           │                       │
│ 5V OUT ●─────────────│───────────│─────● VCC (Red)       │
│                      │           │                       │
│ GND    ●─────────────│───────────│─────● GND (Black)     │
│                      │           │                       │
│ HALL-A ●─────────────│───────────│─────● Hall A (Yellow) │
│                      │           │                       │
│ HALL-B ●─────────────│───────────│─────● Hall B (Green)  │
│                      │           │                       │
│ HALL-C ●─────────────│───────────│─────● Hall C (Blue)   │
│                      │           │                       │
└──────────────────────┘           └───────────────────────┘
```

### Hall Sensor Extension Wiring

For rear motors requiring cable extension:

**Shielded Cable Specification:**
- Cable type: 5-conductor shielded
- Conductor gauge: 22 AWG stranded
- Shield type: Braided copper
- Maximum extension: 36 inches

**Extension Wiring:**
```
Motor Hall         Extension Cable              Controller
Connector          (Shielded 5-cond)            Hall Terminals
    │                                               │
VCC ●────────────────[Red]──────────────────────────● 5V OUT
GND ●────────────────[Black]────────────────────────● GND
HA  ●────────────────[Yellow]───────────────────────● HALL-A
HB  ●────────────────[Green]────────────────────────● HALL-B
HC  ●────────────────[Blue]─────────────────────────● HALL-C
                         │
                     [Shield]─────────────────────────● GND (one end only)
```

**Shield Grounding:**
- Connect shield to ground at controller end only
- Do not ground shield at motor end (prevents ground loop)
- Use heat shrink to insulate exposed shield

## Complete Motor-to-Controller Diagram

### All Four Motors Complete Wiring

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                   MOTOR CONTROLLER TO WHEEL MOTOR WIRING                        ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONT AXLE                                      │
├────────────────────────────────────┬────────────────────────────────────────────┤
│            MC1 (Front-Left)        │            MC2 (Front-Right)               │
│                                    │                                            │
│  ┌──────────────┐   PHASE WIRES    │   PHASE WIRES    ┌──────────────┐         │
│  │              │   ═══════════    │   ═══════════    │              │         │
│  │   RioRand    │──U──[Yel]────┐   │   ┌────[Yel]──U──│   RioRand    │         │
│  │   350W MC    │──V──[Grn]────┼───┼───┼────[Grn]──V──│   350W MC    │         │
│  │              │──W──[Blu]────┼───┼───┼────[Blu]──W──│              │         │
│  │              │              │   │   │              │              │         │
│  │  ┌─────────┐ │   HALL WIRES │   │   │  HALL WIRES  │ ┌─────────┐  │         │
│  │  │ 5V  GND │ │   ──────────  │   │   │  ──────────  │ │ 5V  GND │  │         │
│  │  │  ●   ●  │─┼─5V──[Red]───┼───┼───┼───[Red]──5V─┼─│  ●   ●  │  │         │
│  │  └─────────┘ │ GND──[Blk]──┼───┼───┼───[Blk]──GND│ │ └─────────┘  │         │
│  │  ┌─────────┐ │  HA──[Yel]──┼───┼───┼───[Yel]──HA │ │ ┌─────────┐  │         │
│  │  │HA HB HC │ │  HB──[Grn]──┼───┼───┼───[Grn]──HB │ │ │HA HB HC │  │         │
│  │  │ ●  ●  ● │─┤  HC──[Blu]──┼───┼───┼───[Blu]──HC─├─│ ● ●  ●  │  │         │
│  │  └─────────┘ │              │   │   │              │ └─────────┘  │         │
│  └──────────────┘              │   │   │              └──────────────┘         │
│                                ▼   │   ▼                                        │
│                         ┌─────────┐│┌─────────┐                                 │
│                         │ MOTOR 1 │││ MOTOR 2 │                                 │
│                         │  (FL)   │││  (FR)   │                                 │
│                         │   ⟳     │││     ⟳   │                                 │
│                         │  ◄──    │││   ──►   │                                 │
│                         └─────────┘│└─────────┘                                 │
├────────────────────────────────────┼────────────────────────────────────────────┤
│                                    │                                            │
│                               CHASSIS                                           │
│                                    │                                            │
├────────────────────────────────────┼────────────────────────────────────────────┤
│                                 REAR AXLE                                       │
├────────────────────────────────────┬────────────────────────────────────────────┤
│            MC3 (Rear-Left)         │            MC4 (Rear-Right)                │
│                                    │                                            │
│  ┌──────────────┐   PHASE WIRES    │   PHASE WIRES    ┌──────────────┐         │
│  │              │   ═══════════    │   ═══════════    │              │         │
│  │   RioRand    │──U──[Yel]────┐   │   ┌────[Yel]──U──│   RioRand    │         │
│  │   350W MC    │──V──[Grn]────┼───┼───┼────[Grn]──V──│   350W MC    │         │
│  │              │──W──[Blu]────┼───┼───┼────[Blu]──W──│              │         │
│  │              │              │   │   │              │              │         │
│  │  ┌─────────┐ │  HALL WIRES  │   │   │  HALL WIRES  │ ┌─────────┐  │         │
│  │  │ 5V  GND │ │  (SHIELDED)  │   │   │  (SHIELDED)  │ │ 5V  GND │  │         │
│  │  │  ●   ●  │─┼─5V══[Red]═══┼───┼───┼═══[Red]═══5V─┼─│  ●   ●  │  │         │
│  │  └─────────┘ │ GND══[Blk]══┼───┼───┼═══[Blk]═══GND│ │ └─────────┘  │         │
│  │  ┌─────────┐ │  HA══[Yel]══┼───┼───┼═══[Yel]═══HA │ │ ┌─────────┐  │         │
│  │  │HA HB HC │ │  HB══[Grn]══┼───┼───┼═══[Grn]═══HB │ │ │HA HB HC │  │         │
│  │  │ ●  ●  ● │─┤  HC══[Blu]══┼───┼───┼═══[Blu]═══HC─├─│ ● ●  ●  │  │         │
│  │  └─────────┘ │              │   │   │              │ └─────────┘  │         │
│  └──────────────┘              │   │   │              └──────────────┘         │
│                                ▼   │   ▼                                        │
│                         ┌─────────┐│┌─────────┐                                 │
│                         │ MOTOR 3 │││ MOTOR 4 │                                 │
│                         │  (RL)   │││  (RR)   │                                 │
│                         │   ⟳     │││     ⟳   │                                 │
│                         │  ◄──    │││   ──►   │                                 │
│                         └─────────┘│└─────────┘                                 │
└─────────────────────────────────────┴───────────────────────────────────────────┘

Legend:
═══ = Shielded cable (for rear motor Hall sensors)
─── = Standard wire
⟳ = Motor rotation direction (both left motors same, both right motors same)
```

## Motor Phase Testing Procedure

### Before Connecting to Controller

**Step 1: Phase Resistance Test**
1. Disconnect motor from controller
2. Set multimeter to resistance (Ω) mode
3. Measure resistance between each phase pair:
   - Phase A to Phase B: Expected 0.6-1.0Ω
   - Phase B to Phase C: Expected 0.6-1.0Ω
   - Phase A to Phase C: Expected 0.6-1.0Ω
4. All three readings should be approximately equal
5. Unequal readings indicate phase winding damage

**Step 2: Phase Continuity to Ground**
1. Measure resistance from each phase to motor housing
2. Expected: Open circuit (infinite resistance)
3. Low resistance indicates insulation failure - do not use motor

**Step 3: Hall Sensor Power Test**
1. Connect Hall sensor VCC to 5V supply
2. Connect Hall sensor GND to ground
3. Current draw should be 10-20mA per sensor (30-60mA total)
4. Excessive current indicates Hall sensor damage

**Step 4: Hall Sensor Signal Test**
1. Power Hall sensors with 5V
2. Slowly rotate motor by hand
3. Monitor Hall A, B, C signals with multimeter or logic analyzer
4. Each sensor should toggle between 0V and 5V as motor rotates
5. Pattern should be 6 state changes per electrical revolution

### Hall Sensor Sequence Verification

The Hall sensors produce a specific sequence as the motor rotates. Incorrect sequence causes erratic motor behavior.

**Normal Hall Sensor Sequence (120° spacing):**
```
Rotation ──►

        ┌───┐   ┌───┐   ┌───┐   ┌───┐
Hall A: │   │   │   │   │   │   │   │
        ┘   └───┘   └───┘   └───┘   └───

            ┌───┐   ┌───┐   ┌───┐   ┌───
Hall B: ────┘   └───┘   └───┘   └───┘   └

    ───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐
Hall C:    └───┘   └───┘   └───┘   └───┘   

State:   1   2   3   4   5   6   1   2   3...
```

**6-State Hall Pattern:**
| State | Hall A | Hall B | Hall C | Binary |
|-------|--------|--------|--------|--------|
| 1 | HIGH | LOW | HIGH | 101 |
| 2 | HIGH | LOW | LOW | 100 |
| 3 | HIGH | HIGH | LOW | 110 |
| 4 | LOW | HIGH | LOW | 010 |
| 5 | LOW | HIGH | HIGH | 011 |
| 6 | LOW | LOW | HIGH | 001 |

**Invalid States (indicates wiring error):**
- 000 (all low) - sensor disconnected or not powered
- 111 (all high) - sensor disconnected or shorted

## Troubleshooting Guide

### Motor Does Not Spin

**Check Phase Connections:**
1. Verify all three phase wires connected
2. Check for loose bullet connectors
3. Test phase resistance (should be 0.6-1.0Ω between phases)

**Check Hall Sensors:**
1. Verify 5V power to Hall sensors
2. Verify ground connection
3. Check Hall signal levels while rotating by hand
4. Ensure all three Hall signals reach controller

**Check Controller:**
1. Verify controller has 36V power
2. Check controller enable/PWM signal from NodeMCU
3. Verify direction signal is at valid level
4. Ensure brake signal is LOW (not engaged)

### Motor Runs Erratically (Jerky Motion)

**Hall Sensor Order Wrong:**
1. Motor commutation depends on correct Hall sequence
2. Try swapping Hall A and Hall C
3. If still wrong, try swapping Hall A and Hall B
4. There are 6 possible combinations - test systematically

**Phase Wire Order Wrong:**
1. If Hall order is correct but motor still jerky
2. Swap any two phase wires
3. Motor should now run smoothly

### Motor Spins Wrong Direction

**Software Solution (Preferred):**
Change direction signal polarity in firmware

**Hardware Solution (Phase Swap):**
Swap any two of the three phase wires at controller

**Hardware Solution (Hall Swap):**
Swap Hall A and Hall C to reverse commutation sequence

### Motor Overheats

**Check Phase Connections:**
1. Loose connections cause resistance heating
2. Inspect all bullet connectors
3. Ensure proper crimp on terminals

**Check Current Draw:**
1. Measure current at motor controller
2. Normal operating current: 5-10A
3. Stall current: 15-20A
4. Reduce load if overheating persists

**Check Controller Settings:**
1. Some controllers have current limit adjustment
2. Ensure limit is set appropriately
3. Check for proper heatsinking on controller

### Single Motor Failure

**Isolation Test:**
1. Swap suspected motor with known working motor
2. If problem follows motor → motor damaged
3. If problem stays with position → controller or wiring issue

**Visual Inspection:**
1. Check motor wires for damage
2. Inspect Hall sensor cable
3. Look for melting or discoloration
4. Check for water ingress

## Wire Connection Summary Table

### Phase Wire Connections

| Motor | Controller | Phase A (U) | Phase B (V) | Phase C (W) |
|-------|------------|-------------|-------------|-------------|
| Motor 1 (FL) | MC1 | Yellow to Yellow | Green to Green | Blue to Blue |
| Motor 2 (FR) | MC2 | Yellow to Yellow | Green to Blue* | Blue to Green* |
| Motor 3 (RL) | MC3 | Yellow to Yellow | Green to Green | Blue to Blue |
| Motor 4 (RR) | MC4 | Yellow to Yellow | Green to Blue* | Blue to Green* |

*Right-side motors have V and W swapped for correct rotation direction (assuming left/right mirror mounting)

### Hall Sensor Connections

| Motor | Controller | VCC | GND | Hall A | Hall B | Hall C |
|-------|------------|-----|-----|--------|--------|--------|
| Motor 1 (FL) | MC1 | Red→5V | Blk→GND | Yel→HA | Grn→HB | Blu→HC |
| Motor 2 (FR) | MC2 | Red→5V | Blk→GND | Yel→HA | Grn→HB | Blu→HC |
| Motor 3 (RL) | MC3 | Red→5V | Blk→GND | Yel→HA | Grn→HB | Blu→HC |
| Motor 4 (RR) | MC4 | Red→5V | Blk→GND | Yel→HA | Grn→HB | Blu→HC |

## Verification Checklist

### Per-Motor Verification

**Motor 1 (Front-Left):**
- [ ] Phase wires connected (U, V, W)
- [ ] Phase resistance measured and recorded
- [ ] Hall sensor power verified (5V)
- [ ] Hall sensor signals tested (rotate by hand)
- [ ] Motor spins in correct direction
- [ ] Motor runs smoothly (no jerking)
- [ ] Temperature stable under load

**Motor 2 (Front-Right):**
- [ ] Phase wires connected (V and W swapped for direction)
- [ ] Phase resistance measured and recorded
- [ ] Hall sensor power verified (5V)
- [ ] Hall sensor signals tested
- [ ] Motor spins in correct direction (opposite to Motor 1)
- [ ] Motor runs smoothly
- [ ] Temperature stable under load

**Motor 3 (Rear-Left):**
- [ ] Phase wires connected (U, V, W)
- [ ] Shielded cable used for Hall extension
- [ ] Hall sensor power verified (5V)
- [ ] Hall sensor signals tested
- [ ] Motor spins in same direction as Motor 1
- [ ] Motor runs smoothly
- [ ] Temperature stable under load

**Motor 4 (Rear-Right):**
- [ ] Phase wires connected (V and W swapped)
- [ ] Shielded cable used for Hall extension
- [ ] Hall sensor power verified (5V)
- [ ] Hall sensor signals tested
- [ ] Motor spins in same direction as Motor 2
- [ ] Motor runs smoothly
- [ ] Temperature stable under load
