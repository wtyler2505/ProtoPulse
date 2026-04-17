---
description: Always validate component dimensions and pin alignment against standard breadboard grid spacing 
type: methodology
category: processing
source: session-mining
created: 2026-04-17
status: active
session_source: current-session
---

# enforce physical constraints on BreadboardFit logic

## What to Do

When computing component placement on a breadboard using `BreadboardFit` logic, always validate that physical dimensions and pin offsets strictly align with the standard 0.1-inch (2.54mm) grid matrix. Use bounding box collision detection and snap-to-grid constraints.

## What to Avoid

Do not place components based purely on arbitrary pixel coordinates without snapping to the breadboard hole matrix, and do not ignore physical overlaps. 

## Why This Matters

Ignoring physical constraints causes overlapping components or misaligned pins, rendering the simulated breadboard layouts invalid and physically impossible to build in real life. This erodes user trust in the AI-generated designs.

## Scope

This applies to all EDA, breadboard simulation, and placement algorithms within ProtoPulse.

---

Related: [[methodology]]
