---
slug: brown-out-detectors
title: Brown-out detectors
ercCodes: []
---

## What it is

A brown-out detector (BOD) is the on-chip supervisor that compares the supply rail against a configured threshold and yanks the MCU into reset the moment the rail dips below it. It converts "limped through the sag with corrupted state" into "restarted cleanly" — the difference between a glitch and a haunting.

## Why it bites

The first bite is shipping with it off. On many MCUs the BOD is disabled by default or buried in fuse/option-byte configuration, so the prototype that "worked fine" sails through testing with no brownout protection at all — until a low battery sags the rail mid-EEPROM-write and the device wakes up with its settings replaced by garbage. Corrupted nonvolatile config after low-battery events is the classic BOD-was-off signature. The second bite is the opposite: a threshold set too *high* for a battery-powered design, so every motor start or radio burst that legitimately sags the rail triggers a reset — the device reboots precisely when it tries to do its job, and the protection becomes the failure.

## The numbers

Hedged, because every family differs: BOD thresholds are picked from a short per-part table (datasheet), and the safe window is defined by two other numbers you must look up — the chip's minimum reliable operating voltage at *your* clock speed (the speed-grade table) and the higher minimum that flash/EEPROM writes typically demand. The threshold belongs above the voltage where execution stops being trustworthy and below your worst *legitimate* sag. If those two constraints can't both be satisfied, the BOD isn't your problem — the power design is, and the fix is bulk capacitance or sag control, not a braver threshold. Some BODs filter brief dips; microsecond-scale transients may pass unseen — again, datasheet.

## See it

In the co-sim, run firmware that writes a config block, and dip the rail mid-write with the BOD disabled: the write completes wrongly and the corrupted block reads back. Enable the BOD model at a sane threshold and re-run — the dip becomes a clean reset, and the old config survives.

## Go deeper

Related: [brownout-and-por](brownout-and-por), [reset-circuits](reset-circuits), [battery-sag-under-load](battery-sag-under-load). Curriculum: Track 3 "Power" — the chip-side companion to the rail-side story. Canonical reference: your MCU datasheet's BOD electrical characteristics and fuse/option-byte configuration table.
