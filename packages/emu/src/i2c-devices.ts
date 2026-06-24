import type { I2cSlave } from './esp32s3.js';

/**
 * I2C device models for the ESP32-S3 emulator's master + slave hook
 * (`Esp32s3Core.setI2cSlave`). A device is an `I2cSlave` callback that answers
 * master register reads; these helpers build one from a register map so a real
 * sensor's identity/data registers respond to unmodified firmware.
 */

/**
 * Build an I2C slave that answers reads from a fixed register map. Registers
 * absent from the map read back as 0 (the bus default after a chip's reset for
 * an unimplemented register). The device address is accepted but not matched —
 * install one slave per modeled device on its controller port.
 */
export function i2cRegisterDevice(registers: ReadonlyMap<number, number>): I2cSlave {
  return (_address, register) => registers.get(register & 0xff) ?? 0;
}

/** Optional initial sensor readings for {@link mpu6050} (signed 16-bit, default 0). */
export interface Mpu6050State {
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
}

/**
 * GY-521 / MPU-6050 6-axis IMU (InvenSense/TDK) as an I2C slave — `core:mpu6050`,
 * address 0x68 (AD0 low). Register map per the MPU-6000/6050 Register Map (RM):
 *   - WHO_AM_I (0x75) = 0x68 — the canonical identity check.
 *   - PWR_MGMT_1 (0x6B) = 0x40 — reset default (the device boots in SLEEP).
 *   - ACCEL_{X,Y,Z}OUT_H/L at 0x3B..0x40, GYRO_{X,Y,Z}OUT_H/L at 0x43..0x48 —
 *     big-endian signed 16-bit; a burst read auto-increments through them.
 * Temperature and self-test/config registers are not modeled (read back 0).
 */
export function mpu6050(state: Mpu6050State = {}): I2cSlave {
  const regs = new Map<number, number>();
  regs.set(0x75, 0x68); // WHO_AM_I
  regs.set(0x6b, 0x40); // PWR_MGMT_1 — reset default (SLEEP)
  const put16be = (highReg: number, value: number): void => {
    const v = value & 0xffff;
    regs.set(highReg, (v >> 8) & 0xff);
    regs.set(highReg + 1, v & 0xff);
  };
  put16be(0x3b, state.accelX ?? 0); // ACCEL_XOUT_H/L
  put16be(0x3d, state.accelY ?? 0); // ACCEL_YOUT_H/L
  put16be(0x3f, state.accelZ ?? 0); // ACCEL_ZOUT_H/L
  put16be(0x43, state.gyroX ?? 0); // GYRO_XOUT_H/L
  put16be(0x45, state.gyroY ?? 0); // GYRO_YOUT_H/L
  put16be(0x47, state.gyroZ ?? 0); // GYRO_ZOUT_H/L
  return i2cRegisterDevice(regs);
}
