---
slug: schottky-vs-silicon
title: Schottky vs silicon diodes
ercCodes: []
---

## What it is

A Schottky diode swaps the silicon diode's P-N junction for a metal-semiconductor junction, buying a lower forward drop and near-instant turn-off. The price is higher reverse leakage — a Schottky never fully closes the door, and it leaks more the hotter it gets.

## Why it bites

Choose by habit and each diode bites in the other's job. Use a plain silicon diode for reverse-polarity protection on a 3.3V battery design and the ~0.7V toll eats a huge slice of your headroom and your battery life — the Schottky's ~0.3V is the difference between "protected" and "protected but dead by lunch." Flip the mistake: use a Schottky as a blocker in a hot, high-voltage spot and its leakage — which can climb steeply with temperature — quietly drains your battery or back-feeds the rail you swore was isolated. There's also speed: ordinary rectifier diodes briefly conduct *backwards* while turning off (reverse recovery), which in fast switching circuits turns into heat and spray; Schottkys barely have this vice, which is why they live next to buck converters.

## The numbers

Typical forward drops at modest current, hedged because they vary with part and current: silicon 0.6–0.7V, Schottky roughly 0.2–0.45V. Power lost in any series diode is P = Vf × I, so at 1A a Schottky saves you on the order of a third of a watt over silicon — real heat in a small enclosure. Reverse leakage is the fine print to actually read: Schottky datasheets quote it at 25°C and at elevated temperature, and the hot number can be orders of magnitude larger than the cold one. Rule with its limit: prefer Schottky for low-voltage rectification and protection, prefer silicon (or a FET-based solution) where reverse blocking at heat is the actual job.

## See it

In the sim, power a 3.3V load through a series silicon diode and read the load voltage: ~2.6V, brownout territory. Swap to a Schottky model: ~3.0V and the load lives. Then compare the dissipation readouts on both diodes at 1A.

## Go deeper

Related: [diode-drop-and-flyback](diode-drop-and-flyback), [body-diode](body-diode), [power-and-heat](power-and-heat). Curriculum: Track 3 "Power", step 5 — input protection is where this choice gets made. Canonical reference: a Schottky datasheet's leakage-vs-temperature curve next to a 1N400x-class silicon datasheet.
