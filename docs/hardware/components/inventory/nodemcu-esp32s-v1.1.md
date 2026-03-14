---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-inventory-nodemcu-esp32s-v1.1
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
  - 'NodeMCU ESP-32S: WiFi and Bluetooth communication module'
  - 'Eve: AI assistant personality system'
  - 'Telemetry System: Real-time data transmission from rover'
summary:
  '> WiFi and Bluetooth communication module providing IoT connectivity for the OmniTrek Rover |
  Property         | Value                         |'
depends_on:
  - README.md
---

# NodeMCU ESP-32S V1.1

> WiFi and Bluetooth communication module providing IoT connectivity for the OmniTrek Rover

## Quick Reference

| Property         | Value                                   |
| ---------------- | --------------------------------------- |
| **Category**     | Primary                                 |
| **Status**       | Working                                 |
| **Quantity**     | 1                                       |
| **Last Tested**  | 2025-11-03                              |
| **Test Results** | Pass                                    |
| **Criticality**  | High                                    |
| **Project Role** | WiFi communication and IoT connectivity |

---

## Specifications

### Technical Specifications

- **Model/Part Number**: ESP32-S2
- **Manufacturer**: Espressif Systems
- **Technology**: 32-bit dual-core Xtensa LX6
- **Form Factor**: 48.26 x 25.5 mm

### Electrical Characteristics

- **Operating Voltage**: 3.3V
- **Current Consumption**: 160mA typical, 260mA peak
- **Power Requirements**: 5V via USB or 3.3V regulated
- **Logic Levels**: 3.3V

### Performance Characteristics

- **Processing Speed**: 240 MHz (dual-core)
- **Memory/Storage**: 4 MB Flash, 520 KB SRAM
- **Interface Speed**: WiFi 802.11 b/g/n, Bluetooth 5.0
- **Accuracy/Precision**: High-precision timing peripherals

### Physical Characteristics

- **Dimensions**: 48.26 x 25.5 mm
- **Weight**: 10 g
- **Operating Temperature**: -40 to 85°C
- **Mounting**: PCB mounting holes

---

## Integration

### Compatibility

- **Platforms**: Arduino IDE, ESP-IDF, PlatformIO, MicroPython
- **Communication Protocols**: WiFi, Bluetooth, UART, SPI, I2C
- **Required Libraries**: WiFi.h, BluetoothSerial.h
- **Known Conflicts**: Power supply issues with high current draw

### Connections

- **Power Connections**: 5V via USB micro-B port
- **Data Interfaces**: 48 GPIO pins, 18 ADC channels, 2 DAC
- **GPIO Requirements**: 3.3V logic level interfacing
- **Signal Requirements**: Level shifting for 5V systems

### Dependencies

- **Required Components**: 5V power supply or USB connection
- **Optional Enhancements**: External antenna, battery pack
- **Alternative Components**: ESP8266, Raspberry Pi Zero W

---

## Testing & Maintenance

### Test Procedures

1. **Basic Functionality Test**: Upload WiFi scan sketch
2. **Integration Test**: Connect to WiFi network and ping gateway
3. **Performance Test**: Test data throughput and range
4. **Stress Test**: Multiple simultaneous connections

### Expected Results

- **Normal Operation**: WiFi networks visible, successful connections
- **Common Issues**: Connection drops, slow response
- **Failure Modes**: WiFi module failure, power issues

### Maintenance Requirements

- **Calibration**: Not required
- **Cleaning**: Keep USB port clean
- **Inspection Schedule**: Monthly connection testing
- **Replacement Indicators**: Persistent connection failures

---

## Troubleshooting

### Common Issues

| Symptom               | Possible Cause      | Solution                       |
| --------------------- | ------------------- | ------------------------------ |
| No WiFi networks      | Antenna issue       | Check hardware, reset device   |
| Connection drops      | Power instability   | Verify power supply quality    |
| Cannot upload sketch  | Boot mode issues    | Hold BOOT button during upload |
| Bluetooth not working | Firmware corruption | Re-flash firmware              |

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

- **Role in Project**: WiFi communication for remote control and telemetry
- **Integration Status**: Connected to main controller via serial
- **Performance in Project**: Stable WiFi connectivity with good range
- **Known Limitations**: Single point of failure for remote operations

### Code Examples

```cpp
#include <WiFi.h>

const char* ssid = "OmniTrek_Network";
const char* password = "rover_password";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }

  Serial.println("WiFi connected!");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Handle WiFi communications
  delay(1000);
}
```

### Configuration

- **Default Settings**: 240 MHz CPU, WiFi enabled
- **Optimal Settings**: Power-saving mode for battery operation
- **Configuration Files**: WiFi credentials in code

---

## Documentation & Resources

### Official Documentation

- **Datasheet**:
  <https://www.espressif.com/sites/default/files/documentation/esp32-s2_datasheet_en.pdf>
- **User Manual**: <https://docs.espressif.com/projects/esp-idf/en/latest/esp32s2/>
- **Application Notes**: ESP-IDF programming guide

### Community Resources

- **Forums**: ESP32 community forums
- **Tutorials**: Random Nerd Tutorials, ESP32 examples
- **GitHub Repositories**: espressif/esp-idf

### Project-Specific Resources

- **Wiring Diagrams**: /docs/hardware/wiring/esp32-connections.md
- **Integration Guide**: /docs/hardware/integration/wifi-setup.md
- **Test Results**: Component database entry

---

## Procurement

### Purchasing Information

- **Current Supplier**: Amazon, AliExpress, Digi-Key
- **Alternative Suppliers**: SparkFun, Adafruit
- **Typical Cost**: $15-25
- **Availability**: Common

### Specifications for Ordering

- **Exact Model Number**: ESP32-S2 NodeMCU V1.1
- **Required Accessories**: USB cable, external antenna (optional)
- **Minimum Order Quantity**: 1

### Replacement Planning

- **End of Life Status**: Active production
- **Recommended Replacement**: ESP32-S3 or newer NodeMCU
- **Inventory Level**: 1 spare recommended

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
