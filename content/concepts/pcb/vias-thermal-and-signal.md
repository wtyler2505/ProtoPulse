---
slug: vias-thermal-and-signal
title: Vias — thermal and signal
ercCodes: []
---

## What it is

A via is a plated hole connecting copper layers — a tiny tube of copper, not a solid post. It has resistance, inductance, and a current rating, and it conducts heat as well as electrons, which makes it both a wiring element and a thermal one.

## Why it bites

Two distinct failures. Power: you route 3A from F.Cu to B.Cu through a single small via, it runs hot, the plating degrades over thermal cycles, and months later the board develops an intermittent that comes and goes with temperature — the worst kind of bug. Thermal: a power regulator or MOSFET with a tab pad needs to dump heat into the bottom copper, and without vias under the pad the heat has nowhere to go; the part hits thermal shutdown at half its rated load and you blame the part ([power-and-heat](power-and-heat), [thermal-runaway](thermal-runaway)). Bonus bite: thermal vias under a pad can drink your solder down the barrel during reflow, starving the joint.

## The numbers

Order-of-magnitude figures, hedge included: a typical small via is roughly half a milliohm to a few milliohms of resistance and roughly a nanohenry of inductance — negligible alone, decisive when one via carries a switcher's return. Current: a standard ~0.3mm via is good for roughly an amp with modest temperature rise; don't push past that, parallel them instead — vias are cheap, use several. Thermal vias under a pad: a grid of them, and more helps with diminishing returns. Ground stitching vias every centimetre or two tie the two sides' pours together so returns ([return-paths](return-paths)) don't detour. JLCPCB's 2-layer deck floor: 0.3mm minimum drill, 0.13mm minimum annular ring — ProtoPulse's DRC enforces both.

## See it

ProtoPulse's PCB editor places vias during routing between F.Cu and B.Cu, and the DRC (JLCPCB deck) checks drill size and annular ring on every one. Try routing a power net through one via versus three in parallel — the editor won't score it thermally, but the habit is the point. Stitch your B.Cu ground pour to F.Cu copper and watch the isolated-island DRC check go quiet.

## Go deeper

Related: [annular-rings](annular-rings) (the via's manufacturing margin), [trace-width-vs-current](trace-width-vs-current), [zones-and-thermal-reliefs](zones-and-thermal-reliefs), [return-paths](return-paths), [impedance-vs-resistance](impedance-vs-resistance) (why a via's nanohenry matters at speed). Curriculum: Track 6 "First Board" — via budgeting for the power stage is an explicit step. Canonical reference: your fab's capability page for drill/plating limits, and IPC-2152's via-current guidance.
