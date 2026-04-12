---
description: "Multi-device I2C bus wiring for rover sensor suite — BNO055 + INA219 + compass module with address management and pull-up sizing"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]]", "[[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
status: needs-test
quantity: 0
voltage: [3.3, 5]
interfaces: [I2C]
---

# Wiring I2C Multi-Device Bus — Compass, IMU, Current Sensor

This guide covers wiring multiple I2C sensors on a shared bus for the rover's sensor suite. The key challenges are: address conflict avoidance, proper pull-up resistor sizing, bus capacitance management, and level shifting if mixing 3.3V and 5V devices.

## I2C Address Map

| Address | Device | Configurable? | Notes |
|---------|--------|--------------|-------|
| 0x28 | [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] | Yes (0x28 or 0x29 via ADR pin) | Default. No conflicts on this bus |
| 0x40 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] #1 | Yes (0x40-0x4F via A0/A1) | Battery rail monitor |
| 0x41 | [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] #2 | Yes (0x40-0x4F via A0/A1) | 5V rail monitor |
| 0x1E | [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] (genuine HMC) | No (fixed) | Only if NOT using BNO055 |
| 0x0D | [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] (QMC clone) | No (fixed) | Only if NOT using BNO055 |

**No address conflicts in this configuration.** All devices sit at unique addresses. The compass module (0x1E or 0x0D) is only needed if you're NOT using the BNO055 (which has its own magnetometer).

### Other Common I2C Devices and Potential Conflicts

| Address | Device | Conflict? |
|---------|--------|-----------|
| 0x68 | [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] | No conflict (different from BNO055 0x28) |
| 0x68 | [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] | Conflicts with MPU6050, not with this bus |
| 0x3C | SH1106/SSD1306 OLED | No conflict with any sensor on this bus |

## Bus Topology

### Option A: Arduino Mega (5V native, no level shifting needed)

```
Arduino Mega 2560
   SDA (Pin 20) ──┬─── BNO055 SDA (0x28)
                  ├─── INA219 #1 SDA (0x40)
                  ├─── INA219 #2 SDA (0x41)
                  └─── Compass SDA (0x1E or 0x0D) [if used]

   SCL (Pin 21) ──┬─── BNO055 SCL
                  ├─── INA219 #1 SCL
                  ├─── INA219 #2 SCL
                  └─── Compass SCL [if used]

   5V ────────────┬─── BNO055 VIN
                  ├─── INA219 #1 VCC
                  ├─── INA219 #2 VCC
                  └─── Compass VCC [if used]

   GND ───────────┬─── BNO055 GND
                  ├─── INA219 #1 GND
                  ├─── INA219 #2 GND
                  └─── Compass GND [if used]
```

### Option B: ESP32 (3.3V native, level shifting needed for 5V sensors)

```
ESP32                  HW-221 Shifter           5V I2C Devices
                      LV      HV
GPIO21 (SDA) ──→ LV1 ──── HV1 ──┬── BNO055 SDA
                                 ├── INA219 #1 SDA
                                 ├── INA219 #2 SDA
                                 └── Compass SDA

GPIO22 (SCL) ──→ LV2 ──── HV2 ──┬── BNO055 SCL
                                 ├── INA219 #1 SCL
                                 ├── INA219 #2 SCL
                                 └── Compass SCL

3.3V ──→ LV                HV ←── 5V
GND  ──→ GND ──────────── GND
```

Use the [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] for I2C level shifting. Do NOT use the TXS0108E — it fights with I2C open-drain topology.

## Pull-Up Resistor Sizing

I2C requires pull-up resistors on SDA and SCL. Most breakout boards include onboard pull-ups (typically 4.7K or 10K). With multiple devices on the bus, the parallel combination of all pull-ups determines the effective resistance.

### Calculating Effective Pull-Up

```
Devices on bus:
  BNO055 breakout:     10K pull-ups onboard
  INA219 #1 breakout:  10K pull-ups onboard
  INA219 #2 breakout:  10K pull-ups onboard
  Compass breakout:    10K pull-ups onboard (if used)
  HW-221 shifter:      10K pull-ups onboard (if used)

3 devices (no compass, no shifter):
  R_eff = 1 / (1/10K + 1/10K + 1/10K) = 3.3K

4 devices (with compass):
  R_eff = 1 / (1/10K + 1/10K + 1/10K + 1/10K) = 2.5K

5 devices (with compass + shifter):
  R_eff = 1 / (1/10K × 5) = 2K
```

### Is the Pull-Up Too Strong?

The I2C spec requires the pull-up to source enough current to charge bus capacitance within the rise time specification, but not so much that the open-drain drivers can't sink it.

```
At 5V, I2C sink current limit: 3mA
Minimum pull-up resistance: 5V / 3mA = 1.67K

With 3 devices: R_eff = 3.3K → I_sink = 5V / 3.3K = 1.5mA ✓ Safe
With 4 devices: R_eff = 2.5K → I_sink = 5V / 2.5K = 2.0mA ✓ Safe
With 5 devices: R_eff = 2.0K → I_sink = 5V / 2.0K = 2.5mA ✓ Safe (borderline)
```

All configurations are within spec. If you add more devices (6+), consider removing some onboard pull-ups by desoldering the resistors on the breakout boards.

## Bus Capacitance Budget

I2C spec limits bus capacitance to 400pF for standard/fast mode. Each device adds capacitance:

```
Per device: ~10-15pF (input capacitance)
Per cm of wire: ~1-2pF
Level shifter (BSS138): ~5pF per channel

Budget:
  4 devices × 15pF     = 60pF
  Level shifter × 2ch  = 10pF
  30cm wiring          = 45pF
  Total                = 115pF ✓ Well within 400pF limit
```

Keep total wire length under 1 meter and you'll be fine at 400kHz fast mode.

## I2C Scanner Code

Always run this first to verify all devices are detected:

```cpp
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(115200);
  Serial.println("I2C Scanner");
}

void loop() {
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
    }
  }
  Serial.println("Scan complete.\n");
  delay(5000);
}

// Expected output:
// Device at 0x28  (BNO055)
// Device at 0x40  (INA219 #1)
// Device at 0x41  (INA219 #2)
// Device at 0x1E  (HMC5883L) or 0x0D (QMC5883L)
```

## Wiring Checklist

- [ ] All devices share SDA and SCL lines (parallel)
- [ ] All devices share common GND
- [ ] Pull-up effective resistance > 1.67K (at 5V)
- [ ] Total bus capacitance < 400pF
- [ ] Level shifter used if mixing 3.3V and 5V devices
- [ ] BSS138-based shifter (HW-221), NOT TXS0108E for I2C
- [ ] No I2C address conflicts (run scanner to verify)
- [ ] 0.1uF decoupling capacitor near each device's VCC pin

---

Categories:
- [[wiring-guides]]
