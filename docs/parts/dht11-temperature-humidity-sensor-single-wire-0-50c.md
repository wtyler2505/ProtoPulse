---
description: "Basic temperature (0-50C, +/-2C) and humidity (20-90% RH, +/-5%) sensor with proprietary single-wire protocol — NOT I2C despite similar wiring. 1Hz max sample rate. Cheap and simple but low accuracy. Good enough for ambient monitoring, not for precision"
topics: ["[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Digital]
logic_level: "3.3-5V (single-wire protocol, voltage-tolerant)"
manufacturer: "Aosong (ASAIR)"
part_number: "DHT11"
pinout: |
  DHT11 (4-pin package, pin 3 is NC):
  Pin 1 (VCC)  → 3.3-5V power
  Pin 2 (DATA) → Single-wire data (needs 10K pull-up to VCC)
  Pin 3 (NC)   → Not connected
  Pin 4 (GND)  → Ground

  DHT11 module (3-pin breakout, pull-up onboard):
  VCC  → 3.3-5V
  DATA → Digital GPIO
  GND  → Ground
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Maximum 1Hz sampling rate — do NOT poll faster than once per second or you get stale/error data", "NOT I2C — uses a proprietary single-wire protocol that looks similar but is incompatible. Cannot share an I2C bus", "Low accuracy (+/-2C temperature, +/-5% RH) — use DHT22/AM2302 or BME280 if you need better", "Operating range is only 0-50C — will not work in freezing conditions", "The bare 4-pin component needs an external 10K pull-up resistor on DATA. Module breakouts include it onboard", "Slow response time — takes 6-15 seconds to respond to temperature changes"]
datasheet_url: "https://www.mouser.com/datasheet/2/758/DHT11-Technical-Data-Sheet-Translated-Version-1143054.pdf"
---

# DHT11 Temperature + Humidity Sensor — Single-Wire, 0-50C

The DHT11 is the cheapest temperature + humidity sensor you can get. One data pin, one pull-up resistor, and you get both readings. The trade-off is accuracy and speed — +/-2C on temperature and +/-5% on humidity, with a maximum sample rate of 1 Hz.

It uses a proprietary single-wire protocol (NOT 1-Wire, NOT I2C). The MCU sends a start pulse, then the DHT11 responds with 40 bits of data: 8 bits humidity integer, 8 bits humidity decimal, 8 bits temperature integer, 8 bits temperature decimal, 8 bits checksum. The timing-sensitive protocol means you need a dedicated library (DHT.h) — don't try to bit-bang it yourself.

For ambient monitoring of the rover's electronics enclosure temperature, the DHT11 is adequate. For outdoor environmental sensing or any application needing better than +/-2C accuracy, use a DHT22 (0.5C accuracy, -40 to +80C range) or a BME280 (I2C, pressure/temp/humidity, lab-grade).

## Specifications

| Spec | Value |
|------|-------|
| Sensor | DHT11 (Aosong ASAIR) |
| Temperature Range | 0-50C |
| Temperature Accuracy | +/-2C |
| Temperature Resolution | 1C (integer only in basic mode) |
| Humidity Range | 20-90% RH |
| Humidity Accuracy | +/-5% RH |
| Humidity Resolution | 1% RH |
| Supply Voltage | 3.3-5.5V |
| Supply Current | 0.3mA (measuring), 60uA (standby) |
| Sampling Rate | 1 Hz maximum (one reading per second) |
| Interface | Proprietary single-wire (NOT I2C, NOT 1-Wire) |
| Response Time | 6-15 seconds (temperature), 6-15 seconds (humidity) |
| Operating Temp | 0-50C |

## Wiring

| DHT11 Pin | Arduino/ESP32 | Notes |
|-----------|--------------|-------|
| VCC | 3.3-5V | |
| DATA | Any digital GPIO | Add 10K pull-up to VCC (if bare sensor) |
| GND | GND | |

If using a module breakout board, the pull-up resistor is already onboard.

## Arduino Code

```cpp
#include <DHT.h>

#define DHTPIN 2       // Data pin
#define DHTTYPE DHT11  // DHT11 (use DHT22 for AM2302)

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);  // Wait 2 seconds between readings (1Hz max)

  float humidity = dht.readHumidity();
  float temp_c = dht.readTemperature();

  if (isnan(humidity) || isnan(temp_c)) {
    Serial.println("DHT11 read failed!");
    return;
  }

  Serial.print("Temp: "); Serial.print(temp_c); Serial.print("C  ");
  Serial.print("Humidity: "); Serial.print(humidity); Serial.println("%");
}
```

## DHT11 vs DHT22 vs BME280

| Feature | DHT11 | DHT22/AM2302 | BME280 |
|---------|-------|-------------|--------|
| Temp Range | 0-50C | -40 to +80C | -40 to +85C |
| Temp Accuracy | +/-2C | +/-0.5C | +/-0.5C |
| Humidity Range | 20-90% | 0-100% | 0-100% |
| Humidity Accuracy | +/-5% | +/-2-5% | +/-3% |
| Interface | Single-wire | Single-wire | I2C/SPI |
| Sample Rate | 1 Hz | 0.5 Hz | Up to 25 Hz |
| Pressure | No | No | Yes |
| Price | ~$1 | ~$3 | ~$5-8 |

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via digital GPIO at 5V, direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO at 5V, direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO at 5V, direct connection
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO at 5V, direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, direct connection
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via digital GPIO at 3.3V, direct connection
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, direct connection

Categories:
- [[sensors]]
