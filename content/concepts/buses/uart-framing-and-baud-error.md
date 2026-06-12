---
slug: uart-framing-and-baud-error
title: UART framing & the baud error budget
ercCodes: []
---

## What it is

UART is serial with no clock wire: both ends independently time the bits, agreeing in advance on the baud rate, and resynchronize on each frame's start bit. Every byte travels as a frame — start bit, data bits, optional parity, stop bit — and the receiver samples each bit where it *believes* the middle is.

## Why it bites

The signature failure is garbage that almost makes sense: receivable at 9600 baud, mojibake at 115200, or text where every few characters are wrong. Because the receiver re-times from each start bit, a small clock mismatch drifts further off-center with every bit in the frame — the last data bit and the stop bit are sampled worst, which is why errors look byte-positional and intermittent rather than total. The classic causes: an MCU running on its internal RC oscillator instead of a crystal, a baud rate the clock can't divide to cleanly, or the two ends disagreeing about frame format entirely. And before blaming timing at all, check the wiring — TX must cross to RX; TX-to-TX is the most common dead-UART of them all.

## The numbers

A standard 8N1 frame is 10 bit-times per byte, and the receiver must still be inside the correct bit at the final sample — cumulative timing error has to stay under half a bit across the frame, which works out to roughly 5% *total* mismatch, conventionally budgeted as about ±2% per end to leave margin for edge distortion. Crystals hold tens of ppm and spend almost none of that budget; internal RC oscillators are typically around ±1% calibrated and several percent uncalibrated over temperature — check your part. Add the divider error: baud = clock ÷ divisor, and when the divisor doesn't land exactly, the leftover error spends budget too. The frame format (data bits, parity, stop bits) must match exactly — that part has no error budget at all.

## See it

Track 4 opens here: two emulated MCUs talking, decoded live on the virtual logic analyzer. Then the baud-mismatch puzzle — skew one end a few percent and watch clean frames decay into specific, repeatable garbage as the sample point walks off the bit.

## Go deeper

Related: [crystal-loading-caps](crystal-loading-caps), [spi-modes](spi-modes), [i2c-electrical-model](i2c-electrical-model), [can-basics](can-basics). Curriculum: Track 4 "Talking Chips", step 1. Canonical reference: your MCU's USART chapter — the baud-rate divisor table with its per-rate error column.
