---
slug: bulk-capacitance
title: Bulk capacitance
ercCodes: []
---

## What it is

Bulk capacitance is the big reservoir — tens to thousands of microfarads — that holds a rail up over microseconds-to-milliseconds events: load steps, regulator response gaps, input ripple. Local decoupling handles the nanosecond gulps; bulk handles the slow heave.

## Why it bites

The symptom has a signature: the board resets exactly when *the thing* activates. A servo starts moving, an SD card begins a write, a radio keys up its transmit burst — and the rail dips faster than the regulator can respond, the MCU browns out, and you're rebooting. The regulator isn't broken; it simply has a finite response time, and for those first microseconds the only thing holding the rail up is stored charge. USB power sharpens the bite: a long thin cable adds real resistance and inductance between you and the source, so transient demand has to come from capacitance on *your* board. The reverse bite exists too — pile on too much bulk and the inrush at plug-in trips the upstream port's current limit before your circuit even starts.

## The numbers

The reservoir math is exact: ΔV = I·Δt / C. An extra 100mA drawn for 1ms from 470µF sags the rail about 0.21V; from 47µF, ten times that. On top of the droop, ESR adds an instant step of I × ESR the moment the load hits — more farads won't fix a resistance problem. Hedges that matter: aluminum electrolytics lose capacitance and gain ESR as they age and as they get cold, so a budget that barely clears at 25°C fails in winter. Size for the worst documented load pulse, then add margin.

## See it

In the sim, step a load from 50mA to 500mA for 1ms on a rail held by 47µF, then by 470µF, each with explicit series resistance. Watch the droop shrink tenfold with the capacitance — and watch the instant ESR step refuse to move until you lower the resistance instead.

## Go deeper

Related: [local-decoupling](local-decoupling), [esr-and-why-it-matters](esr-and-why-it-matters), [inrush-limiting](inrush-limiting), [battery-sag-under-load](battery-sag-under-load). Curriculum: Track 3 "Power", step 2 — the bulk half of the rail-bounce demo. Canonical reference: your capacitor datasheet's capacitance-vs-temperature and ESR tables.
