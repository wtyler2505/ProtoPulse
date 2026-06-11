---
slug: inrush-limiting
title: Inrush limiting
ercCodes: []
---

## What it is

Inrush is the current surge at the instant of power-on, when every discharged bulk capacitor on your board momentarily looks like a short circuit. Inrush limiting is the discipline of making the first few milliseconds survivable — for fuses, switches, connectors, and whatever upstream supply you're plugging into.

## Why it bites

The board is innocent in steady state and guilty at the instant of connection. Symptoms: a USB hub that disconnects *everything* the moment your board is plugged in, because the surge dragged the shared 5V rail down past every device's tolerance; a fuse that "nuisance-blows" only at power-on and never during operation; a power switch whose contacts pit and weld over months of starting sparks; a current-limited bench supply that hiccups into foldback and never finishes starting your board. The physics is bare: I = C·dV/dt, and with a hard source and discharged capacitors, dV/dt at contact is enormous — the only things limiting the spike are source impedance, wiring, and ESR, none of which you chose deliberately.

## The numbers

The stored-energy bill is fixed — charging C to V always moves charge Q = C·V — but the *peak* current is yours to shape: spread the same charge over more time and the spike collapses. The standard tools: an NTC thermistor in series (cold resistance of a few ohms swallows the spike, then it heats and gets out of the way), the soft-start built into most modern regulators (which ramps the output over typically milliseconds — datasheet number), or deliberate series resistance where the steady current is small. Context that bites makers: USB hosts expect limited capacitance hanging directly on VBUS — on the order of 10µF for the legacy spec — so big bulk behind a soft-started regulator beats big bulk on the connector.

## See it

In the sim, connect 1000µF through 50mΩ of wiring to a stiff 5V source and watch the ammeter spike to tens of amps for a fraction of a millisecond. Add a 5Ω series resistance standing in for a cold NTC and re-run: the spike collapses to about an amp, the capacitor still charges, nothing notices.

## Go deeper

Related: [ntc-inrush-limiting](ntc-inrush-limiting), [bulk-capacitance](bulk-capacitance), [fusing-and-ptc](fusing-and-ptc), [esr-and-why-it-matters](esr-and-why-it-matters). Curriculum: Track 3 "Power", step 5 — simulate the mistake first. Canonical reference: your regulator datasheet's soft-start section and the NTC datasheet's resistance-vs-temperature curve.
