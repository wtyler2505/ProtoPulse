---
slug: buck-topology-intuition
title: Buck topology intuition
ercCodes: []
---

## What it is

A buck converter steps voltage down by switching the input on and off at high frequency and letting an inductor and capacitor average the chopped waveform into smooth DC. The duty cycle sets the ratio; almost nothing is burned as heat — that's the entire point.

## Why it bites

Treat a buck like a quieter 7805 and it bites three ways. First, noise: the output carries a sawtooth ripple at the switching frequency, plus sharp edges that couple everywhere — your ADC readings dance, your radio desenses, sometimes the inductor audibly whines. Second, the inductor: a cheap module's inductor pushed past its current rating saturates, the smooth triangle of inductor current turns into spikes, and the converter runs hot and ugly exactly at full load — the one condition you didn't test. Third, light load: many controllers skip pulses to stay efficient near zero load, and the ripple character changes completely, confusing measurements you took at idle. When you graduate from module to chip, layout joins the list: the fast-switching "hot loop" must be physically tiny or it becomes a transmitter.

## The numbers

The textbook relationship, continuous conduction and ideal parts: Vout ≈ D × Vin, where D is duty cycle — a 12V input at 27.5% duty averages to 3.3V. Efficiency typically lands in the 80–95% range versus a linear's Vout/Vin, which is why bucks own every big step-down. Switching frequencies typically run hundreds of kHz to a few MHz. Everything sharper than that — ripple amplitude, transient response, minimum load — is part- and layout-specific: the datasheet's application section and curves are the authority.

## See it

In the sim, drive an ideal switch-inductor-diode-capacitor buck from 12V and sweep the duty cycle: the output tracks D × Vin. Zoom into the output and watch the sawtooth riding on the DC; shrink the inductor until its current hits zero each cycle and watch the clean relationship walk away.

## Go deeper

Related: [duty-cycle](duty-cycle), [inductor-saturation](inductor-saturation), [ripple-and-how-to-measure-it](ripple-and-how-to-measure-it), [linear-regulator-dropout](linear-regulator-dropout). Curriculum: Track 3 "Power", step 4 — buck module as a black box, then ripple measurement. Canonical reference: the converter datasheet's application section and efficiency curves.
