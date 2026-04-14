---
description: "Auto-direction level shifters like the TXS0108E draw around 100uA of quiescent supply current per side even with no signal activity because their edge-detection logic runs continuously, while BSS138-based pull-up shifters draw essentially zero quiescent current from the supply rails because the shifter is passive MOSFETs and the only current flow is through pull-up resistors when a line is driven LOW — this makes the shifter class a battery-life decision, not just a speed decision"
type: claim
source: "docs/parts/txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[power]]"
  - "[[eda-fundamentals]]"
related_components:
  - "txs0108e-level-shifter"
  - "hw-221-level-shifter"
---

# Active level shifters draw continuous quiescent current unlike passive BSS138 shifters with near-zero idle draw

The standard framing of the level-shifter choice is speed vs topology: TXS for fast push-pull, BSS138 for slow open-drain. A third axis that rarely surfaces in vendor comparisons is idle power draw, and it matters whenever the target is battery-powered or uses MCU deep-sleep modes.

**The numerical gap:** the TXS0108E draws roughly 100uA quiescent current when no signals are switching — the edge-detection and one-shot logic runs continuously because the chip cannot know when an edge might arrive. The BSS138-based HW-221 draws essentially zero quiescent current from its supply rails because the MOSFETs are off when no line is being pulled LOW, and the pull-up resistors dissipate power only while sinking into a driven-LOW pin.

**Why this matters for deep-sleep budgets:** since [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]], an ESP32 at 10uA can run for months on a coin cell. Adding a TXS0108E on the same rail adds 100uA — 10x the MCU's own sleep current. The total sleep draw becomes dominated by the level shifter, collapsing battery life from months to weeks. This is not a theoretical concern — it is the default outcome when a developer drops in a TXS to bridge a 5V sensor to a 3.3V low-power MCU without checking the shifter's quiescent spec.

**Why BSS138 is different:** BSS138 shifters have no active logic. The MOSFET gates are held at VCC through the source connection; the drain-source channel is OFF when the line is idle HIGH (both sides pulled up). No current flows through the MOSFET. The only sink is the pull-up resistors, and pull-ups on an idle-HIGH I2C bus dissipate nothing. The whole shifter is electrically invisible at idle.

**The selection consequence:** the shifter decision now has three axes, not two:

| Axis | BSS138 wins | TXS0108E wins |
|------|-------------|---------------|
| Signal topology | open-drain (I2C) | push-pull (SPI, Hall) |
| Speed | <400kHz | >1MHz to 110Mbps |
| Idle current (battery/sleep) | near-zero | ~100uA |

**When the axes conflict:** a battery-powered device with push-pull signals (a Hall-sensor motor on a LiPo) needs both TXS-class speed and BSS-class idle draw. The resolution is usually to power the TXS through a switchable rail (GPIO-gated LDO or PMOS switch) so the shifter is completely off during sleep and only powered when the motor system is active. The alternative — hard-wiring the TXS to always-on supply — silently destroys battery life. This interaction is the kind of cross-concern that only shows up when quiescent current is included as a first-class selection axis alongside topology and speed.

---

Source: [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]

Relevant Notes:
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — the mechanism that consumes the quiescent current
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the selection framework this adds a third axis to
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — the passive architecture that produces near-zero idle draw
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] — the low-power baseline the TXS disrupts
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] — broader pattern of auxiliary parts dominating sleep current
- [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]] — same passive-vs-active tradeoff in a different part class

Topics:
- [[shields]]
- [[power]]
- [[eda-fundamentals]]
