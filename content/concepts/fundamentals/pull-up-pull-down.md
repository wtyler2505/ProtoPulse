---
slug: pull-up-pull-down
title: Pull-up and pull-down resistors
ercCodes:
  - ERC-OC-NO-PULLUP
  - ERC-OC-ON-RAIL
---

## What it is

A pull-up is a resistor from a signal to the supply rail; a pull-down goes to ground. Either one gives a node a defined resting level that an active driver can still cheaply override — a default answer for when nobody's talking.

## Why it bites

Two failures bracket this concept. Leave the pull out and your I2C bus reads nothing but garbage: open-collector drivers can only pull the line *low*, so without a pull-up the bus never rises and every transaction times out — the exact bug the missing-pull-up ERC check catches. Wire the "pull-up" as a straight jumper to the rail instead of a resistor and you get the opposite disaster: the first device to pull the line low is now shorting the supply through itself, and something smokes. The resistor isn't decoration — it's the current limit that makes the shared line safe to fight over.

## The numbers

10k is the standard default pull for logic inputs and buttons: strong enough against nanoamp-scale CMOS leakage, weak enough to waste only 0.33mA when overridden at 3.3V. I2C is the case where the value actually matters: the bus spec limits a standard-mode driver to sinking 3mA, putting a floor around 1k at 3.3V, while the RC of the pull against bus capacitance sets the ceiling — 4.7k is the common 100kHz choice, dropping toward 1–2.2k for 400kHz or long buses. These are guidelines with stated limits, not laws: compute the rise time when the bus is fast or physically large.

## See it

Wire a pushbutton from an input pin to ground with no pull, run the sim, and watch the input wander when the button is open. Add a 10k pull-up: the pin now rests high and snaps low on press. Then run ERC on an open-collector net with and without its pull-up and read both findings.

## Go deeper

Related: [floating-inputs](floating-inputs), [push-pull-vs-open-collector](push-pull-vs-open-collector), [ohms-law-in-practice](ohms-law-in-practice). Curriculum: Track 1 "First Light", step 4 (first-light-04), revisited in the I2C work of later tracks. Canonical reference: NXP UM10204 (I2C-bus specification), pull-up sizing section.
