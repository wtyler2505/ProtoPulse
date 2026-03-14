---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-categories-sensors-README
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 5 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'MPU-6050: 6-axis motion and orientation sensor'
  - 'HC-SR04: Ultrasonic distance and obstacle detection sensor'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary:
  '> Environmental and motion sensing systems for rover awareness and navigation This category
  contains all sensor modules used in the OmniTrek Rover project, providing critical data for
  navigation, o...'
depends_on:
  - README.md
---

# Sensors

> Environmental and motion sensing systems for rover awareness and navigation

## 📋 Overview

This category contains all sensor modules used in the OmniTrek Rover project, providing critical
data for navigation, obstacle avoidance, and vehicle stability.

## 🎯 Component Roles

### **Motion & Orientation**

- **[MPU-6050](../../inventory/mpu-6050.md)** - 6-axis motion sensing (accelerometer + gyroscope)

### **Distance & Proximity**

- **[HC-SR04](../../inventory/hc-sr04.md)** - Ultrasonic distance measurement

## 📊 Category Status

| Component | Type            | Status         | Function                | Criticality | Last Tested |
| --------- | --------------- | -------------- | ----------------------- | ----------- | ----------- |
| MPU-6050  | Motion Sensor   | ✅ Operational | Orientation & Stability | High        | 2025-11-03  |
| HC-SR04   | Distance Sensor | ✅ Operational | Obstacle Detection      | Medium      | 2025-11-03  |

> **Note**: This table is derived from `component-database.json` and reflects the core rover sensor
> set currently used or reserved for OmniTrek. Additional experimental or legacy sensors may only
> appear in `component-inventory.md` or `component-log.md`.

## 🔧 Technical Specifications

### **MPU-6050 Motion Sensor**

- **Sensors**: 3-axis accelerometer + 3-axis gyroscope
- **Accelerometer Range**: ±2, ±4, ±8, ±16 g (16-bit resolution)
- **Gyroscope Range**: ±250, ±500, ±1000, ±2000 °/s (16-bit resolution)
- **Interface**: I2C communication
- **Voltage**: 3.3V-5V operation
- **Dimensions**: 20 x 15 mm
- **Weight**: 2g
- **Data Rate**: Up to 1kHz sampling

> **📖 Complete MPU-6050 Details**: See [MPU-6050](../../inventory/mpu-6050.md) for full
> specifications and [Complete Wiring Guide](../../wiring/complete-wiring-guide.md) for I2C
> connection examples.

### **HC-SR04 Ultrasonic Sensor**

- **Type**: Ultrasonic time-of-flight distance sensor
- **Range**: 2cm - 400cm
- **Resolution**: 0.3cm accuracy
- **Frequency**: 40 kHz ultrasonic pulse

> **📖 Complete HC-SR04 Details**: See [HC-SR04](../../inventory/hc-sr04.md) for full specifications
> and [Complete Wiring Guide](../../wiring/complete-wiring-guide.md) for distance measurement
> circuit examples.

- **Interface**: 2-wire digital (Trigger, Echo)
- **Voltage**: 5V operation
- **Dimensions**: 45 x 20 x 15 mm
- **Weight**: 8g
- **Beam Angle**: 15° cone

## 🧭 Sensor Integration

### **Sensor Placement on Rover**

```
                 [HC-SR04]
                    ↑
                 Forward Facing
                    ↓
[Front Left] ← MPU-6050 → [Front Right]
     ↑                           ↑
   Wheel                      Wheel
     ↓                           ↓
[Center of Mass] ← Stability Reference
```

### **Data Flow Architecture**

```
Sensors → Arduino Mega → Sensor Fusion → Navigation
   ↓           ↓              ↓              ↓
Raw Data  → Processing → Orientation → Path Planning
   ↓           ↓              ↓              ↓
MPU-6050  → I2C Bus → Quaternion → Motor Control
HC-SR04   → GPIO → Distance → Obstacle Avoidance
```

## 📊 Sensor Data Processing

### **MPU-6050 Data Processing**

```cpp
// Raw sensor readings
int16_t accelX, accelY, accelZ;
int16_t gyroX, gyroY, gyroZ;

// Processed data
float pitch, roll, yaw;
float accelMagnitude;
float angularVelocity;

// Sensor fusion (Kalman filter)
void updateOrientation() {
  // Read accelerometer and gyroscope
  mpu.getMotion6(&accelX, &accelY, &accelZ, &gyroX, &gyroY, &gyroZ);

  // Convert to engineering units
  pitch = atan2(accelY, accelZ) * 180/PI;
  roll = atan2(-accelX, accelZ) * 180/PI;

  // Apply complementary filter
  pitch = 0.98 * (pitch + gyroX * dt) + 0.02 * accelPitch;
  roll = 0.98 * (roll + gyroY * dt) + 0.02 * accelRoll;
}
```

### **HC-SR04 Distance Calculation**

```cpp
long getDistance() {
  // Send trigger pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Measure echo duration
  long duration = pulseIn(ECHO_PIN, HIGH);

  // Convert to distance (cm)
  // Speed of sound = 343 m/s = 0.0343 cm/μs
  // Distance = (duration × speed) / 2 (round trip)
  long distance = duration * 0.0343 / 2;

  return distance;
}
```

## 🎯 Applications & Use Cases

### **MPU-6050 Applications**

#### **Rover Stability**

- **Pitch/Roll Monitoring**: Detect tipping angles
- **Incline Detection**: Measure slope angles for navigation
- **Vibration Analysis**: Monitor wheel balance and surface conditions
- **Orientation Reference**: Provide heading reference for navigation

#### **Motion Control**

- **Balance Control**: Automatic stabilization on uneven terrain
- **Turn Detection**: Identify when rover is turning
- **Acceleration Monitoring**: Measure velocity changes
- **Shock Detection**: Identify impacts and collisions

### **HC-SR04 Applications**

#### **Obstacle Avoidance**

- **Forward Detection**: Primary obstacle detection in travel direction
- **Distance Measurement**: Range finding for navigation decisions
- **Parking Assist**: Precision positioning for docking
- **Safety Zone**: Maintain minimum distance from obstacles

#### **Environment Mapping**

- **Simple Mapping**: Basic distance measurements for area mapping
- **Wall Following**: Maintain distance from walls
- **Navigation Aid**: Complement other sensors for path planning

## 📈 Performance Characteristics

### **MPU-6050 Performance**

- **Accuracy**: ±2° for orientation (with sensor fusion)
- **Drift**: <1°/minute with calibration
- **Response Time**: <10ms for data updates
- **Noise Level**: Low noise with proper filtering
- **Temperature Stability**: ±0.5° over operating range

### **HC-SR04 Performance**

- **Accuracy**: ±3mm typical
- **Range**: 2cm to 400cm effective range
- **Beam Angle**: 15° detection cone
- **Update Rate**: Up to 40Hz measurement
- **Surface Dependency**: Performance varies with target surface

## 🔧 Calibration & Configuration

### **MPU-6050 Calibration**

```cpp
void calibrateMPU() {
  // Accelerometer calibration
  long accelX_sum = 0, accelY_sum = 0, accelZ_sum = 0;

  for(int i = 0; i < 1000; i++) {
    mpu.getAcceleration(&ax, &ay, &az);
    accelX_sum += ax;
    accelY_sum += ay;
    accelZ_sum += az;
    delay(1);
  }

  accelX_offset = accelX_sum / 1000;
  accelY_offset = accelY_sum / 1000;
  accelZ_offset = (accelZ_sum / 1000) - 16384; // 1g offset
}
```

### **HC-SR04 Configuration**

```cpp
// Optimize for different ranges
void configureSensor() {
  // Short range optimization (2-50cm)
  if(shortRangeMode) {
    measurementDelay = 20;  // 50Hz update
    timeoutValue = 3000;    // 50cm max
  }
  // Long range optimization (50-400cm)
  else {
    measurementDelay = 100; // 10Hz update
    timeoutValue = 24000;   // 400cm max
  }
}
```

## 🛡️ Error Handling & Reliability

### **Common Sensor Issues**

#### **MPU-6050 Problems**

- **I2C Communication Failures**: Check wiring and pull-up resistors
- **Drift Over Time**: Implement periodic recalibration
- **Temperature Effects**: Apply temperature compensation
- **Noise in Data**: Use digital filtering techniques

#### **HC-SR04 Problems**

- **False Readings**: Multiple echo reflections
- **Range Limitations**: Surface absorption or angle issues
- **Interference**: Other ultrasonic devices nearby
- **Weather Effects**: Wind and temperature affect sound speed

### **Reliability Strategies**

```cpp
bool validateSensorData() {
  // MPU-6050 validation
  if(abs(pitch) > 90 || abs(roll) > 90) {
    // Rover tipped over or sensor error
    return false;
  }

  // HC-SR04 validation
  if(distance < 2 || distance > 400) {
    // Out of range or invalid reading
    return false;
  }

  return true;
}
```

## 📊 Data Logging & Analysis

### **Sensor Data Format**

```json
{
  "timestamp": "2025-11-03T10:30:45Z",
  "mpu6050": {
    "acceleration": { "x": 0.12, "y": -0.05, "z": 9.81 },
    "gyroscope": { "x": 0.01, "y": -0.02, "z": 0.0 },
    "orientation": { "pitch": 2.3, "roll": -1.1, "yaw": 45.6 }
  },
  "hcsr04": {
    "distance": 125.5,
    "signalStrength": 87,
    "temperature": 22.5
  }
}
```

### **Performance Metrics**

- **Data Integrity**: >99% valid readings
- **Update Rate**: 50Hz for motion, 10Hz for distance
- **Accuracy**: ±2° orientation, ±3mm distance
- **Latency**: <20ms total processing time

## 🔮 Future Sensor Enhancements

### **Planned Additions**

- **LIDAR Sensor**: 360° distance scanning
- **Camera Module**: Visual navigation and object recognition
- **GPS Module**: Global positioning and waypoint navigation
- **Environmental Sensors**: Temperature, humidity, pressure

### **Advanced Features**

- **Sensor Fusion**: Combine multiple sensor inputs
- **Machine Learning**: Pattern recognition in sensor data
- **Predictive Analytics**: Anticipate terrain changes
- **Redundant Systems**: Backup sensors for critical measurements

## 📚 Related Documentation

- **[Component Database](../../component-database.json)** - Complete technical specifications
- **[Wiring Documentation](../../wiring/)** - Connection diagrams and procedures
- **[Test Results](../../operations/test-results-observations.md)** - Performance testing data
- **[Programming Examples](../../inventory/)** - Code samples and libraries

---

**Last Updated**: 2025-11-05 **Category**: Sensors **Total Components**: 2

For detailed specifications and code examples, refer to individual component documentation.
