---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-inventory-hc-sr04
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
summary:
  '> Short-range distance measurement sensor providing obstacle detection for the OmniTrek Rover |
  Property         | Value                         |'
depends_on:
  - README.md
---

# HC-SR04 Ultrasonic Sensor

> Short-range distance measurement sensor providing obstacle detection for the OmniTrek Rover

## Quick Reference

| Property         | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| **Category**     | Secondary                                               |
| **Status**       | Working                                                 |
| **Quantity**     | 1                                                       |
| **Last Tested**  | 2025-11-03                                              |
| **Test Results** | Pass                                                    |
| **Criticality**  | Medium                                                  |
| **Project Role** | Short-range obstacle detection and distance measurement |

---

## Specifications

### Technical Specifications

- **Model/Part Number**: HC-SR04
- **Manufacturer**: Various
- **Technology**: Ultrasonic time-of-flight
- **Form Factor**: 45 x 20 x 15 mm

### Electrical Characteristics

- **Operating Voltage**: 5V
- **Current Consumption**: 15mA typical
- **Power Requirements**: 5V DC supply
- **Logic Levels**: 5V TTL

### Performance Characteristics

- **Range**: 2cm - 400cm
- **Resolution**: 0.3cm
- **Frequency**: 40 kHz ultrasonic pulse
- **Accuracy/Precision**: ±3mm accuracy

### Physical Characteristics

- **Dimensions**: 45 x 20 x 15 mm
- **Weight**: 8 g
- **Operating Temperature**: 0 to 60°C
- **Mounting**: Standard mounting holes

---

## Integration

### Compatibility

- **Controllers**: Arduino, ESP32, Raspberry Pi
- **Libraries**: NewPing, Ultrasonic
- **Protocols**: Digital GPIO (2-wire interface)
- **Known Conflicts**: Sensitive to acoustic noise, soft surfaces

### Connections

- **Power Connections**: VCC (5V), GND
- **Data Interfaces**: Trig (trigger pulse), Echo (return pulse)
- **GPIO Requirements**: 2 digital pins
- **Signal Requirements**: 5V logic levels, precise timing

### Dependencies

- **Required Components**: 5V power supply, microcontroller with timing capability
- **Optional Enhancements**: Temperature sensor for speed of sound compensation
- **Alternative Components**: IR distance sensors, laser rangefinders

---

## Testing & Maintenance

### Test Procedures

1. **Basic Functionality Test**: Measure distance to a flat surface at known distance
2. **Integration Test**: Test obstacle detection in rover environment
3. **Performance Test**: Verify accuracy across full range (2cm-400cm)
4. **Stress Test**: Test with various surface materials and angles

### Expected Results

- **Normal Operation**: Consistent distance readings within ±3mm
- **Common Issues**: Erratic readings, no echo detection
- **Failure Modes**: Transducer failure, timing issues

### Maintenance Requirements

- **Calibration**: Not required, but temperature compensation recommended
- **Cleaning**: Keep transducers clean and free of obstructions
- **Inspection Schedule**: Monthly accuracy verification
- **Replacement Indicators**: Consistently erratic or no readings

---

## Troubleshooting

### Common Issues

| Symptom              | Possible Cause        | Solution                              |
| -------------------- | --------------------- | ------------------------------------- |
| No distance reading  | No echo pulse         | Check target distance, wiring         |
| Erratic readings     | Acoustic interference | Move away from noise sources          |
| Always reads 0       | Trigger not working   | Verify trigger pulse generation       |
| Max distance reading | Echo timeout          | Check timeout values, target distance |

### Debugging Steps

1. Verify 5V power supply and ground connections
2. Check trigger and echo pin connections
3. Test with known flat surface at 10-50cm distance
4. Verify timing calculations in code

### Performance Issues

- **Inaccurate readings**: Temperature changes, angled surfaces
- **No detection**: Target too far, soft surface, timing issues
- **Complete Failure**: Transducer damage, wiring issues

---

## Project Usage

### Current Implementation

- **Role in Project**: Provides short-range obstacle detection for navigation
- **Integration Status**: Connected to Arduino Mega for distance measurement
- **Performance in Project**: Reliable detection within 2-200cm range
- **Known Limitations**: Limited range, affected by surface materials

### Code Examples

```cpp
// HC-SR04 distance measurement example
#define TRIG_PIN 12
#define ECHO_PIN 13

long duration;
int distance;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
}

void loop() {
  // Clear the trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Set the trigger pin HIGH for 10 microseconds
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read the echo pin, returns the sound wave travel time in microseconds
  duration = pulseIn(ECHO_PIN, HIGH);

  // Calculate the distance in cm
  distance = duration * 0.034 / 2;

  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  delay(500);
}
```

### Configuration

- **Default Settings**: 40 kHz frequency, 5V operation
- **Optimal Settings**: Temperature compensation for accuracy
- **Configuration Files**: Arduino sketch timing parameters

---

## Documentation & Resources

### Official Documentation

- **Datasheet**: <https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf>
- **User Manual**: Basic operation guide
- **Application Notes**: Distance measurement tutorials

### Community Resources

- **Forums**: Arduino sensor forums
- **Tutorials**: Various HC-SR04 tutorials online
- **GitHub Repositories**: NewPing library, ultrasonic examples

### Project-Specific Resources

- **Wiring Diagrams**: /docs/hardware/wiring/hcsr04-connections.md
- **Integration Guide**: /docs/hardware/integration/obstacle-detection-setup.md
- **Test Results**: Component database entry

---

## Procurement

### Purchasing Information

- **Current Supplier**: Amazon, Adafruit, SparkFun, AliExpress
- **Alternative Suppliers**: Digi-Key, Mouser
- **Typical Cost**: $2-5
- **Availability**: Very Common

### Specifications for Ordering

- **Exact Model Number**: HC-SR04
- **Required Accessories**: Jumper wires, mounting hardware
- **Minimum Order Quantity**: 1

### Replacement Planning

- **End of Life Status**: Active production
- **Recommended Replacement**: JSN-SR04T (waterproof version) or newer ultrasonic sensors
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
