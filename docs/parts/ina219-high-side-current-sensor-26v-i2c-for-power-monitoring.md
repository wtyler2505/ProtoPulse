---
description: "TI high-side current/voltage sensor with 12-bit ADC — measures bus voltage (0-26V) AND current via shunt resistor simultaneously over I2C. 16 configurable addresses (0x40-0x4F) for multi-sensor setups. Essential for power monitoring on battery-powered rovers"
topics: ["[[sensors]]", "[[power]]"]
status: verified
quantity: 2
voltage: [3.3, 5]
interfaces: [I2C]
logic_level: "mixed"
logic_notes: "The INA219 core is 3.3V-class, but common breakouts accept 3.3V or 5V VCC and expose I2C behavior that depends on the board pull-up arrangement."
manufacturer: "Texas Instruments"
part_number: "INA219AIDCNR"
i2c_address: "0x40 (default, A0=GND A1=GND), configurable 0x40-0x4F via A0/A1 pins"
breakout_board: "Adafruit INA219 Breakout / Generic GY-INA219"
pinout: |
  INA219 breakout module:
  VCC  → 3.3-5V (board power)
  GND  → Ground
  SCL  → I2C clock
  SDA  → I2C data
  VIN+ → High side of load (from power source)
  VIN- → Low side of load (to load)
  A0   → Address bit 0 (GND or VCC)
  A1   → Address bit 1 (GND or VCC)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["Maximum bus voltage is 26V — do NOT connect directly to a 36V battery! Use only on 12V or 5V rails, or use a voltage divider on the bus voltage pin", "The shunt resistor gets HOT at high currents — 0.1 ohm at 3.2A = 1W dissipation. For higher currents, use lower shunt (0.01 ohm for up to 32A)", "High-side measurement ONLY — VIN+ and VIN- are both above ground. Do not use for low-side sensing", "Shunt resistor value determines current range and resolution — 0.1 ohm = +/-3.2A range, 0.01 ohm = +/-32A range", "Bus voltage accuracy degrades above 26V — chip is spec'd for 26V max"]
datasheet_url: "https://www.ti.com/product/INA219"
---

# INA219 High-Side Current Sensor 26V I2C for Power Monitoring

Texas Instruments INA219 — a high-side current and voltage sensor that talks over I2C. It measures both the bus voltage (how much voltage your load sees) and the current flowing through a shunt resistor (how much current your load draws). With both, you can calculate power consumption in real time.

"High-side" means the shunt resistor sits between the power source and the load, on the positive rail. This is the safe way to measure current — you don't break the ground path, and the measurement point stays at a known voltage.

The 12-bit ADC gives you decent resolution. With the default 0.1 ohm shunt, you get +/-3.2A range with ~0.8mA resolution. For a rover pulling 10-15A per motor, you'd swap to a 0.01 ohm shunt (0-32A range, ~8mA resolution) or use an INA219 per rail rather than per motor.

## Specifications

| Spec | Value |
|------|-------|
| Sensor IC | INA219AIDCNR (Texas Instruments) |
| Bus Voltage Range | 0-26V maximum |
| Shunt Voltage Range | +/-320mV |
| ADC Resolution | 12-bit (4096 steps) |
| Current Range | +/-3.2A (0.1 ohm shunt), +/-32A (0.01 ohm shunt) |
| Interface | I2C (100kHz, 400kHz, up to 3.4MHz) |
| I2C Address | 0x40-0x4F (16 configurable via A0/A1) |
| Supply Voltage | 3.0-5.5V |
| Supply Current | 1mA max |
| Accuracy | +/-1% (bus voltage), +/-1% (shunt current) |
| Operating Temp | -40C to +125C |

## I2C Address Configuration

| A1 | A0 | Address |
|----|----|---------|
| GND | GND | 0x40 (default) |
| GND | VCC | 0x41 |
| VCC | GND | 0x44 |
| VCC | VCC | 0x45 |
| GND | SDA | 0x42 |
| GND | SCL | 0x43 |
| VCC | SDA | 0x46 |
| VCC | SCL | 0x47 |
| SDA | GND | 0x48 |
| SDA | VCC | 0x49 |
| SCL | GND | 0x4C |
| SCL | VCC | 0x4D |
| SDA | SDA | 0x4A |
| SDA | SCL | 0x4B |
| SCL | SDA | 0x4E |
| SCL | SCL | 0x4F |

For two-sensor monitoring (battery input + 5V rail), use 0x40 and 0x41 (simplest — just bridge A0 to VCC on the second sensor).

## Wiring (Inline Current Measurement)

```
Power Source (+) ──→ VIN+ ──[shunt resistor]── VIN- ──→ Load (+)
Power Source (-) ──→ GND ──────────────────────────→ Load (-)
```

The shunt resistor is typically onboard the breakout module (0.1 ohm). Current flows through VIN+ to VIN-, and the INA219 measures the voltage drop across the shunt to calculate current (V = IR).

## Wiring to Arduino Mega

| INA219 Pin | Arduino Mega | Notes |
|------------|-------------|-------|
| VCC | 5V | Board power (separate from measured circuit) |
| GND | GND | Common ground |
| SCL | D21 (SCL) | Shared I2C bus |
| SDA | D20 (SDA) | Shared I2C bus |
| VIN+ | From power source | High side of measured circuit |
| VIN- | To load | Current flows through onboard 0.1 ohm shunt |

## Arduino Code

```cpp
#include <Adafruit_INA219.h>

Adafruit_INA219 ina219_battery(0x40);  // Battery rail
Adafruit_INA219 ina219_5v(0x41);       // 5V rail

void setup() {
  Serial.begin(115200);
  ina219_battery.begin();
  ina219_5v.begin();

  // For higher current (>3.2A), configure for 32V/32A range:
  // ina219_battery.setCalibration_32V_2A();  // or _32V_1A for better resolution
}

void loop() {
  float voltage = ina219_battery.getBusVoltage_V();
  float current = ina219_battery.getCurrent_mA();
  float power = ina219_battery.getPower_mW();

  Serial.print("Bus V: "); Serial.print(voltage);
  Serial.print("  Current mA: "); Serial.print(current);
  Serial.print("  Power mW: "); Serial.println(power);
  delay(1000);
}
```

## 26V Limit and 36V Systems

The INA219 maxes out at 26V bus voltage. For the OmniTrek's 36V battery system, you CANNOT put the INA219 directly on the 36V rail. Options:

1. **Monitor downstream rails only** — put INA219 on the 12V and 5V buck converter outputs (within spec)
2. **Use INA226 instead** — drop-in replacement rated for 36V bus voltage, same I2C protocol
3. **Voltage divider on VBUS** — reduces bus voltage reading, but adds complexity and reduces accuracy

---

Related Parts:
- [[power-distribution-board-fused-terminal-block-for-36v-system]] — cross-ref: use INA219 to monitor downstream rails (12V, 5V) from the power distribution board. Do NOT put INA219 on the 36V bus (26V max)
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — cross-ref: monitor battery discharge current and voltage on 12V/5V buck outputs, not directly on 36V rail
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO21 SCL=GPIO22
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO4 SCL=GPIO5
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via I2C at 3.3V

Categories:
- [[sensors]]
- [[power]]
