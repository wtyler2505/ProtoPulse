# Changelog

All notable changes to ProtoPulse are documented in this file.

## 2026-06-23 — I²C slave-device hook: foundation for I²C digital-sensor co-sim (BL-0892)

### Added
- **`Esp32s3Core.setI2cSlave(port, fn)`** (`@protopulse/emu`): the ESP32-S3 I²C master
  previously filled every RX-FIFO read with hardcoded zeros — a connected device could
  not answer. The new hook lets a modeled slave respond: during a master transaction the
  emulator recovers the 7-bit device address + register pointer from the bytes written
  this transaction (the standard `write [addr+W, reg]` → restart → `write [addr+R]` →
  `read` shape) and calls `fn(address, register)` for each read byte (the register
  auto-increments across a burst read). Passing `null` removes it; **with no slave,
  reads still return 0 — no regression** to the existing master-read behavior.
- New emu test: a BME280-style slave at address `0x76` answers its chip-ID register
  `0xD0` with `0x60`, and firmware reads it back over a real I²C master transaction.

This is the **foundation for the next breadth class — I²C digital sensors** (BME280,
GY-521/MPU-6050, …), which (unlike the analog→ADC slices) exchange register bytes over
the bus rather than sourcing a voltage. A device-model registry + a cosim bus-device
binding build on this hook in follow-ups.

### Verified
- On main: `npm run -w @protopulse/emu test` → **6 files / 326 tests pass** (239 ESP32-S3,
  incl. the new I²C slave test; the existing no-slave READ test still returns zeros).
  Targeted `tsc --noEmit` on `@protopulse/emu` → **EXIT=0**.

## 2026-06-23 — Breadth slice 3: FC-28 soil moisture → ADC co-sim (BL-0891)

### Added
- **`core:soil-moisture` SPICE emitter** (`@protopulse/sim`, `models.ts`): the FC-28
  resistive soil-moisture module. Its analog output AO (pin 4) is modeled as a
  **supply-dependent behavioral source** (a SPICE B-source, unlike the fixed DC sources
  of slices 1–2): `AO = V_supply · (1 − moisture)`, referenced to GND. Web-verified
  direction — dry soil → high AO (≈VCC), wet soil → low AO (≈0). The moisture fraction
  (0=dry … 1=wet, default 0.5) rides on the placed part's `value`; a simplified linear
  stand-in for the real non-linear, board-dependent curve (the digital DO is not modeled).
- **`packages/cosim/src/quantum.soil.cosim.test.ts`** — breadth slice 3, built TDD. Real
  closed loop: VCC(3.3 V) → soil VCC, AO → MID (ADC ch0); real `Esp32s3Core` runs
  `esp32s3-adc0-read.bin` through `runCosimClosedLoop`. Asserts MID solves **2.475 V @
  moisture 0.25** and **0.825 V @ moisture 0.75**, settled ADC reads track ±0.005 V, UART
  code = round(V/3.3 × 4095), and wetter soil reads lower (`wet < dry`) — moisture drives
  the reading. First slice to exercise a supply-dependent B-source through the closed loop.

### Verified
- On main: `npm run -w @protopulse/cosim test` → **8 files / 84 tests pass** (was 79; +5).
  Targeted `tsc --noEmit` on `@protopulse/sim` and `@protopulse/cosim` → **EXIT=0**.

## 2026-06-23 — Breadth slice 2: potentiometer → ADC co-sim (BL-0890)

### Added
- **`core:pot-10k` SPICE emitter** (`@protopulse/sim`, `models.ts`): the 10 kΩ rotary
  potentiometer, a 3-terminal voltage divider — two resistors summing to 10 kΩ
  (A–WIPER = 10k·pos, WIPER–B = 10k·(1−pos)), where the wiper fraction `pos` (A→B,
  default 0.5) rides on the placed part's `value` (1 Ω floor avoids a 0 Ω element at the
  travel limits). Generalizes the slice-1 analog-ADC pattern from a 2-pin source to a
  3-terminal device.
- **`packages/cosim/src/quantum.pot.cosim.test.ts`** — breadth slice 2, built TDD. Real
  closed loop: VCC(3.3 V) → pot A, WIPER → MID (ADC ch0), B → GND, so `V_wiper = 3.3·(1−pos)`.
  A real `Esp32s3Core` runs `esp32s3-adc0-read.bin` through `runCosimClosedLoop`; asserts
  MID solves **2.31 V @ pos 0.3** and **0.99 V @ pos 0.7**, settled ADC reads track ±0.005 V,
  UART code = round(V/3.3 × 4095). The pos=0.7 case proves a *variable* input — different
  wiper positions solve to different node voltages, which the firmware reads back.

### Verified
- On main: `npm run -w @protopulse/cosim test` → **7 files / 79 tests pass** (was 74; +5).
  Targeted `tsc --noEmit` on `@protopulse/sim` and `@protopulse/cosim` → **EXIT=0** (the
  project-wide `check:packages` OOM-terminates — the known trap; verified per-package).

## 2026-06-23 — Breadth slice 1: TMP36 analog sensor → ADC co-sim (BL-0889)

### Added
- **`core:tmp36` SPICE emitter** (`@protopulse/sim`, `models.ts`): the Analog Devices
  TMP35/36/37 analog temperature sensor, modeled as an ideal DC source on VOUT (pin 2)
  referenced to GND (pin 3) — `Vout = 10 mV/°C · T + 500 mV`. The operating temperature
  rides on the placed part's `value` (a bare °C number, default 25 °C); there is no
  per-instance parametrics map in the emitter path, so `value` is the settable channel.
- **`packages/cosim/src/quantum.tmp36.cosim.test.ts`** — the first post-gate **breadth**
  slice, built TDD (red → green). Real closed loop, no mocks: VCC(3.3 V) → TMP36 → MID
  (bound to ADC ch0); a real `Esp32s3Core` runs `esp32s3-adc0-read.bin` through the real
  `runCosimClosedLoop`. Asserts MID solves **0.75 V @ 25 °C** and **1.00 V @ 50 °C**, the
  firmware's settled ADC reads track the node to ±0.005 V, and the UART-reported 12-bit
  code = round(Vout/3.3 × 4095). The 50 °C case proves a *transfer function*, not a
  constant (a hardcoded 0.75 V would fail it).

### Verified
- On main: `npm run -w @protopulse/cosim test` → **6 files / 74 tests pass** (was 69; +5).
  Targeted `tsc --noEmit` on `@protopulse/sim` and `@protopulse/cosim` → **EXIT=0** (the
  project-wide `check:packages` OOM-terminates — the known trap; verified per-package).

## 2026-06-23 — ESP32-S3 completion gate CERTIFIED (criterion (3) co-sim closed loop)

### Added
- **ESP32-S3 ADC0 reader firmware sample** (`packages/emu/samples/esp32s3-adc0-read.bin`
  + self-verifying `gen-adc0-read.mts`): reads SAR ADC1 channel 0 in a loop and TX's
  each 12-bit result over UART0. The missing artifact for the co-sim closed loop.

### Verified
- **ESP32-S3 base completion gate, criterion (3) — co-sim closed loop** (ROADMAP §v0.5):
  new integration test `packages/cosim/src/quantum.esp32s3.cosim.test.ts` proves the loop
  end-to-end with REAL components (no mocks). A real resistor divider (`core:pwr-vcc`
  3.3 V → R1 10k → net **MID** → R2 10k → `core:pwr-gnd`) SPICE-solves MID to 1.65 V; a
  real `Esp32s3Core` loaded with `esp32s3-adc0-read.bin` reads ADC channel 0 through the
  real `runCosimClosedLoop` quantum engine (`packages/cosim/src/quantum.ts`), which feeds
  back the bound net's solved voltage. Assertions: `adcReads` non-empty, all channel 0;
  settled reads (quantum 1+) track MID to **±0.02 V**; the firmware's UART output decodes
  to **code 2048 = round(1.65/3.3×4095)** — the value reached the firmware, not just the
  sampler log. TDD red-check confirmed it fails for the right reason at a wrong expected V.
- `npm run -w @protopulse/cosim test`: **5 files / 69 tests pass**; `npm run check:packages`
  (tsc -p packages): **0 errors**.
- **All four gate criteria now met** — (1) emu tests (238 ESP32-S3), (2) app smoke,
  (3) co-sim closed loop, (4) co-sim pin labels. The ESP32-S3 foundation is certified;
  next is board/sensor/module breadth.

## 2026-06-23 — ESP32-S3 completion gate: criterion (2) E2E app smoke certified

### Verified
- **ESP32-S3 base completion gate, criterion (2) — E2E app smoke** (ROADMAP
  §v0.5): drove the new-engine editor (`@protopulse/app`, port 5174) end to end —
  opened the Firmware panel, set the core picker to **ESP32-S3 (Xtensa LX7, 240 MHz)**,
  loaded `packages/emu/samples/esp32s3-blink-io5.bin` (48-byte raw image, "Firmware
  loaded — ESP32-S3 @ 240MHz"), and ran it. **IO5 toggled** in the logic-analyzer pin
  traces (68,000,000 cycles / t = 283 ms @ 240 MHz; 9,079 painted pixels on the waveform
  canvas — not blank). The blink is cycle-exact, zero-jitter per the `blinks IO5 with
  cycle-exact spacing` unit test, so the dense toggle reads as the solid band the sample
  README predicts. Driven headless via Playwright against the live dev server.
- **No code change** — this is a certification of existing, shipped integration
  (FirmwarePanel + the slice-161 blink sample). Gate status now: (1) ✅ tests (238
  ESP32-S3), (2) ✅ app smoke, (4) ✅ co-sim pin labels; **only (3) co-sim closed loop
  remains** before the ESP32-S3 foundation is certified and board/sensor breadth begins.
- `npm run -w @protopulse/emu test` re-run fresh: **325 package tests pass (238
  ESP32-S3)**.

## 2026-06-20 — ESP32-S3 slice 163: AES-CFB8 (completes the AES_BLOCK_MODE matrix)

### Added
- **AES-CFB8 coverage** (@protopulse/emu): the GDMA-fed AES-DMA path now models 8-bit
  (byte-segment) cipher-feedback mode (`AES_BLOCK_MODE = 4`), encrypt and decrypt. Each
  input byte encrypts the 128-bit shift register, XORs the most-significant keystream
  byte, then shifts the register left one byte and feeds the ciphertext byte back at the
  least-significant end — the output byte when encrypting, the input byte when decrypting.
  This is the last unmodeled AES block mode; AES now covers ECB/CBC/CTR/OFB/CFB8/CFB128/
  GCM(+AAD) — the full enum.

### Verified
- Two known-answer tests run NIST SP 800-38A F.3.7 (AES-128-CFB8: key `2b7e1516…`,
  IV `000102…0f`, plaintext `6bc1bee2…` → ciphertext `3b79424c…`), two blocks each so the
  cross-block byte-feedback carry is exercised; the decrypt test round-trips the same
  vector. Both were independently confirmed against OpenSSL (`aes-128-cfb8`) before the
  tests were written. esp-idf's `esp_aes_crypt_cfb8` drives this exact DMA path
  (`aes_hal_mode_init(ESP_AES_BLOCK_MODE_CFB8)` over full blocks).
- `npm run -w @protopulse/emu test` passed with 325 package tests (236 ESP32-S3); a fresh
  `tsc -p packages/emu --noEmit` and `npm run check:packages` both reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 162: AES-192-GCM (completes the GCM key-size matrix)

### Added
- **AES-192 GCM coverage** (@protopulse/emu): proves the GDMA-fed AES-GCM path works
  with a 192-bit key (`AES_MODE = 1`, the Nk=6 key schedule), completing the
  128/192/256 matrix through the same GHASH + GCTR + tag machinery.

### Verified
- A known-answer test runs NIST GCM Test Case 8 (192-bit all-zero key, 96-bit all-zero
  IV, one all-zero plaintext block, no AAD) → ciphertext `98e7247c…84b0f600`, tag
  `2ff58d80…7514f0fb`; the vector was independently confirmed against OpenSSL
  (`aes-192-gcm`) before the test was written.
- `npm run -w @protopulse/emu test` passed with 323 package tests
  (236 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 161: Digital Signature (DS) peripheral — the crypto capstone

### Added
- **Digital Signature (DS) accelerator** (@protopulse/emu, DR_REG_DIGITAL_SIGNATURE_BASE
  0x6003D000): the fifth and final S3 crypto block, wiring together the AES, SHA, and RSA
  primitives. `SET_START` AES-256-CBC-decrypts the encrypted private-key parameter block C
  with the HMAC-derived key + IV and exposes Y (exponent) and M (modulus) from their
  little-endian regions; `SET_ME` computes the signature `Z = X^Y mod M`. Register map +
  C-block region layout (Y +0x000 / M +0x200 / Rb +0x400 / Box +0x600, IV +0x630, X +0x800,
  Z +0xA00, control +0xE00) verified against `soc/esp32s3/hwcrypto_reg.h`. Host helpers
  `loadDsKey`/`loadDsCiphertext`/`loadDsIv`/`loadDsX` stand in for the firmware writes.

### Verified
- A known-answer test signs with a fixed 512-bit RSA key: the C block was AES-256-CBC-built
  from the key params, and the resulting signature `Z` was round-trip-verified independently
  (`Z^e mod n == X`) when the vector was generated. The guest drives SET_START → SET_ME and
  reads back Z word0 `0x6c8368a0`, Z word15 `0x28044cc5`, and QUERY_CHECK = 0 — first-GREEN.
- The MD integrity check and the HMAC-downstream AES-key derivation are documented follow-ons
  (their exact hash input / box byte-order are not yet verifiable from primary sources).
- `npm run -w @protopulse/emu test` passed with 322 package tests
  (235 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 160: AES-CFB128 (encrypt + decrypt) through the AES-DMA path

### Added
- **AES-CFB128 mode** (@protopulse/emu): the GDMA-fed AES-DMA path now supports
  cipher feedback (`AES_BLOCK_MODE = 5`) in both directions. The keystream is
  `E(feedback)` from the IV; the block cipher always runs forward, and the
  `AES_MODE` encrypt/decrypt bit selects the feedback source — the output
  ciphertext when encrypting, the input ciphertext when decrypting.

### Verified
- The hardware enc/dec direction convention was confirmed against primary
  sources first (ESP-IDF `aes_ll_set_mode` + the `esp_aes_crypt_cfb128` DMA path,
  which writes the caller's direction into `AES_MODE_REG` for CFB) — not guessed.
- Two known-answer tests run NIST SP 800-38A F.3.13/F.3.14 over two blocks
  (so the C₁→block-2 feedback chaining is exercised): encrypt
  `6bc1bee2…`/`ae2d8a57…` → `3b3fd92e…e83cfb4a`/`c8a64537…9f1ce58b`, and decrypt
  back. Both vectors were independently confirmed against OpenSSL (`aes-128-cfb`).
- `npm run -w @protopulse/emu test` passed with 321 package tests
  (234 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 159: AES-OFB through the AES-DMA path

### Added
- **AES-OFB mode** (@protopulse/emu): the GDMA-fed AES-DMA path now supports
  output feedback (`AES_BLOCK_MODE = 2`). The keystream block `O_i = E(O_{i-1})`
  starts from the IV and feeds back the cipher output itself, so encrypt and
  decrypt are the identical operation.

### Verified
- A known-answer test runs NIST SP 800-38A F.4.1 over **two** blocks (so the
  feedback chaining `O_2 = E(O_1)` is exercised, not just `E(IV)`): key
  `2b7e1516…`, IV `000102…0f`, plaintext `6bc1bee2…` / `ae2d8a57…` → ciphertext
  `3b3fd92e…e83cfb4a` / `7789508d…c54ed825`. The vector was independently
  confirmed against OpenSSL (`aes-128-ofb`) before the test was written.
- `npm run -w @protopulse/emu test` passed with 319 package tests
  (232 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 158: AES-256-GCM through the AES-DMA path

### Added
- **AES-256 GCM coverage** (@protopulse/emu): proves the GDMA-fed AES-GCM path
  works with a 256-bit key (`AES_MODE = 2`), not just AES-128 — the same GHASH +
  GCTR + tag machinery driven through the Nk=8 key schedule.

### Verified
- A known-answer test runs NIST GCM Test Case 15 (256-bit all-zero key, 96-bit
  all-zero IV, one all-zero plaintext block, no AAD) → ciphertext
  `cea7403d…baf39d18`, tag `d0d1c8a7…d48ab919`. The vector was independently
  confirmed against OpenSSL (`aes-256-gcm`) before the test was written.
- `npm run -w @protopulse/emu test` passed with 318 package tests
  (231 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 157: AES-GCM with additional authenticated data

### Added
- **AES-GCM AAD coverage** (@protopulse/emu): exercises the `AES_AAD_BLOCK_NUM` path —
  the leading DMA blocks are GHASHed but not encrypted, only the plaintext blocks
  become ciphertext, and the authentication tag folds in the AAD.

### Verified
- A known-answer test runs the Test Case 3 key/IV/plaintext plus a 16-byte AAD block:
  the ciphertext is unchanged (42831ec2…) but the tag now reflects the AAD
  (e5d06dc2…88d624ee), confirmed end-to-end through GDMA.
- `npm run -w @protopulse/emu test` passed with 317 package tests
  (230 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 156: AES-GCM (authenticated encryption)

### Added
- **AES-GCM** (@protopulse/emu): the authenticated-encryption mode modern TLS uses
  (`AES_BLOCK_MODE` = 6). The firmware-derived J0 is written to `AES_J0_MEM` (+0x70);
  the engine GCTR-encrypts the plaintext (counter from inc32(J0)), GHASHes the
  ciphertext, and computes the authentication tag = GHASH ⊕ E(J0) at `AES_T0_MEM`
  (+0x80). The hash subkey H = E(0) is exposed at `AES_H_MEM` (+0x60), and
  `AES_AAD_BLOCK_NUM` (+0xA0) marks leading AAD blocks. Adds a from-scratch GHASH
  GF(2¹²⁸) multiply (NIST SP 800-38D, x¹²⁸+x⁷+x²+x+1). Verified against esp-idf
  `esp_aes_gcm.c`.

### Verified
- A known-answer test runs NIST GCM Test Case 3 (no AAD, 64-byte plaintext) end-to-end
  through GDMA: ciphertext 42831ec2…473f5985 and tag 4d5c2af3…2ba6fab4, both read back
  from the descriptors and the tag register.
- `npm run -w @protopulse/emu test` passed with 316 package tests
  (229 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- GCM with AAD (the path is implemented via `AES_AAD_BLOCK_NUM`) and partial final
  blocks remain to be exercised by tests.

## 2026-06-18 — ESP32-S3 slice 155: SHA-512 over the SHA-DMA path

### Added
- **SHA-512 (and SHA-384) over DMA** (@protopulse/emu): `shaRunDma()` now selects the
  1024-bit (32-word) block size for the 64-bit-word algorithms and feeds the
  `sha512Compress` core, so the GDMA hashing path covers the full SHA family.

### Verified
- A known-answer test feeds the pre-padded "abc" SHA-512 block (32 words) over GDMA
  and confirms the digest is NIST SHA-512 ddaf35a1…a54ca49f.
- `npm run -w @protopulse/emu test` passed with 315 package tests
  (228 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 154: SHA-DMA path (GDMA-fed hashing)

### Added
- **SHA through GDMA** (@protopulse/emu): the SHA accelerator can take its
  (pre-padded) message over GDMA — real IDF hashes large buffers this way. The
  message blocks arrive on the GDMA OUT channel bound to peripheral SHA0 (trigger id
  7); the digest stays in the H registers. New registers: `SHA_DMA_BLOCK_NUM` (+0x0c),
  `SHA_DMA_START` (+0x1c), `SHA_DMA_CONTINUE` (+0x20). The new `shaRunDma()` reuses the
  existing block-compression core; `CONTINUE` accumulates onto the running digest.

### Verified
- A known-answer test feeds the pre-padded "abc" block over GDMA and confirms the
  digest read from the H registers is NIST SHA-256 ba7816bf…f20015ad.
- `npm run -w @protopulse/emu test` passed with 314 package tests
  (227 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 153: AES-DMA completion interrupt (CBC/CTR)

### Added
- **AES-DMA completion interrupt** (@protopulse/emu): completing an AES-DMA operation
  (CBC/CTR) raises the same AES done interrupt as the ECB path, routed through the
  interrupt matrix (source 76 → INTMTX + 0x134). This closes out the AES-DMA mode —
  CBC encrypt + CBC decrypt + CTR + the completion interrupt are now all modeled and
  end-to-end verified through real GDMA descriptors.

### Verified
- A known-answer test arms `AES_INT_ENA`, maps the AES source to CPU line 0, runs a
  CBC-DMA encrypt, and confirms the ISR fires exactly once (clearing `AES_INT_CLR`,
  no re-fire).
- `npm run -w @protopulse/emu test` passed with 313 package tests
  (226 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 152: AES-CTR via the AES-DMA path

### Added
- **AES-CTR through GDMA** (@protopulse/emu): `AES_BLOCK_MODE` = 3 (CTR). The engine
  encrypts the counter block to form a keystream, XORs it with the GDMA-fed input, and
  increments the counter's low 32 bits (INC32) per block. The counter starts at the IV
  register. Same GDMA OUT/IN data path as CBC.

### Verified
- A known-answer test runs the NIST SP 800-38A F.5.1 AES-128-CTR vector end-to-end
  through GDMA: counter f0f1f2f3…ff, plaintext 6bc1bee2… → ciphertext 874d6191…990db6ce.
- `npm run -w @protopulse/emu test` passed with 312 package tests
  (225 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 151: AES-CBC via the AES-DMA path (encrypt + decrypt)

### Added
- **AES-CBC through GDMA** (@protopulse/emu): on the S3, all non-ECB AES modes run
  through the AES-DMA path (GDMA-fed data), not the CPU-FIFO path. The AES engine now
  consumes plaintext from the GDMA OUT channel connected to peripheral AES0 (trigger
  id 6) and produces ciphertext into the GDMA IN channel, with CBC chaining seeded by
  the IV register (`AES_IV_BASE` +0x50). New registers: `AES_DMA_ENABLE` (+0x90),
  `AES_BLOCK_MODE` (+0x94, CBC=1), `AES_BLOCK_NUM` (+0x98). Both encrypt and decrypt
  are supported, reusing the existing AES round core; the IV is updated to the last
  cipher block for chaining. Verified against esp-idf `esp_aes.c` (`esp_aes_process_dma`)
  + `aes_ll.h`.

### Verified
- Two known-answer tests run the NIST SP 800-38A F.2.1/F.2.2 AES-128-CBC vectors
  end-to-end through real GDMA descriptors: plaintext 6bc1bee2… encrypts to
  7649abac…12e9197d, and that ciphertext decrypts back to the plaintext.
- `npm run -w @protopulse/emu test` passed with 311 package tests
  (224 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- AES-CTR mode and a dedicated DMA-mode interrupt test remain follow-on (the AES done
  interrupt already fires on DMA completion via the existing matrix routing).

## 2026-06-18 — ESP32-S3 slice 150: hardware RNG (WDEV_RND_REG)

### Added
- **Hardware RNG** (@protopulse/emu): `esp_random()` reads `WDEV_RND_REG`
  (0x6003507C) for entropy — used pervasively by real IDF firmware (mbedTLS, lwIP,
  BT). The emulator models a deterministic-from-reset xorshift32 generator (seed
  0xa5a5a5a5) so guest runs are reproducible while each read advances the stream and
  returns a fresh 32-bit word.

### Verified
- A known-answer test reads the register twice and confirms the deterministic stream
  v1 = 0x3330a88d, v2 = 0xe202683d.
- `npm run -w @protopulse/emu test` passed with 309 package tests
  (222 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 149: HMAC-SHA256 accelerator

### Added
- **HMAC accelerator** (@protopulse/emu): the fourth S3 crypto block, at
  `DR_REG_HMAC_BASE` (0x6003E000), computing HMAC-SHA256. Flow:
  `SET_PARA_PURPOSE` (+0x44) = 8 (upstream), `SET_PARA_KEY` (+0x48) = eFuse key
  block, `SET_PARA_FINISH` (+0x4c); feed a 512-bit block to `WR_MESSAGE_MEM`
  (+0x80, 16 words) + `SET_MESSAGE_ONE` (+0x50); `SET_RESULT_FINISH` (+0x5c) = 2;
  read the 256-bit MAC from `RD_RESULT_MEM` (+0xc0, 8 words). The key is the
  eFuse-programmed 256-bit block, loaded via a new `loadHmacKey()` host helper.
  HMAC-SHA256 is computed exactly with a from-scratch pure SHA-256 digest (RFC 2104
  inner/outer construction), not the block-by-block hardware path. Register offsets
  and flow verified against esp-idf master (`hmac_reg.h` + `hmac_ll.h` + `hmac_hal.c`),
  since the on-disk Arduino SDK ships no `hmac_reg.h`.

### Verified
- A known-answer test computes HMAC-SHA256(key = 32×0x0b, message = 64×0x61) =
  `91acb47f…0e012f1e` and confirms result words [0] and [7] read from the MAC output.
- `npm run -w @protopulse/emu test` passed with 308 package tests
  (221 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- Multi-block message feeding and the partial-block padding path
  (`SET_MESSAGE_PAD`/`SET_MESSAGE_ING`), the HMAC matrix interrupt, and the
  downstream JTAG/DS key modes remain follow-on.

## 2026-06-18 — ESP32-S3 slice 148: USB-Serial-JTAG TX-empty interrupt

### Added
- **USB-Serial-JTAG controller — TX-empty interrupt** (@protopulse/emu): the
  `SERIAL_IN_EMPTY` status (INT bit3) now tracks the TX FIFO — staging a byte
  (EP1 write) clears it and flushing (`WR_DONE`) empties the FIFO and re-asserts it,
  raising the interrupt when enabled (reset default 1, matching the hardware). This
  completes the USB-Serial-JTAG interrupt surface (RX `SERIAL_OUT_RECV_PKT` + TX
  `SERIAL_IN_EMPTY`).

### Verified
- A known-answer test stages a byte (clearing IN_EMPTY), arms `INT_ENA` bit3, maps
  the source to CPU line 0, then flushes — the now-empty FIFO fires the interrupt
  exactly once (ISR clears it, counter stays 1), and the flushed byte still reaches
  the host.
- `npm run -w @protopulse/emu test` passed with 307 package tests
  (220 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 147: USB-Serial-JTAG RX interrupt

### Added
- **USB-Serial-JTAG controller — RX interrupt** (@protopulse/emu): host console
  input now raises `SERIAL_OUT_RECV_PKT` (INT bit2). `INT_ENA_REG` (+0x10) arms it,
  `INT_CLR_REG` (+0x14) clears it, `INT_RAW_REG` (+0x08) / `INT_ST_REG` (+0x0c) report
  status, and the controller's matrix map sits at the explicit silicon offset
  `INTERRUPT_CORE0_USB_DEVICE_INT_MAP_REG` = INTMTX + 0x180. This completes the
  USB-Serial-JTAG console (TX + RX + interrupt).

### Verified
- A known-answer test injects a byte, arms `INT_ENA`, maps the source to CPU line 0,
  and confirms the ISR fires exactly once: it drains `EP1_REG` and clears the raw bit,
  and the counter stays 1 (no re-fire).
- `npm run -w @protopulse/emu test` passed with 306 package tests
  (219 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The `SERIAL_IN_EMPTY` (TX-FIFO-empty) interrupt remains follow-on.

## 2026-06-18 — ESP32-S3 slice 146: USB-Serial-JTAG RX console

### Added
- **USB-Serial-JTAG controller — RX console** (@protopulse/emu): host console input.
  A new `usbSerialJtagWrite(byte)` host method (mirroring `uartWrite`) injects bytes
  into the OUT endpoint. `EP1_CONF_REG` (+0x04) raises `SERIAL_OUT_EP_DATA_AVAIL`
  (bit2) while input is pending, and each read of `EP1_REG` (+0x00) pops the next RX
  byte from the FIFO.

### Verified
- A known-answer test injects 'X', confirms `EP1_CONF` reads data-avail+data-free
  (0b110 = 6), pops the byte (0x58), then re-reads `EP1_CONF` (RX drained → 2).
- `npm run -w @protopulse/emu test` passed with 305 package tests
  (218 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The USB-Serial-JTAG interrupts (`SERIAL_IN_EMPTY` / `SERIAL_OUT_RECV_PKT`, matrix
  map at INTMTX + 0x180) remain follow-on. The console now does TX and RX.

## 2026-06-18 — ESP32-S3 slice 145: USB-Serial-JTAG TX console

### Added
- **USB-Serial-JTAG controller — TX console** (@protopulse/emu): a new peripheral
  at `DR_REG_USB_DEVICE_BASE` (0x60038000), the default console on modern ESP32-S3
  boards. Bytes written to `EP1_REG` (+0x00, RDWR_BYTE) stage into the TX FIFO;
  writing `WR_DONE` (bit0 of `EP1_CONF_REG` +0x04) flushes them to the host.
  `EP1_CONF_REG` reads back `SERIAL_IN_EP_DATA_FREE` (bit1, the TX FIFO always has
  room in the model). A new `drainUsbSerialJtag()` host method returns the flushed
  console bytes, mirroring `drainUart()`.

### Verified
- A known-answer test reads `EP1_CONF` (confirms the data-free bit), writes 'H','i'
  to the FIFO, flushes with `WR_DONE`, and confirms the two bytes land in
  `drainUsbSerialJtag()`.
- `npm run -w @protopulse/emu test` passed with 304 package tests
  (217 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The RX path (host → guest bytes via `SERIAL_OUT_EP_DATA_AVAIL`), and the
  USB-Serial-JTAG interrupts (`SERIAL_IN_EMPTY` / `SERIAL_OUT_RECV_PKT`, matrix
  map at INTMTX + 0x180), remain follow-on.

## 2026-06-18 — ESP32-S3 slice 144: RSA done-interrupt routing

### Added
- **RSA completion interrupt** (@protopulse/emu): the RSA accelerator now raises
  its done interrupt through the interrupt matrix. Completing an operation (MODEXP,
  MOD_MULT, or MULT) asserts a level interrupt gated by `RSA_INTERRUPT_REG` (+0x82c)
  and cleared by `RSA_CLEAR_INTERRUPT` (+0x81c). RSA is interrupt source 75
  (`ETS_RSA_INTR_SOURCE`), so its matrix map sits at `INTERRUPT_CORE0_RSA_INT_MAP_REG`
  = INTMTX + 0x130 (the explicit silicon offset, read directly from
  interrupt_core0_reg.h). This completes the RSA peripheral.

### Verified
- A known-answer test arms `RSA_INTERRUPT_REG`, maps source 75 to CPU line 0, runs
  one modexp, and confirms the ISR fires exactly once: the counter stays 1 after
  the ISR clears `RSA_CLEAR_INTERRUPT` (no level re-fire).
- `npm run -w @protopulse/emu test` passed with 303 package tests
  (216 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 143: RSA modular multiply + full-width multiply

### Added
- **RSA/MPI accelerator — MOD_MULT and MULT** (@protopulse/emu): two more
  operations on the RSA peripheral. `RSA_MOD_MULT_START` (+0x810) computes
  Z = (X · Y) mod M with the same operand-block layout as MODEXP. `RSA_MULT_START`
  (+0x814) computes the full-width product Z = X · Y (no modulus): X sits in the
  X block while Y is left-extended into the Z block at word-offset num_words, and
  `RSA_LENGTH` (+0x804) = num_words·2 − 1; the 2·num_words-word product is read
  back from the Z block. Both use exact BigInt arithmetic.

### Verified
- Known-answer tests: MOD_MULT of 123456·789 mod 1000000 = 406784, and MULT of
  0xffffffff · 2 = 0x1fffffffe (Z[0]=0xfffffffe, Z[1]=1).
- `npm run -w @protopulse/emu test` passed with 302 package tests
  (215 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The RSA done interrupt routed through the matrix (source 75 → INTMTX + 0x130)
  remains follow-on. The accelerator now does MODEXP, MOD_MULT, and MULT.

## 2026-06-18 — ESP32-S3 slice 142: RSA accelerator modular exponentiation

### Added
- **RSA/MPI accelerator — modular exponentiation** (@protopulse/emu): a new
  peripheral at `DR_REG_RSA_BASE` (0x6003C000). Operand memory blocks hold
  little-endian 32-bit words — M @ +0x000, Z (result) @ +0x200, Y (exponent) @
  +0x400, X (base) @ +0x600. Writing 1 to `RSA_MODEXP_START` (+0x80c) with
  `RSA_LENGTH` (+0x804) = num_words − 1 computes Z = X^Y mod M; `RSA_QUERY_INTERRUPT`
  (+0x818) reads 1 when the operation is done and `RSA_CLEAR_INTERRUPT` (+0x81c)
  clears it. The big-number math is done exactly with arbitrary-precision BigInt
  (square-and-multiply modpow over the little-endian operand words) — the
  hardware's Montgomery Rinv/Mprime inputs are accepted and have no effect on the
  result. Block bases, operation registers, length convention, operand endianness,
  and the done-status polarity were all verified against esp-idf master
  (`bignum_alt.c` non-ESP32 branch + `mpi_ll.h` + `mpi_periph.c`).

### Verified
- A known-answer test runs the textbook RSA vector (n=3233 = 61·53, e=17, m=65)
  and confirms c = 65^17 mod 3233 = 2790 read back from the Z block, with the
  done-status handshake (`QUERY_INTERRUPT` → `CLEAR_INTERRUPT`).
- `npm run -w @protopulse/emu test` passed with 300 package tests
  (213 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The MOD_MULT (Z = X·Y mod M) and plain MULT (Z = X·Y, Y left-extended into the
  Z block) operations, and the RSA done interrupt routed through the matrix
  (source 75 → INTMTX + 0x130), remain follow-on.

## 2026-06-18 — ESP32-S3 slice 141: correct SHA/AES interrupt-matrix map offsets

### Fixed
- **SHA/AES interrupt-matrix map offsets** (@protopulse/emu): the SHA and AES
  done-interrupt matrix-map registers were placed at 0x150 / 0x14c, extrapolated
  with a `4·source` formula using wrong source numbers (84/83). The ESP32-S3
  `interrupt_core0_reg.h` gives the authoritative explicit offsets:
  `INTERRUPT_CORE0_SHA_INT_MAP_REG` = INTMTX + 0x138 (source 77) and
  `INTERRUPT_CORE0_AES_INT_MAP_REG` = INTMTX + 0x134 (source 76). The source enum
  has gaps relative to the map-register layout past the I2C/SPI region, so the
  formula silently diverges from silicon — every map offset is now read directly
  from the header. (The earlier tests passed only because the model stored and
  dispatched at the same offset; eFuse and all maps below 0x0b4 were already
  correct.)

### Verified
- The SHA and AES done-interrupt known-answer tests still pass at the corrected
  offsets; `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-18 — ESP32-S3 slice 140: AES done-interrupt routing

### Added
- **AES completion interrupt** (@protopulse/emu): the AES accelerator now raises
  its done interrupt through the interrupt matrix. Completing a block (writing
  `AES_TRIGGER` +0x48) asserts a level interrupt that is gated by `AES_INT_ENA`
  (+0xb0) and cleared by `AES_INT_CLR` (+0xac). AES is interrupt source 83
  (`ETS_AES_INTR_SOURCE`, one slot before SHA=84), so its matrix map sits at
  `INTERRUPT_CORE0_AES_INT_MAP_REG` = INTMTX + 0x14c (0x040 + 4·(83−16)) — the
  same eFuse/SHA routing pattern.

### Verified
- A new known-answer test arms `AES_INT_ENA`, maps source 83 to CPU line 0,
  encrypts one AES-128 block, and confirms the ISR fires exactly once: the
  counter stays 1 after the ISR clears `AES_INT_CLR` (no level re-fire).
- `npm run -w @protopulse/emu test` passed with 299 package tests
  (212 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- CBC/CTR chaining with IV and the AES DMA path remain follow-on. The AES
  accelerator now does ECB encrypt/decrypt for all three key sizes plus its
  completion interrupt.

## 2026-06-18 — ESP32-S3 slice 139: AES ECB decrypt (128/192/256)

### Added
- **AES decrypt** (@protopulse/emu): the AES accelerator now does the inverse
  cipher for all three key sizes (`AES_MODE` 4/5/6 = AES-128/192/256 decrypt).
  Implements the FIPS-197 inverse cipher — the inverse S-box (derived from the
  computed forward S-box), InvShiftRows, InvSubBytes, and InvMixColumns via a
  general GF(2⁸) multiply — reusing the shared key schedule. The mode dispatch
  selects encrypt vs decrypt from the mode's high bit and the key size from its
  low bits.

### Verified
- Two new known-answer tests round-trip the FIPS-197 vectors: AES-128 decrypt of
  `69c4e0d8…70b4c55a` and AES-256 decrypt of `8ea2b7ca…4b496089` both recover the
  plaintext `00112233…ff`.
- `npm run -w @protopulse/emu test` passed with 298 package tests
  (211 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- CBC/CTR chaining with IV, the DMA path, and the AES interrupt remain follow-on.
  The accelerator now does AES-128/192/256 ECB encrypt **and** decrypt.

## 2026-06-18 — ESP32-S3 slice 138: AES-192 and AES-256 ECB modes

### Added
- **AES-192 and AES-256 encrypt** (@protopulse/emu): extends slice 137's AES
  accelerator to the larger key sizes (`AES_MODE` 1 = AES-192, 2 = AES-256). The
  key expansion is generalized over `Nk` = 4/6/8 (including the AES-256 extra
  `SubWord` at `wordIdx % Nk == 4`) and the cipher runs `Nr` = `Nk`+6 rounds.

### Verified
- Two new FIPS-197 known-answer tests confirm AES-192("00112233…ff") =
  `dda97ca4…ec0d7191` and AES-256(…) = `8ea2b7ca…4b496089`. These caught a
  refactor bug — the MixColumns guard had been left hardcoded as `round !== 10`
  instead of `round !== Nr`, which only affected the 12/14-round modes; the
  self-checking vectors flagged it immediately and the fix was verified.
- `npm run -w @protopulse/emu test` passed with 296 package tests
  (209 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- AES decrypt (inverse S-box + InvMixColumns), CBC/CTR with IV, the DMA path,
  and the AES interrupt remain follow-on; the accelerator now does AES-128/192/
  256 ECB encrypt.

## 2026-06-18 — ESP32-S3 slice 137: AES-128 ECB accelerator (new peripheral)

### Added
- **AES accelerator, AES-128 ECB encrypt** (@protopulse/emu): a new peripheral at
  `DR_REG_AES_BASE` (0x6003A000), verified against `hwcrypto_reg.h` and the
  `aes_ll.h` HAL. Models the CPU-driven path: `AES_KEY` (+0x00), `AES_TEXT_IN`
  (+0x20), `AES_MODE` (+0x40, AES-128 encrypt = 0), `AES_TRIGGER` (+0x48, write 1
  to start), `AES_STATE` (+0x4c, reads DONE=2 — instantaneous in the model), and
  `AES_TEXT_OUT` (+0x30). The FIPS-197 cipher is implemented from scratch: the
  S-box is **generated algebraically** (GF(2⁸) inverse via log/antilog tables +
  the affine transform — no 256-byte constant table is transcribed), plus the
  AES-128 key expansion and the round transforms (SubBytes/ShiftRows/MixColumns/
  AddRoundKey).

### Verified
- A new known-answer test runs the FIPS-197 AES-128 vector (key `000102…0f`,
  plaintext `00112233…ff`) and confirms the ciphertext `69c4e0d8…70b4c55a` and
  `AES_STATE`=DONE — passed on the first run, validating the computed S-box, the
  key schedule, and the cipher.
- `npm run -w @protopulse/emu test` passed with 294 package tests
  (207 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Note
- This slice was unblocked by reading the ESP-IDF register headers **locally**
  from the PlatformIO Arduino-ESP32 framework when outbound network/DNS was
  unavailable — the offline fallback for peripheral register research.

### Cuts (follow-on)
- AES-192/256, decrypt (inverse S-box + InvMixColumns), CBC/CTR with IV, the DMA
  path, and the AES interrupt remain follow-on; this lands the AES-128 ECB
  encrypt path.

## 2026-06-18 — ESP32-S3 slice 136: SHA-512 and SHA-384 modes (64-bit algorithms)

### Added
- **SHA-512 and SHA-384** (@protopulse/emu): the SHA accelerator now models the
  64-bit-word algorithms (`SHA_MODE` 384=3, 512=4). These use 1024-bit (128-byte
  = 32-word) message blocks and a 512-bit (16-word) digest region, with 64-bit
  values laid out hi-32-bit-word-first — so `shaText` is now 32 words and `shaH`
  16 words. The FIPS 180-4 SHA-512 compression (80 rounds, the σ/Σ functions,
  the 80×64-bit K table, the SHA-512 and SHA-384 IVs) is implemented from scratch
  over `[hi, lo]` 32-bit pairs with add-with-carry and cross-boundary
  rotate/shift helpers. SHA-384 reuses the SHA-512 compression with the SHA-384
  IV and a truncated 6×64-bit (12-word) digest. The K table and IVs were taken
  from canonical sources (mbed-TLS `sha512.c`, Linux `sha2.h`), not transcribed.

### Verified
- Two new known-answer tests confirm SHA-512("abc") = `ddaf35a1…a54ca49f`
  (16 words) and SHA-384("abc") = `cb00753f…34c825a7` (12 words) against the NIST
  vectors — both passed on the first run, validating the 64-bit arithmetic, the
  80 round constants, and the hi-word-first layout.
- `npm run -w @protopulse/emu test` passed with 293 package tests
  (206 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- The SHA DMA path (`SHA_DMA_START`, `SHA_BLOCK_NUM`) remains follow-on. With
  this, the SHA accelerator models all of SHA-1/224/256/384/512 plus the
  completion interrupt and multi-block accumulation.

## 2026-06-17 — ESP32-S3 slice 135: SHA multi-block (START + CONTINUE) coverage

### Added
- **Two-block SHA-256 coverage** (@protopulse/emu): a new test exercises the
  multi-block path that `SHA_CONTINUE` implements but that had no coverage. It
  hashes the 56-byte NIST message `"abcdbcde…nopq"`, which spans two padded
  512-bit blocks: `SHA_START` hashes block 1, `SHA_CONTINUE` accumulates block 2
  onto the running state. The digest matches the NIST SHA-256 vector
  (`248d6a61…19db06c1`), confirming the running-state accumulation across blocks.
  No production change — locks an untested real path.

### Verified
- `npm run -w @protopulse/emu test` passed with 291 package tests
  (204 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

## 2026-06-17 — ESP32-S3 slice 134: SHA accelerator interrupt routing

### Added
- **SHA completion interrupt** (@protopulse/emu): the SHA accelerator now routes
  its done interrupt through the interrupt matrix. SHA is interrupt source 84
  (`interrupts.h` ETS_SHA_INTR_SOURCE), so its map register sits at
  `INTERRUPT_CORE0` + 0x150 (`0x040 + 4*(84-16)`). `SHA_INT_ENA` (+0x28) arms the
  level interrupt; completing a block (`SHA_START`/`SHA_CONTINUE`) asserts it;
  `SHA_CLEAR_IRQ` (+0x24) clears it. Implemented with the same
  `recomputeIrq`/`raise` pattern as the eFuse routing (slice 123) —
  `shaIntRaw`/`shaIntEna`/`shaIntMaps` plus the matrix read/write dispatch.

### Verified
- A new test arms `SHA_INT_ENA`, maps source 84 to a CPU level-1 line, hashes the
  padded "abc" block, and confirms the ISR runs exactly once and stays cleared
  (no re-fire of the level interrupt after `SHA_CLEAR_IRQ`).
- `npm run -w @protopulse/emu test` passed with 290 package tests
  (203 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- SHA-384 / SHA-512 (64-bit-word algorithms) and the DMA path remain follow-on;
  the SHA accelerator now models the three 32-bit algorithms plus the completion
  interrupt.

## 2026-06-17 — ESP32-S3 slice 133: SHA accelerator SHA-1 + SHA-224 modes

### Added
- **SHA-1 and SHA-224 modes** (@protopulse/emu): extends slice 132's SHA
  accelerator to two more algorithms selected via `SHA_MODE` (SHA-1 = 0,
  SHA-224 = 1). SHA-224 reuses the SHA-256 block compression with the FIPS 180-4
  SHA-224 initial vector and a truncated 7-word digest. SHA-1 adds a from-scratch
  80-round SHA-1 compression onto a 5-word digest (the rotate-lefts are expressed
  via the shared rotate-right helper). `SHA_START` now loads the per-mode IV and
  runs the matching compression; `SHA_CONTINUE` accumulates onto the running
  state for the selected mode.

### Verified
- Two new known-answer tests feed the padded "abc" block: SHA-1("abc") =
  `a9993e36…9cd0d89d` (5 words) and SHA-224("abc") = `23097d22…e36c9da7`
  (7 words), both matching the NIST vectors — so any compression bug fails
  immediately.
- `npm run -w @protopulse/emu test` passed with 289 package tests
  (202 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- SHA-384 / SHA-512 (64-bit-word algorithms), the DMA path, and the SHA
  interrupt remain follow-on. The SHA accelerator now models the three 32-bit
  algorithms (SHA-1/224/256).

## 2026-06-17 — ESP32-S3 slice 132: SHA-256 hardware accelerator (new peripheral)

### Added
- **SHA accelerator, SHA-256 non-DMA path** (@protopulse/emu): a new peripheral
  at `DR_REG_SHA_BASE` (0x6003B000), verified against `hwcrypto_reg.h` /
  `sha_ll.h` / `sha_hal.c`. Models `SHA_MODE` (+0x00, SHA-256 = 2), `SHA_START`
  (+0x10: load the SHA-256 IV then run the per-block compression), `SHA_CONTINUE`
  (+0x14: accumulate onto the running state), `SHA_BUSY` (+0x18: reads 0 —
  compression is instantaneous in the model), the 16-word message region
  `SHA_TEXT_BASE` (+0x80), and the 8-word digest region `SHA_H_BASE` (+0x40).
  The FIPS 180-4 block compression (64-round schedule + K table + IV) is
  implemented from scratch. Message padding is the firmware's responsibility on
  real hardware (the engine only compresses already-padded 64-byte blocks), so
  the model matches: it runs one compression per START/CONTINUE.

### Verified
- A new test feeds the padded "abc" block and confirms the digest equals the
  NIST SHA-256("abc") vector (`ba7816bf 8f01cfea … f20015ad`) — a self-checking
  known-answer test, so any compression-function bug fails immediately.
- `npm run -w @protopulse/emu test` passed with 287 package tests
  (200 ESP32-S3); a fresh `tsc --noEmit --incremental false` reported 0 errors.

### Cuts (follow-on)
- SHA-1 / SHA-224 / SHA-384 / SHA-512 modes, the DMA path (`SHA_DMA_START`),
  and the SHA interrupt remain follow-on; this slice lands the SHA-256
  CPU-driven path that mbedTLS uses by default.

## 2026-06-17 — ESP32-S3 slice 131: deep-sleep touch wake coverage (all wake families covered)

### Added
- **Deep-sleep touch-controller wake coverage** (@protopulse/emu): the final
  deep-sleep wake family. Unlike the pin-edge GPIO/EXT sources, the touch wake
  fires from a one-shot scan triggered in firmware while asleep
  (`TOUCH_CTRL2.TOUCH_START_EN`, RTC_CNTL + 0x10c), which latches
  `RTC_TOUCH_TRIG_EN` = BIT(8). A new test arms the touch scan (SCAN_CTRL pad 1
  + THRES1) in deep sleep and confirms the scan resets the core with
  `DEEPSLEEP_RESET`. With this, **all five deep-sleep wake families — timer
  (124), GPIO (129), EXT0/EXT1 (130), and touch (131) — now have coverage**
  proving the source-agnostic deep-sleep reset path. No production change.

### Verified
- `npm run -w @protopulse/emu test` passed with 286 package tests
  (199 ESP32-S3); a fresh `tsc --noEmit --incremental false` on the package
  reported 0 errors (exit 0).

## 2026-06-17 — ESP32-S3 slice 130: deep-sleep EXT0 + EXT1 wake coverage

### Added
- **Deep-sleep EXT0 and EXT1 wake coverage** (@protopulse/emu): two new tests
  extend slice 129's GPIO coverage to the remaining RTC-IO wake families,
  confirming the source-agnostic deep-sleep branch resets the core with
  `DEEPSLEEP_RESET` for each. EXT0 arms `EXT_WAKEUP_CONF.EXT_WAKEUP0_LV`
  (RTC_CNTL + 0x64, bit 30) + `RTC_IO_EXT_WAKEUP0_SEL` (RTC_IO + 0xdc); EXT1
  arms `EXT_WAKEUP1_LV` (bit 31) + the `EXT_WAKEUP1_SEL` RTC-GPIO bitmask
  (RTC_CNTL + 0xe0). Both enter deep sleep, drive `IO7` high, and confirm the
  reboot marker. No production change — pure coverage of real paths.

### Verified
- `npm run -w @protopulse/emu test` passed with 285 package tests
  (198 ESP32-S3); a fresh `tsc --noEmit --incremental false` on the package
  reported 0 errors (exit 0) — the reliable check per the slice-129 lesson.

### Honest cuts
- Touch-controller deep-sleep wake (`RTC_TOUCH_TRIG_EN`) is driven by the touch
  state machine rather than a `setPin` edge, so its deep-sleep coverage remains
  a follow-on.

## 2026-06-17 — ESP32-S3 slice 129: deep-sleep GPIO wake coverage + slice-128 typecheck fix

### Fixed
- **Typecheck regression in the slice-128 PCNT glitch filter** (@protopulse/emu):
  `pcntFlushPending` indexed into `pendingPulse` / `pendingPulseCycle` without
  accounting for `noUncheckedIndexedAccess`, so a fresh `tsc` reported two
  errors (`pendingPulseCycle[channel]` possibly undefined; `pending` typed
  `DigitalLevel | undefined` on the `lastPulse` assignment). The local
  verification missed it because the typecheck process was OOM-terminating and
  reporting a false "0 errors." Fixed with a `== null` guard, a `?? 0` fallback,
  and an explicitly-typed `confirmed: DigitalLevel`. A fresh
  `tsc --incremental false` on the package now reports 0 errors.

### Added
- **Deep-sleep GPIO wake coverage** (@protopulse/emu): a new test proves the
  source-agnostic deep-sleep branch resets the core with `DEEPSLEEP_RESET` when
  the wake comes from an armed GPIO high-level source (not just the RTC timer
  exercised in slice 124) — arm `GPIO_PIN7` WAKEUP_ENABLE + high-level, enter
  deep sleep, drive `IO7` high, and confirm the reboot marker. Locks a
  previously-untested real path; no production change.

### Verified
- `npm run -w @protopulse/emu test` passed with 283 package tests
  (196 ESP32-S3); fresh package `tsc` clean.

## 2026-06-17 — ESP32-S3 slice 128: PCNT input glitch filter

### Added
- **PCNT glitch filter** (@protopulse/emu): models `U0_CONF0` `FILTER_EN`
  (bit 10) and `FILTER_THRES` (bits [9:0], in APB cycles), verified against
  `pcnt_reg.h` / `pcnt_struct.h`. When enabled, an input pulse narrower than
  `FILTER_THRES` cycles is ignored entirely — both edges dropped — matching
  the hardware rule "any pulse with width < threshold is ignored." It is
  modeled as a debounce on the event-driven input-capture path: each edge is
  deferred (`pendingPulse` / `pendingPulseCycle`) until its level has held
  `>= FILTER_THRES` cycles, confirmed either on the next input capture or on
  a counter read. A sub-threshold glitch therefore never reaches the counter
  and never latches a threshold/limit event.

### Verified
- Additive: the two existing PCNT tests write `CONF0` without `FILTER_EN`, so
  the filter is off for them (the direct-edge path is unchanged). A new test
  drives a GPIO-matrix PCNT input with `FILTER_EN` + `FILTER_THRES`=4: a
  2-cycle pulse is filtered (no count), an 8-cycle pulse counts once — the
  counter ends at 1, never 2.
- `npm run -w @protopulse/emu test` passed with 282 package tests
  (195 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Control-input (ctrl) filtering and exact read-during-glitch timing remain
  follow-on; the filter currently gates the pulse (sig) input.

## 2026-06-17 — ESP32-S3 slice 127: GDMA OUT_CHECK_OWNER descriptor gate

### Added
- **GDMA TX owner-check gate** (@protopulse/emu): the TX counterpart to
  slice 125's RX gate. The TX engine previously treated a CPU-owned outlink
  descriptor as a hard `OUT_DSCR_ERR` unconditionally; it is now gated by
  `GDMA_OUT_CONF1` bit 12 (`OUT_CHECK_OWNER`), which resets to 0 per
  `gdma_reg.h`. By default the engine ignores the OWNER bit and transmits
  the descriptor normally. With the three descriptor controls now modeled
  (`IN_CHECK_OWNER`, `OUT_AUTO_WRBACK`, `OUT_CHECK_OWNER`), the GDMA
  owner-handshake matches the hardware's reset defaults.

### Verified
- The change is additive (existing TX tests use owner=DMA). A new test
  drives an RMT TX from a CPU-owned descriptor and confirms it completes
  (`DONE | EOF | TOTAL_EOF`, not `DSCR_ERR`).
- `npm run -w @protopulse/emu test` passed with 281 package tests
  (194 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- The CONF0 burst-length fields (`IN/OUT_DATA_BURST_LEN`,
  `IN/OUT_MEM_BURST_LEN`) and WEIGHT/PRI channel arbitration remain
  follow-on.

## 2026-06-17 — ESP32-S3 slice 126: GDMA OUT_AUTO_WRBACK descriptor gate

### Added
- **GDMA TX auto-writeback gate** (@protopulse/emu): the TX-side
  counterpart to slice 125. The automatic descriptor write-back — clearing
  the `OWNER` bit to return the descriptor to the CPU after transmission —
  is now gated by `GDMA_OUT_CONF0` bit 2 (`OUT_AUTO_WRBACK`), which resets
  to 0 per `gdma_reg.h`. By default the engine leaves the descriptor
  untouched and firmware recycles it; the prior model wrote back
  unconditionally. The ESP-IDF gdma driver sets the bit explicitly when it
  wants hardware writeback.

### Verified
- The change is additive (no test read the post-TX owner bit). The
  RMT-TX-from-GDMA test now asserts the descriptor stays DMA-owned after
  transmission with `OUT_AUTO_WRBACK` at its reset default.
- `npm run -w @protopulse/emu test` passed with 280 package tests
  (193 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- `OUT_CHECK_OWNER` (OUT_CONF1 bit 12) and CONF0 burst-length fields
  remain follow-on. The writeback-when-enabled path is the unchanged
  pre-gate code.

## 2026-06-17 — ESP32-S3 slice 125: GDMA IN_CHECK_OWNER descriptor gate

### Added
- **GDMA RX owner-check gate** (@protopulse/emu): the RX descriptor
  owner-check is now gated by `GDMA_IN_CONF1` bit 12 (`IN_CHECK_OWNER`),
  which resets to 0 (disabled) per `gdma_reg.h`. By default the DMA now
  ignores the descriptor `OWNER` bit and consumes CPU-owned descriptors
  (overwriting) instead of latching `DSCR_EMPTY` backpressure — the
  previous model checked unconditionally, which was stricter than
  hardware. The ESP-IDF gdma driver enables the bit explicitly, which is
  what the ADC-continuous owner-handshake path represents.

### Verified
- The existing ADC-continuous backpressure/flush tests now write
  `IN_CONF1` bit 12 (modeling the driver), and a new test proves the
  reset-default no-check path: a CPU-owned descriptor is consumed
  (`DONE | SUC_EOF`, not `DSCR_EMPTY`) with no overflow event.
- `npm run -w @protopulse/emu test` passed with 280 package tests
  (193 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- `OUT_CHECK_OWNER` / `OUT_AUTO_WRBACK` (TX side) and the CONF0
  burst-length fields remain follow-on slices.

## 2026-06-17 — ESP32-S3 slice 124: deep-sleep timer wake (reset on wake)

### Added
- **Deep sleep** (@protopulse/emu): models the sleep/wake long-tail item.
  Deep sleep is distinguished from light sleep by `RTC_CNTL_DIG_PWC_REG`
  (+0x90) bit 31 (`DG_WRAP_PD_EN`): when `STATE0.SLEEP_EN` fires with that
  bit set, the digital core powers down, so an RTC-timer wake is a full
  chip **reset** (not a WAITI resume). The reboot records `DEEPSLEEP_RESET`
  (5) in `RESET_STATE[5:0]` — which survives in the always-on RTC domain —
  reusing the existing reset-cause + pending-reset machinery. Light sleep
  (`DG_WRAP_PD_EN` clear) still resumes via WAITI exactly as before.

### Verified
- Added a two-boot test: first boot arms a deep-sleep timer wake and
  sleeps; the timer resets the chip; the reboot reads `DEEPSLEEP_RESET`
  from `RESET_STATE` and emits a marker. Registers verified against
  esp-idf `rtc_cntl_reg.h` / `rom/rtc.h`.
- `npm run -w @protopulse/emu test` passed with 279 package tests
  (192 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Only the RTC-timer wake source is modeled for deep sleep; other deep-sleep
  wake sources (GPIO/EXT/touch) and RTC slow-memory retention are follow-on.

## 2026-06-17 — ESP32-S3 slice 123: eFuse interrupt-matrix routing

### Added
- **eFuse interrupt → CPU** (@protopulse/emu): closes a remaining
  interrupt-delivery gap. The eFuse read/program-done interrupt (its
  `INT_RAW/ST/ENA/CLR` registers were already modeled) now reaches a CPU
  interrupt: `INTERRUPT_CORE0_EFUSE_INT_MAP_REG` (matrix offset `0x090`,
  source 36 — verified against esp-idf `interrupt_core0_reg.h`) routes it,
  and `recomputeIrq` raises it while `INT_RAW & INT_ENA` holds. The eFuse
  INT register writes now recompute the IRQ line.

### Verified
- Added a level-1 handler test: a read command (`CONF = READ_OP_CODE`,
  `CMD = READ_CMD`) latches the read-done interrupt, which routes via
  source 36 to the CPU; the ISR runs once and clears it.
- `npm run -w @protopulse/emu test` passed with 278 package tests
  (191 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Real ESP-IDF firmware polls eFuse status during burns, so this is a
  completeness fix (the interrupt path) rather than a critical path.

## 2026-06-17 — ESP32-S3 slice 122: SYSTIMER COMP1/COMP2 + TIMER_UNIT_SEL

### Added
- **SYSTIMER comparators 1 & 2 + unit selection** (@protopulse/emu):
  completes the SYSTIMER peripheral. The single comparator was refactored
  into a clean 3-comparator array, so COMP1/COMP2 share COMP0's
  one-shot/period alarm logic — each with its own `TARGETn` registers
  (HI `0x1c+8n`, LO `0x20+8n`, CONF `0x34+4n`), `COMPn_LOAD` (`0x50+4n`),
  `INT` bit n, CONF enable (bit `7+n`), and interrupt-matrix source
  (57/58/59 at map offsets `0x0e4+4n`). `TARGETn_CONF` bit 31
  (`TIMER_UNIT_SEL`) now lets any comparator be driven by UNIT0 or UNIT1.

### Verified
- Added a COMP1 level-1 handler test driven by **UNIT1** (exercising
  `TIMER_UNIT_SEL`) and routed through interrupt-matrix **source 58**
  (offset `0x0e8`). The existing COMP0 tests guard the array refactor.
- `npm run -w @protopulse/emu test` passed with 277 package tests
  (190 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- SYSTIMER is now functionally complete (two counters, three comparators,
  one-shot + periodic, unit selection, full interrupt delivery). The
  core-stall gating bits remain unmodeled (no functional effect in the
  current scheduler).

## 2026-06-17 — ESP32-S3 slice 121: SYSTIMER second counter (UNIT1)

### Added
- **SYSTIMER UNIT1** (@protopulse/emu): the second independent 52-bit /
  16 MHz counter, with its own `UNIT1_OP`/`LOAD`/`VALUE` registers
  (offsets `0x08`, `0x14`/`0x18`, `0x48`/`0x4c`, `0x60`) and CONF enable
  (`UNIT1_WORK_EN`, bit 2). Same epoch substrate and UPDATE/VALUE_VALID
  latch handshake as UNIT0; a CONF write now freezes both counters before
  applying the new run-state so neither replays old time.

### Verified
- Added a test that loads a frozen base into UNIT1, reads it back through
  the latch handshake, and confirms it advances once `UNIT1_WORK_EN` is set.
- `npm run -w @protopulse/emu test` passed with 276 package tests
  (189 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- The COMP1/COMP2 comparators (interrupt-matrix sources 58/59) and
  `TIMER_UNIT_SEL` (selecting which UNIT drives each comparator) remain
  follow-on slices. `esp_timer` uses UNIT0/COMP0, which is already complete.

## 2026-06-17 — ESP32-S3 slice 120: SYSTIMER COMP0 period (auto-reload) mode

### Added
- **SYSTIMER period mode** (@protopulse/emu): closes the slice 119 cut.
  `TARGET0_CONF` bit 30 (PERIOD_MODE) with `PERIOD[25:0]` selects periodic
  operation. `COMP0_LOAD` arms the first alarm one PERIOD ahead of the
  current counter, and each fire auto-advances the comparator by PERIOD so
  the alarm re-fires every period — the hardware auto-reload `esp_timer`
  uses for its periodic tick — without software reprogramming the target.

### Verified
- Added a level-1 handler test whose ISR only clears the latch (no
  reprogram) yet runs three times, driven purely by the auto-reload — the
  direct contrast to the one-shot path where the ISR reprograms the target.
- `npm run -w @protopulse/emu test` passed with 275 package tests
  (188 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- The second counter and other comparators (UNIT1, COMP1/COMP2,
  interrupt-matrix sources 58/59) and `TIMER_UNIT_SEL` remain follow-on
  slices.

## 2026-06-17 — ESP32-S3 slice 119: SYSTIMER TARGET0 interrupt-matrix route

### Added
- **SYSTIMER TARGET0 → CPU interrupt** (@protopulse/emu): closes the slice
  118 routing cut. `INTERRUPT_CORE0_SYSTIMER_TARGET0_INT_MAP_REG`
  (interrupt-matrix offset `0x0e4`, source 57 — verified against esp-idf
  `interrupt_core0_reg.h`) routes the COMP0 alarm to a CPU interrupt line,
  and `recomputeIrq` raises it while `INT_RAW & INT_ENA` holds. This
  completes `esp_timer`'s counter → alarm → interrupt cycle on UNIT0/COMP0.

### Verified
- Added a level-1 handler test mirroring the APB_SARADC interrupt path:
  UNIT0 counts past the target, the ISR fires once, reprograms the target
  forward (as `esp_timer`'s ISR does) and clears the latch, leaving
  `INT_RAW` empty with no re-fire.
- `npm run -w @protopulse/emu test` passed with 274 package tests
  (187 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Period (auto-reload) mode and the second counter / other comparators
  (UNIT1, COMP1/COMP2, interrupt-matrix sources 58/59) remain follow-on
  slices.

## 2026-06-17 — ESP32-S3 slice 118: SYSTIMER COMP0 alarm + interrupt latches

### Added
- **SYSTIMER comparator 0 (TARGET0 alarm)** (@protopulse/emu): builds on
  the slice 117 counter. `TARGET0_HI/LO` stage an alarm value, `COMP0_LOAD`
  applies it to the comparator, and with `CONF.TARGET0_WORK_EN` (bit 7)
  set a per-instruction check (mirroring the TIMG `checkAlarm`) latches
  `INT_RAW` bit 0 once UNIT0 reaches the target in one-shot/target mode.
  `INT_ST` masks the raw latch by `INT_ENA`; `INT_CLR` clears it. As on
  hardware, the comparator output is a level (it keeps matching while the
  counter exceeds the target), so software reprograms the target forward
  to disarm it — exactly how `esp_timer`'s ISR re-arms.

### Verified
- Added a test that counts UNIT0 past the target, reads `INT_RAW` set,
  confirms `INT_ST` is masked with `INT_ENA=0` then set with `INT_ENA=1`,
  reprograms the target far forward, clears, and confirms no re-fire.
- `npm run -w @protopulse/emu test` passed with 273 package tests
  (186 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Routing TARGET0 (interrupt-matrix source 57) to a CPU interrupt level,
  period (auto-reload) mode, and UNIT1/COMP1/COMP2 are follow-on slices.
  The alarm is observed through the INT registers, not yet a CPU interrupt.

## 2026-06-17 — ESP32-S3 slice 117: a first SYSTIMER counter path

### Added
- **SYSTIMER peripheral (UNIT0 counter)** (@protopulse/emu): a new system
  timer at `0x60023000`. UNIT0 is a 52-bit up-counter running at 16 MHz
  (XTAL 40 MHz / 2.5, so one tick is 15 of the 240 MHz CPU cycles),
  modeled on the same epoch substrate as the TIMG timers (base + ticks
  since sync, frozen while `UNIT0_WORK_EN` is clear). Software reads it via
  the hardware latch handshake: write `UPDATE` (UNIT0_OP bit 30) to
  snapshot the counter into `UNIT0_VALUE_HI/LO` and set `VALUE_VALID`
  (bit 29); `UNIT0_LOAD_HI/LO` + `UNIT0_LOAD` set the base. This is the
  counter `esp_timer` polls — a prerequisite for unmodified ESP-IDF
  firmware that schedules WiFi/BT and library callbacks through it.

### Verified
- Added a test that loads a frozen base and reads it back exactly through
  the latch handshake, checks `VALUE_VALID`, then enables `UNIT0_WORK_EN`
  and confirms the latched value advances.
- `npm run -w @protopulse/emu test` passed with 272 package tests
  (185 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- This first slice models UNIT0's counter + latch read only. UNIT1, the
  three comparators/alarms (TARGET0/1/2, one-shot + period mode), the
  SYSTIMER_TARGET interrupts (matrix sources 57/58/59), and the core-stall
  gating bits are deferred to follow-on slices.

## 2026-06-17 — ESP32-S3 slice 116: TWAI transmit-complete status bit

### Added
- **TCS status bit** (@protopulse/emu): closes the slice 115 cut. The
  TWAI status register's Transmission Complete Status bit (SR bit 3) now
  tracks the real outcome of the last transmission — set on a successful
  transmit, cleared on a single-shot drop or an unacknowledged transmit —
  rather than always reading complete. The transmit buffer (TBS) bit
  stays set (the buffer is always free in this synchronous model).

### Verified
- Added a test reading the status register after a single-shot frame
  loses arbitration: TCS reads clear (transmission did not complete),
  the inverse of the existing self-reception test where a successful
  transmit reads TCS set.
- `npm run -w @protopulse/emu test` passed with 271 package tests
  (184 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Bit-timing, retry scheduling, and wire-level GPIO waveform remain open.
  TWAI arbitration and transmit modeling (acceptance filtering, ACK/TEC,
  bus-off + recovery, bitwise arbitration with ALC latch, non-destructive
  retransmit, single-shot, and the TCS status bit) is now complete.

## 2026-06-17 — ESP32-S3 slice 115: TWAI single-shot transmit

### Added
- **Single-shot transmission** (@protopulse/emu): closes the slice 114
  cut. Writing the TWAI command register with TR|AT together (0x03 —
  ESP-IDF's `twai_ll_set_cmd_tx_single_shot`, exposed as the
  `TWAI_MSG_FLAG_SS` message flag) now requests a one-shot transmit. On
  arbitration loss the single-shot frame is dropped instead of being
  retried: the TX buffer is released with a failed `tx_done`
  (`TWAI_ALERT_TX_FAILED`) and the frame never reaches the bus. SRR|AT
  (0x12) is the single-shot self-reception variant. AT written on its own
  is now a no-op (no pending transmission to cancel in this synchronous
  model) rather than spuriously latching a TX interrupt.

### Verified
- Added a two-node test where a single-shot id 0x500 loses arbitration to
  id 0x100: it captures the arbitration-lost event, receives the winning
  frame, reports a failed `tx_done`, and leaves an empty TX log — the
  direct contrast to slice 113's auto-retransmit.
- `npm run -w @protopulse/emu test` passed with 270 package tests
  (183 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- The TCS (Transmission Complete Status) status bit still always reads
  complete; success/failure is surfaced through the `tx_done` event, not
  the status register. Bit-timing, retry scheduling, and wire-level GPIO
  waveform remain open.

## 2026-06-17 — ESP32-S3 slice 114: TWAI arbitration-lost capture latch

### Added
- **ALC/ALI capture latch + re-arm** (@protopulse/emu): closes the slice
  113 cut. The SJA1000 arbitration-lost capture now latches on the first
  loss — a second arbitration loss before software reads the ALC register
  produces no new ALC value, no new ALI interrupt, and no new error event.
  Reading ALC re-arms the capture (mirroring ESP-IDF
  `twai_ll_clear_arb_lost_cap`'s dummy read). Arbitration is otherwise
  unchanged: a latched loser still keeps its frame armed and retransmits.

### Verified
- Added a three-node contention test where one node loses twice in a
  single bus resolution (to id 0x100, then to id 0x480 on its retransmit
  round) yet emits exactly one arbitration-lost event and reads ALC=1 —
  the first loss's bit (ID.10), latched over the second loss's bit
  (ID.8 → 3).
- `npm run -w @protopulse/emu test` passed with 269 package tests
  (182 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Single-shot (one-shot) transmit abort is still not modeled; a latched
  loser always retransmits. Bit-timing, retry scheduling, and wire-level
  GPIO waveform remain open.

## 2026-06-17 — ESP32-S3 slice 113: TWAI arbitration-lost modeling

### Added
- **CAN bitwise arbitration** (@protopulse/emu): two TWAI nodes can now
  contend for the bus. A new host primitive `armTwaiTransmit(frame)`
  stages a peer as a simultaneous contender without resolving; when
  another node requests transmission, the bus resolves by CAN bitwise
  arbitration. The winner is the numerically lower identifier, compared
  in true wire order — 11-bit base id, then bit 12 (RTR for standard /
  recessive SRR for extended), then bit 13 (IDE), then the 18-bit
  extension + RTR — so a standard frame beats an extended frame sharing
  the same base id, and a data frame beats a remote frame with the same
  id (both per CAN 2.0B).
- **Arbitration-lost capture** (@protopulse/emu): the loser raises the
  ALI interrupt (IR.6 / `TWAI_LL_INTR_ALI`), records the losing bit
  number in the ALC register (SJA1000 numbering, SOF=0), and emits an
  `{ arbLost: true }` error event (mirroring `twai_error_flags_t.arb_lost`
  / `TWAI_ALERT_ARB_LOST`). The TEC is left untouched — losing
  arbitration is normal traffic, not a bus error (Linux `bd0ccb92`).
- **Non-destructive retransmit** (@protopulse/emu): because CAN never
  drops the loser's frame, the loser keeps its frame armed and the bus
  re-resolves until every armed frame has been sent, so an arbitration
  loss is followed by a successful retransmission on the next slot.

### Verified
- Added a two-node contention test: id 0x500 loses to id 0x100, emits
  the arbitration-lost error, receives the winning frame, then
  retransmits its own frame successfully; reads back ALC=1 (loss at
  ID.10) and TEC=0 through the guest register interface.
- Added a wire-order tiebreak test: a standard data frame (id 0x100)
  beats an extended frame sharing the same 11-bit base id, proving the
  arbitration key resolves the dominant-RTR vs recessive-SRR case the way
  CAN 2.0B requires (a naive integer id compare would get this backwards).
- `npm run -w @protopulse/emu test` passed with 268 package tests
  (181 ESP32-S3); `npm run check:packages` clean.

### Honest cuts
- Contention is host-driven: a turn-based core cannot have two guests
  transmit within a single bit window, so a peer contender is staged via
  `armTwaiTransmit()`. Single-shot (one-shot) transmit abort and the
  ALC re-arm-on-read behavior are not yet modeled. Bit-timing, retry
  scheduling, and wire-level GPIO waveform remain open.

## 2026-06-17 — ESP32-S3 slice 112: TWAI extended-frame dual filtering

### Added
- **Extended-frame dual-filter acceptance** (@protopulse/emu): closes
  the slice 111 cut. In dual-filter mode (AFM clear), an extended
  (29-bit) frame is now matched per the SJA1000 EFF layout — each of the
  two filters compares only ID[28:13] (the top 16 ID bits): filter 1 =
  ACR0/ACR1, filter 2 = ACR2/ACR3. RTR and data bytes do not participate
  in EFF dual mode. A frame is accepted if either filter matches.

### Verified
- Added a dual-filter test configuring filter 1 for ID[28:13]=0xABCD and
  filter 2 for ID[28:13]=0x1234, asserting both prefixes accept (with the
  low 13 ID bits proven don't-care) and a third prefix (0xABCE) rejects.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 179 ESP32-S3 tests.

### Honest cuts
- Bit-timing, arbitration, retry scheduling, and wire-level GPIO waveform
  remain open. Acceptance filtering (single + dual, standard + extended)
  is now complete.

## 2026-06-17 — ESP32-S3 slice 111: TWAI dual-filter acceptance mode

### Added
- **TWAI/CAN dual-filter acceptance mode** (@protopulse/emu): the AFM
  mode bit (mode register bit 3) now selects single-filter (set) vs
  dual-filter (clear) acceptance. Dual mode is modeled exactly for
  standard frames per the SJA1000 layout — two ID+RTR filters
  (ACR0/ACR1 and ACR2/ACR3); filter 1 additionally matches data byte 1
  (high nibble ACR1[3:0], low nibble ACR3[3:0]). A frame is accepted if
  either filter matches. This closes the prior honest cut where dual
  mode reused the coarse single-filter 32-bit compare.

### Verified
- Added a dual-filter test configuring filter 1 for std ID 0x123 and
  filter 2 for std ID 0x200, asserting both IDs are accepted and a third
  (0x150) is rejected via `injectTwaiFrame`.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 178 ESP32-S3 tests.

### Honest cuts
- Extended-frame dual filtering still falls back to the single-filter
  coarse compare (exact EFF dual layout is a later slice). Bit-timing,
  arbitration, retry scheduling, and wire-level GPIO waveform remain
  open.

## 2026-06-17 — ESP32-S3 slice 110: TWAI bus-off recovery

### Added
- **TWAI/CAN bus-off recovery now surfaces as a state change**
  (@protopulse/emu): when firmware returns the controller to operating
  mode (clears the reset-mode bit) while the node is bus-off, the node
  rejoins the bus error-active with cleared error counters and
  `drainTwaiEvents()` emits a `bus_off` -> `active` state-change event.
- This mirrors ESP-IDF's `on_state_change` callback, which fires on
  exit from bus-off as well as entry, so hosts can observe a recovered
  node without polling the error counters.

### Verified
- Extended the no-ACK burst test to saturate the TEC into bus-off, then
  return to operating mode, asserting the full
  active -> warning -> passive -> bus_off -> active state-change
  sequence.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 177 ESP32-S3 tests.

### Honest cuts
- The 129-recessive-bit recovery wait is not modeled — recovery is
  immediate. Recovery via a direct TEC-counter write does not yet emit
  the state-change event. Bit-timing, arbitration, retry scheduling,
  wire-level GPIO waveform, and exact dual-filter mode remain open.

## 2026-06-17 — ESP32-S3 slice 109: TWAI bus-off host event

### Added
- **TWAI/CAN bus-off now surfaces as a host event** (@protopulse/emu):
  when repeated no-ACK transmits drive the Transmit Error Counter to its
  256 saturation point, `drainTwaiEvents()` emits a standalone `error`
  event carrying `busOff`, placed immediately before the
  `passive` -> `bus_off` state-change event.
- This mirrors ESP-IDF's distinct legacy `TWAI_ALERT_BUS_OFF` alert,
  which is separate from the ACK/bus-error alert, so HIL and cosim hosts
  can detect the node going offline without inferring it from the TEC.

### Verified
- Added a 32-frame no-ACK burst test that asserts exactly one
  `{ busOff: true }` error event, confirms the existing
  active -> warning -> passive -> bus_off state-change escalation is
  unchanged, and checks the bus-off error event immediately precedes the
  bus_off transition.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 176 ESP32-S3 tests.

### Honest cuts
- Still not the full ESP-IDF driver alert queue. Bit-timing,
  arbitration, retry scheduling, wire-level GPIO waveform, exact
  dual-filter mode, and a bus-off recovery slice remain open.

## 2026-06-17 — ESP32-S3 slice 108: TWAI ACK bus-error events

### Added
- **TWAI/CAN ACK errors now carry bus-error evidence** (@protopulse/emu):
  `drainTwaiEvents()` reports `busError` alongside `ackErr` when a
  transmit request reaches the modeled ACK slot without any peer ACK.
- This aligns the host-facing event stream with ESP-IDF's legacy TWAI
  alert model, where ACK errors are bus errors and also drive the bus
  error interrupt path.

### Verified
- Tightened the existing no-ACK transmit test so the drained error event
  must include both `ackErr` and `busError`, followed by the failed
  `tx_done` callback.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 175 ESP32-S3 tests.

### Honest cuts
- This still is not the full ESP-IDF driver alert queue. Bit-timing,
  arbitration, retry scheduling, wire-level GPIO waveform, and exact
  dual-filter mode remain open.

## 2026-06-17 — ESP32-S3 slice 107: TWAI RX FIFO overrun events

### Added
- **TWAI/CAN RX FIFO overrun event flag** (@protopulse/emu):
  `drainTwaiEvents()` now reports a host-visible `error` event with
  `rxFifoOverrun` when an incoming TWAI frame is dropped because the
  receive FIFO is full.
- The existing data-overrun status and interrupt latch now has matching
  bridge-facing evidence, so HIL and cosim hosts can distinguish a
  filtered/rejected frame from a full-RX-FIFO drop.

### Verified
- Added a host-injection test that fills the modeled TWAI RX FIFO with
  64 frames, proves the 65th frame is rejected, and checks the drained
  event stream for `rxFifoOverrun`.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 175 ESP32-S3 tests.

### Honest cuts
- This still is not the full ESP-IDF driver alert queue. Bit-timing,
  arbitration, retry scheduling, wire-level GPIO waveform, and exact
  dual-filter mode remain open.

## 2026-06-16 — ESP32-S3 slice 106: TWAI listen-only TX suppression

### Added
- **TWAI/CAN listen-only transmit suppression** (@protopulse/emu):
  register-level TWAI TX and self-RX requests now do nothing while
  `TWAI_MODE_LISTEN_ONLY` is active, matching ESP-IDF's listen-only
  contract that the node receives but does not transmit dominant bits,
  including ACK and error frames.
- The existing peer-bus listen-only ACK suppression now has its paired
  transmit-side coverage: listen-only nodes neither surface host TX
  frames nor emit TX/error events from a transmit request.

### Verified
- Added hand-assembled Xtensa firmware that leaves reset in listen-only
  mode, attempts a standard data-frame TX request, and proves host TX,
  event drain, TEC, and interrupt state all remain quiet.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 174 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,516 tests.

### Honest cuts
- This still is not the full ESP-IDF driver alert queue. Bit-timing,
  arbitration, retry scheduling, wire-level GPIO waveform, and exact
  dual-filter mode remain open.

## 2026-06-16 — ESP32-S3 slice 105: TWAI state-change events

### Added
- **TWAI/CAN state-change event drain** (@protopulse/emu):
  `drainTwaiEvents()` now includes `state_change` events with
  ESP-IDF-shaped old/new error states when TEC/REC movement crosses
  `active`, `warning`, `passive`, and `bus_off` thresholds.
- No-ACK transmit escalation now records state changes as TEC crosses
  96, 128, and 256, preserving the existing ACK-error and `tx_done`
  event stream.

### Verified
- Added hand-assembled Xtensa firmware that sends 32 no-ACK TWAI
  transmissions and proves the drained state-change stream is
  `active -> warning -> passive -> bus_off`.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 173 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,515 tests.

### Honest cuts
- This still is not the full ESP-IDF driver alert queue. Bit-timing,
  arbitration, retry scheduling, wire-level GPIO waveform, and exact
  dual-filter mode remain open.

## 2026-06-16 — ESP32-S3 slice 104: TWAI host event drain

### Added
- **TWAI/CAN host event drain first cut** (@protopulse/emu):
  `Esp32s3Core.drainTwaiEvents()` now exposes typed host-side events
  for firmware-visible TWAI callback paths: `tx_done` with decoded frame
  and success/failure, `rx_done` with decoded frame, and `error` with
  ACK-error flags.
- The virtual peer-bus path now records a successful TX event on the
  sender and an RX event on the receiving core. Lone normal
  transmissions record the ACK error before the failed `tx_done` event,
  matching the callback evidence a host bridge needs to inspect.

### Verified
- Added a two-core Xtensa firmware test proving `drainTwaiEvents()`
  returns `tx_done(success: true)` on the sender and `rx_done` with the
  delivered frame on the receiver.
- Added no-ACK firmware coverage proving `drainTwaiEvents()` returns an
  ACK-error event before `tx_done(success: false)` for a failed normal
  transmit.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 172 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,514 tests.

### Honest cuts
- This is a host-drain substrate for TWAI TX/RX/error callback data, not
  the full ESP-IDF driver alert queue. State-change callbacks,
  bit-timing, arbitration, retry scheduling, wire-level GPIO waveform,
  and exact dual-filter mode remain open.

## 2026-06-16 — ESP32-S3 slice 103: TWAI virtual peer bus + ACK errors

### Added
- **TWAI/CAN peer bus first cut** (@protopulse/emu):
  ESP32-S3 cores can now be linked with `connectTwaiPeer()` /
  `disconnectTwaiPeer()` so firmware `TR` transmissions on one core are
  delivered into a connected peer's TWAI RX FIFO and can be ACKed by
  that active peer.
- **ACK/no-ACK error accounting** for the register-level TWAI path:
  a lone normal transmit still drains to the host bench, but now latches
  `TI|EI|BEI`, increments TEC by 8, records the ACK-slot error segment,
  and progresses toward BUS_OFF on repeated ACK failures. No-ACK/self
  test mode remains the non-error loopback path.

### Verified
- Added hand-assembled Xtensa firmware proving a no-ACK `TR` attempt
  surfaces the transmitted frame, latches `TI|EI|BEI`, raises TEC to 8,
  and exposes ACK-slot error capture through the TWAI registers.
- Added a two-core peer-bus test proving a connected receiver gets the
  frame bytes through the RX buffer while the transmitter's TEC stays at
  zero and only `TI` is latched.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 170 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,512 tests.

### Honest cuts
- Still no bit timing, arbitration, retry scheduling, driver alert
  queue, wire-level GPIO waveform, or exact dual-filter mode. This is a
  host-side virtual bus/ACK substrate for bridge and probe work, not a
  physical CAN transceiver simulation.

## 2026-06-16 — ESP32-S3 slice 102: TWAI host injection + acceptance filters

### Added
- **TWAI/CAN bench bridge** (@protopulse/emu):
  ESP32-S3 TWAI now has a typed host frame surface
  (`injectTwaiFrame`, `drainTwaiTx`) so tests and future co-sim/probe
  paths can inject another bus node's frames and inspect firmware
  transmissions without pretending a physical CAN transceiver exists.
- **Acceptance-filter enforcement** for the register-level TWAI path:
  ACR/AMR writes made while reset mode is active now live in the
  acceptance-filter register view, default to accept-all, and gate
  incoming standard frames before they enter the RX FIFO.

### Verified
- Added hand-assembled Xtensa firmware that configures a standard-ID
  acceptance filter for ID `0x123`, proves a mismatched host-injected
  frame is dropped, then accepts a matching frame and reads count,
  interrupt, frame-info, ID, and data bytes through the TWAI register
  block.
- Added firmware TX coverage proving a normal `TR` command is surfaced
  to the host bench as a decoded TWAI frame and that `drainTwaiTx()`
  drains cleanly.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 168 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,510 tests.

### Honest cuts
- No shared multi-node virtual CAN bus, arbitration, ACK/retry timing,
  error confinement, driver alert queue, or wire-level GPIO waveform
  yet.
- Dual-filter mode is still approximated by the coarse 32-bit
  acceptance compare; this slice intentionally pins the single-filter
  standard-frame path first.

## 2026-06-16 — ESP32-S3 slice 101: TWAI/CAN register + self-test first cut

### Added
- **TWAI/CAN peripheral surface** (@protopulse/emu):
  ESP32-S3 TWAI now exposes the source-pinned register block at
  0x6002B000, SJA1000-style 8-bit registers packed into 32-bit words,
  TX/RX frame buffer bytes, self-reception loopback, RX buffer release,
  RX message count/status bits, read-to-clear RI/TI interrupts, and
  `CAN_INT_MAP` interrupt-matrix routing.

### Verified
- Added hand-assembled Xtensa firmware that sends a standard TWAI
  self-reception frame, reads frame info/ID/data back from the RX
  buffer, releases the RX buffer, and wakes through a `CAN_INT` ISR that
  proves `interrupt_reg` read-to-clear behavior.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 166 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,508 tests.

### Honest cuts
- No virtual CAN bus object, bit timing/arbitration/ACK/error
  confinement, acceptance-filter enforcement, driver alert queue, or
  wire-level GPIO waveform yet.
- This is the register/self-test/interrupt runway, not the full
  ESP-IDF TWAI driver behavior.

## 2026-06-16 — ESP32-S3 slice 100: MCPWM timer/operator/generator first cut

### Added
- **MCPWM peripheral surface** (@protopulse/emu):
  ESP32-S3 MCPWM0/MCPWM1 now expose source-pinned register blocks at
  0x6001E000/0x6002C000, virtual timer counters, operator timer
  selection, comparator A/B timestamps, generator A/B actions,
  continuous software force, GPIO-matrix output signals 160..171, and
  PWM0/PWM1 interrupt-matrix routing.

### Verified
- Added hand-assembled Xtensa firmware that routes MCPWM0 operator 0
  generator A through the GPIO matrix to IO5, delivers OP0_TEA compare
  interrupts through `PWM0_INTR_MAP`, clears/disables the interrupt in
  the ISR, and routes MCPWM1's independent `PWM1_OUT0A` signal.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 164 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed across package workspaces with 1,506 tests.

### Honest cuts
- No dead-time insertion, carrier modulation, fault/capture/sync
  propagation, complementary pair helpers, or power/clock gating effects
  yet.
- This is the first register/timer/generator path, not the full ESP-IDF
  MCPWM driver object model.

## 2026-06-16 — ESP32-S3 slice 99: SPI master CPU-FIFO first cut

### Added
- **SPI master peripheral surface** (@protopulse/emu):
  ESP32-S3 GPSPI2/GPSPI3 now expose source-pinned register blocks at
  0x60024000/0x60025000, CPU-buffer command/address/MOSI/MISO phase
  handling, `cmd.usr` self-clear, TRANS_DONE raw/status/enable/clear/set
  bits, and SPI2_DMA/SPI3_DMA interrupt-matrix routing.

### Verified
- Added hand-assembled Xtensa firmware that runs a GPSPI2
  command/address/MOSI transaction through the SPI2_DMA completion ISR,
  verifies polling completion via `cmd.usr`, captures emitted phase
  bytes, checks zero-filled MISO reads and TRANS_DONE clear behavior, and
  routes GPSPI3 independently while draining MOSI from W8 with
  USR_MOSI_HIGHPART.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 161 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed with 1,503 package tests.

### Honest cuts
- No SPI DMA descriptor movement yet; this slice is CPU FIFO only.
- No attached-device response model: MISO reads synthesize zero bytes.
- SPI clock timing, chip-select pin behavior, multi-line modes, and slave
  mode remain future slices.

## 2026-06-16 — ESP32-S3 slice 98: I2C master command/FIFO first cut

### Added
- **I2C master peripheral surface** (@protopulse/emu):
  ESP32-S3 I2C0/I2C1 now expose the source-pinned register blocks at
  0x60013000/0x60027000, FIFO data access, command registers, status
  readback, transaction-complete/NACK raw/status/enable/clear bits, and
  I2C_EXT0/I2C_EXT1 interrupt-matrix routing.

### Verified
- Added hand-assembled Xtensa firmware that runs an I2C0 write command
  list through START/WRITE/STOP/END, observes completion through the
  I2C_EXT0 interrupt source, verifies TX FIFO drain and command-done
  readback, reads two synthetic bytes through an I2C0 READ command, and
  forces an I2C1 NACK through its independent I2C_EXT1 matrix source.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 158 ESP32-S3 tests.
- `npm run check:packages` passed.
- `npm run test:packages` passed with 1,500 package tests.

### Honest cuts
- I2C bus timing, open-drain SCL/SDA waveforms, glitch filters, and
  clock stretching are stored/read back but not physically timed.
- No attached-device model yet: writes ACK by default, reads synthesize
  zero bytes, and NACK is only modeled for an impossible expected ACK.
- Slave mode, arbitration loss, timeout timing, and DMA/non-FIFO corner
  cases remain future slices.

## 2026-06-16 — ESP32-S3 slice 97: PCNT pulse-counter first cut

### Added
- **PCNT peripheral surface** (@protopulse/emu):
  ESP32-S3 PCNT now exposes the source-pinned register block, GPIO
  input-matrix pulse/control signals, signed 16-bit count readback,
  reset/pause control, edge actions, level-control inversion/hold, and
  watchpoint/status interrupts through the PCNT interrupt-matrix source.

### Verified
- Added hand-assembled Xtensa firmware that routes IO4 into PCNT unit 0,
  counts three rising edges, observes and clears a high-limit interrupt,
  then verifies low control-level inversion makes a rising edge decrement.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 155 ESP32-S3 tests.

### Honest cuts
- No APB-cycle glitch filter timing yet.
- No full quadrature helper path yet.
- PCNT clock/power gating is stored for register shape only.

## 2026-06-16 — ESP32-S3 slice 96: WiFi/BT light-sleep wake sources

### Added
- **WiFi/BT RTC wake hooks** (@protopulse/emu):
  host-injected WiFi and Bluetooth wake events now wake modeled RTC
  sleep when WAKEUP_STATE arms RTC_WIFI_TRIG_EN or RTC_BT_TRIG_EN.
  Both paths record the selected source through SLP_WAKEUP_CAUSE and
  route through RTC_CORE using the shared SLP_WAKEUP raw bit.

### Verified
- Added hand-assembled Xtensa firmware that enters RTC sleep, injects
  WiFi wake, verifies the WiFi wake-cause bit, clears RTC_CORE, then
  repeats the same proof for BT wake.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 153 ESP32-S3 tests.

### Honest cuts
- This models the sleep wake-source plumbing only. It does not claim a
  WiFi/Bluetooth MAC, PHY, coexistence, or host-controller model.

## 2026-06-16 — ESP32-S3 slice 95: RTC slow-clock elapsed rebase

### Added
- **RTC slow-clock live rebase** (@protopulse/emu):
  RTC main-timer ticks and RWDT elapsed ticks now carry forward when
  firmware writes RTC_CNTL_CLK_CONF or RTC_CNTL_SLOW_CLK_CONF. Changing
  the RTC_SLOW_CLK source or RC_SLOW divider now affects future time
  without reinterpreting elapsed time under the new rate.

### Verified
- Added hand-assembled Xtensa firmware that latches the RTC main timer
  after 1 ms, switches to XTAL32K, proves the latched count does not move
  backward, and then keeps aging on the new source.
- Added hand-assembled Xtensa firmware that arms RWDT under RC_SLOW,
  ages one RTC-slow tick, switches to XTAL32K mid-timeout, and still
  resets after the remaining tick with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 152 ESP32-S3 tests.

### Honest cuts
- Sub-tick oscillator phase is still integer-rounded; this closes the
  larger elapsed-time rebase gap without claiming analog clock phase
  fidelity.

## 2026-06-16 — ESP32-S3 slice 94: RC_SLOW divider for RTC slow clock

### Added
- **RTC slow-clock divider** (@protopulse/emu):
  RTC_CNTL_SLOW_CLK_CONF.ANA_CLK_DIV now updates the modeled RC_SLOW
  divider when ANA_CLK_DIV_VLD is set. RWDT and RTC main-timer ticks
  now age at RC_SLOW / (ANA_CLK_DIV + 1) when RC_SLOW is selected.

### Verified
- Added hand-assembled Xtensa firmware that divides RC_SLOW by 4,
  arms a raw RWDT stage0=1 timeout, survives beyond the undivided
  RC_SLOW x2 deadline, and then reboots later with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 150 ESP32-S3 tests.

### Follow-up
- The live elapsed-time rebase gap called out here is closed by
  ESP32-S3 slice 95.

## 2026-06-16 — ESP32-S3 slice 93: RTC slow-clock mux for RWDT

### Added
- **RTC slow-clock source selection** (@protopulse/emu):
  RTC_CNTL_CLK_CONF.ANA_CLK_RTC_SEL now round-trips and drives the
  RTC_SLOW_CLK tick rate used by RWDT and RTC main-timer latching.
  The model covers Espressif's RC_SLOW, XTAL32K, and RC_FAST_D256
  approximate clock sources.

### Verified
- Added hand-assembled Xtensa firmware that selects XTAL32K, arms a
  raw RWDT stage0=1 timeout, survives beyond the old RC_SLOW x2
  deadline, and then reboots later with RTCWDT_SYS_RESET.
- `npm run -w @protopulse/emu test -- src/esp32s3.test.ts`
  passed with 149 ESP32-S3 tests.

### Follow-up
- The live elapsed-time rebase gap called out here is closed by
  ESP32-S3 slice 95.

## 2026-06-16 — ESP32-S3 slices 21-92: IDF runway catch-up

### Added
- **ADC/GDMA/LEDC/RMT runway** (@protopulse/emu): APB_SARADC
  threshold comparators, ADC continuous GDMA backpressure/overflow
  behavior, LEDC low-speed PWM/fade/interrupt delivery, and RMT TX/RX
  direct-memory + GDMA surfaces landed after slice 20.
- **Sleep, wake, and RTC interrupt surface**: WAITI and RTC sleep wake
  sources now cover timer, watchdog, brownout, XTAL32K-dead, SUPER_WDT,
  SARADC, TSENS, touch, ULP/COCPU, GPIO/EXT0/EXT1, UART wake, and
  low-power status/readback slices.
- **Reset and fault-routing fidelity**: power-glitch, brownout,
  clock-glitch, SUPER_WDT, RWDT pause-in-sleep, RWDT eFuse timeout
  multiplier, FIB_SEL routing, and clock-glitch interrupt producer
  slices brought the RTC/reset runway much closer to ESP-IDF startup
  expectations.

### Verified
- Each slice carries its own hand-assembled Xtensa firmware proof in
  `ROADMAP.md`, ending with slice 92's host-injected clock-glitch
  interrupt producer.
- Packages CI was green through `ab301d16` after the latest slice.

### Honest cuts
- This is still not a claim that unmodified IDF/FreeRTOS firmware is
  complete. The open long tail remains GDMA driver-pool flush policy,
  backpressure timing, sleep/wake edge cases, remaining interrupt gaps,
  and the broader peripheral matrix.

## 2026-06-12 — ESP32-S3 slice 20: APB_SARADC interrupt delivery

### Added
- **APB_ADC interrupt-matrix route** (@protopulse/emu): APB_SARADC
  INT_RAW&INT_ENA now drives the ESP32-S3 core-0 interrupt matrix
  source at `INTERRUPT_CORE0_APB_ADC_INT_MAP_REG` (+0x104), matching
  Espressif's ESP-IDF v5.2.7 S3 headers. Digital ADC firmware can
  now wake a level-1 handler on ADC1/ADC2 DONE instead of polling
  INT_ST forever.

### Verified (+1 test, emu suite at 161 green)
- Hand-assembled Xtensa firmware maps APB_ADC to CPU line 0, enables
  ADC1_DONE, starts a digital ADC1 conversion, vectors into a
  level-1 handler, clears INT_CLR, returns, and verifies DATA_STATUS
  still holds the sampled channel data.
- `@protopulse/emu` tests, targeted ESLint for the touched emulator
  files, `check:packages`, and the full package test suite passed.

### Honest cuts
- Core-0 only, consistent with the currently modeled interrupt-matrix
  surface. Threshold interrupt bits are routable once something
  models the threshold comparators; this slice only generates the
  ADC_DONE raw bits.

## 2026-06-11 — ESP32-S3 slice 9: flash-mapped IROM/DROM segments

### Added
- **XIP through the cache windows** (@protopulse/emu): app-image
  segments whose load addresses fall in IROM (0x42000000–0x44000000)
  or DROM (0x3C000000–0x3E000000, both per soc.h and
  ext_mem_defs.h) are now served read-only at their vaddrs — the net
  effect of the second-stage bootloader's MMU setup plus a
  fully-warmed cache. This is what those segments mean: real app
  images map .flash.text/.flash.rodata, they don't copy them to RAM.
  Entry points in IROM are accepted.
- Cache-window writes refuse ("flash is read-only through the
  cache"); reads inside a window but outside any mapped segment
  refuse loudly with the address.

### Verified (+2 tests, emu suite at 124 green)
- An XIP image with NO SRAM segment boots from IROM, pulls a
  constant from DROM, txes it, and survives reset().
- The two refusals, plus the slice-5 unmapped-segment refusal
  updated (flash-mapped segments are no longer refused — truly
  unmapped ranges still are).

### Honest cuts
- XIP reads cost 1 cycle like everything else (no cache-miss or
  line-fill timing); MMU registers are not modeled, so runtime
  remapping is impossible; no SPI flash writes. The long tail toward
  unmodified IDF/FreeRTOS firmware remains: ROM functions,
  RTC/eFuse/SYSTEM registers, the second core.

## 2026-06-11 — ESP32-S3 slice 8: TIMG0 timer 0

### Added
- **TIMG0 T0** (@protopulse/emu): the 54-bit general-purpose timer at
  0x6001F000 — EN/INCREASE/AUTORELOAD/DIVIDER/ALARM_EN in T0CONFIG,
  UPDATE-latched LO/HI reads, LOAD from LOADLO/LOADHI, INT_RAW/ST/
  ENA/CLR with T0 at bit 0, all per timer_group_reg.h. Counts APB
  ticks (80 MHz, soc.h) through the 16-bit prescaler (field 0 =
  ÷65536, matching how the HAL writes 65536). The counter is virtual
  — derived from elapsed CPU cycles, zero per-cycle bookkeeping; the
  alarm comparator runs per instruction only while armed.
- **Hardware alarm auto-disable**: when the alarm fires, ALARM_EN
  clears by hardware (the documented behavior gptimer's ISR re-arms
  around); autoreload reloads the counter from LOAD{LO,HI}. The
  TG_T0 interrupt source routes through the matrix (map at +0x0C8).

### Verified (+3 tests, emu suite at 122 green)
- Cycle-exact ticking: two UPDATE captures 12 CPU cycles apart differ
  by exactly 2 at divider 2 (240/80 = 3 cycles per APB tick).
- A periodic autoreload alarm counts 3 with the full gptimer ISR
  dance (INT_CLR + ALARM_EN re-arm).
- A one-shot alarm fires exactly once — the auto-disable is real.

### Fixed
- The 54-bit wrap uses float-safe modulo: the classic ((x%M)+M)%M
  idiom silently rounds small values to 0 at M = 2^54 (the double
  ulp there is 4) — caught by the first test draft.

### Honest cuts
- T0 of TIMG0 only (no T1, no TIMG1, no watchdogs); APB clock source
  only (no XTAL); UPDATE captures instantly. Next: flash-cache
  mapping.

## 2026-06-11 — ESP32-S3 slice 7: SAR ADC1 oneshot + co-sim channels

### Added
- **SAR ADC1 oneshot** (@protopulse/emu): the SENS_SAR_MEAS1_CTRL2
  register dance (base 0x60008800 + 0xC) that esp-idf's
  adc_oneshot_ll and Arduino's analogRead perform — one-hot channel
  select in SAR1_EN_PAD [30:19], the MEAS1_START_SAR (bit 17) 0→1
  pulse starting a conversion, MEAS1_DONE_SAR (bit 16) poll, 12-bit
  result in MEAS1_DATA_SAR. Every field position from sens_reg.h,
  the flow from adc_ll.h.
- **Co-sim ADC surface**: the ESP32-S3 core now implements
  setAdcSampler/drainAdcReads (the McuCore contract), quantizing
  clamp(round(volts / 3.3 × 4095), 0, 4095); the sampler survives
  reset as bench wiring. The app's core registry gains ADC1's
  channels 0–9 (= GPIO1–10 per adc_channel.h) — the ESP32-S3 was the
  only core without analog channels in the co-sim panel.

### Verified (+2 tests, emu suite at 119 green)
- An analogRead-style conversion round-trips: channel 3 sampled at
  1.65 V → firmware txes 2048 over UART; drainAdcReads logs exactly
  one read on channel 3 (and draining drains).
- Without a sampler, conversions read 0 V and still log.

### Honest cuts
- Conversions complete instantly (no SAR clock timing); attenuation
  is not modeled (3.3 V full scale); no ADC2, no APB_SARADC DMA
  mode. Next: TIMG, flash-cache mapping.

## 2026-06-11 — ESP32-S3 slice 6: peripheral interrupts through the matrix

### Added
- **Interrupt matrix** (@protopulse/emu): the ESP32-S3's matrix at
  0x600C2000 — each peripheral source's 5-bit map register selects
  its CPU interrupt line (GPIO source at +0x040, UART0 at +0x06C),
  reset value 16 so unmapped sources stay silent. Addresses and reset
  values from esp-idf's reg_base.h / interrupt_core0_reg.h.
- **GPIO pin interrupts**: GPIO_PINn registers (INT_TYPE bits [9:7]
  written verbatim from gpio_int_type_t — posedge/negedge/anyedge/
  low-level/high-level — and INT_ENA bit 13, the bit gpio_ll.h's
  GPIO_LL_INTR_ENA writes), STATUS/STATUS1 with W1TS/W1TC. Edge types
  latch on matching input edges; level types re-assert after W1TC
  while the level holds — exactly like hardware.
- **UART0 interrupts**: INT_RAW/ST/ENA/CLR with RXFIFO_FULL (live
  against the CONF1 RXFIFO_FULL_THRHD, reset 96) and TX_DONE
  (latched per transmitted byte, cleared via INT_CLR).
- **CPU**: level-triggered external level-1 lines via `setExtInt`,
  masked to core-isa.h's level-1 externals (INT0–5, 8–9, 12–13,
  17–18) and immune to INTCLEAR, per the RM's rule for
  level-triggered lines.

### Verified (+3 tests, emu suite at 117 green)
- A rising-edge IO4 interrupt vectors through the matrix and counts
  exactly 2 of 3 edges (the falling edge is ignored).
- A high-level interrupt re-fires after every W1TC until the host
  drops the pin (the starved main loop then reports the count).
- A fully interrupt-driven UART echo: RXFIFO_FULL wakes the handler
  per byte while main sits parked on a jump; the line deasserts on
  FIFO drain and re-asserts on the next byte.

### Honest cuts
- Only the GPIO and UART0 sources exist — map writes for unmodeled
  sources are accepted and dropped; RXFIFO_FULL is condition-derived
  (INT_CLR has no lasting effect unless the FIFO drains); no TIMG,
  no ADC, no flash cache yet.

## 2026-06-11 — ESP32-S3 slice 5: MOVSP + the ESP-IDF app-image loader

### Added
- **MOVSP** (@protopulse/emu): the windowed ABI's last gap. With a
  caller's frame live in the register file it is a plain
  stack-pointer move; with all three WindowStart bits below clear
  (the RM's AllocaCause condition) it performs the Alloca handler's
  net effect — the 4-word base save area moves from below the old sp
  to below the new one. Same magic-handler approach as spill/fill.
- **ESP-IDF app-image loader**: `loadFirmware` now boots esptool-built
  .bin images (magic 0xE9). The 24-byte header is validated against
  esp-idf's esp_app_format.h (entry_addr honored, chip_id must be 9 =
  ESP32-S3, ≤16 segments), each segment loads into the modeled SRAM
  window, and the trailing checksum byte (XOR of segment data seeded
  0xEF, esptool's ESP_CHECKSUM_MAGIC) is verified. `reset()` replays
  the segments and restarts at the image's entry point. The Firmware
  panel's existing .bin path feeds straight into this.
- Assembler: the `MOVSP(t, s)` builder.

### Verified (+4 tests, emu suite at 114 green)
- A two-segment image (code → IRAM at a non-base address, data →
  DRAM) boots at its entry point and survives reset().
- Wrong-chip (`targets ESP32 (chip_id 0)`), flash-mapped-segment, and
  corrupted-checksum images refuse with clear messages.
- MOVSP both ways: plain move with the caller live (sp moves, save
  area does NOT); Alloca path with the callers hidden via WSR
  WINDOWSTART (markers at [sp−16] and [sp−4] travel with the stack).

### Honest cuts
- Flash-mapped segments (0x42xxxxxx/0x3Cxxxxxx) refuse — the flash
  cache is not modeled, so only IRAM/DRAM-resident images run; the
  SHA-256 trailer is not verified (the XOR checksum is); flash
  header fields are ignored. Next: peripheral interrupt lines, ADC,
  TIMG, flash-cache mapping.

## 2026-06-11 — ESP32-S3 slice 4: exceptions, interrupts, and time

### Added
- **Special registers + RSR/WSR/RSIL/RFE** (@protopulse/emu): PS
  (INTLEVEL/EXCM gating), EPC1, EXCSAVE1, EXCCAUSE, VECBASE,
  INTENABLE, INTERRUPT, CCOUNT, CCOMPARE0, and the WindowBase/
  WindowStart SRs — numbers verified against the Cadence RM,
  including catching the RM index's own typo (EXCSAVE1 is 209, not
  192 — the EXCSAVE2..7 = 210–215 sequence proves it).
- **The core timer**: CCOUNT increments every cycle; CCOUNT =
  CCOMPARE0 latches the INT6 timer interrupt (line and level from
  ESP32-S3's own core-isa.h), cleared by writing CCOMPARE0 — the RM
  rule, honored exactly.
- **Level-1 dispatch**: pending ∧ enabled ∧ INTLEVEL<1 ∧ ¬EXCM →
  EPC1 ← PC, EXCCAUSE ← 4, EXCM ← 1, PC ← VECBASE + 0x340
  (XCHAL_USER_VECOFS). RFE returns. Reset parks INTLEVEL at 15;
  firmware lowers via RSIL like real crt0s do.
- Assembler: RSR/WSR/RSIL/RFE builders, the SR name map, and PAD_TO
  — NOP-filling to an absolute image offset so handlers can sit at
  architectural addresses.

### Verified (+4 tests, emu suite at 110 green)
- CCOUNT advances exactly one per instruction (RSR deltas).
- The full interrupt life: a periodic CCOMPARE0 interrupt vectors to
  VECBASE+0x340, the handler saves context the architectural way
  (EXCSAVE1 + scratch memory), increments a counter, re-arms (which
  clears the pending bit), RFEs — and main counts 3 ticks.
- RSIL: an interrupt latched while masked delivers the moment
  INTLEVEL drops ([0, 1] observed).
- Unknown special registers refuse loudly.

### Honest cuts
- Timer line only (no software/peripheral interrupt lines yet);
  level-1 only; UM/WOE stored, not acted on; vectoring costs no
  cycles; VECBASE alignment unenforced. Next: MOVSP, peripheral
  lines, the IDF app-image loader.

## 2026-06-11 — ESP32-S3 slice 3: the windowed ABI

### Added
- **Register windows** (@protopulse/emu): CALL4/8/12, CALLX4/8/12,
  ENTRY, RETW/RETW.N over a 64-entry physical register file with
  WindowBase/WindowStart, exactly per the Cadence ISA RM (whose
  §4.7.1 quotes the mechanics verbatim). Overflow/underflow is
  handled by MAGIC SPILL/FILL — the RM's reference handlers' net
  effect performed directly, producing byte-for-byte the stack
  layout compiled code and debuggers expect. The check runs lazily
  on first touch of a register group, matching the hardware's
  spill-and-retry fixpoint.
- Assembler: ENTRY/RETW/RETW.N/CALLXn builders and CALLN_TO
  index-based placeholders (sharing CALL0's 4-alignment
  enforcement).

### Verified
- "entry a1, 32" = 36 41 00 byte fixture; window rotation argument
  passing (caller a10 → callee a2) with caller locals surviving;
  **14 live frames of call8 recursion over the 64-register file** —
  multiple overflow spills on the way down, underflow fills on the
  unwind, every frame's sentinel register and the root frame's UART
  pointer round-tripping through memory ([1..12, 78] out the UART);
  CALLX8 through a register; RETW with a call0-style link refuses.
  The test's own first draft used ENTRY a1,16 in a call8-making
  function — an ABI violation (callee extra save area needs 16 more
  bytes) — and the emulator's faithful layout surfaced it: the
  canonical "entry a1, 32" exists for a reason. 106 emu tests green.

### Honest cuts
- Spill/fill costs no cycles; MOVSP and handler-only L32E/S32E/RFWO/
  RFWU refuse; PS not modeled (window rules enforced by throwing).
  Still ahead for real ESP-IDF firmware: interrupts, peripherals,
  the app-image loader.

## 2026-06-11 — ESP32-S3 slice 2: code-density instructions

### Added
- **16-bit .N forms in the interpreter** (@protopulse/emu): MOV.N,
  MOVI.N (asymmetric −32..95, sign = AND of the top two immediate
  bits), ADD.N, ADDI.N (t=0 encodes −1), L32I.N/S32I.N (imm4<<2),
  BEQZ.N/BNEZ.N (zero-extended, forward-only), RET.N, NOP.N — the
  forms GCC emits densely, i.e. the first prerequisite for ever
  running compiler output. RETW.N and ILL.N refuse loudly.
- **Mixed-width assembly** (xtensa-asm.ts): narrow builders carry
  their width through a two-pass layout, and control flow gained
  index-based placeholders (J_TO/BEQ_TO/BNEZ_TO/BEQZ_N_TO/…)
  resolved against the real byte layout — hand-counted offsets are
  how this morning's two assembler bugs happened, so the layout
  engine owns targets now. BR() remains valid for uniform 24-bit
  code.

### Verification
- Four details the Espressif overview PDF's text extraction garbled
  (MOV.N operand order, BEQZ.N signedness, ADDI.N's −1 rule, MOVI.N's
  range rule) were settled against the full Cadence ISA RM —
  addendum in inbox/2026-06-11-esp32s3-emulator-core-verification.md.
- 6 new tests: narrow byte fixtures (RET.N = 0d f0, NOP.N = 3d f0),
  the MOV.N direction probe (would print 42 instead of 7 if
  transposed), MOVI.N at both range ends, ADDI.N −1 + narrow
  load/store round-trip, BEQZ.N jumping the trap, a mixed-width
  zero-jitter blink, RET.N subroutines + the RETW.N refusal.
  102 emu tests green.

## 2026-06-11 — ESP32-S3 core v0: the from-scratch emulator epic begins

### Added
- **Xtensa LX7 interpreter** (@protopulse/emu xtensa.ts): the 24-bit
  call0-ABI subset (~32 instructions — ALU, shifts, loads/stores,
  branches, J/JX/CALL0/CALLX0/RET, L32R, MOVI/ADDI/ADDMI). Every
  encoding verified against the Espressif ISA overview AND the
  ida-xtensa2 disassembler tables; unimplemented encodings throw
  with address and bytes instead of guessing.
- **Hand-assembler** (xtensa-asm.ts, the asm.ts/thumb-asm.ts
  sibling): 24-bit builders, a BR() displacement helper, an L32R
  literal pool, CALL0_TO with 4-alignment enforcement, and a
  bootable image layout (entry jump → pool → code).
- **Esp32s3Core** under the McuCore contract: GPIO matrix (both
  banks, IO0–IO48, OUT/W1TS/W1TC + ENABLE + IN, cycle-stamped pin
  events) and UART0 (FIFO + STATUS RXFIFO_CNT) at the REAL S3
  addresses from esp-idf v5.2's own soc headers (sources in
  inbox/2026-06-11-esp32s3-emulator-core-verification.md).
- **Firmware panel**: loads raw .bin images (the core's format)
  alongside Intel HEX; the core picker gains the S3 with an honest
  "v0, raw images" label; co-sim offers it no ADC channels because
  it has no ADC.

### Verified
- 9 tests, all real hand-assembled Xtensa machine code, with the
  assembler's bytes pinned against independent disassembly fixtures
  (RET 80 00 00, MOVI a2,63 = 22 a0 3f, …) so an assembler/
  interpreter shared bug cannot hide: zero-jitter blink on IO5,
  host-driven input mirror, high-bank IO33 via OUT1/ENABLE1, UART
  hello + echo through STATUS polling, CALL0/RET double-twice,
  SLLI arithmetic, loud HEX/unknown-instruction refusals, reset
  replay.

### Honest cuts (stated in the core header)
- Single core (the S3 has two); 1 instruction = 1 cycle at 240 MHz;
  one 480 KB SRAM window on both buses; no 16-bit density forms, no
  register windows — real ESP-IDF firmware will NOT run yet; no
  interrupts, no ADC, no bootloader. The ROADMAP names the next
  slices.

## 2026-06-11 — documentation overhaul: every living doc audited against the code

### Fixed (stale claims, verified against the repo before correcting)
- Legacy AI tool count is **113**, not 82 (counted from the
  `server/ai-tools/` registry) — corrected in README, USER_GUIDE,
  AI_AGENT_GUIDE.
- Legacy test suite is **725 files / ~30.5k tests** (verified by
  running it), not "54 files / 1,553" — README and AI_AGENT_GUIDE now
  state the real numbers AND the honest caveat (~421 env-dependent
  failures on main, tracked in ROADMAP).
- Database schema is **47 tables**, not 27 (counted in
  `shared/schema.ts`).
- Engine test count corrected everywhere to **1,340**; "14 concept
  articles" → the complete 88-article wiki; "17 seed parts" → 18.
- The repo claimed MIT in three places with a dead LICENSE link —
  **the MIT LICENSE file now exists**.

### Refreshed
- **README.md**: engine section rewritten for the v0.1–v0.4-complete
  reality (full capability table across all 16 packages, crew, fab
  decks, importer), honest Quality numbers, expanded documentation
  index, unverifiable legacy progress percentage replaced with a
  pointer to the backlog ledger.
- **packages/README.md**: complete 16-package map with dependencies,
  the op-log thesis paid off in one paragraph, two new house
  conventions written down (honest cuts stated; hardware facts
  verified), relay dev command added.
- **DEVELOPER.md / AI_AGENT_GUIDE.md**: engine sections brought to
  current truth — all 16 packages, both AI stacks table, real test
  expectations.
- **USER_GUIDE.md**: §19 retitled from "Preview" to "The New Editor"
  (it long outgrew a preview); intro cross-links it.
- **DESIGN.md**: engine chapter package map and SDF-text reference
  updated.
- **tools/golden/README.md**: the `zoned-led` fixture joins the table.
- **ADR index**: 0012–0016 indexed; ADR-0014's deviation noted as
  closed (the merge resolver shipped).

### Untouched on principle
- `docs/vision/` (frozen), `docs/notebooklm.md` (Codex-owned), all
  point-in-time records (CODEX_*/COLLAB_*/audits/qa-audit/reports),
  CHANGELOG history below this entry.

## 2026-06-11 — multi-fab rule decks + fab picker

### Added
- **OSHPark + PCBWay 2-layer rule decks** (content/decks): every
  capability web-verified against the fab's official pages —
  OSHPark 6/6 mil trace/space, 10 mil drill, 5 mil annular, 15 mil
  edge keepout; PCBWay 0.1 mm trace/space, 0.15 mm drill/annular,
  0.25 mm edge. Sources + the mil→nm table filed to
  inbox/2026-06-11-fab-rule-deck-capabilities.md. The power-class
  0.3 mm trace override is the house convention, noted as such.
- **Fab picker** (@protopulse/app DRC panel): selects which
  manufacturer's deck the WHOLE app answers to — DRC reports (the
  deck joins the cache key, so the same head re-checks under a new
  fab), the Router's direct runs, walk/shove clearance, and zone
  pours all follow the selection, which persists across sessions.
  Switching fabs clears the displayed report (it answered to
  another fab) and re-pours zones at the new clearance.

### Verified
- Runner test: same head re-runs on fab switch, deck reloads,
  unknown deck names refuse, the three decks list with JLC first.
  Browser pass: picker lists all three, an OSHPark run reports
  "deck oshpark-2layer-standard rev 2026-06", and the selection
  survives a reload.

## 2026-06-11 — part packs: the community library's foundation

### Added
- **`pp-part-pack` format** (@protopulse/parts): a versioned JSON
  file of full Part records, validated by the complete part schema
  (pin closure, 1.27 mm grid, footprint pad references). Structural
  trust rules: every part lives in the pack's own namespace — the
  `core:` seed namespace cannot be shadowed or extended — and
  provenance tiers are declared per part with the note saying who
  verified what. `loadPackInto` is all-or-nothing: any collision
  refuses the whole pack with the reason.
- **Palette pack loading** (@protopulse/app): "Load part pack…"
  reads a pack file, adds its parts to the palette (tier shown in
  every tooltip), persists the pack in localStorage so it's back
  next session, lists loaded packs, and forgets them on request
  (parts stay until reload — stated in the UI). Startup load
  failures surface in the palette, never silently.

### Honest cut
- No registry, hosting, or sharing — that's a product decision
  (where packs live, who publishes, moderation). The format is the
  engineering half: a pack already travels as a file.

### Verified
- 4 pack tests (parse+load, namespace rules incl. core-shadowing
  refusal, duplicate/collision all-or-nothing, full part-schema
  enforcement) and a browser pass: load → part in palette → place it
  (ops advance) → reload → still there, pack row listed.

## 2026-06-11 — legacy → .ppx importer (migration milestone, gate 1)

### Added
- **`protopulse import-legacy`** (@protopulse/cli): converts a raw-row
  JSON snapshot of one legacy project (psql recipe in the command
  help) into a .ppx op-log bundle — components, values, schematic
  placements (25 legacy px = one 1.27 mm grid step, rotations snapped
  to quarter turns), and nets resolved from BOTH legacy segment
  generations ({instanceId, pinId} and {fromInstanceId, …}), with
  connector ids and names both accepted and pins mapped by name
  first, ordinal only when the counts agree. Parts map onto the
  engine seed library by mpn/title/category heuristics (generic NPN
  → 2N3904 and generic N-MOSFET → AO3400, each noted); anything
  unmappable — LDRs, mystery modules — is skipped with its reason.
  Dirty data degrades loudly: a port claimed twice stays on the
  net that existed first and the report says so. The bundle is
  materialize-verified before it's written (problems = exit 1).

### Honest scope
- One legacy circuit design per bundle (--design picks; the report
  lists the rest); hierarchy, breadboard/bench/pcb views, and
  non-seed parts don't carry over. The legacy app's own export
  format drops instance ids and part links — hence the raw-row
  snapshot input.
- Still open before legacy retirement: moving Tyler's real projects
  through it (needs his database), then the default-UI flip.

### Verified
- 5 importer tests (mapping table incl. the LDR refusal; sound
  bundle with values/placements/rotation snap; both segment
  generations + id/name pin resolution; dirty-data degradation;
  --design selection) and an end-to-end smoke: snapshot →
  import-legacy → `protopulse check` exits 0 clean.

## 2026-06-11 — deferred-cuts sweep 2: mouse-bites + fab/panel UI

### Added
- **Mouse-bite separation** (@protopulse/export panelizeGraph):
  `separation: 'v-cut' | 'mouse-bites'` — copies part by a routed
  channel (`gapNm`, default 2mm) bridged by tabs (`tabWidthNm`,
  default 5mm; two per copy edge at 25%/75%) with 0.5mm perforations
  at 0.75mm pitch along BOTH edges of every channel, rails included.
  Per-piece outlines come back as `edgeSegments` for Edge.Cuts and
  bite centers as `bites` for the drill file. The v-cut path is
  byte-identical to before.
- **Excellon extraHoles** (@protopulse/export): exportExcellon grows
  an optional extra-holes parameter for the perforations. Honest
  note: they join the one drill file — KiCad would split PTH/NPTH
  into two files. Default stays byte-identical (golden-safe).
- **Fab outputs + Panelize UI** (@protopulse/app Export tab): one
  button downloads the board's fab set (F/B copper gerbers,
  Edge.Cuts, Excellon drill, pick-and-place CSV); the Panelize
  section (rows/cols/rail/separation/gap/tab) downloads the same
  set for the panel. Engine refusals surface verbatim in the status
  bar. Browser-verified: refusal without an outline, then a 2×2
  mouse-bite panel downloading 5 files whose drill contains exactly
  the engine's 224 perforations (32 tabs × 7 holes).

### Honest cuts
- Edge.Cuts for mouse-bite panels is outline-overlay style (outer
  rect + per-piece rects + bite drills), not a kikit-style routed
  contour polygon. No panel fiducials (unchanged; the graph can't
  hold bare copper and fabs add their own).

## 2026-06-11 — deferred-cuts sweep 1: EEPROM + watchdog, per-core ADC, deck picker

### Added
- **AVR EEPROM** (@protopulse/emu): 1 KiB against a persistent
  backend — nonvolatile across reset() like the silicon, with
  eepromMemory() for bench pre-seeding and inspection. Firmware
  tests cover the full EECR state machine: EEMPE 4-cycle arm window,
  EEPE polling through the ~3.6 ms erase+write, EERE read-back out
  the UART, and persistence across a power-on reset.
- **AVR watchdog** (@protopulse/emu): the WDCE change-enable window,
  WDE timeout → CPU reset + MCUSR.WDRF, WDR feeding. Firmware tests:
  a hung loop gets reset (WDRF asserted); a WDR loop never does.
  Honest note in the core header: avr8js's watchdog reset preserves
  I/O registers where real silicon clears them.
- **Per-core ADC channels** (@protopulse/app co-sim): the closed-loop
  ADC binding picker now offers the borrowed core's own channels
  (RP2040: ADC0–3 on GP26–29; AVR: ADC0–7) instead of a fixed AVR
  list, and the panel names which core it borrowed from the Firmware
  tab.
- **Review deck picker** (@protopulse/app): the Review panel offers
  builtin + every versioned deck bundled from content/review-decks
  (glob + zod mirror, same pattern as the sourcing catalog). The
  deck is part of the report cache key AND the history key — the
  opened/closed delta never diffs across decks (runner test pins
  this). The report line now names deck + rev.

### Still honest gaps
- SPI/TWI slave mode (the host is always the far end); ESP32 core.

## 2026-06-11 — SDF text + GPU picking (the renderer epic)

### Added
- **SDF glyph atlas** (@protopulse/renderer): text now renders from a
  signed distance field — exact Felzenszwalb Euclidean distance
  transform (`sdf.ts`, DOM-free, tested against brute force) with
  TinySDF sub-pixel seeding from the antialiased raster, uploaded as
  an R8 texture, reconstructed by an fwidth smoothstep shader. Crisp
  at every zoom; browser-verified at ~70× (smooth contours, round
  counters, no blur). Supersedes the M1 canvas-alpha atlas (ADR-0015
  supersedes ADR-0013).
- **GPU pick buffer** (@protopulse/renderer `pickAt`): scene nodes
  draw into an offscreen RGBA8 ID pass (24-bit index encoding in
  `pick-encode.ts`, exact-k/255 round-trip tested); readPixels at the
  cursor answers "what's under here" in O(1) regardless of density.
  Cached per (scene, camera, size); drill holes punch through the
  pick buffer just like the visible pass. ADR-0016 supersedes
  ADR-0012 — the Vol II §B.2 dual picking system is complete.
- **Hover highlight** (@protopulse/app): both editors light the node
  under the cursor — GPU pick first (exact on pads/zones/traces/
  copper), flatbush tolerance pick as fallback for 1px line art.
  Browser-verified: pad fill → footprint id, empty board → null,
  highlight clears on leave.

### Honest cut
- Single-channel SDF, not multi-channel MSDF: sharp corners round by
  ≤1 source pixel at extreme magnification (needs vector outlines +
  a bundled font to do better — revisit trigger in ADR-0015).

### Status
- This was the last tractable engine item. v0.1 now has exactly one
  open box (pcbnew manual import check — Tyler); everything else on
  ROADMAP is gated on hardware, product decisions, or migration.

## 2026-06-11 — ESP32-S3 verified part

### Added
- **core:esp32-s3-wroom-1** (@protopulse/parts): the Probe's brain
  joins the seed library with all 41 module pins verified against
  the Espressif ESP32-S3-WROOM-1/-1U datasheet pin table and
  cross-checked against an independent community pinout (sources +
  full table in inbox/2026-06-11-esp32-s3-wroom-1-pinout.md, per the
  Hardware Verification Protocol). Strapping pins (IO0/IO3/IO45/IO46)
  and the EN pull-up flagged in the part docs; symbol splits EN+IOs
  left, UART/JTAG/USB right, 3V3 up, grounds down.

### Honest cut
- No footprint yet — the 18×25.5mm castellated land pattern is a
  later datasheet-exact slice; the part is schematic-usable and the
  unplaced tray flags it on the board side.

### Verified
- New test: 41 pins, unique pin + symbol keys, the datasheet corner
  pins by number (1 GND, 2 3V3, 3 EN, 27 IO0, 36 RXD0, 37 TXD0,
  41 EPAD), and the stated footprint absence. Full test:packages
  green; eslint 0 errors.

## 2026-06-11 — branch sync

### Added
- **Branches sync** across the relay: every branch travels as
  {name, base, OWN ops} — the inherited prefix is the base pointer
  and is never re-carried on the wire. Snapshots list branches
  main-first so base pointers resolve in adoption order; a branch
  created mid-session re-announces through an idempotent join; ops
  that race ahead of their branch's snapshot heal by re-joining.
  BranchLog gains adoptBranch (sync-shaped refusals, not throws) and
  ownOpsFor.
- **Honest conflict rule**: a same-named branch with a DIFFERENT
  fork point is unsyncable by construction — the relay keeps its
  first-seen base and replies with an advisory the Sync panel shows
  as a note; the rest of the session keeps syncing.
- Room persistence records went branch-aware ({branch, base, env}
  JSONL); pre-branch files still load — bare envelopes were main.
  v1 clients (flat envelope payloads) keep working against the new
  relay.

### Verified
- 2 relay tests (branch join/snapshot wire shape + tagged broadcast;
  base-mismatch advisory with first-seen-base retention) and 2
  end-to-end two-editor tests (a feature branch travels: pointer
  adopted, feature-only component visible on the branch and ABSENT
  from main, edits flow both ways; a branch born mid-session reaches
  the peer). All 8 pre-branch relay/sync tests still pass through
  the compat paths. Full test:packages green; eslint 0 errors.

## 2026-06-11 — AVR timers 1/2, SPI, TWI

### Added
- **Timers 1 and 2** wired into Atmega328pCore: avr8js models drive
  OC1A/OC2A/… through the already-wired GPIO ports, so CTC/PWM
  waveforms land in the cycle-stamped pin-event stream like any edge.
- **SPI master** against a host byte handler (setSpiHandler): each
  master transfer hands MOSI to the host and clocks the reply back
  into SPDR; avr8js still charges the configured clock cycles so SPIF
  timing stays honest. No handler = the bus floats 0xFF, like real
  disconnected MISO.
- **TWI master** against a host bus handler (setTwiHandler):
  start/connect/write/read/stop route synchronously with host acks;
  no handler = every address NACKs — an empty bus, never a hang. Both
  handlers survive reset(), like the ADC sampler: bench wiring, not
  machine state.

### Honest gaps (stated in the core header)
- EEPROM and watchdog remain unwired; SPI/TWI slave mode is not
  modeled (the host is always the far end).

### Verified
- 6 tests, all real hand-assembled firmware: timer1 CTC toggles B1
  every exactly 100 cycles and timer2 toggles B3 every 50 (zero
  jitter asserted); an SPI transfer round-trips MOSI 0x42 → host →
  MISO 0xA5 → SPDR → UART; the floating-bus case reads 0xFF; a full
  TWI write transaction logs start → connect(0x50,W) → write(0x42) →
  stop with acks; the empty-bus case completes instead of wedging.
  Full test:packages green; eslint 0 errors.

## 2026-06-11 — panelization: v0.4 complete

### Added
- **panelizeGraph** (@protopulse/export): the panel is a TRANSFORMED
  GRAPH — rows×cols copies with `~P<n>`-suffixed ids/refs/nets,
  offset copper, optional top/bottom rails, and the panel rectangle
  as the outline. Because the output is a plain DesignGraph, every
  existing exporter (gerber, excellon, pick-and-place) and even DRC
  work on the panel unchanged — panelization adds geometry, not a
  second export pipeline. V-cut scores come back alongside and ride
  the Edge.Cuts emitter (exportEdgeCuts grew an extra-segments
  parameter).
- Refusals are honest: no outline, non-rectangular outline, or a
  pointless 1×1 each come back with a reason.

### Honest cuts
- Rectangular axis-aligned outlines only (a V-cut is a straight
  full-panel score); V-cut separation only (mouse-bites are a later
  slice); no panel fiducials (the graph can't represent bare copper —
  pads come from parts — and fabs like JLC add their own on request);
  engine-level only, no panel UI yet.

### Milestone
- **v0.4 (The Board) is COMPLETE**: PCB ops, footprints, DRC, the
  trace/via/zone/outline tools, walkaround + shove + spring-back +
  cascading shove, thermal reliefs, Gerber/Excellon/PnP goldens,
  Edge.Cuts, the copper-to-edge check, and panelization.

### Verified
- 4 tests: refusal trio; 2×3 replication (counts, offsets, distinct
  ids, panel outline, V-cut count, graph invariants HOLD on the
  panel); rails extend the outline with joint V-cuts; the panel flows
  through the existing exporters (4× pad flashes, suffixed refs in
  PnP, outline+V-cut strokes in Edge.Cuts, byte determinism). Full
  test:packages green; eslint 0 errors; goldens untouched.

## 2026-06-11 — outline UI + the copper-to-edge check

### Added
- **Outline tool** in the PCB toolbar: click corners anywhere, click
  the first corner again to close — commits set_board_outline,
  replacing any previous outline (singleton semantics, one undoable
  op).
- **Outline rendering**: the board edge draws as yellow Edge.Cuts
  lines under everything; it is context, never a selection target
  (worst pick rank, segment-proximity hit test).
- **DRC-EDGE-CLEARANCE**: with an outline present, every copper item
  must sit INSIDE it and keep the deck's copper_to_edge_nm from every
  edge; items outside the board are called out as such. Maps to the
  panelization wiki article (breakaway stress near edges). No
  outline → no findings: a schematic-stage design is not in
  violation.

### Verified
- 2 DRC tests (clean inside / no-outline silence; edge-hugging trace
  + outside via both flagged as errors). Browser-verified end to end:
  outline renders, the toolbar tool exists, and the DRC panel reports
  "trace t-edge is 25000nm from the board edge — the deck requires
  300000nm" against the real JLC deck. Full test:packages green;
  eslint 0 errors.

## 2026-06-11 — board outline in the core

### Added
- **set_board_outline** (singleton; null clears) through the full
  graph closure: apply deep-copies, inverse restores the previous
  polygon (or the no-outline state), diff gains
  pcbView.outlineChanged, merge replays theirs-only outline changes
  (ours wins when both touched it), JSON round-trips, invariants
  check integer coordinates. The 100%-branch gate on the core held.
- **Gerber Edge.Cuts** (`exportEdgeCuts`): the outline as a Profile
  layer stroked at 0.1mm (the KiCad convention fabs expect); returns
  null when the design has no outline — an honest absence, not an
  empty file. Existing golden fixtures have no outline and stay
  byte-identical.

### Honest cuts (substrate-first, like buses+sheets)
- No outline drawing tool, renderer display, or DRC copper-to-edge
  check yet — listed on the ROADMAP; panelization now has its
  prerequisite.

### Verified
- 6 graph closure tests (set/reshape/clear, inverse round-trip both
  ways, diff both directions, merge set/clear/ours-wins, JSON,
  invariants) + 1 export test (null absence, Profile header, closed
  stroke, byte determinism). Full test:packages green; goldens
  untouched; eslint 0 errors.

## 2026-06-11 — cascading shove

### Added
- **Cascading shove** (@protopulse/route): when a shove victim's
  detour is cornered (its endpoints swallowed by merged obstacle
  hulls), shovable traces overlapping its corridor AABB are recruited
  into the victim set and the whole plan re-runs — sequential
  cumulative planning keeps every round mutually consistent by
  construction. Rounds capped at MAX_CASCADE_ROUNDS=4; corridors that
  stay blocked after the cap refuse honestly. Stated trade-off: the
  corridor heuristic can over-shove a neighbor that didn't strictly
  need to move — safe churn, undone by spring-back.

### Verified
- New test: a victim walled into a channel between two long traces (a
  short crossing trace hits ONLY the victim) recruits both walls;
  all three reroute and the final configuration is verified mutually
  clear path-by-path. The single-level "nowhere to go" refusal test
  still blocks (endpoints inside the shover's own hull — no cascade
  can fix that). Full test:packages green; eslint 0 errors.

## 2026-06-11 — sim worker streaming: v0.2 complete

### Added
- **Batch progress streaming**: Monte Carlo and parameter-step runs
  stream one progress frame per completed deck from the sim worker;
  the Sim panel shows "Run 7/20 complete…" instead of a frozen
  spinner. Protocol: a `progress` frame per deck before the final
  reply, correlated by id; the client routes frames to an onProgress
  callback threaded from the panel through the cached runner.

### Honest scope
- Single-deck runs can't stream — ngspice-WASM runs a deck to
  completion; the boot message stays for those.

### Milestone
- **v0.2 (The Lab) is COMPLETE.** The two remaining ⬜ markers in the
  ROADMAP were stale (math channels/FFT/branch overlays and the
  AC-source emitter for graph-driven noise all landed earlier) — the
  section is reconciled and closed. v0.1 retains only its three
  M1 stragglers (pcbnew manual check, MSDF/GPU picking, ESP32-S3
  part).

### Verified
- 2 new tests: the pure worker handler emits exactly one frame per
  batch deck (none for single runs), and SimWorkerClient routes
  frames to onProgress while resolving the final batch once, over the
  real handler behind a shim worker. Full test:packages green;
  full-tree eslint 0 errors.

## 2026-06-11 — review decks + community rules: v0.3 complete

### Added
- **Versioned review decks**: runReview accepts a named deck that
  enables/disables checks and overrides severities (a deck states its
  DEVIATIONS — absent checks run at defaults). Reports now pin the
  deck name + rev ('builtin' when none). ReviewDeckSchema lives in
  @protopulse/content; content/review-decks/protopulse-standard.json
  is the no-deviation house deck and the template community decks
  copy.
- **Community-extensible rules**: extraChecks — pure functions over
  the public graph/parts types whose findings join the report as
  first-class citizens, configurable by the deck exactly like
  built-ins.

### Honest cut
- The ReviewPanel still runs the builtin deck; a deck-picker UI is
  later work.

### Milestone
- **v0.3 (The Crew) is COMPLETE**: six crew members, design review as
  a versioned artifact, three teaching depths, buses+sheets, and the
  88-article wiki.

### Verified
- 2 new review tests (deck disable + severity override + deck/rev
  pinning; a community no-electrolytics rule joins, sorts, and is
  deck-silenceable) + 1 content test (the standard deck parses and
  lists every built-in). Full test:packages green; full-tree eslint
  0 errors.

## 2026-06-11 — the Buyer: the crew is complete (6/6)

### Added
- **The Buyer** (`@protopulse/ai`): sixth and final crew member from
  the vision's roster. read_bom (lines grouped by part + canonical
  value, so 10k ≡ 10K), find_offers (by ref or partId+value),
  assign_sourcing (writes fields.lcsc/mpn as reviewable ops — the
  vision's "Buyer-proposed substitutions, each one a reviewable op";
  guards part/value mismatches and preserves existing fields), and
  sourcing_report (basic vs extended counts, unsourced refs — numbers
  about classes, never about money).
- **Sourcing catalog seed** (`content/catalog/jlc-assembly-seed.json`
  + CatalogSchema/loaders in @protopulse/content): 9 LCSC part
  numbers hand-verified against LCSC/JLCPCB product pages this
  session (findings + sources routed through inbox/ per the
  verification protocol). NO prices or stock by design — a static
  catalog quoting those would be lying within a week; the rev stamp
  and "verify at order time" note say so, and a test enforces that
  entries stay price-free.
- **Buyer tab** in the editor: Analyst-pattern live chat; assignments
  land as one undoable batch with meta {agent: 'buyer'}.

### Honest cuts
- Live vendor APIs ("in stock at JLC right now") are v0.6+
  manufacturing-pipeline work; two catalog classes are marked
  "assumed" pending confirmation; offer packages may differ from the
  design's generic footprints (0603 offers vs 0805 seeds) and the
  Buyer is told to surface that, not hide it.

### Verified
- 6 AI tests (tool guards + FakeProvider story: read → offers →
  assign to both 10k refs → report sees the working copy; confirm
  gate) and 2 content tests (real catalog parses, rev-stamped,
  price-free). Full test:packages green; full-tree eslint 0 errors;
  Buyer tab browser-verified.

## 2026-06-11 — Firmware-panel core picker

### Added
- The Firmware tab grew a **core** selector: ATmega328P (16 MHz) or
  RP2040 (125 MHz), applied at load time. The emu session rebuilds
  the core when the kind changes; a build missing the requested
  constructor errors as a value, not a crash. Serial monitor and the
  logic-analyzer traces work for both cores (RP2040 pins show as
  GP0…GP29). Honest note: co-sim bindings still speak AVR pin names.

### Verified
- New runner test: rp2040 selection constructs the other core,
  switching kinds rebuilds, missing-constructor builds error cleanly.
  Browser-verified: the picker renders both cores in the Firmware
  tab. 385 app tests green; typecheck + lint clean.

## 2026-06-11 — RP2040 core: the second MCU

### Added
- **Rp2040Core** (`@protopulse/emu`): the McuCore contract's second
  implementation, on wokwi's rp2040js (Cortex-M0+). GPIO pin events
  cycle-stamped off the real core counter; setPin drives pads (input
  levels survive reset — bench wiring, not machine state); PL011
  UART0 both directions; the SAR ADC consults the host sampler at
  12 bits against 3.3 V (the AVR core is 10-bit @ 5 V — each core
  states its own architecture's truth, PC in bytes vs words included).
- **thumb-asm.ts**: hand-assembler for the Thumb-16 subset the tests
  need (asm.ts's Cortex sibling, encodings from the ARMv6-M ARM) plus
  loadConst for 32-bit register constants.

### Honest cuts (stated in the adapter)
- Firmware images are raw Thumb entered at the flash base (no
  bootrom/boot2/UF2); ADC conversions complete instantly instead of
  after the silicon's ~2 µs; reset = rebuild (rp2040js has no full
  power-on reset); engine-level only — the Firmware panel still
  drives the AVR until a core picker lands.

### Verified
- 7 tests, all real hand-assembled firmware against real RP2040
  registers: GP25 blink (cycle-stamped alternation), GP2→GP25 input
  mirror through SIO+PADS, UART TX, full UART echo (firmware enables
  the PL011 and echoes a fed byte), ADC start→READY-poll→RESULT→UART
  round trip through the sampler, reset/firmware-survival, guards.
  Full test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — sync relay round 2: persistence + auth

### Added
- **Room persistence** (`PP_RELAY_DATA`): rooms append to one JSONL
  file each (append-only — the write story matches the op-log's
  accrue-only nature); a restarted relay re-seeds rooms from disk
  before any client rejoins. Crash-safe by format: appends lead with
  a newline so a cut-short write isolates as one skippable line — a
  bug the restart test caught (a partial tail used to swallow the
  next record). The relay still never owns designs.
- **Shared-token auth** (`PP_RELAY_TOKEN`): when set, joins must carry
  the token; rejected joins get an explicit unauthorized error and the
  socket closes. The Sync panel grew a token field, and the client
  treats relay-level errors as terminal — no retry storm against a
  closed door.

### Honest cut
- Branch sync remains open (ROADMAP): non-main branches stay local.

### Verified
- 2 new relay tests (token gate incl. no-room-leak on rejection;
  rooms survive a relay restart with a corrupt-tail file) + 1
  end-to-end client test against a real token-gated relay (wrong
  token errors without reconnect-looping; right token syncs). Full
  test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — thermal reliefs

### Added
- **Thermal reliefs on zone pours**: zones carry `connect: solid |
  thermal` (optional, absent = solid) through the full graph closure —
  apply/inverse/merge/serialize all preserve it, the 100%-branch gate
  on the core held. Thermal pours carve an annular gap (pad inflated
  by the pour clearance) around every same-net pad, bridged by 4
  orthogonal spokes (default width 0.4mm, a solderability convention)
  — computePour returns a reliefs count and the notch geometry is
  exact-area tested. Same-net traces and vias stay solid-connect; the
  honest cut is stated in the code, the wiki, and here.
- **Zone Inspector**: selecting a zone now shows net/layer/corners and
  a solid|thermal toggle — switching styles lands as ONE undoable
  batch (remove + re-place under the same id; selection survives).
- Obstacles now carry their copper kind (trace/via/pad) — the pour
  partitions same-net pads from same-net track without label-parsing.

### Verified
- 2 new pour tests (exact notch area vs the solid pour; traces/vias
  unaffected), 1 graph closure test (connect through apply, inverse,
  merge replay, JSON). Browser-verified: thermal pour renders the 4
  corner notches; Inspector toggle flips solid↔thermal as one batch
  with live re-pour. Gerber goldens byte-identical (solid default).
  Full test:packages green; full-tree eslint 0 errors.
- The zones-and-thermal-reliefs wiki article's "See it" updated — it
  honestly claimed reliefs didn't exist; now it honestly claims they
  do.

## 2026-06-11 — concepts wiki complete: 88/88

### Added
- **Final PCB tranche (12 articles)**: return-paths, loop-area,
  trace-width-vs-current, vias-thermal-and-signal,
  zones-and-thermal-reliefs, courtyards, annular-rings,
  silk-discipline, stackup-basics, diff-pairs-at-hobby-scale,
  acid-traps, panelization. The Vol III §2 seed list (88 articles,
  nine categories) is complete. "See it" sections stay honest about
  today's editor: solid-connect zones (no thermal reliefs yet), no
  diff-pair mode, no panelization, 2-layer only.
- **drcCodes frontmatter** (optional): PCB articles can claim the DRC
  codes that deep-link to them, mirroring ercCodes. Validation is
  bidirectional and lives in @protopulse/drc (content can't depend on
  drc without a cycle): every DRC code maps to a real article, every
  drcCodes claim is a real DRC code.

### Changed
- DRC codes re-pointed from placeholder fundamentals slugs to the real
  PCB articles: DRC-TRACE-WIDTH → trace-width-vs-current, DRC-ANNULAR
  and DRC-DRILL → annular-rings, DRC-ZONE-OVERLAP and
  DRC-ZONE-ISOLATED → zones-and-thermal-reliefs. (DRC-CLEARANCE stays
  on tolerance-stacking — the honest home; the seed list has no
  dedicated clearance article.)

### Verified
- Content tests now require the pcb category, ≥88 articles, and all
  12 PCB block slugs; the drc concept-mapping test scans the whole
  wiki (was: fundamentals only). Full test:packages green; full-tree
  eslint 0 errors.

## 2026-06-11 — the Architect: fifth crew member

### Added
- **The Architect** (`@protopulse/ai`): organizes designs on the shared
  agent loop — read_structure (sheet tree + buses + unbussed nets +
  root components), create_bus (named bus over nets BY NAME, whole-call
  failure on unknowns), create_sheet (add_sheet + interface ports +
  component moves in one call, parents resolved by name), and
  move_components (onto a sheet or back to the root). Unlike the
  Analyst (injected sim) and the Router (injected routing stack), its
  tools need NO host hooks — buses and sheets are graph entities, so
  the agent loop's working copy is the whole substrate. The purest
  proof yet of "once the substrate exists, a crew member is an
  assembly job".
- **Architect tab** in the editor: same live-chat shape as the
  Analyst/Router; structure lands in the session as one undoable batch
  with meta {agent: 'architect'} — blameable and syncable like any
  edit.

### Fixed
- Renderer scene tests: the hand-rolled mock graph lacked the `sheets`
  map the buses+sheets diff now iterates — 8 latent failures on main,
  green again.

### Verified
- 6 new AI tests (tool registry + FakeProvider end-to-end story:
  read → bus POWER → sheet PSU with interface → verify on the working
  copy; confirm-gate honored). 116 AI / 99 renderer / 383 app tests
  green; typecheck + lint clean; tab browser-verified.

## 2026-06-11 — buses + sheets in the graph core; wiki at 76/88

### Added
- **Buses + sheets** (the Architect's substrate, Vol II §A.5): the
  vision's five ops — create_bus, assign_to_bus, add_sheet,
  set_sheet_interface, move_to_sheet — plus remove_bus/remove_sheet
  (the inverse algebra demands them; zones set the precedent). Full
  closure: bidirectional bus membership maintained through assign/GC/
  merge_nets; sheet interface ports GC with their nets and re-point on
  merges; occupied sheets refuse removal; component sheetId rides the
  component prop deltas so diff/merge get sheet moves for free
  (replayed as move_to_sheet, deferred until theirs-added sheets
  exist — an op-ordering bug a closure test caught). Invariants:
  bidirectional membership, parent existence + cycle walk, binding
  existence. Serialization back-compatible.
- **Concepts wiki 63 → 76**: analog-sensing/ (9 — ADC reference
  quality through aliasing) and practice/ (4 — abs-max ratings,
  footprint choices, ESD truth vs ritual, asking good debugging
  questions). One tranche left: PCB (12), completing the 88.

### Verified
- 30 new graph tests; the 100%-branch gate on ops/apply/materialize/
  diff HELD (all four at 100/100/100/100); 189 graph + 21 content +
  383 app tests green; typecheck + lint clean.

## 2026-06-11 — copper zones, end to end

### Added
- **Zones/pours in four gated phases.** The graph stores INTENT (an
  outline polygon for one net on one layer, optional clearance
  override); the pour — outline minus foreign copper at clearance — is
  derived everywhere it's needed. place_zone/remove_zone close fully
  (apply/GC/inverse/diff/merge/invariants/serialize; the coverage gate
  caught merge_nets not re-pointing zones to the survivor).
  computePour (@protopulse/route): martinez boolean geometry, integer-
  nm boundary, square-corner keep-outs (conservative by construction),
  same-net copper left in the fill — that's how a zone connects.
- **On screen + in hand**: pours render as dimmed copper UNDER traces/
  pads (outline-only until the deck clearance loads — never a guess;
  the scene rebuilds the moment clearance arrives), and the Zone tool
  draws them (pad click seeds the net, corners snap, first-corner
  click closes).
- **DRC**: DRC-ZONE-OVERLAP (different-net zones overlapping pour
  overlapping copper — a short) and DRC-ZONE-ISOLATED (no same-net
  copper inside the outline — an island), both wiki-mapped.
- **Gerber**: zone pours emit as G36/G37 regions, holes via LPC/LPD
  polarity restored before the dark copper draws on top. Frozen in the
  new `zoned-led` golden fixture; every pre-zone fixture stayed
  byte-identical.
- Honest cuts stated where they live: solid connects (thermal reliefs
  are a later slice), square-corner keep-outs.

### Verified
- Pour math by analytic area to the nanometer; 36 DRC tests; golden
  29/29; browser-verified: the zoned-led pour fills with clearance
  moats around every piece of foreign copper, and DRC reports clean.

## 2026-06-11 — failure puzzle #1: the bus that never reads high

### Added
- **The failure-puzzle system** (Vol III §1.4): a broken design + a
  symptom + the instruments; solved when you ANNOTATE the actual
  root-cause net/component on the schematic — solved-ness is a property
  of the design's own op-log (annotate ops), not a quiz UI. PuzzleSchema
  in @protopulse/content, puzzles ship as content/puzzles/<id>/
  {puzzle.json, design.ppx.json}, Puzzles tab in the editor (symptom,
  suggested instruments, progressive hints, mark-selection-as-root-
  cause, explanation revealed on solve; wrong marks stay in history —
  debugging leaves tracks).
- **slow-rise-11** from the catalog: an open-collector bus whose 100k
  pull-up against ~10nF of bus capacitance (τ ≈ 1ms) never reaches a
  valid high between driver pulses. ERC passes — the bug is legal
  electricity with wrong values; the transient tells the story.

### Verified
- The puzzle premise is PHYSICS-TESTED in real ngspice: the broken bus
  peaks <2.5V in steady state; swapping the pull-up to 4.7k puts it
  >3.5V. Schema/anchor/ERC/checker tests alongside. Browser-verified
  end-to-end: load → hint → select R1 on canvas → mark → ✔ solved.

## 2026-06-11 — the Router: fourth crew member

### Added
- **The Router** (`runRouter` in @protopulse/ai + Router tab in the
  editor): copper is geometry, clearance is law, the ratsnest is a
  to-do list. Four tools — read_board (placements/traces/ratsnest
  digest), route_connection (walk-first; shove when walk reports no
  corridor; refusals surface as tool errors the model adapts to),
  run_drc, remove_trace. Engines are dependency-injected (RouterHooks,
  pinned like sim-types): the app wires the REAL walkaround/shove/DRC
  stack — the same machinery the human trace tool drives.
- Routes apply to a working copy inside the loop (Draftsman pattern);
  on completion they land in the session as ONE undoable batch with
  meta {agent: 'router'} — blameable and syncable like any edit.
- Ratsnest segments now carry their endpoint port refs (aPort/bPort),
  so airwires can be named ("R1:2 → R2:1") by every consumer.

### Verified
- 5 ai tests (FakeProvider end-to-end: read → walk refusal → shove →
  DRC-clean on the working copy; destructive confirm gate) + 5 app
  host tests over the REAL engines (labeled ratsnest, walk routes
  emptying the ratsnest, shove with victim ops, deck-loading refusal,
  real DRC findings). Live Anthropic runs need Tyler's key (same as
  Analyst/Professor).

## 2026-06-11 — CI circuit badges

### Added
- `protopulse check --badge <file>`: a shields-style SVG of the check
  result — green "ERC clean", amber "clean · N warnings", red
  "N errors" or "corrupt log". Deterministic by construction (flat
  per-char text metrics, no timestamps) and honest by design: the
  badge writes even when the same run fails the pipeline, so a
  hardware repo's README always shows the truth. Real artifact for the
  555 fixture committed at docs/badges/ and embedded in
  packages/README.

## 2026-06-11 — the sync relay: real-time collaboration

### Added
- **`@protopulse/relay`**: a tiny in-memory WebSocket room server. One
  room = one shared op-log; the relay unions envelopes by (actor,
  lamport) and broadcasts the news — it never interprets ops and never
  resolves conflicts, because materialize's (lamport, actorId) total
  order makes same-set ⇒ same-graph. Schema-validated frames, batch/
  message caps, rooms survive everyone leaving. `npm run -w
  @protopulse/relay dev` → ws://localhost:8787.
- **Sync tab in the editor**: connect to a relay room and edits flow
  both ways live. Joining sends your log, the snapshot brings theirs,
  every local dispatch pushes deltas; remote ops ingest without
  touching the undo stack (you can't undo someone else's edit — your
  own undos sync as inverse ops). SessionCore grew `ingest` (dedupe +
  lamport clock advance).
- Honest v1 notes shipped in the panel itself: main branch only,
  in-memory rooms, one tab per design per browser profile.

### Verified
- 6 relay tests (snapshot/union/dedupe/peers/validation/room
  persistence) + 4 app integration tests running TWO REAL session
  stores through a real in-process relay over Node's native WebSocket —
  bidirectional edits, concurrent-edit convergence, undo propagation.
- Two-browser live demo: an empty editor joined a room and received
  the full design; an edit in browser A appeared on browser B's canvas
  within a second.

## 2026-06-10 — shove + spring-back routing (E.1 steps 2–3)

### Added
- **Shove mode** on the PCB trace tool: the new trace goes where you
  drew it; different-net traces in the way are re-routed around it by
  the walkaround engine (`planShove` in @protopulse/route) — victims
  plan sequentially with cumulative obstacle insertion so the final
  configuration is mutually clear by construction. Hull-cluster merging
  makes detours around shover-touching pads possible. Honest cuts:
  pads/vias never move, victims re-route end-to-end, single-level shove
  (cascades refuse with a reason).
- **Spring-back**: deleting the shover restores its victims to their
  pre-shove paths — read straight from the op-log (shove commits are
  batches labeled 'shove'). A victim only springs back if the user
  hasn't re-routed it since AND the original path is still
  clearance-legal. Rides in the same delete batch, so undo is atomic.
- The 'manual | walk | shove' mode chips on the trace toolbar — and the
  walk mode is now actually wired to the tool (the engine landed in the
  v0.4 slice; the toggle claim preceded the wiring — debt paid).

### Verified
- 11 new engine tests + 4 tool tests + 6 spring-back tests; browser
  end-to-end: shove flashed "Shoved 1 trace(s) aside" with the victim
  visibly detouring, deleting the shover restored its straight path.

## 2026-06-10 — sim ghost overlay (voltages painted on the wires)

### Added
- **Canvas ghost**: after an op or transient run, every net on the
  schematic tints by its solved voltage — cold blue at the range floor,
  warm orange at the ceiling — with a gradient legend (instant label +
  min/max) in the Sim panel and a hide button. Honesty built in: only
  op/tran produce a ghost (AC/noise/sweeps have no single per-net
  voltage), and the ghost carries a (branch, opsVersion) stamp — edit
  anything and it vanishes instead of lying. Renderer grew a generic
  per-node `tint` overlay channel (lowest priority, under selection/
  highlight/diff).

## 2026-06-10 — blame on canvas (the op-log trilogy completes)

### Added
- **History (blame) in the Inspector**: select any component or net and
  see every op that ever touched it — who (actor), when (timestamp),
  what (op summary, batch-aware), and why (meta.rationale on AI/fix
  ops, agent chip included). Click an entry to time-travel to that
  exact moment in the History tab. Pure op-log filter (`blameFor`) —
  no new state, the envelopes always had the answers. With replay
  (watch history), merge (combine histories), and blame (interrogate
  history), the op-log thesis is now fully user-facing.

## 2026-06-10 — serverless share links (v0.6 first slice, early)

### Added
- **Copy share link** in the Export panel: the whole DesignBundle —
  op-log, branches and all — deflate-compressed (native
  CompressionStream, no deps) and base64url-encoded into the URL
  fragment. No server, no upload; the fragment never leaves the
  browser. Receiving end loads after a confirm guard (never silently
  replaces a working design; empty sessions load directly) and strips
  the hash. Browser-verified: the 67-op traffic-light-555 travels as a
  2,129-char URL and lands intact in a pristine browser.

## 2026-06-10 — interactive merge resolver (M1 straggler closed)

### Added
- **Merge in the Branches panel**: any branch merges into the current
  one. Engine half in `@protopulse/graph`: `BranchLog.mergeBaseOps`
  (nearest-common-ancestor prefix across forks, siblings, nested
  branches) and `resolveConflict` (one conflict + one ours/theirs pick →
  ops; returns null for picks M1 cannot express, so the UI disables
  them instead of lying). UI half: auto-merged changes listed, every
  conflict an explicit pick, Apply gated until all are decided; the
  merge lands as ONE undoable batch with `parents: [ours, theirs]`
  recorded in the op-log. Verified end-to-end in the browser: forked
  value conflict (47k vs 1k) surfaced, resolved theirs, landed.
- 17 new tests (engine merge-base topologies + every resolveConflict
  path; store merge workflow incl. stale-merge invalidation); graph
  coverage gate held.

## 2026-06-10 — time-lapse replay (History tab) + demo media rig

### Added
- **History tab** in the new editor: time-lapse replay of the op-log.
  The design IS its op-log, so any moment is a prefix materialization —
  scrub the slider, press play (3 speeds), or click any op to jump.
  Every graph reader (canvas, Inspector) follows the scrub position;
  the session is read-only until "Back to live" (dispatch/undo/redo
  refuse, branch switches exit replay). Status bar shows ⏪ replay k/N.
- `describeOp` — one human-readable line per op kind for the History
  list (pure, payload-only; ops are self-contained by design).
- Demo media rig: `tools/screenshots/capture-gif.ts` (co-sim story →
  `cosim-demo.gif`) and `capture-replay-gif.ts` (the 555 fixture
  building itself via the real History scrubber → `replay-demo.gif`),
  encoded pure-JS (gifenc + pngjs) with global palette + inter-frame
  diff transparency. Embedded in README and USER_GUIDE §19.

## 2026-06-10 — walkaround routing + the Lab stragglers

### Added
- `@protopulse/route`: walkaround interactive routing (Vol II E.1 first
  slice) — obstacle hulls inflated by clearance+width, flatbush broad
  phase, CW/CCW corner walks with recursion cap; 'manual | walk' toggle
  on the PCB trace tool with blocked-corridor refusal. 39 tests.
- Sim worker (ngspice off the main thread, node fallback preserved),
  plot FFT (radix-2 + Hann over resampled windows, per-trace toggle,
  log-x dB spectrum plot), AC-capable battery/rail emitters via
  fields.ac — graph-driven .ac and .noise now run end-to-end.
- Seam fixes from the parallel build: distributive worker-request types,
  traceMode initializer, and the FFT spectrum plot actually rendered
  (the computation existed; the lint gate caught the missing render).

## 2026-06-10 — v0.5 third slice: the loop closes

### Added
- `@protopulse/emu`: ADC peripheral (datasheet-accurate 25/13-clock
  conversions, completion-time host sampler — the D.3 hard sync point),
  assembler grows CPI/branch opcodes; bang-bang firmware verified
  reacting to analog input. 69 emu tests.
- `@protopulse/cosim`: runCosimClosedLoop — conservative quantum loop
  with comparator-fed digital inputs (VIH/VIL + hysteresis), ADC
  sampling against the previous solve, and loudly-counted from-zero
  re-solves. THE closed-loop test passes: firmware charges an RC node
  through its own pin, reads it back, and regulates — sustained
  oscillation around its 2.5V threshold. 65 cosim tests.
- App: closed-loop mode in the Co-sim panel (input/ADC bindings,
  quantum field, re-solve/ADC-read honesty readout). 304 app tests.

### Known gaps (ROADMAP.md)
- WebSerial flashing (hardware required), RP2040/ESP32 cores, solver
  state continuity (currently O(quanta²) re-solves, counted honestly).

## 2026-06-10 — v0.5 second slice: the co-sim bus (the crown jewel, one way)

### Added
- `@protopulse/cosim`: firmware GPIO edges become PWL sources behind a
  series-Rout behavioral boundary, injected via sim's additive
  extraCards hook. The thesis test runs real avr8js blink firmware into
  a real ngspice RC low-pass: 0.94Vpp settled ripple measured vs ~0.9Vpp
  predicted. 31 tests.
- App: Co-sim panel — pin→net bindings, window/step controls, the Vol II
  D.3 slowdown-factor honesty readout, digital traces stacked above the
  analog response in one plot. Shared emu session with a documented
  suspend/reset borrow protocol. 36 new tests (app at 284).

### Known gaps (ROADMAP.md)
- Feedback direction (digital inputs + ADC hard sync), WebSerial
  flashing, RP2040/ESP32 cores.

## 2026-06-10 — v0.5 first slice: The Bridge — firmware in the loop

### Added
- `@protopulse/emu`: ATmega328P emulation on avr8js — McuCore contract,
  cycle-stamped GPIO events, UART queues, Intel-HEX parser, and a
  documented mini-assembler so tests assemble their own firmware (the
  blink test asserts real edges on B5 at ~1206-cycle spacing). 47 tests.
- App: Firmware panel — HEX load, frame-budgeted run/pause, serial
  monitor with input, stacked square-wave pin traces. 33 new tests.

### Known gaps (ROADMAP.md)
- Co-sim bus, WebSerial flashing, ADC + remaining peripherals,
  RP2040/ESP32 cores.

## 2026-06-10 — v0.4 second slice: fab outputs + board rendering truth

### Added
- `@protopulse/export`: Gerber X2 copper layers (integer-nm FSLAX46, no
  float arithmetic in emission), Excellon drill, pick-and-place CSV;
  routed-led golden fixture freezes all fab artifacts byte-exact.
- Renderer: GL triangle pipeline — filled pads, real stroked trace
  widths with round caps/joins, vias as annuli with background drills;
  PCB scene delta sync (identity-preserving); side-flip (F key +
  Inspector) with mirrored bottom rendering.

### Known gaps (ROADMAP.md)
- Push-and-shove routing, zones/pours, panelization.

## 2026-06-10 — v0.4 first slice: The Board

### Added
- Graph: PCB ops are live — place/move/unplace_footprint, route_trace,
  place_via, remove_trace/via as id-keyed entities with GC, inverse,
  diff, and merge support; 100% core coverage gate held.
- Parts: footprint model with generic IPC-class seeds (0805, SOT-23,
  DIP-8), explicitly unverified-until-per-MPN.
- `@protopulse/drc`: width/clearance/annular/drill/unrouted checks
  against the shipped JLC deck. 34 tests.
- App: PCB mode — unplaced tray, footprint placement with rotation,
  octilinear trace tool with cross-net refusal, vias, dashed ratsnest,
  layer toggle, DRC panel with deck rev. 63 new app/renderer tests.

### Known gaps (ROADMAP.md)
- Push-and-shove, stroked widths/filled pads, Gerber export, in-browser
  visual QA of PCB mode.

## 2026-06-10 — v0.3 first slice: Design Review + the Professor

### Added
- `@protopulse/review`: the Vol II G.4 Design Review — embedded ERC,
  decoupling-per-IC (executable 100nF fix), power-tree rollup,
  unverified-parts-in-load-bearing-roles, unwired ICs, DNP-killed rails;
  stored/diffable ReviewReport with opened/closed deltas. 40 tests;
  golden Probe fixture reviews with zero errors.
- The Professor — depth-adjustable crew member with lookup_concept /
  explain_finding grounded in the concepts wiki; ReviewPanel's
  per-finding "Ask the Professor" handoff seeds it with the finding.
- The three teaching depths (do-it/show-me/teach-me): persisted dial,
  apply-fix narration through the status bar, teach-me auto-opens the
  mapped concept article.

## 2026-06-10 — v0.2 second slice: Monte Carlo, stepping, noise, the 555 lives

### Added
- `@protopulse/sim`: seeded Monte Carlo (R 5% / C 20% / L 10% defaults,
  deterministic mulberry32, value-override netlists), parameter stepping,
  .noise analysis (engine verified; input source must carry an AC value),
  and the NE555 behavioral macromodel — hysteretic discharge switch +
  regenerative latch; the golden traffic-light fixture oscillates at
  0.719-0.720s measured vs 0.721s theory. 69 sim tests.
- App: math channels (safe parser — v(a)-v(b), db/abs/mag, complex-aware),
  branch overlay with dashed traces and dual fidelity bars, Monte Carlo
  spaghetti + step trace families, noise UI. 129 app tests.

### Known gaps (ROADMAP.md)
- Sim worker + streaming; plot FFT; AC-source emitter for graph-driven
  noise.

## 2026-06-10 — v0.2 first slice: The Lab is live

### Added
- `@protopulse/sim`: deterministic graph→SPICE netlist generation with the
  model-tier honesty system (spice/behavioral/stub + fidelity manifest),
  op/tran/dc/ac analyses, ngspice-WASM engine wrapper (eecircuit-engine,
  MIT). 48 tests including real-WASM integration against the golden
  led-resistor fixture.
- App: "Sim" panel (analysis picker, fidelity bar with tier chips, trace
  list) and a dependency-free canvas plot workspace (engineering-notation
  axes, crosshair readout, dB/log-x for AC).
- The Analyst — second crew member ("skeptical of everything until it's
  plotted"): run_simulation/measure/read_design tools, shared runAgentLoop
  extracted from the Draftsman, first live Anthropic-wired panel
  (localStorage key with plain-text warning).
- Verified in-browser: golden LED circuit simulated end-to-end (1008-point
  transient; v(led_a)≈2.2 V, loop ≈20 mA — physically correct).

### Known gaps (tracked in ROADMAP.md)
- Noise/Monte-Carlo/param-step analyses, sim worker + streaming, NE555
  model (stub), plot math channels/FFT/branch overlays.

## 2026-06-10 — Milestone 1: the engine redesign lands

The first milestone of the ground-up redesign ("the vision", three volumes) landed on branch `claude/protopulse-vision-geapzy`: a greenfield npm-workspaces monorepo at `packages/` (`@protopulse/*`), living alongside the legacy app (`client/ server/ shared/` — untouched, still the shipping product; it migrates onto the engine in later milestones).

### Added
- `@protopulse/graph` — the core: one canonical design graph; every mutation a typed op; the design IS its op-log (JSON Lines), graph as materialized view. Integer-nm coordinates, UUIDv7 entities, deterministic materialization by (lamport, actorId), inverse-op undo, O(1) branches, visual diff (GraphDelta), three-way merge with conflicts as data. On-disk `.ppx` directory or `.ppx.json` bundle (spec: `packages/graph/README.md`). 100% branch coverage gate in CI.
- `@protopulse/parts` — minimal part model (ERC electrical pin types, 1.27mm-grid symbols, provenance tiers); 17 seed parts, NE555 + BAT54S pin maps datasheet-verified.
- `@protopulse/erc` — 10×10 pin-conflict matrix + net rules (floating inputs, unpowered supplies, single-port nets, open-collector pull-up with an executable fix, current budgets); every finding code maps to a concepts-wiki article.
- `@protopulse/export` — deterministic KiCad legacy-E netlist + CSV BOM; byte-exact golden-file tests in `tools/golden/`.
- `@protopulse/cli` — `protopulse check` / `export`: headless ERC in CI ("CI for circuits"), exit codes 0/1/2.
- `@protopulse/renderer` — WebGL2 retained scene graph, flatbush picking, canvas-glyph-atlas text, nm→px camera with LOD.
- `@protopulse/app` — the new schematic editor (port 5174): place/wire (Manhattan routing), undo/redo, branch switcher with green/amber diff overlay, ERC panel with apply-fix + concept links, KiCad/BOM/bundle export, Draftsman panel.
- `@protopulse/ai` — provider-agnostic agent runtime: zod tool registry with scope slices, destructive-confirm gating, explain() narration, budgeted context assembly; the Draftsman agent (exactly 8 tools); Anthropic adapter (browser-direct, user key); every applied op carries `meta {agent, rationale}` for op-log blame.
- `@protopulse/content` + `content/` — JLCPCB 2-layer DRC rule deck, 14 concept articles, curriculum Track 1 "First Light" steps 01–05 (machine-checkable `erc: clean` goals).
- Root commands `npm run check:packages` / `npm run test:packages`; packages CI workflow (`.github/workflows/packages-ci.yml`); ESLint coverage of `packages/` (zero errors). 346 package tests.

### Known gaps (M1)
- KiCad pcbnew import of the golden netlists awaits one manual verification (`tools/golden/README.md`).
- Merge conflicts surface as data; no interactive resolver UI yet.
- MSDF text and GPU picking deferred; ESP32-S3 part deferred.

## [Unreleased]

### Added (Wave 140)
- Snapshot restore cascade engine — `analyzeSnapshotDomains`, `generateRestorePlan`, cross-domain warnings, 46 tests (BL-0568)
- PCB geometry bridge — `extractTraceGeometries`, `traceGeometryToPdnInput`/`SiInput` converters, 34 tests (BL-0561)
- GPU Monte Carlo engine — async init with 3-attempt retry, GPU/CPU dispatch, dispose lifecycle, 28 tests (BL-0550)
- ISR safety scanner — 8 ISR rules, `findIsrBodies`, `scanForIsrViolations`, 58 tests (BL-0413)
- Dependency resolver — `extractIncludes`, 57 known library headers, `resolveDependencies` with conflict detection, 42 tests (BL-0404)

### Added (Wave 139)
- BOM tolerance bridge — `parseTolerance`, `bomItemsToToleranceSpecs`, tolerance column added to `bom_items`, 26 tests (BL-0574)
- PCB thermal bridge — `PACKAGE_THERMAL_DB` 15 packages, `extractThermalComponents`, 30 tests (BL-0562)
- BOM back-annotation — `BackAnnotationManager` singleton, `findMatchingInstances`, `generateBomBackAnnotationPatch`, 38 tests (BL-0563)
- PCB back-annotation — `syncRefDesChange`, `syncPropertyChange`, 29 tests (BL-0559)
- Design reuse schematic snippets — `SnippetCircuitInstance`/`SnippetCircuitNet`, `prepareForPlacement` circuit ID remapping, 3 built-in snippets with circuit data, 60 tests (BL-0583)

### Fixed (Wave 139)
- Chat message ordering — `chat-context.tsx` now sorts messages ascending by ID

### Added (Waves 25-26)
- Design review commenting system — `CommentsPanel`, `design_comments` table, comments route (FG-12)
- Multi-model AI routing with design-phase awareness (IN-08)
- Interactive design tutorials — `TutorialMenu`, `TutorialOverlay`, tutorial context (IN-13)
- Backup/restore automation — backup route, scripts, runbook (CAPX-OPS-03)
- AC small-signal frequency analysis engine — MNA solver, 480 lines, 41 tests (FG-13)
- Project ownership model — `ownerId`, auth middleware, 20 tests (CAPX-SEC-01)
- Unified undo/redo stack — command pattern, React context, keyboard shortcuts, 36 tests (TD-25)
- ShapeCanvas decomposed from 1,275→755 lines into 6 extracted modules (TD-04)
- Theme picker panel with theme context
- SPICE import functionality
- Design history view and lifecycle dashboard
- Architecture snapshot diff engine (`shared/arch-diff.ts`)
- `design_snapshots` and `design_comments` tables (schema now 27 tables)

### Added (Waves 1-24)
- Architecture Decision Records (ADRs) in `docs/adr/`
- DRC manufacturer templates (JLCPCB, PCBWay, OSHPark) with pre-configured rules
- 5 new DRC rule types: annular-ring, thermal-relief, trace-to-edge, via-in-pad, solder-mask
- Session refresh/rotation mechanism for improved auth security
- Storage integration tests (67 tests covering cache, soft deletes, pagination, bulk ops)
- Auth session tests (18 tests covering token rotation)
- Shared test project in Vitest config (136 tests now running that were previously skipped)
- WCAG AA contrast ratio audit — all critical color pairs pass 4.5:1 minimum
- Collaboration roadmap re-sequenced behind identity/authorization foundation
- AI tool: `generate_test_plan` — fetches full project state for AI to write hardware test plans (FG-26)
- AI tool: `compare_components` — fetches BOM/architecture data for AI component comparison tables (FG-27)
- Dedicated ExportPanel component with 3 categories, 10 formats, per-format download state (UI-06)
- @dnd-kit drag-and-drop from component library to architecture canvas (IN-10)
- `component_lifecycle` table for tracking component lifecycle status, alternate parts, and data sources (FG-32)
- CRUD routes for component lifecycle at `/api/projects/:id/lifecycle` (FG-32)
- Netlist comparison engine in `shared/netlist-diff.ts` — diff two circuit netlists by component and net (FG-33)
- Netlist diff endpoint `POST /api/circuits/:circuitId/netlist-diff` with baseline comparison (FG-33)
- BOM Comparison tab in ProcurementView — Tabs layout with BOM Management + BOM Comparison/BomDiffPanel (UI-34)
- Net class management UI (`NetClassPanel.tsx`) — create/edit net classes with trace width, clearance, via diameter, color-coded badges (UI-14)
- JSDoc documentation across all 11 AI tool modules in `server/ai-tools/` (TD-29)
- AI tool: `suggest_components` — analyzes architecture/BOM/circuits for missing components across 9 categories (IN-05)
- AI tool: `design_review` — comprehensive design review across 7 categories with severity-rated findings (IN-18)
- X-Request-Id header on all HTTP responses with client-side error propagation (CAPX-OBS-04)
- Database transactions for `updateBomItem` and `updateComponentPart` preventing race conditions (CAPX-ARCH-02-EXP)
- Auth regression test suite — 92 tests covering 6 security implementations (CAPX-TEST-01)
- Storage transaction tests — 15 tests covering atomic BOM/component updates (CAPX-ARCH-02-EXP)

### Changed
- React.memo coverage increased to 29+ components across 24 files (from 9 initial)
- Export generators decomposed from 1,211-line monolith into 15 individual modules + types under `server/export/`
- `circuit-routes.ts` (1,804 lines) decomposed into 13 domain files under `server/circuit-routes/` (TD-16)
- `parseLocalIntent` (CCN=102) refactored to IntentHandler registry pattern with 11 handler modules (TD-05/EN-19)
- Test suite expanded from ~350 tests (Wave 1) to 1,553 tests across 54 files
- AI tool count increased from 53 to 82
- Database schema expanded from 11 to 27 tables
- Domain routers expanded from 18 to 21; circuit routers from 11 to 13
- ProcurementView refactored from single-panel to tabbed layout (BOM Management + BOM Comparison)

### Fixed
- DRCRuleType union extended to include all implemented rule types
- Various TypeScript strict mode compliance fixes across test files

## [0.1.0] - 2026-02-15

### Added
- Initial release: architecture block diagrams, BOM management, circuit schematic editor
- AI chat with 82 AI tools (Anthropic Claude + Google Gemini)
- Design validation (DRC/ERC)
- Multi-format export: KiCad, Eagle, SPICE, Gerber, drill, pick-and-place
- Dark theme with Neon Cyan accent
