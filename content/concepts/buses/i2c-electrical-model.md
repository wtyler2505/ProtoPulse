---
slug: i2c-electrical-model
title: The I2C electrical model
ercCodes:
  - ERC-OC-NO-PULLUP
---

## What it is

I2C lines are open-drain: every device can only pull SDA and SCL *low*; nothing on the bus ever drives them high. The high state comes from one pull-up resistor per line charging the bus back up — which makes the pull-up a real circuit element with a real job, not a formality.

## Why it bites

Forget the pull-ups and the bus is simply dead — SDA and SCL sit low or float, every transaction NACKs, and the scope shows a flat line. ERC catches that one. The subtler bite is pull-ups that are merely *wrong*. Too large, and the line rises slowly — the bus works at 100kHz, fails at 400kHz, or fails only after you add the third device, because each device and centimeter of wiring adds capacitance that the lone resistor must charge. The trace looks like shark fins instead of squares. Too small, and devices can't pull the line below a legal low — the strong pull-up wins the tug-of-war and bits get misread. Both failures arrive as "the sensor is flaky," not "the resistor is wrong."

## The numbers

The rise-time limits are in the I2C specification (NXP UM10204): 1000ns maximum in standard mode (100kHz), 300ns in fast mode (400kHz) — and the rise is the RC of your pull-up against total bus capacitance, see [rc-time-constants](rc-time-constants). The floor comes from sink current: the spec's classic output figure is 0.4V maximum at 3mA of sink, so the pull-up must not demand more — roughly VDD ÷ 3mA, about 1kΩ at 3.3V. Between the floor and the rise-time ceiling, common practice lands at 2.2kΩ–10kΩ, smaller as speed and bus capacitance grow. Two more conventions: one pull-up set per bus, not per device — stacked breakout-board pull-ups parallel into an illegally strong pull — and both lines need them, SCL included.

## See it

Track 4, step 2: address-scan a virtual sensor with no pull-ups and watch ERC flag the open-drain net, then run the transient and watch *why* — the bus never rises. Fit the resistors and the shark fins square up.

## Go deeper

Related: [pull-up-pull-down](pull-up-pull-down), [push-pull-vs-open-collector](push-pull-vs-open-collector), [bus-capacitance](bus-capacitance), [i2c-addressing-and-conflicts](i2c-addressing-and-conflicts), [level-shifting](level-shifting). Curriculum: Track 4 "Talking Chips", step 2. Canonical reference: NXP UM10204, the I2C-bus specification.
