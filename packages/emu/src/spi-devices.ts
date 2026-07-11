import type { SpiSlave } from './esp32s3.js';

/**
 * SPI device models for the ESP32-S3 emulator's master + slave hook
 * (`Esp32s3Core.setSpiSlave`). A device is an `SpiSlave` callback that answers
 * the master's MISO phase from the bytes it clocked out — the SPI parallel to
 * the I2C device models in `i2c-devices.ts`.
 */

/** Optional config for {@link rc522}. */
export interface Rc522State {
  /** VersionReg (0x37) value — 0x92 = MFRC522 v2.0 (default), 0x91 = v1.0. */
  version?: number;
}

/**
 * NXP MFRC522 (RC522) RFID reader as an SPI slave — `core:rc522`. The MFRC522
 * SPI read address byte is `((reg << 1) & 0x7E) | 0x80` (datasheet §8.1.2.3,
 * MSB set = read); the addressed register's value is returned on the MISO
 * byte(s) of the transaction. Modeled register: VersionReg (0x37) = 0x92 (v2.0)
 * — the canonical "is the reader there?" identity check; all others read 0.
 * Single-register reads (the common case); MFRC522 burst reads repeat the
 * address byte, which this model does not special-case.
 */
export function rc522(state: Rc522State = {}): SpiSlave {
  const regs = new Map<number, number>();
  regs.set(0x37, (state.version ?? 0x92) & 0xff); // VersionReg
  return (mosi) => {
    const addr = mosi[0] ?? 0;
    if ((addr & 0x80) === 0) return 0; // write / not a read transaction
    return regs.get((addr & 0x7e) >> 1) ?? 0;
  };
}

/**
 * Registry of modeled SPI device part ids → device-model factories — the SPI
 * parallel to `I2C_DEVICES_BY_PART_ID`. Lets the co-sim/app auto-resolve a
 * placed SPI part's model.
 */
export const SPI_DEVICES_BY_PART_ID: ReadonlyMap<string, () => SpiSlave> = new Map<
  string,
  () => SpiSlave
>([['core:rc522', () => rc522()]]);

/** Resolve a placed part id to a fresh SPI device model, or null if the part
 *  is not a modeled SPI device. */
export function spiDeviceForPart(partId: string): SpiSlave | null {
  const factory = SPI_DEVICES_BY_PART_ID.get(partId);
  return factory ? factory() : null;
}
