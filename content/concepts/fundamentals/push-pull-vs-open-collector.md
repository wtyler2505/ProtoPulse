---
slug: push-pull-vs-open-collector
title: Push-pull vs open-collector outputs
ercCodes:
  - ERC-DRIVE-CONFLICT
  - ERC-OUTPUT-ON-RAIL
  - ERC-TRISTATE-DRIVEN
  - ERC-OC-DRIVEN
  - ERC-BIDI-DRIVEN
---

## What it is

A push-pull output actively drives its pin both ways — one transistor pulls toward the supply, another toward ground. An open-collector (or open-drain) output can only pull low; "high" means letting go and trusting an external pull-up to do the lifting.

## Why it bites

Tie two push-pull outputs together and sooner or later one drives high while the other drives low: a transistor-to-transistor short straight through both chips, with nothing but silicon to limit the current. The symptom is a warm chip, a sagging rail, and outputs that read mushy mid-levels — and it's the single most common wiring bug the ERC matrix exists for. The whole family of findings is the same mistake in different costumes: a push-pull output fighting another output, driving a rail, bullying a tri-state bus, or stomping on an open-collector party line that was designed for polite, low-only talkers. Open-collector buses like I2C exist precisely so multiple devices *can* share a wire — any one of them can pull it low, none of them can fight.

## The numbers

Typical small logic outputs source or sink on the order of 4–25mA depending on family — but a drive conflict isn't limited by those ratings, it's limited by the transistors' saturation behavior, and sustained conflicts can push tens of milliamps through both parts continuously. The honest numbers live in each part's datasheet (IOL/IOH); the rule of thumb with its limit: one push-pull driver per net, period — and when you need multiple talkers, use open-collector with a pull-up sized per the bus spec (see pull-up sizing), or tri-state drivers with arbitration you actually designed.

## See it

Connect a 555's OUT pin to a power rail in the editor and run ERC: the output-on-rail finding fires. Then put two outputs on one net and watch the drive-conflict error name both pins. The fix for the shared-line case — open-collector plus a 10k pull-up — passes clean.

## Go deeper

Related: [pull-up-pull-down](pull-up-pull-down), [floating-inputs](floating-inputs), [voltage-vs-current](voltage-vs-current). Curriculum: Track 1 "First Light", step 5 (first-light-05), deepened in the bus design of later tracks. Canonical reference: Horowitz & Hill, *The Art of Electronics*, §10.2 (logic interfacing); NXP UM10204 for the open-drain bus model.
