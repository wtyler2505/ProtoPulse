---
description: "4-motor total peak draw (~60A) exceeds typical hoverboard BMS trip point (30-40A) -- either upgrade the BMS or implement firmware current limiting to prevent sudden shutdown"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: high
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# four-motor BLDC systems exceed standard hoverboard BMS ratings requiring firmware current limiting

When building a 4WD rover with four hoverboard hub motors (like OmniTrek), the total peak current draw exceeds the ratings of standard hoverboard battery management systems. The math is straightforward:

| Parameter | Per Motor | 4-Motor Total |
|-----------|-----------|---------------|
| Continuous current | 8-10A | 32-40A |
| Peak current | ~15A | ~60A |
| Continuous power | 250W | 1,000W |
| Peak power | 350W | 1,400W |

A standard hoverboard BMS is designed for a 2-motor system and typically trips at 30-40A total. Using its battery pack to drive 4 motors means the BMS will trip under peak load conditions (hill climbing, acceleration from stop, hitting obstacles), causing sudden power loss -- a dangerous condition for a rover carrying expensive electronics.

The solutions form a hierarchy, from free-and-software-only to full-architecture-change:

1. **Staggered motor startup (free, timing-only)**: Offset each motor's start command by 100ms so inrush peaks do not stack. Eliminates trips on the launch transient without touching hardware or sensing. See [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection]]. Often combined with a per-motor ramp-up that spreads the individual inrush peak itself.
2. **Firmware current limiting** (cheap, needs sensor): Program the MCU to monitor total system current and throttle PWM duty cycle before the BMS trip point. Requires current sensing on the battery bus (e.g., ACS712 or INA219). Addresses sustained-load trips, not just inrush.
3. **BMS upgrade** (moderate): Replace the hoverboard BMS with a higher-rated unit (60A+ continuous) designed for the actual 4-motor load. Requires matching the battery cell configuration (10S for 36V).
4. **Dual battery packs** (most headroom): Two hoverboard battery packs, each driving two motors through its own BMS. Doubles capacity and halves per-BMS current draw.

The key insight is that most nuisance trips come from inrush during simultaneous start commands, not from sustained overload. Staggered startup alone resolves most cases without requiring current sensing hardware. Firmware current limiting becomes necessary only when sustained load (not just launch transients) approaches the BMS threshold, which usually means the pack is genuinely undersized for the drive profile and a hardware upgrade is the right long-term fix.

This is a system-level constraint that emerges only when you scale beyond the original hoverboard's 2-motor design. The BOM and architecture tools should flag it when a user adds more than 2 BLDC motors to a 36V system with a single battery pack.

**Hardware mitigation parts — the protection stack that complements firmware limiting:**

Firmware current limiting is the software layer; the matching hardware layer at the 60A+ scale uses two specific parts:

- **ANL 100A slow-blow fuse** ([[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc|why ANL class for this bus]]): Sized at roughly 125-150% of expected peak (60A peak → 100A fuse) so nuisance trips do not occur during motor acceleration while still protecting wiring against a dead short. ATC/Maxi automotive blade fuses cannot safely interrupt this level of DC fault current — their rated interrupt capacity is for 32V automotive systems, not a 42V rover bus.
- **Albright SW200 contactor** (200A continuous, 36-48V DC coil): The high-current-capable e-stop replacement for panel-mount pushbuttons. Panel e-stops in the 16-22mm pushbutton form factor top out around 10A and cannot break 60A+ DC without welding the contacts. The SW200's 200A continuous rating provides ~3x margin above peak draw and is specifically designed for DC inductive loads (forklifts, mobility scooters, rover bases). The firmware-aware [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal|auxiliary contact pattern]] applies directly: a small signal contact on the SW200 drives the MCU input while the main contacts interrupt the motor bus.

Together these form a three-layer stack: firmware throttles before BMS trips (graceful degradation), SW200 breaks the main bus on an e-stop (commanded interruption), and the ANL fuse is the last line of defense against a short circuit the contactor cannot react to fast enough.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]
Enriched from: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- this is the high-power tier (6-60V) where BMS sizing becomes critical
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] -- the 16A ZS-X11H is per-motor; system-level current is the sum
- [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection]] -- the cheapest mitigation, applicable to 2-motor and 4-motor systems alike

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
