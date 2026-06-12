---
slug: bus-capacitance
title: Bus capacitance
ercCodes: []
---

## What it is

Every pin, wire, trace, and breadboard row attached to a bus line adds a little capacitance, and the bus can only change state as fast as that total capacitance can be charged or discharged. On open-drain buses the discharge is strong (a transistor) but the charge is whatever the pull-up resistor can deliver — so capacitance taxes the rising edge hardest.

## Why it bites

Bus capacitance is the reason "it worked with two devices" becomes "it fails with six," and "it worked on the PCB" becomes "it fails over the 40cm ribbon cable to the sensor pod." Nothing is broken; every part tests fine; the wiring matches the schematic. But each added device and each added centimeter raised the capacitance, the RC rise time crept up, and at some point the line no longer reaches a valid high before the moment it gets sampled — see [rc-time-constants](rc-time-constants) for the math doing the damage. The shipped failure puzzle slow-rise-11 is exactly this bug in miniature: an open-collector line whose pull-up is far too large for the bus capacitance, reading LOW a hundred microseconds after release because τ = 100kΩ × 10nF = 1ms. ERC passes — it's legal electricity with wrong values.

## The numbers

Rules of thumb, with their limits stated: budget roughly 10pF per connected device pin (datasheets list each part's actual pin capacitance) plus wiring — PCB traces contribute on the order of a picofarad or so per centimeter depending on geometry, and breadboards plus jumper bundles are notoriously worse and less predictable. The I2C specification caps total bus capacitance at 400pF for standard and fast mode precisely because the pull-up has to win against it. The two levers when the rise gets slow: lower the pull-up resistance (bounded below by sink-current limits — see [i2c-electrical-model](i2c-electrical-model)) or shed capacitance: shorter runs, fewer devices, or a bus buffer/repeater splitting the load.

## See it

Load the slow-rise-11 puzzle: transient-sim the release of an open-collector line and watch v(bus) crawl. Estimate the RC from the trace, fix the pull-up, re-run — then add capacitance back and watch the same failure return at the new τ.

## Go deeper

Related: [i2c-electrical-model](i2c-electrical-model), [rc-time-constants](rc-time-constants), [pull-up-pull-down](pull-up-pull-down), [termination-at-hobby-scale](termination-at-hobby-scale). Curriculum: Track 4 "Talking Chips", step 2 — the why behind the missing-pull-up demo. Canonical reference: NXP UM10204's bus-capacitance limits and pull-up sizing graphs.
