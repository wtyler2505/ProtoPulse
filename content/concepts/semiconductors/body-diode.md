---
slug: body-diode
title: The body diode
ercCodes: []
---

## What it is

Every discrete power MOSFET ships with a free passenger: a parasitic diode from source to drain, built into the silicon by the FET's own structure. You can't remove it, you can't order the part without it — you can only know it's there and design like it is.

## Why it bites

The classic surprise: you use an N-channel FET to "disconnect" a load, the FET is off, and current flows anyway — backwards, through the body diode, which conducts whenever the drain falls a diode drop below the source. A single MOSFET can interrupt current in one direction only; "off" never meant "open circuit both ways." This bites battery designs (charge current sneaks around your load switch), and it's why true bidirectional switches use two FETs back-to-back, body diodes opposed. In H-bridges the diode flips from villain to load-bearing wall: when you switch a motor winding off, the inductive current has to go somewhere, and it freewheels through the body diodes of the opposite pair — by design. But the body diode is a mediocre diode: its drop and slow turn-off (reverse recovery) cost heat in fast bridges, which is why high-frequency designs sometimes parallel a Schottky or rely on synchronous rectification — turning the FET channel on to carry the current the diode would otherwise eat.

## The numbers

The body diode behaves like an ordinary silicon junction: a drop in the rough vicinity of 0.7–1V depending on current and part — the datasheet lists it as Vsd, with its own current rating and reverse-recovery figures. Conducting through the channel instead (synchronous rectification) drops I × Rds(on), often tens of times less. Direction memo for an N-channel FET: the diode points from source up to drain — current into the source terminal will not be stopped by turning the gate off.

## See it

In the sim, put an "off" N-channel FET in series with a load and reverse the supply: current flows, one diode drop poorer. Then build the half-bridge, switch off under inductive load, and watch the freewheel current path light up through the opposite body diode.

## Go deeper

Related: [mosfet-gate-basics](mosfet-gate-basics), [diode-drop-and-flyback](diode-drop-and-flyback), [schottky-vs-silicon](schottky-vs-silicon). Curriculum: Track 5 "Moving Things", step 3 — the half-bridge and H-bridge work. Canonical reference: the source-drain diode section of any power-MOSFET datasheet (Vsd, trr).
