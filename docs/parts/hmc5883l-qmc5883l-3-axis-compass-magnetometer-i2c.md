---
description: "3-axis AMR magnetometer for compass heading — WARNING: most modules sold as 'HMC5883L' are actually QMC5883L clones with DIFFERENT I2C address (0x0D vs 0x1E) and incompatible register map. Redundant if using BNO055 IMU"
topics: ["[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [I2C]
logic_level: "mixed"
logic_notes: "The magnetometer silicon is 3.3V-class, but common GY-271/GY-273 modules often accept 5V VCC and behave as mixed-voltage I2C peripherals depending on pull-ups and clone variant."
manufacturer: "Honeywell (HMC5883L, discontinued) / QST (QMC5883L, current production)"
part_number: "HMC5883L or QMC5883L"
i2c_address: "0x1E (genuine HMC5883L) or 0x0D (QMC5883L clone)"
breakout_board: "GY-271 / GY-273"
pinout: |
  GY-271/GY-273 module:
  VCC  → 3.3-5V (module has onboard regulator)
  GND  → Ground
  SCL  → I2C clock
  SDA  → I2C data
  DRDY → Data ready interrupt (optional, rarely used)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
alternative_to: ["[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] (BNO055 includes magnetometer with sensor fusion — makes this redundant)"]
used_in: []
warnings: ["Most 'HMC5883L' modules sold today are QMC5883L clones — verify chip marking: 'L883'=HMC5883L (0x1E), 'DA5883'=QMC5883L (0x0D)", "HMC5883L and QMC5883L use DIFFERENT register maps — HMC5883L libraries will NOT work with QMC5883L", "REDUNDANT if using BNO055 IMU — BNO055 has built-in magnetometer with hardware sensor fusion", "Mount at least 10cm from DC motors — magnetic interference degrades heading accuracy", "Requires hard iron + soft iron calibration for accurate heading", "Strong magnets (neodymium) can permanently damage the sensor — keep >20cm away"]
datasheet_url: ""
---

# HMC5883L / QMC5883L 3-Axis Compass Magnetometer (I2C)

A 3-axis magnetometer that measures Earth's magnetic field to determine compass heading. Uses the Anisotropic Magnetoresistance (AMR) effect — resistance changes in a thin ferromagnetic film when exposed to a magnetic field. Three orthogonal sensors measure Bx, By, Bz components, and you calculate heading with `atan2(By, Bx)`.

**The elephant in the room: clone identification.** Genuine Honeywell HMC5883L was discontinued in 2016. Almost every module sold as "HMC5883L" on Amazon/AliExpress/eBay today is actually a QST QMC5883L. They look identical on the PCB, but the IC has a different I2C address and completely different register map. Run an I2C scanner first — if it shows 0x0D instead of 0x1E, you have the QMC5883L and need the right library.

**Redundancy warning:** If you're using the [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]], you do NOT need this module. The BNO055 has a built-in magnetometer with tilt-compensated sensor fusion — strictly better than a standalone compass.

## Chip Identification

| Property | HMC5883L (Genuine) | QMC5883L (Clone) |
|----------|-------------------|-----------------|
| Chip Marking | "L883" | "DA5883" |
| I2C Address | 0x1E (fixed) | 0x0D (fixed) |
| Manufacturer | Honeywell (discontinued) | QST Corporation |
| ADC Resolution | 12-bit | 16-bit |
| Field Range | +/-8.1 Gauss | +/-8 Gauss |
| Max Output Rate | 116 Hz | 200 Hz |
| Active Current | 130uA | <100uA |
| Arduino Library | Adafruit_HMC5883_U | QMC5883LCompass |

## Specifications (HMC5883L)

| Spec | Value |
|------|-------|
| Magnetic Field Range | +/-8.1 Gauss |
| Resolution | 0.88 milliGauss per LSB |
| I2C Address | 0x1E (fixed) |
| Operating Voltage | 2.16-3.6V (IC), 3.3-5V (module) |
| Active Current | 130uA typical |
| Sleep Current | 1uA |
| Output Rate | Up to 116 Hz |
| Heading Accuracy | 1-2 degrees (after calibration) |
| Interface | I2C (up to 400kHz Fast Mode) |
| Temperature Range | -30C to +85C |

## Specifications (QMC5883L)

| Spec | Value |
|------|-------|
| Magnetic Field Range | +/-8 Gauss |
| Resolution | 0.0735 milliGauss per LSB (16-bit) |
| I2C Address | 0x0D (fixed) |
| Operating Voltage | 3.0-5.0V |
| Active Current | <100uA |
| Output Rate | Up to 200 Hz |
| Heading Accuracy | 1-2 degrees (after calibration, more noise) |
| Interface | I2C (14 registers, different mapping) |

## Wiring to Arduino Mega

| Compass Pin | Arduino Mega | Notes |
|-------------|-------------|-------|
| VCC | 5V | Module regulator handles 5V-to-3.3V |
| GND | GND | |
| SCL | D21 (SCL) | Shared I2C bus |
| SDA | D20 (SDA) | Shared I2C bus |
| DRDY | (not connected) | Data ready — optional |

## Heading Calculation

```cpp
float heading_radians = atan2(By, Bx);
float heading_degrees = heading_radians * (180.0 / M_PI);

if (heading_degrees < 0) {
  heading_degrees += 360.0;  // Normalize to 0-360
}

// Apply magnetic declination for true north
float declination = -13.0;  // Example: your location
float true_heading = heading_degrees + declination;
```

## Mounting Requirements

- Mount at least 10cm from DC motors
- At least 8cm from power cables carrying >1A
- Keep away from steel brackets, battery packs
- Level mounting (minimize pitch/roll effects)
- X-axis should point toward rover front

---

Related Parts:
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] — MAKES THIS REDUNDANT — BNO055 has built-in magnetometer with tilt-compensated hardware sensor fusion. If using BNO055, you do not need this module.
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] — complementary sensor (MPU6050 has accel+gyro but no magnetometer; pair with this compass for full 9DOF if not using BNO055)
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via I2C at 5V (module has LDO), SDA=A4 SCL=A5
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO21 SCL=GPIO22
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO4 SCL=GPIO5
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via I2C at 3.3V

Categories:
- [[sensors]]
