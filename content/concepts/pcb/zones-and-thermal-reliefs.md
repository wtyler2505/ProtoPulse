---
slug: zones-and-thermal-reliefs
title: Zones and thermal reliefs
ercCodes: []
drcCodes: [DRC-ZONE-OVERLAP, DRC-ZONE-ISOLATED]
---

## What it is

A zone (copper pour) is a region of copper that floods around your traces and pads, connected to one net — usually ground — with a clearance gap to everything else. A thermal relief is the spoked connection between a pour and a pad: copper enough to conduct, narrow enough that the pour can't suck all the heat out of your soldering iron.

## Why it bites

Three real failures. Solid-connected pads on a big pour are heat sinks: your iron sits on a through-hole ground pin for fifteen seconds, the joint never flows properly, and you ship a cold joint that fails when the connector gets wiggled — the spokes exist to prevent exactly this. Isolated islands: a pour fragment trapped between traces connects to nothing; at best it's dead copper, at worst it floats and couples noise between whatever runs near it ([floating-inputs](floating-inputs) logic, in copper form). And clipped pours: a clearance setting too tight to fab minimums turns your "ground plane" into lace, and your return paths ([return-paths](return-paths)) detour through the gaps.

## The numbers

Pour clearance should be at or above the fab's minimum — JLCPCB's 2-layer deck floor is 0.127mm clearance, and giving pours a bit more than minimum keeps them from forming slivers. Thermal-relief spokes are typically 4 spokes of roughly trace-width copper; that's a solderability default, and the limit is current — a power pad pushing amps wants a solid connect, taking the harder soldering as the price. Hand-soldering pain scales with pour size and copper weight; reflow mostly doesn't care, which is why reliefs matter most on through-hole and hand-built boards.

## See it

ProtoPulse's PCB editor pours copper zones with configurable clearance, and the DRC catches the two classic zone bugs: overlapping zones on different nets (DRC-ZONE-OVERLAP) and islands connected to nothing (DRC-ZONE-ISOLATED). Honest limit: zones are solid-connect today — thermal reliefs aren't implemented yet, so every pad in a pour gets the full heat-sink connection. Pour a ground zone, thread traces through it, and watch where islands form; that exercise is real even without spokes.

## Go deeper

Related: [return-paths](return-paths) (what the pour is for), [loop-area](loop-area), [vias-thermal-and-signal](vias-thermal-and-signal) (stitching pours together), [soldering-driven-footprint-choices](soldering-driven-footprint-choices) (the same solderability-vs-performance trade), [power-and-heat](power-and-heat). Curriculum: Track 6 "First Board" pours its ground plane and clears every zone DRC error before export. Canonical reference: your fab's capability page for pour clearance, and IPC-7351 land-pattern guidance for thermal-relief geometry.
