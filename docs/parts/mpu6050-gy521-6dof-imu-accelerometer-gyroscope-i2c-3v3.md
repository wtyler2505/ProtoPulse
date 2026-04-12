---
description: "6-axis IMU with onboard DMP — 3-axis accelerometer + 3-axis gyroscope on one chip, I2C interface. The DMP does sensor fusion onboard so your MCU doesn't have to. I2C address 0x68 (conflicts with DS3231 RTC!)"
topics: ["[[sensors]]"]
status: verified
quantity: 12
voltage: [3.3]
interfaces: [I2C]
logic_level: "mixed"
logic_notes: "The MPU-6050 silicon is 3.3V, but common GY-521 breakouts accept 5V VCC and often work on mixed-voltage I2C buses depending on onboard pull-ups."
manufacturer: "InvenSense (TDK)"
part_number: "MPU-6050"
i2c_address: "0x68 (default), 0x69 (AD0 pin HIGH)"
breakout_board: "GY-521"
pinout: |
  GY-521 breakout board:
  VCC  → 3.3-5V (onboard 3.3V regulator)
  GND  → Ground
  SCL  → I2C clock
  SDA  → I2C data
  XDA  → Auxiliary I2C data (for external magnetometer)
  XCL  → Auxiliary I2C clock (for external magnetometer)
  AD0  → Address select (LOW=0x68, HIGH=0x69)
  INT  → Interrupt output (data ready, motion detect, etc.)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]"]
conflicts_with: ["[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] (I2C address 0x68 conflict — use AD0 pin to shift MPU6050 to 0x69)"]
used_in: []
warnings: ["I2C address 0x68 CONFLICTS with DS3231 RTC — if using both, pull AD0 HIGH to shift MPU6050 to 0x69", "GY-521 breakout accepts 5V but the MPU-6050 is a 3.3V chip — the onboard regulator handles this", "Accelerometer and gyro need calibration — raw readings have offset. Run calibration routine and store offsets", "INT pin is open-drain — needs pull-up resistor if used"]
datasheet_url: "https://invensense.tdk.com/products/motion-tracking/6-axis/mpu-6050/"
---

# MPU6050 GY-521 6DOF IMU accelerometer gyroscope I2C 3.3V

You have 12 of these — the most-stocked sensor in the inventory. The MPU-6050 combines a 3-axis accelerometer and 3-axis gyroscope in a single chip with an onboard Digital Motion Processor (DMP) that can do sensor fusion without loading your MCU. On the GY-521 breakout board, it's ready to plug into any Arduino or ESP over I2C.

The DMP is the killer feature. Instead of reading raw accel/gyro values and running a complementary or Kalman filter on your MCU, the DMP outputs quaternions and Euler angles directly. For balancing robots, drones, or motion tracking, this offloads significant computation.

**I2C address conflict warning**: Default address 0x68 is the SAME as the [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]. If you need both on the same I2C bus, pull the MPU6050's AD0 pin HIGH to shift it to 0x69.

## Specifications

| Spec | Value |
|------|-------|
| Sensor | InvenSense MPU-6050 |
| Degrees of Freedom | 6 (3-axis accel + 3-axis gyro) |
| Accelerometer Range | +/-2g, +/-4g, +/-8g, +/-16g (selectable) |
| Gyroscope Range | +/-250, +/-500, +/-1000, +/-2000 deg/s (selectable) |
| ADC Resolution | 16-bit per axis |
| Interface | I2C (up to 400kHz) |
| I2C Address | 0x68 (AD0=LOW), 0x69 (AD0=HIGH) |
| Supply Voltage | 2.375-3.46V (chip), 3.3-5V (GY-521 breakout) |
| Supply Current | ~3.9mA (all sensors active) |
| DMP | Yes — onboard sensor fusion, outputs quaternions |
| Temperature Sensor | Built-in (for compensation, not environmental measurement) |
| Interrupt | Configurable (data ready, motion detect, free-fall) |
| Dimensions (breakout) | ~21 x 16mm |

## I2C Address Configuration

| AD0 Pin State | I2C Address | Hex |
|---------------|-------------|-----|
| LOW (default, pulled down on GY-521) | 1101000 | 0x68 |
| HIGH (connect AD0 to VCC) | 1101001 | 0x69 |

This means you can have at most **2 MPU6050s on one I2C bus** — one at 0x68 and one at 0x69.

## Wiring to Arduino (5V)

| GY-521 Pin | Arduino Mega | Arduino Nano/Uno |
|------------|--------------|-----------------|
| VCC | 5V | 5V |
| GND | GND | GND |
| SCL | D21 (SCL) | A5 (SCL) |
| SDA | D20 (SDA) | A4 (SDA) |
| AD0 | GND (0x68) or 5V (0x69) | GND (0x68) or 5V (0x69) |
| INT | Any digital pin (optional) | Any digital pin (optional) |

## Wiring to ESP8266/ESP32 (3.3V)

| GY-521 Pin | ESP8266 NodeMCU | Notes |
|------------|----------------|-------|
| VCC | 3.3V | Use 3.3V, not 5V (saves power, direct level) |
| GND | GND | |
| SCL | D1 (GPIO5) | Default I2C clock |
| SDA | D2 (GPIO4) | Default I2C data |
| AD0 | GND or 3.3V | Address select |
| INT | Any GPIO (optional) | |

## DMP Usage

The DMP (Digital Motion Processor) processes raw sensor data onboard and outputs fused orientation data:

- **Quaternion** — most accurate representation, no gimbal lock
- **Euler angles** — pitch, roll, yaw (intuitive but suffers gimbal lock at +/-90 pitch)
- **Gravity vector** — useful for tilt detection
- **Linear acceleration** — acceleration with gravity removed

Use the `MPU6050_DMP6` example from Jeff Rowberg's I2Cdevlib. The DMP FIFO runs at a configurable rate (up to 200Hz).

## DMP Configuration Notes

The DMP (Digital Motion Processor) is powerful but has quirks:

- **FIFO buffer management**: The DMP writes to a 1024-byte FIFO buffer at your configured rate. If your main loop doesn't read the FIFO fast enough, it overflows and you get corrupted data. Check the FIFO count register and read promptly.
- **FIFO overflow recovery**: When overflow occurs, reset the FIFO with `mpu.resetFIFO()` and wait for the next valid packet. Don't try to salvage partial data.
- **DMP packet size**: 42 bytes per sample (quaternion + accel + gyro). At 200Hz, that's 8,400 bytes/sec — faster than many I2C implementations can sustain. Use 100Hz for reliable operation on Arduino.
- **Initialization time**: The DMP takes ~8 seconds to stabilize after power-on. Don't trust readings during this warmup period.

```cpp
// Check FIFO count before reading
uint16_t fifoCount = mpu.getFIFOCount();
if (fifoCount >= packetSize) {
  mpu.getFIFOBytes(fifoBuffer, packetSize);
  // Process quaternion data
}
if (fifoCount > 512) {
  mpu.resetFIFO();  // Overflow imminent — reset
}
```

## MPU6050 vs BNO055 Comparison

| Feature | MPU6050 | BNO055 |
|---------|---------|--------|
| Axes | 6 DOF (accel + gyro) | 9 DOF (accel + gyro + mag) |
| Sensor fusion | **Software** (DMP or external filter) | **Hardware** (onboard Cortex-M0 runs fusion) |
| Output | Raw values or DMP quaternions | Euler angles, quaternions, linear accel — ready to use |
| Calibration | Manual (store offsets in EEPROM) | Auto-calibrating (stores calibration profile) |
| Magnetometer | No (needs external HMC5883L via XDA/XCL) | Built-in |
| Absolute heading | No (gyro drifts over time) | Yes (magnetometer corrects drift) |
| Price | ~$2 (GY-521) | ~$25 (Adafruit breakout) |
| Best for | Budget projects, backup IMU, learning | Production robotics, drones, anything needing reliable heading |

**Bottom line:** The MPU6050 is fine for tilt/rotation sensing and short-duration attitude tracking. For anything needing stable heading over time (like a rover that needs to drive north), the BNO055's hardware fusion and magnetometer make it the better choice. The MPU6050 serves well as a backup or redundant sensor in builds that already have a BNO055.

## Calibration

Raw readings have manufacturing offsets. Always calibrate before use:

1. Place sensor on flat, level surface
2. Run calibration sketch (I2Cdevlib includes one)
3. Record 6 offsets (3 accel + 3 gyro)
4. Apply offsets in setup() with `setXAccelOffset()` etc.

Store calibration values in EEPROM so you don't need to recalibrate every power cycle.

---

Related Parts:
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] — I2C address 0x68 CONFLICT — use AD0 to shift MPU6050 to 0x69
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller (I2C on D20/D21)
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible controller (3.3V, I2C on D1/D2)

Categories:
- [[sensors]]
