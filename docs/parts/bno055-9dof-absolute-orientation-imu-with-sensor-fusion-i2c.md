---
description: "Bosch 9-axis IMU with onboard Cortex-M0 sensor fusion processor — outputs quaternions, Euler angles, calibrated accel/gyro/mag directly. Unlike MPU6050, this has a magnetometer AND hardware fusion, so no external filter code needed"
topics: ["[[sensors]]"]
status: verified
quantity: 1
voltage: [3.3, 5]
interfaces: [I2C, UART]
logic_level: "mixed"
logic_notes: "The sensor core is 3.3V, but common breakouts accept 5V VIN and use breakout pull-ups/regulation to behave well on many mixed-voltage I2C setups."
manufacturer: "Bosch Sensortec"
part_number: "BNO055"
i2c_address: "0x28 (default, ADR pin LOW), 0x29 (ADR pin HIGH)"
breakout_board: "Adafruit BNO055 Breakout"
pinout: |
  Adafruit BNO055 breakout board:
  VIN  → 3.3-5V (onboard 3.3V regulator)
  GND  → Ground
  SDA  → I2C data
  SCL  → I2C clock
  RST  → Reset (active LOW, has pull-up)
  INT  → Interrupt output (configurable)
  ADR  → Address select (NC/LOW=0x28, HIGH=0x29)
  PS0  → Protocol select (LOW=I2C, HIGH=UART)
  PS1  → Protocol select (LOW=I2C, see datasheet)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
alternative_to: ["[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] (MPU6050 is 6DOF without magnetometer; BNO055 is 9DOF with hardware fusion)"]
used_in: []
warnings: ["Onboard magnetometer makes a separate compass module REDUNDANT — if using BNO055, you do NOT need HMC5883L/QMC5883L", "Calibration must be performed after each power-on — sensor fusion needs ~20 seconds to reach full accuracy", "Mount away from motors and magnets — magnetometer is sensitive to magnetic interference", "Legacy product (not recommended for new designs by Bosch) but still excellent and widely supported", "INT pin is open-drain — needs pull-up if used"]
datasheet_url: "https://www.bosch-sensortec.com/products/smart-sensors/bno055/"
---

# BNO055 9-DOF Absolute Orientation IMU with Sensor Fusion (I2C)

This is the big upgrade over the [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]. Where the MPU6050 gives you raw accel + gyro and you have to run your own complementary/Kalman filter, the BNO055 has an ARM Cortex-M0 coprocessor that does sensor fusion in hardware and spits out ready-to-use quaternions, Euler angles, linear acceleration (gravity removed), and gravity vector. You read the register and get heading/pitch/roll directly.

The other major advantage: it has a **magnetometer** (3-axis). That means it can give you absolute orientation — it knows which way is north. The MPU6050 can only give you relative orientation (it drifts over time because gyro integration accumulates error). The BNO055's sensor fusion compensates for gyro drift using the magnetometer and accelerometer.

**If you're using this for the rover, you do NOT need a separate compass module.** The BNO055's built-in magnetometer with sensor fusion will give you better heading accuracy than a standalone HMC5883L/QMC5883L because it's tilt-compensated automatically.

## Specifications

| Spec | Value |
|------|-------|
| Sensor | Bosch BNO055 Intelligent 9-Axis |
| Degrees of Freedom | 9 (3-axis accel + 3-axis gyro + 3-axis mag) |
| Sensor Fusion | Hardware (ARM Cortex-M0+ coprocessor) |
| Accelerometer Range | +/-2g, +/-4g, +/-8g, +/-16g (selectable) |
| Accelerometer Resolution | 14-bit |
| Accelerometer Noise | 150 ug/sqrt(Hz) |
| Gyroscope Range | +/-125, +/-250, +/-500, +/-1000, +/-2000 deg/s |
| Gyroscope Resolution | 16-bit |
| Magnetometer Range | +/-1300uT (x/y), +/-2500uT (z) |
| Magnetometer Resolution | ~0.3uT |
| Interface | I2C (up to 400kHz), UART (optional) |
| I2C Address | 0x28 (ADR=LOW), 0x29 (ADR=HIGH) |
| Supply Voltage | 2.4-3.6V (chip), 3.3-5V (Adafruit breakout) |
| Normal Current | 12mA (all sensors + fusion active) |
| Low Power Current | 3-4mA (partial sensors) |
| Suspend Current | <40uA |
| Operating Temp | -40C to +85C |
| Fusion Outputs | Quaternion, Euler angles, rotation vector, linear accel, gravity |
| Calibration | Auto-calibrating with status register feedback |
| Dimensions (breakout) | 25.4 x 17.8mm |
| Weight (breakout) | ~2g |

## Sensor Fusion Output Modes

The BNO055 supports multiple fusion modes — the one you almost always want is NDOF (Nine Degrees of Freedom):

| Mode | Sensors Used | Outputs | Use Case |
|------|-------------|---------|----------|
| NDOF | Accel + Gyro + Mag | Absolute orientation | Rover navigation (primary mode) |
| IMU | Accel + Gyro | Relative orientation | No magnetometer needed |
| COMPASS | Accel + Mag | Heading only | Simple compass |
| M4G | Accel + Gyro + Mag (partial) | Relative with mag correction | Indoor use |
| NDOF_FMC_OFF | Accel + Gyro + Mag (no fast mag cal) | Absolute orientation | Stable mag environment |

## I2C Address Configuration

| ADR Pin State | I2C Address | Hex |
|---------------|-------------|-----|
| LOW or NC (default on Adafruit) | 0x28 | 0x28 |
| HIGH (connect ADR to 3.3V) | 0x29 | 0x29 |

No conflicts with MPU6050 (0x68/0x69), DS3231 (0x68), or INA219 (0x40-0x4F). The BNO055 sits at a unique address range.

## Wiring to Arduino Mega (5V)

| BNO055 Pin | Arduino Mega | Notes |
|------------|-------------|-------|
| VIN | 5V | Onboard regulator drops to 3.3V |
| GND | GND | |
| SDA | D20 (SDA) | Shared I2C bus |
| SCL | D21 (SCL) | Shared I2C bus |
| RST | (optional) | Reset — pull LOW to reset |
| INT | Any digital pin | Data ready interrupt (optional) |

## Wiring to ESP32 (3.3V)

| BNO055 Pin | ESP32 | Notes |
|------------|-------|-------|
| VIN | 3.3V | Direct 3.3V — skip onboard regulator |
| GND | GND | |
| SDA | GPIO21 | Default I2C SDA |
| SCL | GPIO22 | Default I2C SCL |

## Calibration

The BNO055 auto-calibrates, but it needs help. After power-on, each sensor subsystem reports a calibration status from 0 (uncalibrated) to 3 (fully calibrated):

- **Gyroscope**: Place sensor motionless for a few seconds. Calibrates quickly.
- **Accelerometer**: Rotate to multiple positions (6-point tumble). Takes longest.
- **Magnetometer**: Draw a figure-8 in the air. Needs diverse orientations.
- **System**: Derived from the three above. Reaches 3 when all sensors are calibrated.

You can save calibration offsets to EEPROM/flash and reload them on startup to skip the calibration dance. The Adafruit library has `getSensorOffsets()` and `setSensorOffsets()` for this.

## Arduino Library

```cpp
// Install: Arduino Library Manager -> "Adafruit BNO055"
// Also requires: "Adafruit Unified Sensor"
#include <Adafruit_BNO055.h>
#include <Adafruit_Sensor.h>

Adafruit_BNO055 bno = Adafruit_BNO055(55, 0x28);

void setup() {
  Serial.begin(115200);
  if (!bno.begin()) {
    Serial.println("BNO055 not detected!");
    while(1);
  }
  bno.setExtCrystalUse(true);  // Use external 32kHz crystal (more accurate)
}

void loop() {
  sensors_event_t event;
  bno.getEvent(&event);

  Serial.print("Heading: "); Serial.print(event.orientation.x);  // 0-360
  Serial.print(" Pitch: ");  Serial.print(event.orientation.y);  // -180 to 180
  Serial.print(" Roll: ");   Serial.println(event.orientation.z); // -90 to 90
  delay(100);
}
```

## BNO055 vs MPU6050

| Feature | BNO055 | MPU6050 |
|---------|--------|---------|
| Axes | 9 (accel+gyro+mag) | 6 (accel+gyro) |
| Sensor Fusion | Hardware (Cortex-M0) | Software (DMP or external) |
| Magnetometer | Yes | No |
| Absolute Heading | Yes (via magnetometer) | No (gyro drifts) |
| I2C Address | 0x28/0x29 | 0x68/0x69 |
| Price | ~$30 (Adafruit breakout) | ~$2 (GY-521 clone) |
| Quantity in Inventory | 1 | 12 |

---

Related Parts:
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] — alternative (6DOF, no magnetometer, no hardware fusion, much cheaper — use BNO055 if you need absolute heading)
- [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] — REDUNDANT if using BNO055 — BNO055 has built-in magnetometer with tilt-compensated sensor fusion
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via I2C at 5V (breakout has regulator), SDA=A4 SCL=A5
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO21 SCL=GPIO22
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO4 SCL=GPIO5
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via I2C at 3.3V

Categories:
- [[sensors]]
