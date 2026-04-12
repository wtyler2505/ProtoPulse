---
description: "Capacitive soil moisture sensor with analog output — measures moisture without exposed metal probes, so it resists corrosion much better than resistive types. Lower analog reading = wetter soil. Power it only when reading to extend lifespan"
topics: ["[[sensors]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Analog]
logic_level: "3.3-5V"
manufacturer: "Generic"
part_number: ""
pinout: |
  3-pin header:
    VCC → 3.3-5V (power only when taking a reading to extend probe life)
    GND → Ground
    A0  → Analog output (lower voltage = wetter soil)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["Probes corrode in wet soil — power only when reading to extend probe life", "Resistive types corrode faster than capacitive types", "Calibration is soil-specific — sandy vs clay vs potting mix all read differently", "Cheap capacitive sensors have exposed traces on the PCB — coat with conformal spray or nail polish to prevent corrosion"]
datasheet_url: ""
---

# Capacitive Soil Moisture Sensor — Analog Output, 3.3-5V

A capacitive soil moisture sensor measures the dielectric permittivity of the surrounding soil, which changes with moisture content. Unlike resistive sensors (two exposed metal probes), a capacitive sensor has no exposed metal in the sensing area — the capacitor plates are buried under the PCB surface. This means dramatically less corrosion and longer life in wet soil.

The analog output (A0) provides a voltage inversely proportional to moisture: **lower voltage = wetter soil, higher voltage = drier soil**. You'll need to calibrate the readings for your specific soil type.

## Specifications

| Spec | Value |
|------|-------|
| Type | Capacitive (no exposed metal probes) |
| Operating Voltage | 3.3-5V DC |
| Output | Analog voltage (inversely proportional to moisture) |
| Interface | Single analog pin |
| Current Draw | ~5mA when powered |
| PCB Dimensions | ~98 x 23mm (typical) |
| Immersion Line | Marked on PCB — do not submerge above this line |

## Wiring

```
Sensor VCC → Digital GPIO (for power control) or VCC
Sensor GND → GND
Sensor A0  → Analog input (A0)
```

### Power Control (Recommended)

To extend sensor life, power it through a digital GPIO pin instead of continuous VCC. Turn it on, wait for the reading to stabilize (~100ms), read, then turn it off:

```cpp
const int sensorPower = 7;   // Digital pin to power sensor
const int sensorPin = A0;    // Analog input

void setup() {
  pinMode(sensorPower, OUTPUT);
  digitalWrite(sensorPower, LOW);  // Start with sensor off
  Serial.begin(115200);
}

int readMoisture() {
  digitalWrite(sensorPower, HIGH);  // Power on
  delay(100);                        // Stabilize
  int value = analogRead(sensorPin);
  digitalWrite(sensorPower, LOW);   // Power off
  return value;
}

void loop() {
  int moisture = readMoisture();
  Serial.print("Moisture: ");
  Serial.println(moisture);
  delay(60000);  // Read once per minute is plenty
}
```

## Calibration

You must calibrate for your specific soil. The raw ADC values mean nothing without reference points:

1. **Dry reading:** Read the sensor in open air (completely dry). Record this as your "0% moisture" value.
2. **Wet reading:** Submerge the sensor (up to the immersion line!) in a glass of water. Record this as your "100% moisture" value.
3. **Map:** `map(rawValue, wetValue, dryValue, 100, 0)` — note the inverted mapping since lower voltage = wetter.

| Condition | Typical ADC (10-bit, 5V) | Mapped % |
|-----------|-------------------------|----------|
| Air (dry) | ~620-650 | 0% |
| Dry soil | ~500-600 | 10-30% |
| Moist soil | ~350-500 | 30-70% |
| Wet soil | ~250-350 | 70-90% |
| Water | ~200-250 | 100% |

These values vary significantly between sensor units and soil types. Always calibrate.

## Capacitive vs Resistive Soil Sensors

| Feature | Capacitive (this one) | Resistive |
|---------|----------------------|-----------|
| Probe corrosion | Low (no exposed metal) | High (bare copper traces) |
| Lifespan in soil | Months to years | Weeks to months |
| Accuracy | Moderate | Low (degrades with corrosion) |
| Price | ~$2-3 | ~$1 |
| Electrolysis | No | Yes (DC through soil) |

---

Related Parts:
- [[photoresistor-ldr-light-dependent-resistor-analog-light-sensor]] — pairs well for plant monitoring (light + moisture)
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] — add air temperature/humidity for a complete plant monitor
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 6 analog inputs, direct connection at 5V
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — WiFi-connected plant monitor, use ADC1 pins

Categories:
- [[sensors]]
