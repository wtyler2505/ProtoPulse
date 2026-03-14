---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-inventory-nodemcu-amica-esp8266
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 4 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'Eve: AI assistant personality system'
summary:
  '> WiFi communication module providing additional IoT connectivity for the OmniTrek Rover |
  Property         | Value                         |'
depends_on:
  - README.md
---

# NodeMCU Amica (ESP8266)

> WiFi communication module providing additional IoT connectivity for the OmniTrek Rover

## Quick Reference

| Property         | Value                      |
| ---------------- | -------------------------- |
| **Category**     | Secondary                  |
| **Status**       | Working                    |
| **Quantity**     | 2                          |
| **Last Tested**  | 2025-11-03                 |
| **Test Results** | Pass                       |
| **Criticality**  | Medium                     |
| **Project Role** | WiFi communication modules |

---

## Specifications

### Technical Specifications

- **Model/Part Number**: ESP-12E
- **Manufacturer**: Espressif Systems
- **Technology**: 32-bit Tensilica L106
- **Form Factor**: 48.26 x 25.5 mm

### Electrical Characteristics

- **Operating Voltage**: 3.3V
- **Current Consumption**: 80mA typical, 200mA peak
- **Power Requirements**: 5V via USB or 3.3V regulated
- **Logic Levels**: 3.3V

### Performance Characteristics

- **Processing Speed**: 80/160 MHz
- **Memory/Storage**: 4 MB Flash, 160 KB SRAM
- **Interface Speed**: WiFi 802.11 b/g/n
- **Accuracy/Precision**: Built-in TCP/IP protocol stack

### Physical Characteristics

- **Dimensions**: 48.26 x 25.5 mm
- **Weight**: 8 g
- **Operating Temperature**: -40 to 85°C
- **Mounting**: PCB mounting holes

---

## Integration

### Compatibility

- **Platforms**: Arduino IDE, ESP-IDF, PlatformIO, MicroPython
- **Communication Protocols**: WiFi, UART, SPI, I2C
- **Required Libraries**: ESP8266WiFi, ESP8266WebServer
- **Known Conflicts**: Power supply issues with high current draw

### Connections

- **Power Connections**: 5V via USB micro-B port
- **Data Interfaces**: 16 GPIO pins, 1 ADC channel
- **GPIO Requirements**: 3.3V logic level interfacing
- **Signal Requirements**: Level shifting for 5V systems

### Dependencies

- **Required Components**: 5V power supply or USB connection
- **Optional Enhancements**: External antenna, battery pack
- **Alternative Components**: ESP32, ESP8266-01

---

## Testing & Maintenance

### Test Procedures

1. **Basic Functionality Test**: Upload WiFi scan sketch
2. **Integration Test**: Connect to WiFi network and ping gateway
3. **Performance Test**: Test data throughput and range
4. **Stress Test**: Multiple simultaneous connections

### Expected Results

- **Normal Operation**: WiFi networks visible, successful connections
- **Common Issues**: Connection drops, slow response, memory issues
- **Failure Modes**: WiFi module failure, power issues

### Maintenance Requirements

- **Calibration**: Not required
- **Cleaning**: Keep USB port clean
- **Inspection Schedule**: Monthly connection testing
- **Replacement Indicators**: Persistent connection failures

---

## Troubleshooting

### Common Issues

| Symptom              | Possible Cause    | Solution                        |
| -------------------- | ----------------- | ------------------------------- |
| No WiFi networks     | Antenna issue     | Check hardware, reset device    |
| Connection drops     | Power instability | Verify power supply quality     |
| Cannot upload sketch | Boot mode issues  | Hold FLASH button during upload |
| Out of memory        | Memory leak       | Optimize code, use PROGMEM      |

### Debugging Steps

1. Verify power supply stability
2. Check serial output for error messages
3. Test with minimal WiFi example
4. Verify network credentials and availability

### Performance Issues

- **Slow Response**: Network congestion, interference
- **Intermittent Operation**: Power supply issues, firmware bugs
- **Complete Failure**: Hardware damage, firmware corruption

---

## Project Usage

### Current Implementation

- **Role in Project**: Additional WiFi communication modules for redundancy
- **Integration Status**: Available as backup to ESP32, tested and operational
- **Performance in Project**: Stable WiFi connectivity with good range
- **Known Limitations**: Limited memory compared to ESP32, single-core

### Code Examples

```cpp
#include <ESP8266WiFi.h>

const char* ssid = "OmniTrek_Network";
const char* password = "rover_password";

void setup() {
  Serial.begin(115200);
  delay(10);

  // Connect to WiFi network
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Handle WiFi communications
  delay(1000);

  // Send periodic status update
  Serial.printf("WiFi status: %d, RSSI: %d dBm\n",
                WiFi.status(), WiFi.RSSI());
}
```

### Configuration

- **Default Settings**: 80 MHz CPU, WiFi enabled
- **Optimal Settings**: 160 MHz CPU for better performance
- **Configuration Files**: WiFi credentials in code

---

## Documentation & Resources

### Official Documentation

- **Datasheet**:
  <https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf>
- **User Manual**: <https://nodemcu.readthedocs.io/>
- **Application Notes**: ESP8266 programming guides

### Community Resources

- **Forums**: ESP8266 community forums
- **Tutorials**: Random Nerd Tutorials, ESP8266 examples
- **GitHub Repositories**: esp8266/Arduino

### Project-Specific Resources

- **Wiring Diagrams**: /docs/hardware/wiring/esp8266-connections.md
- **Integration Guide**: /docs/hardware/integration/backup-wifi-setup.md
- **Test Results**: Component database entry

---

## Procurement

### Purchasing Information

- **Current Supplier**: Amazon, AliExpress, Banggood
- **Alternative Suppliers**: SparkFun, Adafruit
- **Typical Cost**: $8-15
- **Availability**: Very Common

### Specifications for Ordering

- **Exact Model Number**: NodeMCU ESP8266 Amica
- **Required Accessories**: USB cable, external antenna (optional)
- **Minimum Order Quantity**: 1

### Replacement Planning

- **End of Life Status**: Being replaced by ESP32
- **Recommended Replacement**: ESP32-based NodeMCU
- **Inventory Level**: 2 units available (1 spare)

---

## Revision History

| Date       | Version | Changes               | Author            |
| ---------- | ------- | --------------------- | ----------------- |
| 2025-11-03 | 1.0     | Initial documentation | OmniTrek Dev Team |

---

**Last Updated**: 2025-11-03 **Reviewed By**: OmniTrek Development Team **Next Review Date**:
2026-02-03

---

_This document follows the OmniTrek Documentation Standards. For questions or updates, refer to the
[Documentation Standards Guide](../documentation-standards.md)._
