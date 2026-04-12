---
description: "Trace-based resistive water level sensor — analog output drops as water covers more traces. Dead simple but corrodes quickly if powered continuously. Use intermittent readings to extend life"
topics: ["[[sensors]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [Analog]
logic_level: "Analog output (voltage varies with water level)"
manufacturer: "Generic"
part_number: "YL-69 (variant)"
pinout: |
  2-pin sensor + companion board (some modules):
  Sensor board:
    S  → Signal (to analog input or companion board)
    -  → GND
    +  → VCC (3.3-5V)

  If companion board present (LM393-based):
    AO → Analog output (proportional to water level)
    DO → Digital output (threshold triggered)
    GND → Ground
    VCC → 3.3-5V
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]"]
used_in: []
warnings: ["Traces corrode via electrolysis if powered continuously — use GPIO to power it ON only during readings", "Not food-safe — do not use in drinking water applications", "Output is relative (more water = lower resistance) — calibrate for your specific setup", "Conductive liquids other than water will give different readings"]
datasheet_url: ""
---

# Water level detection sensor resistive analog output

A PCB with exposed copper traces that act as a variable resistor based on how much water covers them. More water across the traces = lower resistance = higher analog output voltage. Dead simple in concept, but there's an important gotcha: if you leave it powered continuously, electrolysis corrodes the traces and the sensor dies within weeks.

The fix: power the sensor through a GPIO pin instead of the VCC rail. Turn it on, wait 10ms for the reading to stabilize, read the analog value, then turn it off. This reduces the powered time by >99% and the sensor lasts much longer.

## Specifications

| Spec | Value |
|------|-------|
| Sensor Type | Resistive (exposed PCB traces) |
| Operating Voltage | 3.3-5V DC |
| Output | Analog voltage (proportional to water contact area) |
| Detection | Water level / presence |
| Dimensions | ~62 x 20mm (sensor board) |
| Interface | Analog (direct) or Analog+Digital (with LM393 companion board) |

## Wiring (Direct, Recommended)

Power the sensor from a GPIO pin to prevent electrolysis corrosion:

| Sensor Pin | Arduino Pin | Notes |
|------------|-------------|-------|
| + (VCC) | Digital GPIO (e.g., D7) | Use as switchable power |
| - (GND) | GND | |
| S (Signal) | Analog input (e.g., A0) | Read water level |

```cpp
#define SENSOR_POWER 7
#define SENSOR_SIGNAL A0

void setup() {
  pinMode(SENSOR_POWER, OUTPUT);
  digitalWrite(SENSOR_POWER, LOW);  // Off by default
}

int readWaterLevel() {
  digitalWrite(SENSOR_POWER, HIGH);  // Power on
  delay(10);                          // Settle time
  int value = analogRead(SENSOR_SIGNAL);
  digitalWrite(SENSOR_POWER, LOW);   // Power off immediately
  return value;
}
```

## Reading Interpretation

| Analog Value (5V, 10-bit) | Approximate Level |
|---------------------------|-------------------|
| 0-100 | Dry or barely wet |
| 100-300 | Partially submerged |
| 300-500 | Half submerged |
| 500-700+ | Mostly/fully submerged |

These values are approximate and vary by sensor, water conductivity (tap water vs distilled vs salt water), and supply voltage. Calibrate for your specific application.

## Companion Board (LM393)

Some modules come with an LM393 comparator board that provides:
- **AO**: Analog output (same as direct connection)
- **DO**: Digital output — HIGH when water crosses the threshold set by the trimpot

The companion board is useful if you only need "water detected yes/no" without an analog input pin.

## Limitations

- **Electrolysis corrosion**: The #1 failure mode. ALWAYS use switched power.
- **Not precise**: This is a "how wet is it" sensor, not a calibrated liquid level gauge. For precise level measurement, use a float switch or ultrasonic sensor aimed at the water surface.
- **Conductivity dependent**: Pure distilled water has high resistance and gives weak readings. Tap water works fine. Salt water gives very strong readings.
- **Temperature affects readings**: Water conductivity changes with temperature, so readings drift.

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via analog input (A0-A5), 5V direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via analog input (A0-A15), 5V direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via analog input (A0-A7), 5V direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via ADC pins at 3.3V. NOTE: ADC2 pins unavailable when WiFi is active — use ADC1 pins (GPIO32-39)
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible but only has ONE analog input (A0, 0-1V range) — needs voltage divider if powered at 3.3V+

Categories:
- [[sensors]]
