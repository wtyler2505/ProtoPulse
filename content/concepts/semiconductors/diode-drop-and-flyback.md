---
slug: diode-drop-and-flyback
title: Diode drop and flyback
ercCodes: []
---

## What it is

A diode conducts one way and charges a toll — the forward drop, around 0.6–0.7V for ordinary silicon. Its most heroic job is the flyback diode: parked across a relay coil or motor, it gives the coil's stored energy a safe path when the switch opens, instead of letting it become a voltage spike that kills your transistor.

## Why it bites

The drop bites first in low-voltage designs: put a protection diode in series with a 3.3V supply and your rail is now ~2.6V, below spec for half your parts — the diode "worked" and broke everything downstream. Flyback bites harder. An inductor's current cannot stop instantly; V = L·(di/dt) says that if you force di/dt with an opening switch, the coil makes whatever voltage it takes to keep current flowing — easily tens or hundreds of volts across a small relay coil. Skip the diode and the spike punches through your transistor or feeds straight back into an MCU pin. The classic symptom: the relay clicks fine for weeks, then the driver transistor dies "randomly" — each click was a small lightning strike, and one finally landed.

## The numbers

Silicon forward drop is typically 0.6–0.7V at modest current, rising with current and falling roughly 2mV per °C as the junction warms — that tempco is textbook physics and the reason hot diodes drop less. The spike math is V = L·(di/dt), exact and merciless: interrupt 100mA in a microsecond through a 100mH coil and the arithmetic says ten kilovolts is being attempted; reality clamps lower through arcing and breakdown, but well past any transistor's rating. With a flyback diode, the coil sees just one diode drop above the rail, and its current decays harmlessly through the loop. The tradeoff, stated: a plain diode makes relays release a little slower; that's usually fine.

## See it

In the sim, drive a relay coil model from a transistor and open the switch with no diode: the collector voltage spikes far past the rail. Add the flyback diode across the coil and re-run — the spike flattens to a polite bump one drop above supply.

## Go deeper

Related: [schottky-vs-silicon](schottky-vs-silicon), [body-diode](body-diode), [voltage-vs-current](voltage-vs-current). Curriculum: Track 5 "Moving Things", step 2 — you kill the virtual transistor first, then fix it. Canonical reference: Horowitz & Hill, *The Art of Electronics*, diode and inductive-load sections.
