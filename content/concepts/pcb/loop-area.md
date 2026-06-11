---
slug: loop-area
title: Loop area
ercCodes: []
---

## What it is

Loop area is the area enclosed between a signal's outbound path and its return — the accidental antenna you build with every net. Both radiated emissions and susceptibility to incoming noise scale with that enclosed area.

## Why it bites

The classic victim is the "hot loop" in a switching converter: the path from input cap through the switch, through the diode or low-side FET, and back. That loop carries amperes with nanosecond edges; if you place the input cap a few centimetres from the switcher IC, you've built a transmitting loop. Symptoms you'd actually see: a buck converter whose output looks fine but whose noise shows up on every ADC reading on the board, a radio receiver that deafens whenever the supply is loaded, an EMC scan failure at the switching frequency's harmonics. The reverse failure is susceptibility — a long sensor wire and a lazy return making a loop that picks up every motor turn-on nearby ([kelvin-connections](kelvin-connections) thinking applies here too).

## The numbers

There's no single number, and that's the point — area is the variable you control. Rules of thumb: emissions grow roughly with loop area, current, and the square of frequency, so fast-edged high-current loops dominate everything else on the board. Practical translation: the switcher's input cap goes millimetres from its pins, not centimetres ([local-decoupling](local-decoupling)); signal and return travel together. The limit of the rule: below the megahertz range with slow edges, loop area is rarely your first problem — don't contort a layout for a 10kHz signal.

## See it

In ProtoPulse's 2-layer PCB editor, route a supply trace on F.Cu and trace where its return travels on B.Cu — the daylight between them is your loop. Pour a B.Cu ground zone and watch the effective loop collapse, because the return can now flow directly underneath. There's no field solver or EMI view; the editor shows you geometry, and geometry is most of the battle.

## Go deeper

Related: [return-paths](return-paths) (the same physics from the current's view), [buck-topology-intuition](buck-topology-intuition) and [boost-topology-intuition](boost-topology-intuition) (where the hot loop lives), [local-decoupling](local-decoupling), [ripple-and-how-to-measure-it](ripple-and-how-to-measure-it). Curriculum: Track 6 "First Board" has you identify the hot loop before placing a single part. Canonical reference: your switching-regulator vendor's layout application note — they all print the hot-loop diagram for a reason.
