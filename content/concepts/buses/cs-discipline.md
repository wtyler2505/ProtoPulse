---
slug: cs-discipline
title: Chip-select discipline
ercCodes: []
---

## What it is

On a shared SPI bus, the chip-select (CS) line is what makes a transfer *for* a particular device: each peripheral gets its own CS, listens only while selected, and — critically — releases its data line when deselected. CS isn't an address; it's the only thing standing between an orderly bus and a shouting match.

## Why it bites

The textbook failure is two peripherals selected at once: both drive MISO, push-pull against push-pull, and the master reads the bitwise wreckage of their fight — see [push-pull-vs-open-collector](push-pull-vs-open-collector) for why that's electrically ugly, not just logically wrong. The sneakier failure happens before your code runs at all: during reset and boot, MCU pins float as inputs, so every CS line is undriven — a floating select. A flash chip or SD card that sees its CS wander low while the clock line picks up noise can receive garbage it interprets as commands; SD cards are famous for ending up in a confused state before the firmware's first line executes. Third bite: a sensor that uses the same physical pin as a boot-time strap, where the pull resistor your SPI device needs fights the level the MCU needs at reset.

## The numbers

The rules are structural more than numeric. One CS per device, no sharing, no decoding tricks at hobby scale. A pull-up resistor on every CS line — conventionally in the ~10kΩ region, weak enough for the MCU to override — so that every peripheral is positively deselected from the instant power arrives until firmware takes over; this is the same floating-pin logic as [floating-inputs](floating-inputs), applied to selects. MISO must be tri-stated by deselected devices; most real chips comply, but some cheap modules add buffers that drive MISO always — those need a bus switch or their own bus. And CS frames the transaction: many devices latch on CS rising, so toggling it mid-transfer aborts, not pauses.

## See it

In the sim, put two peripherals on one bus and assert both selects: the analyzer shows MISO contention as overlapping drive. Then float the CS lines during a simulated reset window and watch a peripheral clock in noise. Pull-ups fix both traces.

## Go deeper

Related: [spi-modes](spi-modes), [floating-inputs](floating-inputs), [pull-up-pull-down](pull-up-pull-down), [boot-strap-pins](boot-strap-pins), [push-pull-vs-open-collector](push-pull-vs-open-collector). Curriculum: Track 4 "Talking Chips" — the multi-sensor deliverable is where CS discipline gets enforced. Canonical reference: your peripheral's datasheet section on CS timing and tri-state behavior.
