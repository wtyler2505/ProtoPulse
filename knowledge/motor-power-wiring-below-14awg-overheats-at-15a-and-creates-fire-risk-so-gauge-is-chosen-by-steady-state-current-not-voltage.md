---
description: "Wire gauge is set by the I2R heating the conductor dissipates, not by the voltage it carries — 22AWG bundles that safely carry a 36V logic rail at 100mA melt under the 15A steady-state phase current of a single BLDC motor, so motor power wiring demands 14AWG minimum regardless of how the signal wires around it are sized"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
  - "[[actuators]]"
---

# Motor power wiring below 14AWG overheats at 15A and creates fire risk so gauge is chosen by steady-state current not voltage

The voltage a wire carries has no effect on how hot it gets; the current does. This is why a 22AWG signal wire happily carries a 36V level-shifted Hall pulse at 10mA and why the same wire melts its insulation when a 15A motor phase current flows through it — both runs are at 36V, only the current changed. Wire sizing follows the AWG ampacity table, which maps conductor cross-section to a safe continuous current based on the temperature rise the insulation will tolerate.

For the 15A steady-state current of a ZS-X11H-driven hoverboard motor phase, the relevant ampacity limits are:

| Gauge | Ampacity (chassis wiring, 30°C ambient) | ZS-X11H motor phase verdict |
|-------|----------------------------------------|------------------------------|
| 22AWG | 7A | **Unsafe** — melts at 15A continuous, fire risk |
| 18AWG | 16A | Marginal — no thermal headroom, degrades over time |
| 16AWG | 22A | Acceptable for 15A rated, 20A peak — no margin |
| 14AWG | 32A | **Minimum recommended** — comfortable margin on steady 15A, survives 20A peaks |
| 12AWG | 41A | Better for bundled runs or high ambient temperature |

The 14AWG rule for motor phase wiring is not conservative over-engineering. A 22AWG wire at 15A dissipates I²R = 15² × 0.016 ohm/ft = 3.6W per foot — the wire visibly glows in dark conditions within 30 seconds. 14AWG at the same current dissipates 0.56W/ft, which the insulation sheds through convection without heating past 60°C. The factor between them is 6.4x — the square of the current times the resistance-per-length ratio.

This is the same principle that [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity|the power-budget hierarchy]] enforces at the fuse-versus-ampacity row: every fuse must sit under the wire's ampacity, because the wire is what the fuse is protecting. If the wire is 22AWG, no amount of correct fuse sizing can save it — the 15A fuse that would blow at 20A is itself rated above the 7A the wire can tolerate.

Three wiring classes on a rover have distinct ampacity demands that cannot be substituted for each other:

- **Motor phase wires** (15A continuous, 20A peak): 14AWG minimum, 12AWG preferred for runs longer than 1 foot or for bundled wiring where heat cannot escape.
- **Battery main bus** (60-85A for 4-motor rover): 6AWG minimum, 4AWG preferred — the peak current is four times a single motor's and the conductor cross-section must scale with it.
- **Control signal wires** (50mA PWM, Hall pulses, UART): 22-24AWG is correct, because the current is three orders of magnitude smaller. Using 14AWG here wastes weight and makes bundles impractical.

The beginner mistake the source names explicitly is running a full hoverboard-motor phase on the same thin wire used for the PWM signal. The result is a fire hazard that takes effect on the first few minutes of steady operation — the short test runs that prototype builders do first may never trigger it, making the failure mode delayed and hard to attribute. This is why [[beginners-need-ai-that-catches-mistakes-before-money-is-spent|beginners need DRC tooling]] that enforces gauge selection against inferred current load before the project is built.

---

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]]

Relevant Notes:
- [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]] — wire ampacity is the ceiling of the four-number hierarchy
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] — fuse class selection that matches the main-bus wire gauge
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — where 4x motor current drives the main-bus ampacity requirement

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
- [[actuators]]
