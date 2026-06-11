---
slug: how-to-ask-a-good-debugging-question
title: How to ask a good debugging question
ercCodes: []
---

## What it is

A good debugging question is a measurement report with a gap in it: what you built, what you expected, what you observed instead, what you've already ruled out — and the numbers. It hands a stranger everything they need to think, and nothing they have to ask for.

## Why it bites

"It doesn't work" gets you a day of twenty-questions instead of an answer. The expensive failure modes are specific. Describing your *interpretation* instead of your *observation* — "the regulator is dead" when the truth is "the output pin reads 0.3V" — sends helpers down your wrong path with you. The XY problem: asking about your attempted solution ("how do I disable brown-out reset?") instead of your actual problem ("the board resets when the motor starts" — which is [battery-sag-under-load](battery-sag-under-load), and disabling the detector would have hidden it). Posting a photo of the breadboard instead of the schematic — wiring as built is exactly what's in question, so show the intent *and* the build. And omitting what you already tried, which guarantees the first five replies are things you already tried.

## The numbers

The measurements that should accompany nearly every hardware question, made with the load connected and the failure happening: rail voltage at the chip's own power pins (not the supply's terminals — see [ground-three-meanings](ground-three-meanings) for why the difference is the point), the voltage at every pin of the suspect part against the datasheet's expectation, and current draw if you can get it. State part numbers exactly — "a 7805" and "an AMS1117" fail differently — and link the datasheet you used, per [reading-a-datasheet](reading-a-datasheet). Then the honest magic: assembling this report *is* a debugging method. Half the questions are solved during the writing, because the first measurement that contradicts your story is the bug. That's the rubber-duck effect, and it's free.

## See it

ProtoPulse's Review report is this article automated: design intent, ERC findings, and sim traces in one artifact. Attaching one to a question replaces a dozen clarifying exchanges — the slow-rise-11 puzzle even makes good practice: write the question you *would* post, then check it names the measurement that gives the answer away.

## Go deeper

Related: [reading-a-datasheet](reading-a-datasheet), [battery-sag-under-load](battery-sag-under-load), [ground-three-meanings](ground-three-meanings), [floating-inputs](floating-inputs). Curriculum: every track's failure puzzles train exactly this observation discipline. Canonical reference: Eric S. Raymond's "How To Ask Questions The Smart Way" — old, blunt, still correct.
