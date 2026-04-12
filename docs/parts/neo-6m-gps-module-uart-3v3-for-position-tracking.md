---
description: "U-blox GPS receiver for outdoor position tracking — UART at 9600 baud default, 2.5m accuracy, 50-channel. Cold start 30-45s. 3.3V logic but most modules have 5V regulator. Essential for waypoint navigation, useless indoors"
topics: ["[[sensors]]", "[[communication]]"]
status: verified
quantity: 1
voltage: [3.3, 5]
interfaces: [UART]
logic_level: "mixed"
logic_notes: "Most breakout boards accept 5V power through an onboard regulator, but the UART signals are still 3.3V and the GPS RX pin must not see a raw 5V TX signal."
manufacturer: "U-blox"
part_number: "NEO-6M"
pinout: |
  NEO-6M module (typical breakout):
  VCC  → 3.3-5V (module has onboard 3.3V regulator)
  GND  → Ground
  TX   → UART transmit (GPS → MCU) — 3.3V logic
  RX   → UART receive (MCU → GPS) — 3.3V logic
  PPS  → Pulse per second (optional, 1Hz timing)
level_shifter_needed: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["TX/RX are 3.3V logic — do NOT connect RX directly to a 5V TX pin without a voltage divider or level shifter", "Requires clear sky view — will NOT work indoors, under dense tree canopy, or in urban canyons", "Cold start takes 30-45 seconds for first fix — be patient, it's acquiring satellites", "Antenna must face up (toward sky) — ceramic patch antenna is directional", "GPS heading is ONLY valid when moving >0.5 m/s — stationary heading is random noise", "Some modules have an EEPROM battery for hot start — if battery dies, every start is a cold start"]
datasheet_url: "https://www.u-blox.com/en/product/neo-6-series"
---

# NEO-6M GPS Module UART 3.3V for Position Tracking

U-blox NEO-6M GPS receiver — the go-to budget GPS module for Arduino/ESP32 projects. Outputs NMEA sentences over UART at 9600 baud (configurable up to 115200). Parse with TinyGPS++ library and you get latitude, longitude, altitude, speed, course, time, and satellite count.

This is a UART device, not I2C. It needs its own serial port — on an Arduino Mega, use one of the four hardware UARTs (Serial1/2/3). On an ESP32, use any available UART. On an Arduino Uno, you're stuck with SoftwareSerial (which works but is fragile at higher baud rates).

**GPS heading vs compass heading:** GPS course is derived from successive position fixes. It's only valid when you're MOVING (>0.5 m/s). When stationary, GPS heading is garbage — random values. That's where a compass or IMU comes in. Best approach: use GPS heading when moving, compass/IMU heading when stationary.

## Specifications

| Spec | Value |
|------|-------|
| Chipset | U-blox NEO-6M |
| Satellite Systems | GPS L1 (1575.42 MHz) only |
| Tracking Channels | 50 |
| Horizontal Accuracy | 2.5m CEP (50% confidence) |
| Update Rate | 1 Hz default, 5 Hz maximum |
| Operating Voltage | 2.7-3.6V (IC), 3.3-5V (module) |
| Operating Current | 45mA (acquisition), 37mA (tracking) |
| UART Baud Rate | 9600 default (configurable) |
| Logic Level | 3.3V |
| Protocol | NMEA 0183 (default), UBX (proprietary) |
| Time to First Fix | Cold: 27-30s, Warm: 27s, Hot: 1s |
| Sensitivity | -162 dBm (tracking), -148 dBm (acquisition) |
| Altitude Limit | 50,000m |
| Speed Limit | 500 m/s |
| Operating Temp | -40C to +85C |
| Antenna | Ceramic patch (onboard) + u.FL for external |

## Wiring to Arduino Mega (5V board)

The Mega has 4 hardware UARTs — use Serial1, Serial2, or Serial3 (NOT Serial0, that's USB).

| GPS Pin | Arduino Mega | Notes |
|---------|-------------|-------|
| VCC | 5V | Module regulator drops to 3.3V |
| GND | GND | |
| TX | D19 (RX1) | GPS TX → Arduino RX1 (Serial1) |
| RX | D18 (TX1) via voltage divider | Arduino 5V TX → GPS 3.3V RX. Use 1K + 2K divider |
| PPS | Any digital pin | Optional — 1 pulse per second |

**CRITICAL:** The GPS RX pin is 3.3V tolerant at most. Sending 5V from the Arduino's TX pin may damage it. Use a voltage divider (1K from TX to GPS RX, 2K from GPS RX to GND) or a level shifter.

## Wiring to ESP32 (3.3V)

No level shifting needed — both are 3.3V logic.

| GPS Pin | ESP32 | Notes |
|---------|-------|-------|
| VCC | 3.3V or 5V | 3.3V direct to IC, 5V through module regulator |
| GND | GND | |
| TX | GPIO16 (RX2) | GPS TX → ESP32 RX (Serial2) |
| RX | GPIO17 (TX2) | ESP32 TX → GPS RX |
| PPS | Any GPIO | Optional |

## Arduino Code (TinyGPS++)

```cpp
#include <TinyGPS++.h>

TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);   // USB debug
  Serial1.begin(9600);    // GPS on Serial1 (Mega pins 18/19)
  Serial.println("GPS Module Test");
}

void loop() {
  while (Serial1.available()) {
    gps.encode(Serial1.read());
  }

  if (gps.location.isUpdated()) {
    Serial.print("Lat: "); Serial.print(gps.location.lat(), 6);
    Serial.print(" Lng: "); Serial.print(gps.location.lng(), 6);
    Serial.print(" Sats: "); Serial.print(gps.satellites.value());
    Serial.print(" Speed: "); Serial.print(gps.speed.mps());
    Serial.print(" Course: "); Serial.println(gps.course.deg());
  }
}
```

## Antenna Considerations

- **Ceramic patch antenna (onboard):** Decent for open sky, struggles near buildings
- **External active antenna (u.FL connector):** Much better sensitivity, recommended for vehicles/rovers
- **Mounting:** Antenna must face UP toward sky. Do not mount upside down or vertically

---

Related Parts:
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] — complementary sensor (GPS provides position, BNO055 provides heading/orientation — GPS heading only valid when moving)
- [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] — complementary sensor (compass provides heading when stationary, GPS heading is noise when not moving)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via hardware UART (Serial1/2/3). WARNING: use voltage divider on Arduino TX to GPS RX (5V to 3.3V)
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via hardware UART. WARNING: use voltage divider on TX to GPS RX (5V to 3.3V)
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via SoftwareSerial only (single hardware UART used by USB). WARNING: level shift TX line (5V to 3.3V)
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via SoftwareSerial only. WARNING: level shift TX line (5V to 3.3V)
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via UART at 3.3V, no level shifting needed, direct connection
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via SoftwareSerial at 3.3V, no level shifting needed. Only one hardware UART shared with USB
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via UART at 3.3V, no level shifting needed, direct connection

Categories:
- [[sensors]]
- [[communication]]
