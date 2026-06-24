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

/** Optional initial raw ADC outputs for {@link bme280} (the firmware applies
 *  Bosch compensation using the calibration registers; default 0). */
export interface Bme280State {
  /** 20-bit raw temperature ADC (UT). */
  rawTemp?: number;
  /** 20-bit raw pressure ADC (UP). */
  rawPress?: number;
  /** 16-bit raw humidity ADC (UH). */
  rawHum?: number;
}

/**
 * Bosch BME280 temperature/humidity/pressure sensor as an I2C slave —
 * `core:bme280`, address 0x76 (SDO low) / 0x77 (SDO high). Register map per the
 * BME280 datasheet §5.3:
 *   - "id" (0xD0) = 0x60 — the canonical chip-ID identity check.
 *   - reset (0xE0) reads 0x00; status (0xF3) reads 0x00 (idle).
 *   - raw ADC outputs MSB-first: press 0xF7..0xF9 (20-bit), temp 0xFA..0xFC
 *     (20-bit), hum 0xFD..0xFE (16-bit), settable via state.
 * The calibration-coefficient registers (0x88.., 0xE1..) are NOT modeled — a
 * driver computing compensated °C/%RH/hPa needs them; the chip-ID identity
 * check and raw-register reads work as-is.
 */
export function bme280(state: Bme280State = {}): I2cSlave {
  const regs = new Map<number, number>();
  regs.set(0xd0, 0x60); // id — BME280
  regs.set(0xe0, 0x00); // reset register reads back 0
  regs.set(0xf3, 0x00); // status — idle
  // 20-bit press (0xF7..F9) and temp (0xFA..FC): [msb, lsb, xlsb<<4].
  const put20 = (msbReg: number, value: number): void => {
    const v = value & 0xfffff;
    regs.set(msbReg, (v >> 12) & 0xff);
    regs.set(msbReg + 1, (v >> 4) & 0xff);
    regs.set(msbReg + 2, (v << 4) & 0xf0);
  };
  put20(0xf7, state.rawPress ?? 0); // press_msb/lsb/xlsb
  put20(0xfa, state.rawTemp ?? 0); // temp_msb/lsb/xlsb
  const hum = (state.rawHum ?? 0) & 0xffff; // hum_msb/lsb (0xFD..0xFE)
  regs.set(0xfd, (hum >> 8) & 0xff);
  regs.set(0xfe, hum & 0xff);
  return i2cRegisterDevice(regs);
}

/**
 * Registry of modeled I2C device part ids → device-model factories. Lets the
 * co-sim (or app) auto-install the right slave for a placed I2C part — the
 * bus-device parallel to the SPICE `EMITTERS_BY_PART_ID` for analog parts.
 */
export const I2C_DEVICES_BY_PART_ID: ReadonlyMap<string, () => I2cSlave> = new Map<
  string,
  () => I2cSlave
>([
  ['core:mpu6050', () => mpu6050()],
  ['core:bme280', () => bme280()],
]);

/** Resolve a placed part id to a fresh I2C device model, or null if the part
 *  is not a modeled I2C device. */
export function i2cDeviceForPart(partId: string): I2cSlave | null {
  const factory = I2C_DEVICES_BY_PART_ID.get(partId);
  return factory ? factory() : null;
}
