---
_schema:
  entity_type: knowledge-note
  applies_to: knowledge/*.md
description: V = −L · di/dt says an inductor opposes change in current by generating a voltage proportional to how fast current changes...
type: reference
confidence: proven
topics:
- moc-electronics-math
- eda-fundamentals
- passives
---
# inductor flyback voltage v equals l di dt

**[beginner]** An inductor (coil of wire, relay coil, motor winding, solenoid) resists changes in the current flowing through it. If you try to turn that current off suddenly — by opening a switch or turning off a transistor — the inductor "fights back" by generating a voltage spike that tries to keep the current flowing. The formula is **V = L · di/dt**, where L is inductance in henries and di/dt is how fast the current is changing in amps-per-second. The minus sign (V = −L · di/dt in textbooks) indicates the spike *opposes* the change and thus opposes the supply polarity — that is where "flyback" comes from. Calculator card example: a 100 mH relay coil carrying 50 mA interrupted in 1 μs generates V = 0.1 · (0.05 / 0.000001) = 5000 V theoretical peak. In practice, the spike is clamped by whatever path it finds — an arc in the switch contacts, a zener diode, a flyback diode, or a transistor's breakdown voltage (destructively). This is why every relay, motor, and solenoid drive circuit needs a **flyback diode** across the coil: it gives the spike a safe return path.

**[intermediate]** The formula comes from Faraday's law applied to the inductor's geometry. An inductor stores energy in the magnetic field around its coil: **E = ½ · L · I²**. When current changes, the magnetic flux changes, and Faraday's law says a changing flux induces a voltage in any loop it threads: **V = −dΦ/dt**. Since flux is proportional to current for a linear inductor (Φ = L · I), the induced voltage is V = −L · (dI/dt). The minus sign is the statement of **Lenz's law** — the induced voltage opposes the change that caused it.

For a switch opening in series with an inductor, dI/dt is huge and negative (current dropping fast), so V is huge and positive in the sense that opposes the dropping current. That voltage appears across the switch gap (or across the transistor's drain-source, collector-emitter, etc.) and keeps rising until *something* breaks down and provides a current path. The spike energy comes from the inductor's stored magnetic energy: all ½ L I² has to go somewhere.

The **flyback diode** (also called freewheel diode, catch diode, or commutation diode) is placed antiparallel across the inductor — anode to the low side of the coil, cathode to the high side, so it does not conduct during normal operation. When the switch opens, the coil's induced voltage forward-biases the diode, and the inductor current "freewheels" through the diode loop, decaying exponentially with time constant L/R where R is the total loop resistance (diode plus coil plus any added resistance). Peak voltage is limited to Vf_diode ≈ 0.7 V (plus supply, on the other side of the coil) — about 10,000× lower than the uncontrolled spike.

The decay time matters in AC-mechanical applications. A relay with a simple flyback diode takes 10–100× longer to drop out than without, because the diode maintains the coil current until it dissipates — the armature stays pulled in. For fast-dropout relays, a zener or TVS in series with the diode sets a higher clamp voltage (e.g., 30–50 V) which absorbs the energy faster at the cost of requiring a transistor rated for that clamp voltage.

**[expert]** Four real-world details:

First, **motor drive is the big application**. A DC motor has a rotor winding inductance (tens to hundreds of μH for small brushed motors, mH for larger ones) and commutator-driven brushes that *repeatedly* make and break circuits inside the motor — every commutation produces a mini-flyback. This is why brushed motors generate spark, EMI, and commutator wear, and why motor drives need snubbers (RC networks) or clamp diodes across motor terminals even though the motor is not "switched off" globally. H-bridge drivers (L298N, TB6612, DRV8833) integrate flyback diodes on all four transistor corners for this reason. See [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] and [[tb6612-internal-flyback-diodes-eliminate-the-external-protection-burden-that-l298n-requires]] for the part-specific trade-offs.

Second, **diode recovery speed matters for fast-switching applications**. A 1N4007 (general-purpose rectifier) has a ~3 μs reverse recovery time — fine for relay coils switched manually, terrible for PWM motor drive at 20 kHz where the diode's slow recovery produces shoot-through currents through the transistor. Fast-recovery diodes (UF4007, ~75 ns) or Schottky diodes (trr = 0, but limited reverse voltage) are mandatory above a few kHz switching. Buck/boost converter designs specifically use Schottky catch diodes for this reason. A mismatched diode in a "just add flyback protection" fix can make the problem worse than no diode.

Third, **BJT base drive is a miniature flyback scenario**. A BJT base-emitter junction has parasitic inductance (a few nH of bond wires and PCB trace), and fast base-drive edges induce small flyback voltages that can drive the base below the emitter (reverse-biasing B-E, which is fine) or above VCE-sat (forward-biasing B-C, which is minority-carrier injection and slows the device). High-speed switching designs add base snubbers or Baker clamps for this. Not relay-scale important, but measurable in nanosecond-domain work.

Fourth, **the diode's energy rating**. A flyback diode must absorb the inductor's entire stored energy as heat if the load is a short-duty pulse — E = ½ L I². For a 1 H solenoid at 1 A, that is 500 mJ per release, potentially at 1 Hz (500 mW average). A small signal diode (1N4148, 500 mW rating at 25 °C, derated with pulse duty) would overheat; the 1N4007 (~1 W rating) is sized for this use specifically. Motor drives with larger inductance or higher currents need schottkys or TVS diodes explicitly rated in joules of surge energy, not just in volts and amps.

The same V = L · di/dt math runs in **reverse** too: switching-mode power supplies deliberately store energy in an inductor during the switch-on phase (V_L = V_in, di/dt = V_in / L positive) and dump it into the output during the switch-off phase via the catch diode. Buck converters, boost converters, and flyback transformer topologies (called flyback for this reason) are all productive uses of the same spike energy that flyback diodes in relay circuits dissipate as waste.

---

Relevant Notes:
- [[ohms-law-v-equals-i-times-r-derivation]] — V = IR is the resistive analog; V = L di/dt is the inductive analog
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] — H-bridge without internal flyback
- [[tb6612-internal-flyback-diodes-eliminate-the-external-protection-burden-that-l298n-requires]] — H-bridge with integrated flyback
- [[drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit]] — EDA rule for detecting this anti-pattern
- [[hardware-component-inductor-100-h]] — physical 100 μH inductor characteristics
- [[hardware-component-inductor-10-h]] — physical 10 μH inductor characteristics

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
