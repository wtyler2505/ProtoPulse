---
slug: aliasing
title: Aliasing
ercCodes: []
---

## What it is

Sample a signal slower than twice its highest frequency content and the fast parts don't disappear — they reappear as counterfeit slow signals, folded down below half the sample rate. It's the wagon-wheel effect from old films: the wheel spins forward, the camera's frame rate samples it, and on screen it rolls slowly backwards.

## Why it bites

Aliasing bites by being *plausible*. Your temperature log shows a graceful wobble with a period of minutes — which is actually 50/60Hz mains pickup beating against your sample rate. Your motor-current reading sits at a steady, believable, wrong value — because you're sampling near-synchronously with the PWM from [pwm-resolution-vs-frequency](pwm-resolution-vs-frequency), landing on nearly the same point of each cycle and reading the duty-cycle lottery instead of the average. Change the sample rate and the "signal" changes shape — the classic tell. The cruelty is that once sampled, an alias is mathematically indistinguishable from a real slow signal: no firmware filter, however clever, can remove it, because the information needed to tell them apart was destroyed at the sampling instant. The only fix lives in hardware, before the ADC — which is why [filtering-before-the-adc](filtering-before-the-adc) exists.

## The numbers

The Nyquist criterion: to represent content at frequency f you must sample faster than 2f. Anything above fs/2 folds down to |f − k·fs| for the nearest integer k — a 1kHz ripple sampled at 990Hz returns as a 10Hz ghost; 50Hz mains sampled at 49Hz crawls at 1Hz. Practical discipline, hedged only by your patience: know your sample rate, know what's actually on the wire (the scope view, not the wish), and either filter everything above fs/2 down into the noise floor or sample deliberately fast and decimate in firmware. For PWM specifically, sampling synchronized to the PWM period — or much faster than it — beats sampling near it.

## See it

The sim ghost overlay is built for this: it draws the continuous waveform faintly behind your sampled points. Sample 1kHz ripple at 990Hz and watch the dots trace a stately 10Hz wave through a blur of reality they completely misrepresent.

## Go deeper

Related: [pwm-resolution-vs-frequency](pwm-resolution-vs-frequency), [filtering-before-the-adc](filtering-before-the-adc), [duty-cycle](duty-cycle), [rms-vs-peak](rms-vs-peak). Curriculum: Track 7 "Build the Probe" — an instrument that samples must know this cold. Canonical reference: the Nyquist–Shannon sampling theorem, any signals text; the wagon-wheel effect for intuition.
