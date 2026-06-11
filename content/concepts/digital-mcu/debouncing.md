---
slug: debouncing
title: Debouncing
ercCodes: []
---

## What it is

Mechanical switch contacts don't close once — they bounce, chattering open and closed for a short while before settling. Electronics are fast enough to count every chatter as a separate event. Debouncing, in hardware or firmware or both, is what makes one physical press equal one logical press.

## Why it bites

The counter increments by three per press. The menu skips an entry. The toggle ends up in a random state — sometimes on, sometimes off, for the *same* press. Interrupt-driven code is bitten hardest: an edge interrupt on a bouncing pin fires a storm of handler calls microseconds apart, and any code that wasn't written expecting that storm misbehaves in ways that look nothing like a switch problem. The cruelty is the variability: bounce differs per switch, per press, per the age of the switch — so the bug is intermittent, survives "works for me" testing, and blooms during the demo. Toggle switches, buttons, relay contacts, rotary encoders' mechanical detents: all of them bounce.

## The numbers

Bounce duration is typically on the order of hundreds of microseconds to ten-plus milliseconds, varying wildly between switch types and even between presses of one switch — the classic empirical survey is Ganssle's, and the only number you can trust for *your* switch is the one you measure. Hardware fix: an RC filter with a time constant comfortably longer than the bounce, feeding a Schmitt-trigger input so the slow RC edge doesn't itself chatter the logic threshold. Firmware fix: after a change, ignore further changes for a window of typically 20–50ms — long enough to outlast bounce, short enough that humans never notice.

## See it

Track 2 makes you watch it raw: a pushbutton into an MCU pin, with the virtual logic analyzer zoomed into the edge — one press, a burst of edges. Fix it first in hardware with an RC, then in firmware with a lockout window, and compare the analyzer traces side by side.

## Go deeper

Related: [rc-time-constants](rc-time-constants), [pull-up-pull-down](pull-up-pull-down), [interrupts-vs-polling](interrupts-vs-polling), [floating-inputs](floating-inputs). Curriculum: Track 2 "Signals & Switches", step 2 — bounce on the logic analyzer, fixed twice. Canonical reference: Jack Ganssle, "A Guide to Debouncing."
