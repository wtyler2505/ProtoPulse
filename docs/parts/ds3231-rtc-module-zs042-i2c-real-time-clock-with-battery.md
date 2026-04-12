---
description: "Temperature-compensated RTC that keeps time to +/-2 minutes per year — I2C interface, CR2032 backup battery, and 4KB EEPROM on the ZS-042 board. I2C address 0x68 CONFLICTS with MPU6050!"
topics: ["[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [I2C]
logic_level: "3.3V/5V (open-drain I2C with pull-ups)"
manufacturer: "Maxim Integrated (Analog Devices)"
part_number: "DS3231"
breakout_board: "ZS-042"
i2c_address: "0x68 (DS3231), 0x57 (AT24C32 EEPROM on board)"
backup_battery: "CR2032"
accuracy: "+/-2 ppm (about +/-1 minute per year)"
pinout: |
  ZS-042 breakout board:
  VCC  → 3.3-5V supply
  GND  → Ground
  SCL  → I2C clock
  SDA  → I2C data
  SQW  → Square wave / interrupt output (1Hz, 1kHz, 4kHz, 8kHz, or alarm)
  32K  → 32.768kHz output (for external clock reference)

  Onboard components:
  CR2032 battery holder → backup power for timekeeping
  AT24C32 EEPROM → 4KB I2C storage at address 0x57
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
conflicts_with: ["[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] (I2C address 0x68 conflict — shift MPU6050 to 0x69 via AD0 pin)"]
used_in: []
warnings: ["I2C address 0x68 CONFLICTS with MPU6050 — if using both, pull MPU6050 AD0 HIGH to shift it to 0x69", "DS3231 address is FIXED at 0x68 — it cannot be changed", "ZS-042 board has a charging circuit for the battery — if using non-rechargeable CR2032, REMOVE resistor R5 or the battery may leak/explode", "The AT24C32 EEPROM at 0x57 may conflict with other I2C EEPROMs on the bus"]
datasheet_url: "https://datasheets.maximintegrated.com/en/ds/DS3231.pdf"
---

# DS3231 RTC module ZS-042 I2C real-time clock with battery

The DS3231 is the gold standard for Arduino real-time clocks. Temperature-compensated crystal oscillator (TCXO) keeps accuracy to about +/-2 minutes PER YEAR — vastly better than the DS1307 (which drifts minutes per month). The ZS-042 breakout adds a CR2032 battery backup so the clock keeps running when your project loses power, plus a 4KB AT24C32 EEPROM for storing configuration data.

**CRITICAL I2C ADDRESS CONFLICT**: The DS3231 uses I2C address 0x68, which is the SAME address as the [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]. The DS3231's address is hardwired and CANNOT be changed. If you need both on the same bus, the MPU6050 must be shifted to 0x69 by pulling its AD0 pin HIGH. There is no other workaround short of using an I2C multiplexer (TCA9548A).

## Specifications

| Spec | Value |
|------|-------|
| RTC IC | DS3231 (Maxim/Analog Devices) |
| Accuracy | +/-2 ppm (0 to 40C), +/-3.5 ppm (-40 to 85C) |
| Drift | ~1 minute per year typical |
| Interface | I2C (up to 400kHz) |
| I2C Address | 0x68 (DS3231), 0x57 (AT24C32 EEPROM) |
| Supply Voltage | 2.3-5.5V |
| Battery Backup | CR2032 (maintains time when VCC removed) |
| Battery Life | ~3-5 years (timekeeping only, no I2C traffic) |
| Temperature Sensor | Built-in (+/-3C accuracy, 0.25C resolution) |
| Alarms | 2 programmable alarms |
| Square Wave Output | 1Hz, 1.024kHz, 4.096kHz, 8.192kHz |
| EEPROM (on ZS-042) | AT24C32, 4KB (32,768 bits) |
| Dimensions (ZS-042) | ~38 x 22mm |

## I2C Address Map (ZS-042 Board)

| Address | Device | Changeable? |
|---------|--------|-------------|
| 0x68 | DS3231 RTC | NO — hardwired |
| 0x57 | AT24C32 EEPROM | Partially — A0/A1/A2 pads can shift to 0x50-0x57 |

## ZS-042 Battery Charging Warning

The ZS-042 board includes a charging circuit (200 ohm resistor R5 + diode) designed for rechargeable LIR2032 batteries. If you're using a standard NON-rechargeable CR2032 (which is what most people use), this charging circuit can cause the battery to overheat, leak, or in extreme cases rupture.

**Fix**: Remove resistor R5 (or the diode next to it) from the ZS-042 board. This disables the charging circuit. The CR2032 will still provide backup power — it just won't be (dangerously) trickle-charged.

## Wiring

| ZS-042 Pin | Arduino Mega | Arduino Uno/Nano |
|------------|--------------|-----------------|
| VCC | 5V | 5V |
| GND | GND | GND |
| SCL | D21 (SCL) | A5 (SCL) |
| SDA | D20 (SDA) | A4 (SDA) |
| SQW | Any digital pin (optional) | Any digital pin (optional) |
| 32K | Not usually needed | Not usually needed |

## Using with MPU6050 on the Same Bus

Both the DS3231 and MPU6050 default to I2C address 0x68. To use them together:

1. Connect DS3231 normally (it MUST stay at 0x68)
2. On the MPU6050 GY-521 board, connect AD0 pin to VCC (3.3V or 5V depending on your bus)
3. MPU6050 now responds at 0x69
4. In your code, initialize MPU6050 at address 0x69: `MPU6050 mpu(0x69);`

## Arduino Library

Use the `RTClib` library by Adafruit. It supports DS3231 natively:

```cpp
#include <RTClib.h>
RTC_DS3231 rtc;

void setup() {
  rtc.begin();
  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__))); // Set to compile time
  }
}

void loop() {
  DateTime now = rtc.now();
  Serial.print(now.hour());
  Serial.print(":");
  Serial.println(now.minute());
}
```

## Built-in Temperature Sensor

The DS3231 has a temperature sensor used for crystal compensation, but you can read it for environmental temperature too. Accuracy is +/-3C with 0.25C resolution — not great for precision work, but free.

```cpp
float temp = rtc.getTemperature();  // Returns degrees Celsius
```

---

Related Parts:
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] — I2C address 0x68 CONFLICT — DS3231 is hardwired to 0x68, shift MPU6050 to 0x69 via AD0 pin HIGH
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] — NO conflict (BNO055 at 0x28/0x29, DS3231 at 0x68) — safe to share I2C bus
- [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] — NO conflict (INA219 at 0x40-0x4F, DS3231 at 0x68) — safe to share I2C bus
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via I2C at 5V, SDA=A4 SCL=A5
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via I2C at 5V, SDA=D20 SCL=D21
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO21 SCL=GPIO22
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via I2C at 3.3V, SDA=GPIO4 SCL=GPIO5
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via I2C at 3.3V

Categories:
- [[sensors]]
