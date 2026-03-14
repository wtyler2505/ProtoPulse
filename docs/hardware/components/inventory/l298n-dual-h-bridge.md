---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-inventory-l298n-dual-h-bridge
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
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary:
  '> Versatile DC motor and stepper motor controller providing auxiliary motor control for the
  OmniTrek Rover | Property         | Value                         |'
depends_on:
  - README.md
---

# L298N Dual H-Bridge DC Motor Driver

> Versatile DC motor and stepper motor controller providing auxiliary motor control for the OmniTrek
> Rover

## Quick Reference

| Property         | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Category**     | Secondary                                      |
| **Status**       | Working                                        |
| **Quantity**     | 2                                              |
| **Last Tested**  | 2025-11-03                                     |
| **Test Results** | Pass                                           |
| **Criticality**  | Medium                                         |
| **Project Role** | Auxiliary motor control (arms, grippers, etc.) |

---

## Specifications

### Technical Specifications

- **Model/Part Number**: L298N
- **Manufacturer**: STMicroelectronics
- **Technology**: Dual H-Bridge motor driver IC
- **Form Factor**: 43 x 43 x 26 mm

### Electrical Characteristics

- **Motor Voltage**: 5V-35V
- **Logic Voltage**: 5V
- **Current Consumption**: 2A continuous per channel, 3A peak
- **Power Requirements**: Separate motor and logic supplies

### Performance Characteristics

- **Motor Control**: PWM speed control, digital direction control
- **Channels**: 2 independent H-bridge channels
- **Interface Speed**: PWM frequency up to 25 kHz
- **Efficiency**: Approximately 70% (typical for H-bridge)

### Physical Characteristics

- **Dimensions**: 43 x 43 x 26 mm
- **Weight**: 30 g
- **Operating Temperature**: -25 to 130°C
- **Mounting**: Standard PCB mounting holes

---

## Integration

### Compatibility

- **Motors**: DC motors, 1x bipolar stepper motor
- **Controllers**: Arduino, ESP32, Raspberry Pi
- **Programming**: Standard motor driver libraries
- **Known Conflicts**: Heat generation at high currents, voltage drop

### Connections

- **Power Connections**: VM (motor power 5-35V), VSS (logic 5V), GND
- **Data Interfaces**: IN1/IN2, IN3/IN4 (direction), ENA/ENB (PWM speed)
- **GPIO Requirements**: 6 digital pins (4 direction + 2 PWM)
- **Signal Requirements**: 5V logic levels, PWM for speed control

### Dependencies

- **Required Components**: DC motors or stepper motor, power supply
- **Optional Enhancements**: Heat sink, external power supply
- **Alternative Components**: TB6612FNG, DRV8833

---

## Testing & Maintenance

### Test Procedures

1. **Basic Functionality Test**: Connect DC motor and test direction control
2. **Integration Test**: Test PWM speed control with variable duty cycle
3. **Performance Test**: Verify current handling and thermal performance
4. **Stress Test**: Test under load conditions with heat monitoring

### Expected Results

- **Normal Operation**: Smooth motor control in both directions with variable speed
- **Common Issues**: Motor stuttering, overheating, insufficient torque
- **Failure Modes**: H-bridge failure, overheating damage

### Maintenance Requirements

- **Calibration**: Not required
- **Cleaning**: Keep heat sinks clean and free of dust
- **Inspection Schedule**: Weekly thermal inspection under load
- **Replacement Indicators**: Overheating, motor control failure

---

## Troubleshooting

### Common Issues

| Symptom                  | Possible Cause      | Solution                    |
| ------------------------ | ------------------- | --------------------------- |
| Motor not spinning       | No power to motor   | Check VM power supply       |
| Motor only one direction | Direction pin issue | Verify IN1/IN2 signals      |
| Overheating              | High current draw   | Add heat sink, reduce load  |
| Weak motor performance   | Voltage drop        | Check power supply capacity |

### Debugging Steps

1. Verify motor power supply voltage (5-35V)
2. Check logic power supply (5V)
3. Test direction control pins with digital signals
4. Verify PWM signals on enable pins

### Performance Issues

- **Poor speed control**: PWM frequency too low, insufficient current
- **Overheating**: High current load, insufficient cooling
- **Complete Failure**: H-bridge IC failure, power supply issues

---

## Project Usage

### Current Implementation

- **Role in Project**: Controls auxiliary motors for rover attachments
- **Integration Status**: Connected to Arduino Mega for PWM and direction control
- **Performance in Project**: Reliable operation for low to medium power motors
- **Known Limitations**: Inefficient at high currents, requires heat management

### Code Examples

```cpp
// L298N DC motor control example
#define ENA 9  // PWM speed control for motor A
#define IN1 8  // Direction control for motor A
#define IN2 7  // Direction control for motor A
#define ENB 10 // PWM speed control for motor B
#define IN3 6  // Direction control for motor B
#define IN4 5  // Direction control for motor B

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  Serial.begin(9600);
}

void motorAControl(int speed, bool direction) {
  digitalWrite(IN1, direction ? HIGH : LOW);
  digitalWrite(IN2, direction ? LOW : HIGH);
  analogWrite(ENA, speed);
}

void motorBControl(int speed, bool direction) {
  digitalWrite(IN3, direction ? HIGH : LOW);
  digitalWrite(IN4, direction ? LOW : HIGH);
  analogWrite(ENB, speed);
}

void loop() {
  // Test motor A forward at 50% speed
  motorAControl(128, true);
  delay(2000);

  // Stop motor A
  motorAControl(0, false);
  delay(1000);

  // Test motor A backward at 75% speed
  motorAControl(192, false);
  delay(2000);
}
```

### Configuration

- **Default Settings**: 5V logic, external motor power
- **Optimal Settings**: 12V motor supply, PWM 1-20 kHz
- **Configuration Files**: Arduino motor control library settings

---

## Documentation & Resources

### Official Documentation

- **Datasheet**: https://www.st.com/resource/en/datasheet/l298.pdf
- **User Manual**: L298N module documentation
- **Application Notes**: H-bridge motor control guides

### Community Resources

- **Forums**: Arduino motor control forums
- **Tutorials**: L298N control tutorials
- **GitHub Repositories**: Arduino motor control libraries

### Project-Specific Resources

- **Wiring Diagrams**: /docs/hardware/wiring/l298n-connections.md
- **Integration Guide**: /docs/hardware/integration/auxiliary-motor-setup.md
- **Test Results**: Component database entry

---

## Procurement

### Purchasing Information

- **Current Supplier**: Amazon, Adafruit, Digi-Key
- **Alternative Suppliers**: SparkFun, AliExpress
- **Typical Cost**: $5-10
- **Availability**: Very Common

### Specifications for Ordering

- **Exact Model Number**: L298N module with heat sink
- **Required Accessories**: Heat sink, jumper wires
- **Minimum Order Quantity**: 1

### Replacement Planning

- **End of Life Status**: Active production
- **Recommended Replacement**: TB6612FNG (more efficient) or modern motor drivers
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
