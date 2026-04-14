---
description: "BSS138 single-MOSFET-per-channel level shifter achieves bidirectional translation through two asymmetric mechanisms — gate-source threshold conduction in the LV-to-HV direction and parasitic body-diode conduction in the HV-to-LV direction — eliminating the need for direction-sensing logic entirely"
type: claim
source: "docs/parts/hw-221-8-channel-bidirectional-level-shifter-bss138-based.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[passives]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hw-221-level-shifter"
  - "txs0108e-level-shifter"
---

# BSS138 body diode makes level shifting bidirectional without direction control

The BSS138 single-MOSFET-per-channel circuit is bidirectional not because of any active logic, but because two completely different physical mechanisms happen to work in opposite directions. Understanding which mechanism runs in which direction explains both why the circuit works and why it has specific limitations (edge rate, max speed, I2C compatibility) that other shifters do not.

**LV drives LOW → MOSFET channel conducts:** The gate is tied to the LV rail. When LV-side signal pulls LOW, gate-source voltage (V_GS = V_rail - V_LOW) exceeds the BSS138 threshold (~1.5V). The MOSFET channel turns on, connecting LV-side to HV-side through the conducting drain-source path. The HV-side pull-up resistor's current flows through the channel to the LV driver, pulling the HV line LOW.

**HV drives LOW → body diode conducts:** When HV-side drives LOW, V_GS stays near zero (both gate and source at LV-rail initially), so the channel stays off. But the BSS138's parasitic body diode between drain and source conducts because the HV side (now ~0V) is below LV side minus one diode drop. The body diode pulls the LV side down to roughly V_HV + 0.6V, which is still low enough to register as logic LOW on the LV side. Once that happens, V_GS rises and the channel turns on too, sharpening the pulldown.

**Neither drives LOW → both pull HIGH:** With both drivers in high-impedance state (the default for open-drain signals like I2C between transactions), the LV and HV pull-ups each charge their respective side to their rail voltage independently.

This asymmetry has consequences. The channel-conduction direction is fast (MOSFET on-state is low-resistance). The body-diode direction is slower and drops ~0.6V — which is why BSS138 shifters are rated around 400kHz maximum despite BSS138 itself being a fast MOSFET. The body diode also draws some current continuously when HV is held LOW, which is one reason the circuit is unsuitable for high-frequency push-pull signals where one side is driven constantly.

Because no direction-sensing logic exists, there is nothing to get confused by a weak pull-up versus a hard driver — which is exactly why BSS138 shifters work on open-drain buses where [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] describes the failure mode of auto-direction chips.

---

Source: [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]

Relevant Notes:
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — contrasts with unidirectional active buffers
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — general rule this mechanism implements
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — the speed ceiling this mechanism produces
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — topology determines whether this mechanism is appropriate

Topics:
- [[shields]]
- [[passives]]
- [[eda-fundamentals]]
