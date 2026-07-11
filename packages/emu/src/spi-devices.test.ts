import { describe, expect, it } from 'vitest';

import { Esp32s3Core, ESP32S3_IRAM_BASE, ESP32S3_SPI2_BASE, ESP32S3_UART0_BASE } from './esp32s3.js';
import { rc522, spiDeviceForPart } from './spi-devices.js';
import { assembleXtensa, BR, J, L32I, L32R, MOVI, S32I } from './xtensa-asm.js';

/**
 * First real SPI device over the emulator's master + slave hook
 * (Esp32s3Core.setSpiSlave): the NXP MFRC522 (RC522) RFID reader on GPSPI2.
 * The canonical identity check reads VersionReg (0x37) → 0x92 (v2.0). The
 * MFRC522 SPI read address byte is ((reg << 1) & 0x7E) | 0x80, so VersionReg
 * reads as command 0xEE; the device answers the value on the MISO phase.
 */

const SPI2 = ESP32S3_SPI2_BASE;
const UART = ESP32S3_UART0_BASE;

const core = (image: Uint8Array): Esp32s3Core => {
  const c = new Esp32s3Core();
  c.loadFirmware(image);
  return c;
};

/** Firmware: SPI command byte `cmd` + 1-byte MISO read on GPSPI2, TX the byte. */
function spiReadImage(cmd: number): Uint8Array {
  const SPI_USR_COMMAND = 0x80000000;
  const SPI_USR_MISO = 0x10000000;
  const USER_CMD_MISO = (SPI_USR_COMMAND | SPI_USR_MISO) >>> 0;
  const USER2_CMD = ((7 << 28) | (cmd & 0xffff)) >>> 0; // 8-bit command
  const SPI_CMD_USR = 1 << 24;
  return assembleXtensa(
    ESP32S3_IRAM_BASE,
    [SPI2, UART, USER_CMD_MISO, USER2_CMD, SPI_CMD_USR],
    [
      L32R(2, 0), // a2 = GPSPI2
      L32R(6, 1), // a6 = UART0
      L32R(3, 2),
      S32I(3, 2, 0x10), // USER = COMMAND | MISO
      L32R(3, 3),
      S32I(3, 2, 0x18), // USER2 = 8-bit command
      MOVI(3, 7),
      S32I(3, 2, 0x1c), // MS_DLEN = 8 bits (1 MISO byte)
      MOVI(3, 0),
      S32I(3, 2, 0x98), // W0 = 0 (cleared before the read)
      L32R(3, 4),
      S32I(3, 2, 0x00), // CMD = USR — runs the transaction
      L32I(4, 2, 0x98), // W0 low byte = MISO[0]
      S32I(4, 6, 0), // UART <- byte
      J(BR(-1)),
    ],
  );
}

describe('SPI device models — MFRC522 (RC522) over the emu master + slave hook', () => {
  it('reads VersionReg (0x37) → 0x92 (the canonical RC522 identity check)', () => {
    // ((0x37 << 1) & 0x7E) | 0x80 = 0xEE — the MFRC522 read address byte.
    const c = core(spiReadImage(0xee));
    c.setSpiSlave(2, rc522());
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x92]);
  });

  it('honors a configured version (e.g. a v1.0 clone reporting 0x91)', () => {
    const c = core(spiReadImage(0xee));
    c.setSpiSlave(2, rc522({ version: 0x91 }));
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x91]);
  });

  it('resolves a placed part id to its SPI device model (null for non-SPI parts)', () => {
    const dev = spiDeviceForPart('core:rc522');
    expect(dev).not.toBeNull();
    // VersionReg read addr 0xEE → 0x92 on the MISO byte.
    expect(dev?.([0xee], 0)).toBe(0x92);
    expect(spiDeviceForPart('core:resistor')).toBeNull();
  });
});
