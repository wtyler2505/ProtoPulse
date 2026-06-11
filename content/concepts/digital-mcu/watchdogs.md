---
slug: watchdogs
title: Watchdogs
ercCodes: []
---

## What it is

A watchdog timer is an independent countdown that resets the MCU unless firmware keeps proving it's alive by refreshing the count before it expires. It converts "hung forever in a field installation" into "rebooted within seconds" — the last line of defense when every other safeguard has already failed.

## Why it bites

Bite one: it's off. Most MCUs ship with the watchdog disabled, the prototype never hangs on the bench, and the device ships unguarded — then a once-a-month firmware deadlock turns into a truck roll instead of a self-recovery. Bite two is subtler: the watchdog is on but petted from the wrong place. Refresh it inside a timer interrupt and it will keep getting petted while your main loop is deadlocked — the interrupt still fires, the dog stays happy, the product stays hung. The refresh must be reachable only when the *real* work is provably progressing. Bite three: the watchdog works perfectly and the bug is in startup — firmware that hangs before the first refresh produces an infinite reset loop, which can chew through flash/EEPROM writes or hammer attached hardware. And after any watchdog reset, firmware that doesn't check the reset-cause register reruns initialization blind, erasing the very evidence you need.

## The numbers

Hedged, because families differ: timeouts are picked from prescaler tables spanning roughly milliseconds to seconds. The watchdog typically runs from its own low-power RC oscillator, whose accuracy is loose — tens-of-percent variation over temperature and voltage is common — so never set the timeout near your worst-case loop time; leave generous margin. Window watchdogs add a *minimum* time too: refreshing too early also resets, catching runaway code that pets the dog in a tight loop. Check the reset-cause register on every boot and log it.

## See it

In the co-sim, run firmware whose main loop deadlocks on a flag while a timer interrupt keeps running. With the refresh in the interrupt, the system hangs forever. Move the refresh into the main loop, re-run, and watch the watchdog cut in and recover it.

## Go deeper

Related: [reset-circuits](reset-circuits), [brown-out-detectors](brown-out-detectors), [brownout-and-por](brownout-and-por), [interrupts-vs-polling](interrupts-vs-polling). Curriculum: Track 4 "Talking Chips" — multi-chip firmware is where hangs stop being theoretical. Canonical reference: your MCU's watchdog chapter, especially the oscillator tolerance and reset-cause register sections.
