---
slug: ntc-inrush-limiting
title: NTC thermistors and inrush limiting
ercCodes: []
---

## What it is

An NTC thermistor is a resistor whose resistance falls as it heats up — Negative Temperature Coefficient. That makes it a self-removing brake: cold at power-on, it limits the first surge of current; seconds later it has heated itself into a near-short and stops costing you efficiency.

## Why it bites

Big capacitors look like dead shorts at the instant of power-on, so a supply with serious bulk capacitance can pull a brutal inrush spike — the symptom is breakers that trip on plug-in, connectors that spark and pit, USB ports that brown out, or an upstream fuse that dies young for no steady-state reason. An inrush NTC in series tames the spike. But the cure has its own teeth: the NTC only limits while *cold*. Power-cycle the device quickly and the still-hot thermistor is still low-resistance, so the second inrush arrives unbraked — the classic "it only blows the fuse when I flick it off and on fast." NTCs also dissipate continuously while running; in always-on gear, designs often bypass them with a relay after startup.

## The numbers

The cold (25°C) resistance printed on an inrush NTC is the brake: peak inrush is roughly Vin divided by that cold resistance plus whatever else is in the loop — Ohm's law at the worst instant. Hot, a typical inrush part falls to a small fraction of an ohm to a few ohms depending on the part and the current through it; the datasheet's R-vs-current curve is the spec. Two ratings matter and aren't interchangeable: maximum steady-state current (thermal survival) and maximum capacitive load at a given voltage (energy survival during the surge). Cool-down to full braking takes on the order of tens of seconds to a minute for many parts — that's the power-cycle trap, quantified by the datasheet's recovery-time figure.

## See it

In the sim, switch a supply into a large bulk capacitor through nothing but wiring: the current spike at t=0 is bounded only by parasitics. Add a 10Ω series resistance — the cold NTC — and watch the spike collapse to Vin/10Ω and the capacitor charge as a gentle RC instead.

## Go deeper

Related: [power-and-heat](power-and-heat), [resistor-power-sizing](resistor-power-sizing), [rc-time-constants](rc-time-constants). Curriculum: Track 3 "Power", step 5 — reverse polarity and inrush, simulated before protected. Canonical reference: an inrush-NTC datasheet's R-vs-current and recovery-time curves.
