---
slug: op-amp-golden-rules
title: The op-amp golden rules
ercCodes: []
---

## What it is

With negative feedback in place, an ideal op-amp obeys two rules: the inputs draw no current, and the output does whatever it must to make the two inputs equal. Every standard op-amp circuit — amplifier, buffer, filter — is just those two rules plus Ohm's law.

## Why it bites

The rules bite when you forget they're *conditional*. They hold only while negative feedback is active and the output can actually move — so the moment the output hits a supply rail, the rules are off, the inputs split apart, and your tidy gain equation describes a circuit that no longer exists. The classic symptom: an amplifier that's accurate mid-range but flatlines near the rails, because the op-amp isn't rail-to-rail (most aren't, and "rail-to-rail" outputs still stop tens of millivolts short under load — datasheet). Second bite: violating the *input* common-mode range — many older op-amps can't accept inputs near one or both rails, and respond not with clipping but with garbage, sometimes inverting their behavior entirely. Third: "no input current" is an idealization. Bipolar-input op-amps draw real bias current, and with the megohm resistors that beginners love, that current becomes a real offset voltage that the golden rules never predicted.

## The numbers

Hedged, because op-amps span decades: input bias current runs from picoamps (CMOS/JFET inputs) to nanoamps or worse (bipolar) — times a 1MΩ source, 10nA is 10mV of error. Open-loop gain is huge but finite, and gain-bandwidth product is the budget you spend: a 1MHz GBW part configured for gain 100 is flat only to roughly 10kHz. Output current limits are modest, commonly in the tens of milliamps — an op-amp is not a driver. Every one of these is a datasheet number, never a guess.

## See it

In the sim, build a gain-of-10 non-inverting stage on a single 3.3V supply and feed it 0.5V: the output dutifully shows 5V minus reality — it parks at the rail. Watch the virtual-short collapse on the input pins the instant the output saturates.

## Go deeper

Related: [non-inverting-and-inverting-amps](non-inverting-and-inverting-amps), [comparators-and-hysteresis](comparators-and-hysteresis), [impedance-vs-resistance](impedance-vs-resistance), [reading-a-datasheet](reading-a-datasheet). Curriculum: Track 7 "Build the Probe" — the analog front end is golden-rules applied. Canonical reference: any op-amp datasheet's input common-mode and output-swing tables, read against the ideal model.
