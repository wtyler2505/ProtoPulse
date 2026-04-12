---
description: Sensor modules — distance, motion, temperature, light, sound, and environmental sensing
type: moc
---

# sensors

Everything that measures the physical world. Distance, motion, temperature, light, sound, proximity.

## Parts

| Part | Voltage | Interface | Measurement | Status | Qty |
|------|---------|-----------|-------------|--------|-----|
| [[ntc-103-10k-thermistor-temperature-sensor-for-3d-printers]] | 3.3-5V | Analog | Temperature | needs-test | 1 |
| [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] | 5-12V | Digital | Motion (PIR) | needs-test | 2 |
| [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] | 5V | Digital | Distance (2-400cm) | needs-test | 1 |
| [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] | 3.3V | I2C | Accel + Gyro (6DOF) | verified | 12 |
| [[sharp-gp2y0a51sk0f-ir-proximity-sensor-2-to-15cm-analog]] | 3.3-5V | Analog | Proximity (2-15cm) | needs-test | 2 |
| [[hamlin-59030-reed-switch-magnetic-sensor-dry-contact]] | 3.3-5V | Digital | Magnetic field (contact) | needs-test | 1 |
| [[sound-sensor-module-lm393-electret-mic-analog-digital-out]] | 3.3-5V | Analog/Digital | Sound level | needs-test | 2 |
| [[water-level-detection-sensor-resistive-analog-output]] | 3.3-5V | Analog | Water level | needs-test | 2 |
| [[adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3]] | 3.3V | PDM/I2S | Digital audio | needs-test | 1 |
| [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] | 3.3-5V | I2C | Real-time clock | needs-test | 1 |
| [[osepp-ir-detector-ird01-obstacle-avoidance-ir-sensor]] | 3.3-5V | GPIO | IR proximity (2-30cm) | needs-test | 2 |
| [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] | 3.3-5V | I2C | 9DOF IMU (accel+gyro+mag) | verified | 1 |
| [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] | 3.3-5V | I2C | Compass heading (magnetometer) | needs-test | 1 |
| [[neo-6m-gps-module-uart-3v3-for-position-tracking]] | 3.3-5V | UART | GPS position (2.5m accuracy) | needs-test | 1 |
| [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] | 3.3-5V | I2C | Current + voltage (0-26V) | needs-test | 2 |
| [[dht11-temperature-humidity-sensor-single-wire-0-50c]] | 3.3-5V | Digital | Temp (0-50C) + humidity | needs-test | 1 |
| [[generic-ir-receiver-module-38khz-demodulator]] | 3.3-5V | GPIO | IR remote signals (38kHz) | needs-test | 5 |
| [[sw-520d-tilt-switch-ball-type-orientation-detector]] | 3.3-5V | GPIO | Tilt/orientation (binary) | needs-test | 3 |
| [[photoresistor-ldr-light-dependent-resistor-analog-light-sensor]] | 3.3-5V | Analog | Light level (resistive) | needs-test | 5 |
| [[soil-moisture-sensor-capacitive-analog-3v3-5v]] | 3.3-5V | Analog | Soil moisture (capacitive) | needs-test | 1 |
| [[flame-sensor-module-ir-760-1100nm-fire-detector-analog-digital]] | 3.3-5V | Analog/Digital | IR flame detection (760-1100nm) | needs-test | 1 |

## I2C Address Map

| Address | Device | Notes |
|---------|--------|-------|
| 0x68 | [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] | Default (AD0=LOW). **CONFLICTS with DS3231!** Pull AD0 HIGH to shift to 0x69 |
| 0x69 | [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] | Alternate (AD0=HIGH). Use this when DS3231 is on the bus |
| 0x68 | [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] | FIXED — cannot be changed. **CONFLICTS with MPU6050 default!** |
| 0x57 | AT24C32 EEPROM (on DS3231 ZS-042 board) | Onboard EEPROM, address adjustable via A0/A1/A2 pads |
| 0x28 | [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] | Default (ADR=LOW). Alt: 0x29 (ADR=HIGH). No conflicts on standard bus |
| 0x29 | [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] | Alternate (ADR=HIGH) |
| 0x1E | [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] | Genuine HMC5883L (fixed). REDUNDANT if using BNO055 |
| 0x0D | [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] | QMC5883L clone (fixed). Most "HMC5883L" modules are actually this |
| 0x40 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] | Default (A0=GND, A1=GND). Configurable 0x40-0x4F |
| 0x41 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] | Second sensor (A0=VCC, A1=GND) |
| 0x44 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] | Third sensor (A0=GND, A1=VCC) |
| 0x45 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] | Fourth sensor (A0=VCC, A1=VCC) |

## Quick Reference

| Sensor Type | Common Parts | Interface | Typical Voltage |
|------------|-------------|-----------|-----------------|
| Ultrasonic distance | HC-SR04 | Digital (Trig/Echo) | 5V |
| PIR motion | HC-SR501 | Digital | 5V |
| IMU (6-axis) | MPU6050, BNO055 | I2C | 3.3V |
| IR proximity | Sharp GP2Y | Analog | 5V |
| Temperature | DHT11/22, DS18B20 | Digital (1-Wire) | 3.3-5V |
| Light level | Photoresistor (LDR) | Analog (voltage divider) | 3.3-5V |
| Soil moisture | Capacitive sensor | Analog | 3.3-5V |
| Flame/fire | IR flame sensor | Analog + Digital | 3.3-5V |

---

Categories:
- [[index]]
