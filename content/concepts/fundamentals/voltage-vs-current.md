---
slug: voltage-vs-current
title: Voltage vs current
ercCodes:
  - ERC-OUTPUT-POWERS-PIN
  - ERC-POWER-UNSOURCED
---

## What it is

Voltage is the push between two points; current is the flow that results when something conducts between them. A supply sets the push, but the circuit — not the supply — decides the flow.

## Why it bites

You wire a 3V coin cell straight to an LED, it flares bright, and it's dead in minutes. The battery never "sent" too much current — your circuit asked for it, because nothing in the path limited the flow. The same confusion shows up later as a microcontroller pin browning out a sensor: a logic output can push the right *voltage* while having no business sourcing the *current* a supply pin demands. That's exactly what the ERC flags when an output feeds a power pin.

## The numbers

A red LED drops roughly 1.8–2.2V; blue and white sit around 2.8–3.4V. Past that drop, current climbs steeply — a fraction of a volt of extra push can multiply the flow. Typical small MCU pins are rated for about 20–40mA absolute maximum (check your part's datasheet — families differ), while a sensor's supply pin may demand far more at startup. The rule of thumb: voltage ratings tell you what won't break down; current ratings tell you what won't burn. Neither number alone describes your circuit's behavior — the limit comes from whatever resistance or regulation you put in the path.

## See it

Place a battery and an LED with nothing in between, then run the sim and watch the current readout scream past the LED's 20mA rating. Now insert a 220Ω resistor and re-run: the voltage across the LED barely changes, but the current collapses to a safe value. One part changed; push stayed, flow obeyed.

## Go deeper

Related: [ohms-law-in-practice](ohms-law-in-practice), [power-and-heat](power-and-heat), [series-vs-parallel](series-vs-parallel). Curriculum: Track 1 "First Light", step 1 (first-light-01). Canonical reference: Horowitz & Hill, *The Art of Electronics*, ch. 1.
