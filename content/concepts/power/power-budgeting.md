---
slug: power-budgeting
title: Power budgeting
ercCodes: []
---

## What it is

A power budget is the unglamorous table that sums the worst-case current of every part on every rail and checks each supply can deliver it with margin. It's done before the build, because afterward the budget audits itself — by failing.

## Why it bites

Every individual part is fine; the sum is not. The classic: a WiFi module that idles at a polite few tens of milliamps but pulls a transmit burst of hundreds — so the board works perfectly until it joins the network, then browns out, every time, and the bug report says "crashes when WiFi connects." Two traps feed this. First, budgeting from the datasheet's "typical" column instead of its maximum and peak figures — typical is a marketing average, peaks are what sag your rail. Second, the USB illusion: treating a computer port as an infinite 5V source when it is a current-limited one. A third, quieter trap: a boost converter draws *more* current from its input than it delivers at its output, so budgeting a boosted rail by output current undercounts the drain on the source.

## The numbers

Sum worst-case peaks per rail, then derate: common practice loads a supply to no more than about 80% of its rating sustained — convention, not law, but a kind one. For a linear regulator, input current ≈ output current, and the headroom becomes heat you must also budget. For a boost, input current ≈ output current × Vout/Vin ÷ efficiency. Peak coincidence matters: budget the moment when the motor stalls *while* the radio transmits, because shipping products find that moment.

## See it

ProtoPulse makes the table executable: declare each part's draw as a constraint and the ERC totals them per rail against the declared source — the current-budget finding fires before the brownout does. Track 3, step 3 walks exactly this.

## Go deeper

Related: [power-and-heat](power-and-heat), [linear-regulator-dropout](linear-regulator-dropout), [boost-topology-intuition](boost-topology-intuition), [battery-sag-under-load](battery-sag-under-load). Curriculum: Track 3 "Power", step 3 — declare draws as constraints, watch ERC total them. Canonical reference: each part datasheet's operating-current table, maximum column, and supply-current-vs-activity curves.
