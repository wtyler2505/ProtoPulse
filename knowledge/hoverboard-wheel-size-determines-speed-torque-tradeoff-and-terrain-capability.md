---
description: "6.5-inch (indoor, standard), 8-inch (rough surfaces), 10-inch (off-road, pneumatic option) -- larger wheel means more torque and weight but less RPM, and only the 10-inch offers air-filled tires"
type: claim
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
confidence: high
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# hoverboard wheel size determines speed-torque tradeoff and terrain capability

Hoverboard hub motors come in three standard wheel diameters. All share the same basic electrical design (3-phase BLDC, 5-wire Hall cable, 36V nominal) but differ in mechanical characteristics that directly affect rover and robot builds:

| Wheel Size | Diameter | Weight | No-load RPM (36V) | Torque | Tire Type | Best For |
|-----------|----------|--------|-------------------|--------|-----------|----------|
| 6.5 inch | ~165mm | ~2.5 kg | ~200-250 | Standard | Solid rubber | Indoor robots, smooth surfaces |
| 8 inch | ~200mm | ~3.0 kg | ~180-220 | Higher | Solid rubber | Mixed terrain, outdoor robots |
| 10 inch | ~254mm | ~3.5 kg | ~150-200 | Highest | Solid or pneumatic | Off-road, heavy rovers |

The speed-torque tradeoff follows from basic physics: a larger wheel diameter means more torque at the ground contact point (longer lever arm) but lower wheel RPM for the same motor electrical speed. Weight increases roughly linearly with diameter.

The 10-inch variant is significant because it is sometimes available with pneumatic (air-filled) tires instead of solid rubber. Pneumatic tires provide better traction and shock absorption on rough terrain, which matters for outdoor rovers. The tradeoff is puncture risk -- solid rubber tires on the 6.5 and 8-inch variants are zero-maintenance.

For the OmniTrek rover project, the 6.5-inch solid rubber motors are in the inventory. These are appropriate for the initial build (primarily flat surfaces) but would limit off-road capability. A future terrain upgrade path would be swapping to 10-inch pneumatic wheels -- the electrical interface is identical, so the controller wiring doesn't change, only the mechanical mounting.

**For ProtoPulse:** When a user selects hoverboard hub motors, the AI should ask about intended terrain and recommend the appropriate wheel size. The BOM should capture wheel diameter as a distinct parameter since it affects ground clearance, top speed, and terrain capability without changing the electrical design.

---

Source: [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]

Relevant Notes:
- [[outrunner-hub-motors-eliminate-mechanical-transmission-by-making-the-wheel-the-rotor]] -- wheel size selection is the main mechanical design choice when the wheel IS the motor
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- heavier wheels (10-inch) increase inertia and peak current during acceleration

Topics:
- [[actuators]]
- [[eda-fundamentals]]
