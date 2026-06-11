---
slug: shunt-current-sensing
title: Shunt current sensing
ercCodes: []
---

## What it is

Put a deliberately small resistor in the current path, measure the voltage across it, and Ohm's law hands you the current. The whole craft is choosing how small "small" is, and reading the tiny voltage honestly.

## Why it bites

Size the shunt by feel and it bites from both ends. Too large, and the shunt becomes a heater and a voltage thief: at full load it drops enough volts to starve the thing it's measuring, and dissipates real watts — [power-and-heat](power-and-heat) applies, and so does derating from [resistor-power-sizing](resistor-power-sizing). Too small, and your full-scale signal is millivolts riding on a noisy board — amplifier offset and ground bounce swamp it, and the firmware reads plausible-looking garbage. Placement bites separately: a low-side shunt (in the ground return) is easy to amplify but lifts the load's "ground" above the real one — every signal shared with that load now has a current-dependent offset, the third meaning in [ground-three-meanings](ground-three-meanings). High-side sensing keeps grounds honest but needs an amplifier rated for the common-mode voltage. And wherever you put it, *where the sense wires tap* the shunt decides whether you measure the shunt or the solder — that's [kelvin-connections](kelvin-connections).

## The numbers

Work the budget in this order. Pick a full-scale sense voltage — 50mV to 100mV is the classic window, large enough to amplify cleanly, small enough not to rob the load. Divide by full-scale current: 5A at 50mV gives 10mΩ. Then check the heat: P = I²R = 25 × 0.01 = 0.25W, so a quarter-watt part sits at its limit — size up. Then check the math survives tolerance: a 5% shunt caps your accuracy at 5% before the amplifier adds its share.

## See it

Track 5, step 5 walks exactly this: size a shunt for the motor stage, amplify it, and co-sim a stall event — the firmware current limit trips on the amplified shunt voltage, which is the whole point of having one.

## Go deeper

Related: [kelvin-connections](kelvin-connections), [power-and-heat](power-and-heat), [ground-three-meanings](ground-three-meanings), [non-inverting-and-inverting-amps](non-inverting-and-inverting-amps), [resistor-power-sizing](resistor-power-sizing). Curriculum: Track 5 "Moving Things", step 5 — shunt sizing and the stall-trip co-sim. Canonical reference: any current-sense amplifier datasheet's shunt-selection section.
