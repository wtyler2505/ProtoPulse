---
slug: pwm-resolution-vs-frequency
title: PWM resolution vs frequency
ercCodes: []
---

## What it is

Hardware PWM is a counter racing a compare register: the counter's clock is a fixed budget, and you spend it on either more steps per cycle (resolution) or more cycles per second (frequency). You cannot have maximum of both — the timer's clock divides between them.

## Why it bites

You raise the PWM frequency to silence a motor's audible whine, and suddenly your speed control feels coarse — the smooth ramp becomes visible steps, because pushing the frequency up ate your duty-cycle steps. Or the reverse: you want fine LED dimming, configure a high-resolution timer, and the resulting low frequency flickers in peripheral vision or strobes on camera. The API hides the trade — you ask a library for "25kHz at 16 bits" and it silently delivers fewer bits, so the code *looks* right while the bottom few bits of your duty value do nothing at all. Servo users hit the opposite wall: the signal is slow (a pulse every 20ms), so the resolution that matters is timer ticks across a 1–2ms pulse, not bits of nominal range.

## The numbers

The arithmetic is exact: steps per cycle = timer clock ÷ PWM frequency. A 16MHz timer at 8-bit resolution (256 steps) tops out at 62.5kHz; ask that same timer for 25kHz and you get 640 steps — about 9.3 bits, never 16. Frequencies above roughly 20kHz clear human hearing, which is why motor drives aim there. LED flicker perception varies by person and motion, low hundreds of hertz is commonly cited as the discomfort zone for direct view — when in doubt, go faster *if* your resolution budget allows. And every frequency increase multiplies switching events, so gate-drive losses scale with it.

## See it

Track 5's co-sim plots this trade directly: ramp a motor's duty at 8 bits and at 4 bits side by side and watch the current staircase. Then crank the frequency until the resolution collapses and the "smooth" ramp turns into terraces.

## Go deeper

Related: [duty-cycle](duty-cycle), [gate-charge-and-switching-loss](gate-charge-and-switching-loss), [led-forward-current](led-forward-current), [rms-vs-peak](rms-vs-peak). Curriculum: Track 5 "Moving Things", step 4 — PWM speed control with duty, current, and sag plotted together. Canonical reference: your MCU's timer/PWM peripheral chapter — the prescaler and top-value registers are where the trade is configured.
