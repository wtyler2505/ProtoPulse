---
description: Master compatibility reference — voltage matrices, interface maps, and I2C address registry
type: moc
---

# compatibility

What works with what, and what needs help to work together.

## Quick References

### Voltage Compatibility

Use level shifters ([[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] or [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]) when connecting 3.3V and 5V devices.

**3.3V boards:** ESP32, ESP8266, RPi Pico, RPi 3B+
**5V boards:** Arduino Uno, Mega, Nano, Elegoo Mega, OSEPP Uno, DCCduino Nano

### I2C Address Map

See [[sensors]] for the full I2C address map. Key conflicts:
- **0x68**: MPU6050 (default) AND DS3231 — shift MPU6050 to 0x69 via AD0 pin
- **0x28**: BNO055 default (no conflicts)
- **0x40-0x4F**: INA219 (configurable via solder pads)
- **0x1E/0x0D**: HMC5883L vs QMC5883L (clone has different address!)

### Interface Coverage

Run `bash ops/queries/interface-coverage.sh` for a live report of which interfaces your inventory covers.

## Voltage Quick Reference

| Logic Level | Direct Connect OK | Needs Level Shifter |
|------------|-------------------|-------------------|
| 5V → 5V | Yes | No |
| 3.3V → 3.3V | Yes | No |
| 3.3V → 5V | Input only (maybe) | Yes for output |
| 5V → 3.3V | NO — will damage | Yes always |

---

Categories:
- [[index]]
