---
slug: annular-rings
title: Annular rings
ercCodes: []
drcCodes: [DRC-ANNULAR, DRC-DRILL]
---

## What it is

The annular ring is the rim of copper left between a drilled hole and the edge of its pad — the margin that keeps the hole inside the copper after the drill lands wherever it actually lands. It exists because drills wander, layers misregister, and pads are etched with their own tolerance.

## Why it bites

When the ring is too thin and the drill drifts, you get *breakout*: the hole exits the side of the pad. Sometimes the via still conducts through whatever plating survived — a marginal connection that works on the bench and opens after a few thermal cycles or one enthusiastic connector insertion. That's the field-failure version. The fab-rejection version is friendlier: your order bounces with a DFM complaint, costing you days. Through-hole connector pads are the classic victims, because mechanical stress on the pin works the weakened rim until it cracks — a board that "needs the cable reseated" is often a broken ring, not a dirty contact.

## The numbers

JLCPCB's 2-layer deck, which ProtoPulse checks against: minimum drill 0.3mm, minimum annular ring 0.13mm — so the smallest legal via pad is roughly 0.56mm across. Those minimums encode the fab's real drill-wander and registration stack-up; they're not negotiable margins to shave. Rule of thumb with its limit: use minimums only where density forces you, and give anything mechanical (connectors, mounting holes, wire pads) a visibly generous ring — the standard minimum protects conduction, not against a pin being levered sideways for years.

## See it

ProtoPulse's DRC enforces both limits on every via and through-hole pad: DRC-DRILL flags holes under 0.3mm, DRC-ANNULAR flags rings under 0.13mm. Shrink a via pad until DRC-ANNULAR fires, then look at how little copper was left — that sliver is what stood between you and breakout. Gerber export carries the drill file the fab will actually use.

## Go deeper

Related: [vias-thermal-and-signal](vias-thermal-and-signal) (what the hole is for), [trace-width-vs-current](trace-width-vs-current) (the other fab-minimum trap), [courtyards](courtyards) (mechanical margin thinking, body-scale), [tolerance-stacking](tolerance-stacking) (the ring is literally a tolerance stack-up budget). Curriculum: Track 6 "First Board" runs the full JLCPCB deck clean before Gerber export. Canonical reference: your fab's capability page — annular minimums differ per fab and per layer count.
