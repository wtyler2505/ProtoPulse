---
description: "When you only need 'is it tilted?' rather than 'what angle?', a passive mechanical tilt switch (SW-520D, ~$0.10, zero idle power) eliminates the power budget, code complexity, and I2C bus occupancy of an IMU like the MPU6050"
type: claim
source: "docs/parts/sw-520d-tilt-switch-ball-type-orientation-detector.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[input-devices]]"
related_components:
  - "sw-520d-tilt-switch"
  - "mpu6050-imu"
---

# Binary tilt detection trades precision for simplicity and zero quiescent power

Sensor selection principle: match the sensor's information density to the actual decision being made.

**Binary tilt switch (SW-520D):**
- Output: OPEN or CLOSED (1 bit)
- Power: Zero in open state, microamps through pull-up in closed state
- Code: `digitalRead()` + debounce. No library, no initialization, no calibration
- Cost: ~$0.10
- Answers: "Is it tilted past threshold?" (yes/no)

**IMU accelerometer (MPU6050):**
- Output: 3-axis acceleration at 16-bit resolution, up to 1kHz
- Power: 3.6mA typical (always measuring)
- Code: I2C initialization, register configuration, calibration, trigonometry for angle
- Cost: ~$2-5
- Answers: "What exact angle is it tilted to? How fast is it rotating? What acceleration is it experiencing?"

**When to choose binary:**
- Tip-over detection (mailbox flag, vending machine anti-tilt)
- Anti-tamper alarm (device was moved)
- Orientation lock (landscape vs. portrait, but only two states)
- Battery wake trigger (zero power in sleep state)
- Any case where the response to tilt is binary regardless of angle

**When you need IMU:**
- Balancing (robotics, Segway)
- Gesture recognition
- Inclinometer (measuring exact angle)
- Motion tracking
- Any case where the response scales with tilt magnitude

**The broader principle:** Don't reach for I2C/digital sensors when a passive component answers the actual question. Every I2C device adds bus complexity, power draw, initialization code, and a failure mode. A passive switch adds a wire.

---

Relevant Notes:
- [[pdm-digital-audio-and-analog-envelope-detection-serve-fundamentally-different-use-cases-not-a-quality-spectrum]] -- Same pattern: match sensor type to actual question
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Another "good enough for the question" sensor

Topics:
- [[sensors]]
- [[input-devices]]
