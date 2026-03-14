---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-inventory-riorand-zsx11h
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
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'ZSX11H Motor Controllers: 36V, 350W brushless motor controllers'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary:
  '> Primary brushless DC motor controller for the OmniTrek Rover wheel drive system |
  Property         | Value                         |'
depends_on:
  - README.md
---

# RioRand ZS-X11H Motor Controller

> Primary brushless DC motor controller for the OmniTrek Rover wheel drive system

## Quick Reference

| Property         | Value                                             |
| ---------------- | ------------------------------------------------- |
| **Category**     | Primary                                           |
| **Status**       | Working                                           |
| **Quantity**     | 4                                                 |
| **Last Tested**  | 2025-11-03                                        |
| **Test Results** | Pass                                              |
| **Criticality**  | Critical                                          |
| **Project Role** | Primary drive motor control (4x for rover wheels) |

---

## Specifications

### Technical Specifications

- **Model/Part Number**: ZS-X11H
- **Manufacturer**: RioRand
- **Technology**: 3-phase BLDC motor controller
- **Form Factor**: 110 x 80 x 35 mm

### Electrical Characteristics

- **Operating Voltage**: 6-60V DC
- **Current Consumption**: 16A rated, 30A peak
- **Power Requirements**: 36V recommended for optimal performance
- **Logic Levels**: 5V logic level control

### Performance Characteristics

- **Processing Speed**: Hall sensor feedback response
- **Power Rating**: 350W rated, 500W peak
- **Interface Speed**: PWM frequency up to 20 kHz
- **Accuracy/Precision**: Hall sensor-based position control

### Physical Characteristics

- **Dimensions**: 110 x 80 x 35 mm
- **Weight**: 200 g
- **Operating Temperature**: -20 to 60°C
- **Mounting**: M3 screw holes

---

## Integration

### Compatibility

- **Motors**: 3-phase BLDC motors with Hall sensors
- **Controllers**: Arduino, ESP32, Raspberry Pi
- **Programming**: Arduino library available
- **Known Conflicts**: Requires Hall sensor feedback, not compatible with sensorless motors

### Connections

- **Power Connections**: 6-60V DC input, 3-phase motor output
- **Data Interfaces**: Hall sensor inputs (5V), PWM speed control, direction control
- **GPIO Requirements**: 3 Hall sensor pins + PWM + direction pin
- **Signal Requirements**: 5V logic levels, Hall sensor feedback required

### Dependencies

- **Required Components**: BLDC motor with Hall sensors, power supply
- **Optional Enhancements**: Heat sink, cooling fan
- **Alternative Components**: ESC for brushless motors, L298N for DC motors

---

## Testing & Maintenance

### Test Procedures

1. **Basic Functionality Test**: Connect motor and test response to PWM signals
2. **Integration Test**: Test with Hall sensor feedback and direction control
3. **Performance Test**: Verify speed control and torque output
4. **Stress Test**: Test under load conditions and thermal performance

### Expected Results

- **Normal Operation**: Motor responds smoothly to PWM changes, direction control works
- **Common Issues**: Motor jerking, overheating, no response
- **Failure Modes**: Power MOSFET failure, Hall sensor issues

### Maintenance Requirements

- **Calibration**: Hall sensor alignment may need adjustment
- **Cleaning**: Keep heat sinks clean and free of dust
- **Inspection Schedule**: Weekly thermal inspection under load
- **Replacement Indicators**: Overheating, motor control failure

---

## Troubleshooting

### Common Issues

| Symptom              | Possible Cause           | Solution                 |
| -------------------- | ------------------------ | ------------------------ |
| Motor not spinning   | No Hall sensor signal    | Check Hall sensor wiring |
| Motor jerks          | Hall sensor misalignment | Adjust sensor position   |
| Controller overheats | Insufficient cooling     | Add heat sink or fan     |
| No speed control     | PWM signal issue         | Verify PWM connections   |

### Debugging Steps

1. Verify power supply voltage (6-60V)
2. Check Hall sensor connections and signals
3. Test PWM signal from controller
4. Verify motor phase connections

### Performance Issues

- **Slow Response**: PWM frequency too low, power supply insufficient
- **Intermittent Operation**: Loose connections, overheating
- **Complete Failure**: MOSFET failure, power supply issues

---

## Project Usage

### Current Implementation

- **Role in Project**: Wheel motor control for rover mobility (4 controllers)
- **Integration Status**: Connected to Arduino Mega with Hall sensor feedback
- **Performance in Project**: Reliable operation with good torque control
- **Known Limitations**: Requires careful thermal management

### Code Examples

```cpp
// BLDC motor control example
#define HALL_A 2
#define HALL_B 3
#define HALL_C 4
#define PWM_PIN 9
#define DIR_PIN 8

void setup() {
  pinMode(HALL_A, INPUT);
  pinMode(HALL_B, INPUT);
  pinMode(HALL_C, INPUT);
  pinMode(PWM_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);

  Serial.begin(9600);
}

void loop() {
  // Read Hall sensors
  int hallA = digitalRead(HALL_A);
  int hallB = digitalRead(HALL_B);
  int hallC = digitalRead(HALL_C);

  // Control motor speed (0-255)
  analogWrite(PWM_PIN, 180);

  // Control direction
  digitalWrite(DIR_PIN, HIGH);

  delay(10);
}
```

### Configuration

- **Default Settings**: PWM control, Hall sensor feedback enabled
- **Optimal Settings**: 36V supply, PWM frequency 10-20 kHz
- **Configuration Files**: Arduino motor control library

---

## Documentation & Resources

### Official Documentation

- **Datasheet**: Custom controller - limited documentation available
- **User Manual**: Supplier documentation
- **Application Notes**: BLDC motor control guides

### Community Resources

- **Forums**: Arduino motor control forums
- **Tutorials**: BLDC motor control tutorials
- **GitHub Repositories**: Arduino motor control libraries

### Project-Specific Resources

- **Wiring Diagrams**: /docs/hardware/wiring/zsx11h-wiring.md
- **Integration Guide**: /docs/hardware/integration/motor-control-setup.md
- **Test Results**: Component database entry

---

## Procurement

### Purchasing Information

- **Current Supplier**: Amazon, AliExpress
- **Alternative Suppliers**: Direct from manufacturer
- **Typical Cost**: $25-40
- **Availability**: Moderate

### Specifications for Ordering

- **Exact Model Number**: ZS-X11H
- **Required Accessories**: Heat sink, cooling fan
- **Minimum Order Quantity**: 1

### Replacement Planning

- **End of Life Status**: Unknown production status
- **Recommended Replacement**: Standard ESC with Hall sensor support
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
