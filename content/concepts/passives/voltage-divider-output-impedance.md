---
slug: voltage-divider-output-impedance
title: Voltage dividers and their output impedance
ercCodes: []
---

## What it is

Two resistors make a voltage divider, and the formula Vout = Vin × R2/(R1+R2) is the first one every maker learns. The part nobody mentions: that output comes with a built-in source resistance — R1 in parallel with R2 — and the divider only tells the truth to loads that don't disturb it.

## Why it bites

You divide 12V down to 6V with two 10k resistors, connect "6V" to something that draws current, and measure 4V — the load formed a third resistor in your divider and rewrote the math. The modern version of this bite is the ADC: you scale a battery voltage with a high-value divider to save current, and the readings come back noisy and low. The ADC's input briefly connects a small internal sampling capacitor that must charge through your divider's output impedance; a weak divider can't fill it in time, and the conversion reads the shortfall. Same circuit, perfect on the meter (which is patient), wrong in the code (which is not).

## The numbers

Output impedance is R1∥R2 = R1·R2/(R1+R2), exactly — two 10k resistors give 5k. The working rule, with its limit stated: a load at least ten times the output impedance sags the output by under about 10%; for measurement-grade accuracy you want a much larger ratio or a buffer. For ADCs, many microcontroller datasheets recommend keeping source impedance around 10kΩ or less — the exact figure varies by chip and sample time, so check yours — or parking a capacitor (100nF is a common choice) directly on the ADC pin to act as a local charge reservoir. The divider also burns standing power, Vin²/(R1+R2): the eternal tradeoff is stiffness against battery drain.

## See it

Build the 10k/10k divider on 12V in the sim: 6.0V open. Hang a 10k load on the output and watch it drop to 4.0V — exactly what the three-resistor math predicts. Re-run with a 1k/1k divider and the same load: about 5.7V. Stiffer source, smaller lie.

## Go deeper

Related: [ohms-law-in-practice](ohms-law-in-practice), [series-vs-parallel](series-vs-parallel), [rc-time-constants](rc-time-constants). Curriculum: not yet bound to a track step — the `adc-jitter-06` failure puzzle is this concept wearing a disguise. Canonical reference: your MCU datasheet's ADC input-impedance and sample-time section.
