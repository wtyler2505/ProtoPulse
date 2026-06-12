---
slug: adc-reference-quality
title: ADC reference quality
ercCodes: []
---

## What it is

An ADC never measures volts — it measures the *ratio* of the input to its reference and hands you that ratio as a code. Every flaw in the reference — noise, ripple, drift, sag — appears in your readings at full strength, disguised as a flaw in the signal.

## Why it bites

The classic bite is using VCC as the reference because it's free. Now your "temperature reading" wanders whenever the rail does: the WiFi radio bursts, the rail dips, and every channel jumps a few counts in unison. The board reads differently on USB power than on battery, and differently again when the motor runs. The cruelest version is measuring a divided-down battery against a VCC reference *derived from that battery* — the ratio barely moves as the cell discharges, so the fuel gauge reads "fine" right up to brownout. The opposite trap also exists: a ratiometric sensor (a pot, a bridge, many Hall sensors) powered from VCC *should* be measured against VCC — switching to a precision reference there *adds* supply error instead of removing it. Reference quality is a matching problem, not just a purity problem.

## The numbers

One LSB of a 12-bit ADC on a 3.3V reference is about 0.8mV; a 10-bit ADC, about 3.2mV. Hold those against your rail: tens of millivolts of switcher ripple on VCC-as-reference erases several LSBs of your resolution outright — see [ripple-and-how-to-measure-it](ripple-and-how-to-measure-it). Reference options, hedged because parts vary: a raw rail is as good as your regulator and decoupling; an internal bandgap reference is typically specified to a few percent absolute but is stable and quiet; an external reference IC buys accuracy and temperature drift numbers you must read from its datasheet, not assume. Whatever you use, decouple the reference pin as the datasheet shows — it draws sharp charge gulps every conversion.

## See it

In the co-sim, sample a steady 1.65V source while firmware toggles a bank of pins: with VCC as reference and thin decoupling, the codes scatter in time with the rail bounce. Switch the model to a clean reference and the scatter collapses to a stable code.

## Go deeper

Related: [source-impedance-and-sample-caps](source-impedance-and-sample-caps), [filtering-before-the-adc](filtering-before-the-adc), [local-decoupling](local-decoupling), [battery-sag-under-load](battery-sag-under-load). Curriculum: Track 7 "Build the Probe" — the analog front end lives or dies on its reference. Canonical reference: your MCU datasheet's ADC characteristics and internal-reference tables.
