import { describe, expect, it } from 'vitest';

import { Esp32s3Core, ESP32S3_I2C0_BASE, ESP32S3_IRAM_BASE, ESP32S3_UART0_BASE } from './esp32s3.js';
import { bme280, ds3231, i2cDeviceForPart, mpu6050 } from './i2c-devices.js';
import { assembleXtensa, BR, J, L32I, L32R, MOVI, S32I } from './xtensa-asm.js';

import type { XtInstr } from './xtensa-asm.js';

/**
 * First real I2C device over the emulator's master + slave hook
 * (Esp32s3Core.setI2cSlave): the GY-521 / MPU-6050 6-axis IMU at address 0x68.
 * The firmware does the canonical ESP-IDF master register read — write
 * [addr+W, reg], RESTART, write [addr+R], READ n — and TX's each byte over
 * UART0. The modeled device answers from its register map.
 */

const I2C0 = ESP32S3_I2C0_BASE;
const UART = ESP32S3_UART0_BASE;

const core = (image: Uint8Array): Esp32s3Core => {
  const c = new Esp32s3Core();
  c.loadFirmware(image);
  return c;
};

/** Firmware: read `count` bytes from `reg` of I2C device `addr`, TX each over UART0. */
function i2cReadImage(addr: number, reg: number, count: number): Uint8Array {
  const addrW = (addr << 1) | 0;
  const addrR = (addr << 1) | 1;
  const WRITE2_ACK = 2 | (1 << 8) | (1 << 11);
  const WRITE1_ACK = 1 | (1 << 8) | (1 << 11);
  const RESTART = 6 << 11;
  const READn = (count & 0xff) | (3 << 11);
  const STOP = 2 << 11;
  const END = 4 << 11;
  const readBackTx: XtInstr[] = Array.from({ length: count }, () => [
    L32I(4, 2, 0x1c), // a4 = RXFIFO byte
    S32I(4, 6, 0), // UART <- byte
  ]).flat();
  return assembleXtensa(
    ESP32S3_IRAM_BASE,
    [I2C0, UART, addrW, reg, addrR, WRITE2_ACK, RESTART, WRITE1_ACK, READn, STOP, END],
    [
      L32R(2, 0), // a2 = I2C0
      L32R(6, 1), // a6 = UART0
      L32R(3, 2),
      S32I(3, 2, 0x1c), // TXFIFO <- addr+W
      L32R(3, 3),
      S32I(3, 2, 0x1c), // TXFIFO <- reg
      L32R(3, 4),
      S32I(3, 2, 0x1c), // TXFIFO <- addr+R
      L32R(3, 5),
      S32I(3, 2, 0x58), // COMD0 = WRITE 2 (+ACK)
      L32R(3, 6),
      S32I(3, 2, 0x5c), // COMD1 = RESTART
      L32R(3, 7),
      S32I(3, 2, 0x60), // COMD2 = WRITE 1 (+ACK)
      L32R(3, 8),
      S32I(3, 2, 0x64), // COMD3 = READ n
      L32R(3, 9),
      S32I(3, 2, 0x68), // COMD4 = STOP
      L32R(3, 10),
      S32I(3, 2, 0x6c), // COMD5 = END
      MOVI(3, 0x20),
      S32I(3, 2, 0x04), // TRANS_START
      ...readBackTx,
      J(BR(-1)),
    ],
  );
}

describe('I2C device models — MPU-6050 over the emu master + slave hook', () => {
  it('reports WHO_AM_I = 0x68 (the canonical MPU-6050 identity check)', () => {
    const c = core(i2cReadImage(0x68, 0x75, 1)); // WHO_AM_I register
    c.setI2cSlave(0, mpu6050());
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x68]);
  });

  it('burst-reads ACCEL_XOUT_H/L as a big-endian signed 16-bit value (register auto-increment)', () => {
    // accelX = 0x1234 → ACCEL_XOUT_H (0x3B) = 0x12, ACCEL_XOUT_L (0x3C) = 0x34.
    // A single 2-byte read from 0x3B must auto-increment the register pointer.
    const c = core(i2cReadImage(0x68, 0x3b, 2));
    c.setI2cSlave(0, mpu6050({ accelX: 0x1234 }));
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x12, 0x34]);
  });

  it('defaults registers (including unset axes) to 0', () => {
    const c = core(i2cReadImage(0x68, 0x3b, 2)); // accelX unset
    c.setI2cSlave(0, mpu6050());
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x00, 0x00]);
  });
});

describe('I2C device models — BME280 + the part→device registry', () => {
  it('BME280 reports chip-ID 0x60 at register 0xD0 (the canonical identity check)', () => {
    const c = core(i2cReadImage(0x76, 0xd0, 1)); // BME280 "id" register at addr 0x76
    c.setI2cSlave(0, bme280());
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x60]);
  });

  it('resolves a placed part id to its I2C device model (and null for non-I2C parts)', () => {
    const mpu = i2cDeviceForPart('core:mpu6050');
    const bme = i2cDeviceForPart('core:bme280');
    expect(mpu).not.toBeNull();
    expect(bme).not.toBeNull();
    // The resolved models answer their identity registers.
    expect(mpu?.(0x68, 0x75)).toBe(0x68); // MPU-6050 WHO_AM_I
    expect(bme?.(0x76, 0xd0)).toBe(0x60); // BME280 chip ID
    expect(i2cDeviceForPart('core:resistor')).toBeNull();
  });
});

describe('I2C device models — DS3231 RTC', () => {
  it('reads BCD time registers (seconds/minutes/hours) via a burst read', () => {
    // DS3231 @ 0x68, time registers 0x00..0x02 are BCD. 13:30:42 reads back as
    // the BCD bytes 0x42 (sec), 0x30 (min), 0x13 (hr) via register auto-increment.
    const c = core(i2cReadImage(0x68, 0x00, 3));
    c.setI2cSlave(0, ds3231({ hours: 13, minutes: 30, seconds: 42 }));
    c.step(400);
    expect([...c.drainUart()]).toEqual([0x42, 0x30, 0x13]);
  });

  it('is registered for core:ds3231', () => {
    expect(i2cDeviceForPart('core:ds3231')).not.toBeNull();
  });
});
