// Regenerate esp32s3-adc0-read.bin — a tiny ESP32-S3 raw-image ADC reader for
// the Co-sim closed-loop smoke (ROADMAP ESP32-S3 completion gate, criterion 3).
//
//   npx tsx packages/emu/samples/gen-adc0-read.mts
//
// The image reads SAR ADC1 channel 0 in a forever loop (oneshot per pass) and
// TX's each 12-bit conversion result over UART0 as two bytes (low, then high).
// The instruction sequence mirrors the "an analogRead-style conversion
// round-trips through the sampler" unit test in src/esp32s3.test.ts, made into a
// loop so the conversion re-runs every pass — which is what the co-sim engine
// drives: each ADC read calls the host sampler, which feeds back the bound SPICE
// node's voltage (see @protopulse/cosim quantum.ts setAdcSampler), so the read
// value TRACKS the analog node. It loads via the Firmware panel as a raw .bin on
// the ESP32-S3 core (no esptool header — loadFirmware drops a raw blob at
// IRAM_BASE), then the Co-sim panel binds a net to ADC channel 0.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ESP32S3_IRAM_BASE, ESP32S3_UART0_BASE, Esp32s3Core } from '../src/esp32s3.ts';
import { AND, assembleXtensa, BEQZ, BR, J, L32I, L32R, MOVI, S32I, SRAI, SRLI } from '../src/xtensa-asm.ts';

// SENS_SAR_MEAS1_CTRL2 (SAR ADC1 control/result), the same register the
// adc_oneshot_ll path drives. Channel 0 one-hot in SAR1_EN_PAD ([30:19]),
// EN_PAD_FORCE (bit 31) and START_FORCE (bit 18); then the START_SAR (bit 17)
// 0→1 pulse runs the conversion. DONE is bit 16; DATA is the low 12 bits.
const SENS = 0x60008800;
const CTRL_CH0 = (0x80000000 | (1 << 18) | (1 << (19 + 0))) >>> 0;
const CTRL_CH0_START = (CTRL_CH0 | (1 << 17)) >>> 0;

const image: Uint8Array = assembleXtensa(
  ESP32S3_IRAM_BASE,
  [ESP32S3_UART0_BASE, SENS, CTRL_CH0, CTRL_CH0_START, 0xfff],
  [
    L32R(2, 0), // a2 = UART0 base
    L32R(3, 1), // a3 = SENS base
    // loop:
    L32R(4, 2), // a4 = CTRL_CH0 (START_SAR still low)
    S32I(4, 3, 0x0c), // MEAS1_CTRL2 — start low (pulse first half)
    L32R(4, 3), // a4 = CTRL_CH0_START
    S32I(4, 3, 0x0c), // MEAS1_CTRL2 — start 0→1, conversion runs
    // poll DONE (bit 16):
    L32I(5, 3, 0x0c), // a5 = MEAS1_CTRL2
    SRAI(6, 5, 16), // SRLI tops out at 15; AND below drops the sign fill
    MOVI(7, 1),
    AND(6, 6, 7),
    BEQZ(6, BR(-5)), // not done → back to the poll load
    L32R(7, 4), // a7 = 0xfff
    AND(5, 5, 7), // result = MEAS1_DATA_SAR (low 12 bits)
    S32I(5, 2, 0x00), // UART TX — data & 0xff
    SRLI(5, 5, 8),
    S32I(5, 2, 0x00), // UART TX — data >> 8
    J(BR(-15)), // back to loop (re-arm + re-convert every pass)
  ],
);

// Self-verify the artifact the same way the Firmware + Co-sim panels load it:
// drive the host ADC sampler at a known voltage and confirm the firmware reads
// it back (the closed-loop data path) and TX's the matching 12-bit code.
const core = new Esp32s3Core();
core.loadFirmware(image);
core.setAdcSampler((channel) => (channel === 0 ? 1.65 : 0));
core.step(800);
const uart = [...core.drainUart()];
const reads = core.drainAdcReads();
// round(1.65 / 3.3 × 4095) = 2048 → bytes [0x00, 0x08] per conversion.
const okFirstSample = uart[0] === 0x00 && uart[1] === 0x08;
const okLooping = reads.length >= 2 && reads.every((r) => r.channel === 0);
if (!okFirstSample || !okLooping) {
  console.error(
    `SELF-TEST FAILED: uart=${JSON.stringify(uart.slice(0, 6))} adcReads=${String(reads.length)} ` +
      `(want first sample [0,8] and ≥2 channel-0 reads)`,
  );
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'esp32s3-adc0-read.bin');
writeFileSync(out, image);
console.log(`wrote ${String(image.length)} bytes -> ${out}`);
console.log(`self-test OK: ${String(reads.length)} ADC ch0 reads, first sample round-trips 1.65V → code 2048`);
