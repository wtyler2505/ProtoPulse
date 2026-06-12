---
slug: panelization
title: Panelization
ercCodes: []
drcCodes: [DRC-EDGE-CLEARANCE]
---

## What it is

Panelization combines multiple board copies (or multiple designs) into one larger panel, joined by V-cuts (scored straight lines you snap) or mouse bites (perforated tab rows you break), usually with rails along the edges and fiducial marks for the assembly machines. Fabs and assemblers panelize because pick-and-place lines handle one standard panel far better than a pile of odd small boards.

## Why it bites

The bite arrives at depanelization. Snapping a V-cut bends the board, and the bend strains everything near the edge — ceramic capacitors are the classic casualty, because MLCCs crack under flex and the crack is invisible: the board tests fine, then the capacitor fails short weeks later and takes the rail down with it. That's a field failure born at the moment someone snapped the panel. Secondary bites: mouse-bite tabs leave rough nubs that foul enclosure fit, connectors hanging over a V-cut edge get sheared during separation, and a panel without fiducials or rails gets kicked back by the assembler after you've already waited a week.

## The numbers

Working figures, all roughly: keep components — especially MLCCs — a few millimetres back from any snap edge, more for larger ceramics, and orient them parallel to the V-cut so flex stresses them less; mouse bites are gentler than V-cuts near sensitive parts. Rails are typically around 5mm wide; fiducials are roughly 1mm bare-copper dots, three per panel, asymmetrically placed. JLCPCB's deck already enforces 0.3mm copper-to-edge on a single board — panel edges deserve more, because they get snapped, not routed. The limit on all of this: every assembler publishes their own panel spec, and theirs wins over any rule of thumb here.

## See it

Not in ProtoPulse yet: there's no panelization tooling — no V-cut, mouse-bite, rail, or fiducial support — and claiming otherwise would be roadmap fiction. What the editor gives you today is the single-board contract a panel is built from: a clean board outline, copper-to-edge clearance checked by DRC, and Gerber export that fabs (or third-party panelizer tools) consume directly. Design the single board well and panelization stays a packaging step, not a redesign.

## Go deeper

Related: [courtyards](courtyards) (edge keep-out is the same discipline), [tolerance-stacking](tolerance-stacking) (why fiducials exist at all), [capacitor-types](capacitor-types) (why MLCCs crack and electrolytics don't), [silk-discipline](silk-discipline) (panels need readable orientation too). Curriculum: Track 6 "First Board" ships as a single board; Track 7 "Build the Probe" discusses what changes when you order assembly. Canonical reference: your assembler's panel-requirements page — it overrides everything above.
