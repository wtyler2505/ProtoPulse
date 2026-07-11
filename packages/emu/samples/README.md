# @protopulse/emu — sample firmware

Tiny, ready-to-load firmware images for exercising the cores in the app's
**Firmware** and **Co-sim** panels (and for manual smoke tests).

| File | Core | What it does |
|---|---|---|
| `esp32s3-blink-io5.bin` | ESP32-S3 | Toggles GPIO **IO5** forever via the GPIO matrix (`OUT_W1TS`/`OUT_W1TC`). 48-byte raw image — loads at `IRAM_BASE` (no esptool header). |
| `esp32s3-adc0-read.bin` | ESP32-S3 | Reads **SAR ADC1 channel 0** in a forever loop (oneshot per pass) and TX's each 12-bit result over UART0 (low byte, then high). 75-byte raw image. For the **Co-sim closed loop**: bind an analog net to ADC channel 0 and each read tracks that net's SPICE voltage. |

## Loading in the app

### Blink (Firmware panel)

1. **Firmware** tab → set the core picker to **ESP32-S3** → pick `esp32s3-blink-io5.bin`
   under "firmware file" → **Load** → **Run**.
2. The logic analyzer (**PIN TRACES**) shows **IO5** toggling. (The blink is fast —
   millions of edges/second at 240 MHz — so a wide window reads as a solid band;
   that density *is* the blink.)

### ADC read / Co-sim closed loop

1. **Firmware** tab → core picker **ESP32-S3** → pick `esp32s3-adc0-read.bin` → **Load**.
   (The Co-sim panel borrows the Firmware panel's loaded core.)
2. Place an analog source in the schematic (e.g. a resistor divider off the VCC/GND
   rails) so there is a net at a known mid-rail voltage.
3. **Co-sim** tab → mode **closed-loop** → bind that net to **ADC channel 0** → **Run**.
   Each firmware ADC read calls the host sampler, which feeds back the bound net's
   SPICE voltage, so the read value *tracks the analog node* (the honesty readout
   counts the ADC reads; the plot overlays the analog net against the digital pins).

## Regenerating

The `.bin`s are generated (and self-verified against the real emulator) by their
sibling scripts:

```bash
npx tsx packages/emu/samples/gen-blink-io5.mts   # strictly-alternating IO5 edges
npx tsx packages/emu/samples/gen-adc0-read.mts   # ADC ch0 round-trips an injected 1.65 V → code 2048
```

The images are byte-deterministic, so regenerating produces identical files. The
instruction sequences mirror the "blinks IO5 with cycle-exact spacing" and "an
analogRead-style conversion round-trips through the sampler" unit tests in
`src/esp32s3.test.ts`.
