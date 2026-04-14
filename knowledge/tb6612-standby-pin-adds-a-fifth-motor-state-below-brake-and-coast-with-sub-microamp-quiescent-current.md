---
description: "The TB6612's STBY pin gates all outputs at a level deeper than brake or coast, dropping the IC to under 1uA quiescent draw — this is a true sleep state, not a high-impedance stop, and it exists on MOSFET drivers because MOSFETs can power-gate while Darlington drivers cannot"
type: claim
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
related_components:
  - "osepp-tb6612-motor-shield"
---

# TB6612 standby pin adds a fifth motor state below brake and coast with sub-microamp quiescent current

The L293D and L298N truth tables have four motor states: forward, reverse, brake, coast. The TB6612 adds a fifth state gated by its dedicated STBY pin. When STBY is pulled LOW, all four output transistors turn off AND the internal logic, bias circuits, and gate drivers shut down. Quiescent current drops below 1uA. When STBY is HIGH, the four normal states work per the H-bridge truth table. This is not redundant with coast — coast leaves the internal circuitry powered and just holds outputs low.

**Why this state exists on MOSFET drivers but not Darlington drivers:** Darlington bias circuits require continuous current to keep the transistors ready to switch. An L298N in "quiescent" state still draws tens of milliamps through its internal reference circuitry — there is no practical "off" state short of cutting VM entirely. MOSFETs require only gate voltage to be held; with gate drivers disabled and gate-source clamped low, a MOSFET H-bridge draws nanoamps of leakage. The STBY pin exists because MOSFET topology PERMITS it; adding an equivalent to an L298N would not save meaningful current.

**Practical battery-powered implication:** For a battery-powered robot that idles between movements, pulling STBY LOW during idle saves milliamps over leaving the driver in coast state. For a rover with 1-hour active duty and 23-hour standby (field sensing, remote monitoring), the standby draw dominates total energy budget. Using the STBY pin extends battery runtime by orders of magnitude compared to L298N-based shields, which must use external power switching (MOSFET in VM path) to achieve equivalent idle current.

**GPIO cost of STBY:** The pin must be actively driven — on most TB6612 shields it is tied to a GPIO because leaving it floating leaves outputs disabled (the failsafe default). This consumes one additional GPIO beyond the 6 required for two-channel PWM+direction control. Some shield variants include a jumper to tie STBY HIGH permanently, which sacrifices the standby capability for one more free GPIO. Check the jumper before assuming STBY is software-controllable.

**Integration with the brake/coast logic:** The full state hierarchy becomes:
- STBY = HIGH, IN1 = H, IN2 = L: Forward
- STBY = HIGH, IN1 = L, IN2 = H: Reverse
- STBY = HIGH, IN1 = H, IN2 = H: Brake (dynamic stop)
- STBY = HIGH, IN1 = L, IN2 = L: Coast (free-run)
- STBY = LOW, IN1 = X, IN2 = X: Standby (sub-uA sleep)

This extends the analysis in [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] with a third distinct "stop" mode that has meaningful different semantics: brake actively opposes motion, coast lets inertia decide, standby powers down the driver itself. Choosing between brake and coast affects motion; choosing standby vs either affects energy budget.

---

Source: [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]

Relevant Notes:
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] — standby is a third distinct stop mode that L298N cannot offer
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — the MOSFET architecture that enables the standby state
- [[stepper-holding-current-draws-continuous-power-even-when-stationary-making-de-energize-logic-essential-for-battery-projects]] — similar battery-motivated de-energize pattern at the stepper level
- [[active-level-shifters-draw-continuous-quiescent-current-unlike-passive-bss138-shifters-with-near-zero-idle-draw]] — parallel principle: MOSFET-based parts frequently permit deep sleep that bipolar parts cannot

Topics:
- [[actuators]]
- [[power-systems]]
