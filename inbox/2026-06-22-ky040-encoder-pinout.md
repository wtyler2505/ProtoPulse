---
summary: KY-040 rotary encoder module — web-verified 5-pin layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: components101 KY-040 + espboards.dev + Keyes KY-040 datasheet (web-verified)
verified: 2026-06-22
---

# KY-040 rotary encoder module — verification note

Added `core:ky040-encoder` to `@protopulse/parts`. Classic incremental rotary encoder +
push-button module (Tyler owns it — "Rotary Encoder Module" in the component log, with
CLK/DT/SW/+/GND labels). Pinout **web-verified**.

## Part
- **MPN:** KY-040 (Keyes / generic)
- **Class:** `ic`, refPrefix **U** (module). 5 pins. Footprint deferred.

## Pinout — 5-pin header
Silk order `CLK, DT, SW, +, GND`.
- **CLK** = quadrature contact A, **DT** = quadrature contact B (the board carries two 10kΩ
  pull-ups, so an open contact reads HIGH). Phase between CLK/DT gives direction.
- **SW** = shaft momentary push-button (connects to GND when pressed).
- **+ / GND** = 3.3–5 V supply.

## ERC modeling
- **CLK, DT, SW → output** — signal lines the MCU reads (consistent with the seed's
  sensor-output convention).
- **+, GND → power_in.**

## Verification
- Web sources: components101 KY-040, espboards.dev/sensors/ky-040, Keyes KY-040 datasheet —
  agree on CLK/DT/SW/+/GND and the dual 10k pull-ups.
- Component log agrees; web is the authority per the standing rule.
- Vault (`qmd_search`): no prior KY-040 note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-ky040-encoder.md`
(never author `knowledge/` directly).
