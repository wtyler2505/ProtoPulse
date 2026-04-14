---
description: "Active level shifters like the TXS0108E detect a rising edge on either side and fire a brief one-shot pulse that actively drives the opposite rail, replacing the passive RC charge path that caps BSS138 shifters near 400kHz — this is the mechanism that enables 110Mbps push-pull operation on a chip otherwise similar in footprint to a BSS138 module"
type: claim
source: "docs/parts/txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[communication]]"
  - "[[eda-fundamentals]]"
related_components:
  - "txs0108e-level-shifter"
  - "hw-221-level-shifter"
---

# Active level shifters use one-shot edge accelerators to drive rising edges breaking the BSS138 RC ceiling

The 250x bandwidth gap between BSS138-based shifters (400kHz) and TXS0108E-class shifters (110Mbps push-pull) is not a MOSFET-speed difference. Both chips use fast MOSFETs internally. The difference is whether rising edges are driven or charged — and only one mechanism scales into the megahertz range.

**BSS138 rising edges are RC-charged, not driven:** since [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]], the BSS138 topology pulls the line LOW through an active MOSFET channel or body diode, but the rising edge is produced entirely by the pull-up resistor charging bus capacitance. This RC time constant is the bandwidth ceiling — see [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] for the math. No amount of MOSFET speed-up helps because the MOSFET is not involved in the rising edge.

**TXS0108E rising edges are actively driven by one-shot pulses:** the chip watches both sides for an edge. When it detects a rising edge on one side, it fires a brief one-shot pulse that actively drives the corresponding side HIGH through a low-impedance output driver. The pulse lasts only long enough to charge the bus capacitance; after it expires, a weaker pull-up holds the line. The result is a near-push-pull rising edge with no dependence on an external pull-up resistor. Falling edges are similarly accelerated.

**Why this requires direction sensing:** the one-shot must fire on the correct side — the side that is NOT the original driver. If it fired on the driving side, the chip would fight its own signal. This forces the TXS0108E to track which side drove the edge first and fire the accelerator on the opposite side. That direction inference is exactly what [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] describes as failing on I2C — the mechanism that makes the chip fast on push-pull is the same mechanism that makes it broken on open-drain.

**The consequence for selection:** the choice between BSS138-class and TXS-class is not "slow vs fast in general" — it is a structural decision about whether rising edges need to be driven. Push-pull signals often drive their own rising edges, so either shifter works electrically, but the TXS preserves edge rate while BSS138 degrades it. Open-drain signals cannot drive their own rising edges (that is what makes them open-drain), so the pull-up IS the rising-edge mechanism on the bus — and the TXS's one-shot conflicts with that. This is why the topology decision cascades: driven-edge signals get TXS, pulled-edge signals get BSS138.

---

Source: [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]

Relevant Notes:
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] — the RC ceiling this mechanism breaks
- [[bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control]] — the passive topology this contrasts with
- [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] — why the same mechanism that enables speed breaks open-drain compatibility
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the selection framework this mechanism slots into
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the unidirectional alternative that also uses active drive

Topics:
- [[shields]]
- [[communication]]
- [[eda-fundamentals]]
