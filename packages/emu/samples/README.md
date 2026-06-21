# @protopulse/emu — sample firmware

Tiny, ready-to-load firmware images for exercising the cores in the app's
**Firmware** and **Co-sim** panels (and for manual smoke tests).

| File | Core | What it does |
|---|---|---|
| `esp32s3-blink-io5.bin` | ESP32-S3 | Toggles GPIO **IO5** forever via the GPIO matrix (`OUT_W1TS`/`OUT_W1TC`). 48-byte raw image — loads at `IRAM_BASE` (no esptool header). |

## Loading in the app

1. **Firmware** tab → set the core picker to **ESP32-S3** → pick `esp32s3-blink-io5.bin`
   under "firmware file" → **Load** → **Run**.
2. The logic analyzer (**PIN TRACES**) shows **IO5** toggling. (The blink is fast —
   millions of edges/second at 240 MHz — so a wide window reads as a solid band;
   that density *is* the blink.)

## Regenerating

The `.bin` is generated (and self-verified to produce strictly-alternating IO5
edges) by its sibling script:

```bash
npx tsx packages/emu/samples/gen-blink-io5.mts
```

The image is byte-deterministic, so regenerating produces an identical file.
The instruction sequence mirrors the "blinks IO5 with cycle-exact spacing"
unit test in `src/esp32s3.test.ts`.
