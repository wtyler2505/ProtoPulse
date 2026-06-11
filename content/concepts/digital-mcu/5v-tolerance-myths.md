---
slug: 5v-tolerance-myths
title: 5V tolerance myths
ercCodes: []
---

## What it is

"5V-tolerant" means a specific pin, under specific conditions spelled out in the datasheet, can survive 5V on its input while the chip runs from a lower rail. It is a per-pin, per-condition claim — never a property of "the chip" and never something a forum post can grant.

## Why it bites

The myth pattern is always the same: someone reads that a chip family "is 5V-tolerant," wires 5V signals everywhere, and the board works — for a while. Then the failures arrive wearing disguises. The pin that was tolerant in digital mode wasn't tolerant in analog mode, so the ADC channel reads garbage or dies. The tolerance only held *while the chip was powered*, so the 5V signal that arrives before the 3.3V rail back-powers the whole chip through a clamp diode — the MCU half-boots from its own input pin and behaves like a haunted house. Or the pin was genuinely tolerant but the internal pull-up was enabled, dragging current somewhere the datasheet's tolerance footnote excluded. None of these look like "wrong voltage on a pin." All of them are.

## The numbers

The numbers live in one place: the absolute maximum ratings table and its footnotes. Non-tolerant pins typically specify a max of VDD + 0.3V — with VDD at 3.3V, anything above roughly 3.6V starts forward-biasing the clamp diode. Injection current limits, where stated at all, are typically single-digit milliamps — and "survives" is not "meets spec while it happens." Tolerant pins carry conditions: powered only, digital mode only, pull-ups off, sometimes a different leakage figure. Read every footnote; the footnote is the spec. When in doubt, shift the level properly — see [level-shifting](level-shifting) — instead of litigating tolerance.

## See it

In the sim, feed 5V into a 3.3V-rail input model with the supply off and watch the clamp diode conduct: the "unpowered" 3.3V rail floats up to a diode drop below the input. That back-powering trace is the whole myth, made visible.

## Go deeper

Related: [level-shifting](level-shifting), [reading-a-datasheet](reading-a-datasheet), [diode-drop-and-flyback](diode-drop-and-flyback), [zener-clamping](zener-clamping). Curriculum: Track 4 "Talking Chips" — mixed-voltage wiring is where this myth gets tested. Canonical reference: your MCU's absolute maximum ratings table, footnotes included — they outrank every forum thread.
