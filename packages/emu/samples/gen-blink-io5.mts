// Regenerate esp32s3-blink-io5.bin — a tiny ESP32-S3 raw-image blink demo.
//
//   npx tsx packages/emu/samples/gen-blink-io5.mts
//
// The image toggles GPIO IO5 forever (W1TS high → short delay → W1TC low →
// short delay), the same sequence proven by the "blinks IO5 with cycle-exact
// spacing" unit test. It loads via the Firmware panel as a raw .bin on the
// ESP32-S3 core (no esptool header — loadFirmware drops a raw blob at IRAM_BASE).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ESP32S3_GPIO_BASE, ESP32S3_IRAM_BASE, Esp32s3Core } from '../src/esp32s3.ts';
import { ADDI, assembleXtensa, BNEZ, BR, J, L32R, MOVI, S32I } from '../src/xtensa-asm.ts';

const image: Uint8Array = assembleXtensa(
  ESP32S3_IRAM_BASE,
  [ESP32S3_GPIO_BASE, 1 << 5],
  [
    L32R(2, 0), // a2 = GPIO base
    L32R(3, 1), // a3 = bit 5 mask
    S32I(3, 2, 0x24), // GPIO_ENABLE_W1TS — make IO5 an output
    // loop:
    S32I(3, 2, 0x08), // GPIO_OUT_W1TS — IO5 high
    MOVI(4, 10),
    ADDI(4, 4, -1),
    BNEZ(4, BR(-2)),
    S32I(3, 2, 0x0c), // GPIO_OUT_W1TC — IO5 low
    MOVI(4, 10),
    ADDI(4, 4, -1),
    BNEZ(4, BR(-2)),
    J(BR(-9)), // back to loop
  ],
);

// Self-verify the artifact the same way the Firmware panel loads it.
const core = new Esp32s3Core();
core.loadFirmware(image);
const { events } = core.step(1000);
const io5 = events.filter((e) => e.pin === 'IO5');
let alternating = io5.length > 8;
for (let i = 1; i < io5.length; i++) {
  if (io5[i]!.level === io5[i - 1]!.level) alternating = false;
}
if (!alternating) {
  console.error(`SELF-TEST FAILED: ${String(io5.length)} IO5 edges, not strictly alternating`);
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'esp32s3-blink-io5.bin');
writeFileSync(out, image);
console.log(`wrote ${String(image.length)} bytes -> ${out}`);
console.log(`self-test OK: ${String(io5.length)} IO5 edges, strictly alternating`);
