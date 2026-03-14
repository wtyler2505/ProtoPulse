---
# LLM Optimization Metadata
metadata:
  document_id: hardware-wiring-complete-wiring-guide
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 22 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
  - 'Wiring Guide: Electrical connection instructions'
summary: Technical documentation for OmniTrek Nexus project.
depends_on:
  - README.md
---

================================================================================ COMPLETE WIRING
GUIDE: 15+ CIRCUITS FOR OmniTrek ROVER
================================================================================

REFERENCE: 02_COMPLETE_WIRING_GUIDE.txt Cross-reference: 03 (pinouts), 04 (code), 06 (power), 07
(safety)

Every circuit includes: Diagram, connection list, code integration, troubleshooting

================================================================================ CIRCUIT 1: SIMPLE
LED BLINK (FOUNDATION)
================================================================================

Purpose: First electronics project - understand circuits, power, current limiting Difficulty:
Beginner Time: 15 minutes Components: Arduino Mega, LED, 220Ω resistor, 2x jumper wires, USB cable

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                    Breadboard
         │
    ┌────┴────┐
    │ 5V      │────[RED WIRE]────────┬────────┐
    │          │                     │        │
    │ GND      │────[BLACK WIRE]────────┐    │
    │ D13      │────[GREEN WIRE]───┐  │    │
    └────┬────┘                    │  │    │
         │                         │  │    │
     USB/Power                     │ [LED] │
                                   ├──┤   │
                                   │ │220Ω│
                                   │ │    │
                                   │ ├────┤
                                   │        │
                                   └────────┴────→ GND
```

CONNECTION STEPS:

1. Insert LED onto breadboard
   - Longer leg (positive) on breadboard row A
   - Shorter leg (negative) on breadboard row B

2. Connect 220Ω resistor
   - One end: same row as LED negative leg (row B)
   - Other end: empty row C (this will go to ground)

3. Wire from Arduino D13
   - Arduino D13 (yellow wire) → Row A of breadboard (LED positive side)

4. Wire to ground
   - Arduino GND (black wire) → Row C of breadboard (resistor to ground)

5. Connect USB for power
   - Arduino USB to computer

VERIFICATION CHECKLIST: ☐ LED longer leg connected to D13 (through 220Ω resistor path) ☐ LED shorter
leg connected to GND (through 220Ω resistor) ☐ 220Ω resistor is in series with LED ☐ All wires fully
inserted into breadboard ☐ No loose connections

ARDUINO CODE:

```cpp
void setup() {
  pinMode(13, OUTPUT); // Configure pin 13 as output
}

void loop() {
  digitalWrite(13, HIGH);  // Turn LED on (5V)
  delay(1000);             // Wait 1 second
  digitalWrite(13, LOW);   // Turn LED off (0V)
  delay(1000);             // Wait 1 second
}
```

UPLOAD & TEST:

1. Connect Arduino via USB to computer
2. Select Board: Arduino Mega 2560
3. Select Port: COM# (varies by computer)
4. Upload code
5. LED should blink on/off every second
6. Modify delay() values to change blink speed

TROUBLESHOOTING:

Problem: LED doesn't light at all Fixes: - Check LED polarity: longer leg to D13, shorter to GND -
Try flipping LED 180° if unclear which is longer - Replace LED if broken - Verify 220Ω resistor
(color bands: red, red, brown, gold)

Problem: LED stays on constantly Fixes: - Check code uploaded successfully (IDE says "Done
uploading") - Try pressing Arduino reset button - Verify digitalWrite commands are correct

Problem: LED is very dim Fixes: - Normal if using current-limiting resistor - If too dim, try 100Ω
resistor (brighter but draws more current)

================================================================================ CIRCUIT 2: PWM LED
BRIGHTNESS CONTROL ================================================================================

Purpose: Control LED brightness with PWM (pulse width modulation) Difficulty: Beginner Time: 20
minutes Components: Same as Circuit 1, but uses PWM pin

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                    Breadboard
         │
    ┌────┴────┐
    │ 5V      │──────────────────────┬──────┐
    │          │                      │      │
    │ GND      │──────[BLACK WIRE]────────┐  │
    │ D9 (PWM) │──────[YELLOW WIRE]──┐  │  │
    └────┬────┘                       │ [LED] │
         │                            ├──┤   │
     USB/Power                        │ │220Ω│
                                      │ │    │
                                      │ ├────┤
                                      │       │
                                      └───────┴────→ GND
```

KEY DIFFERENCE FROM CIRCUIT 1: Use D9 (PWM-capable pin) instead of D13 Use analogWrite() instead of
digitalWrite()

CONNECTION: Same as Circuit 1, but wire from D9 instead of D13

ARDUINO CODE:

```cpp
void setup() {
  pinMode(9, OUTPUT); // D9 is PWM-capable
}

void loop() {
  // Fade in
  for (int brightness = 0; brightness <= 255; brightness++) {
    analogWrite(9, brightness); // 0=off, 255=full brightness
    delay(10);
  }

  // Fade out
  for (int brightness = 255; brightness >= 0; brightness--) {
    analogWrite(9, brightness);
    delay(10);
  }
}
```

PWM EXPLAINED: analogWrite(pin, 0) = 0% brightness (completely off) analogWrite(pin, 64) = 25%
brightness analogWrite(pin, 128) = 50% brightness analogWrite(pin, 191) = 75% brightness
analogWrite(pin, 255) = 100% brightness (full on)

PWM-CAPABLE PINS ON ARDUINO MEGA: D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13 (Any of these
can use analogWrite())

================================================================================ CIRCUIT 3: PUSH
BUTTON INPUT (DIGITAL READ)
================================================================================

Purpose: Read a button press and trigger an action Difficulty: Beginner Time: 25 minutes Components:
Arduino Mega, push button, 10kΩ resistor, LED (optional), jumper wires

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                    Breadboard
    ┌────┬────┐
    │ 5V │GND │
    │    │    │                     [10kΩ resistor]
    │    │    │                              │
    │    │    │                              ├─→ D2 (digital input)
    │ D2 ├────┼──[BUTTON]──┬────[10kΩ]──────┘
    │    │    │             │
    │    │    │            GND
    │    │    │
    └────┴────┘

Configuration: Pull-down configuration
  - Button pulled HIGH (5V) when pressed
  - Button held LOW (through resistor to GND) when not pressed
```

PULL-DOWN RESISTOR EXPLAINED: When button is not pressed: - Current flows through 10kΩ resistor →
GND - D2 reads approximately 0V (LOW)

When button is pressed: - Current flows from 5V through button → D2 - D2 reads approximately 5V
(HIGH)

CONNECTION STEPS:

1. Insert push button on breadboard
   - Button terminals in rows A and B

2. Connect 10kΩ resistor
   - From same row as one button terminal → GND
   - This is the pull-down resistor

3. Wire from button to Arduino D2
   - From row with button that's NOT connected to resistor → Arduino D2

4. Wire 5V to button
   - Arduino 5V → same row as button terminal without resistor

5. Wire GND for pull-down
   - Arduino GND → other end of 10kΩ resistor

ARDUINO CODE:

```cpp
const int BUTTON_PIN = 2;
const int LED_PIN = 13;

void setup() {
  pinMode(BUTTON_PIN, INPUT);  // Configure D2 as input
  pinMode(LED_PIN, OUTPUT);    // Optional: LED for feedback
  Serial.begin(9600);
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == HIGH) {
    Serial.println("Button pressed!");
    digitalWrite(LED_PIN, HIGH); // Turn LED on
  } else {
    Serial.println("Button released");
    digitalWrite(LED_PIN, LOW);  // Turn LED off
  }

  delay(100); // Debounce delay (prevents false triggers)
}
```

DEBOUNCING EXPLAINED: Mechanical buttons can "bounce" (multiple rapid on/off cycles) Solution: Add
delay(100) between reads to ignore noise

TESTING:

1. Upload code
2. Open Serial Monitor (Tools → Serial Monitor, 9600 baud)
3. Press button - should see "Button pressed!"
4. Release button - should see "Button released"

TROUBLESHOOTING:

Problem: Serial monitor shows random states Fixes: - Add debounce delay: delay(50-100) - Check
button connections are secure - Verify 10kΩ resistor is correctly placed

Problem: Button always reads HIGH Fixes: - Check resistor connected correctly to GND - Verify D2 is
connected through button

Problem: Button always reads LOW Fixes: - Check 5V is connected to button - Verify button makes good
physical contact

================================================================================ CIRCUIT 4: SINGLE
MOTOR SPEED CONTROL ================================================================================

Purpose: Control motor speed using PWM through L298N driver Difficulty: Intermediate Time: 45
minutes Components: Arduino Mega, L298N motor driver, DC motor, 12V battery, jumpers

CIRCUIT DIAGRAM:

```
12V Battery                    L298N Motor Driver              Arduino Mega
    │                          ┌──────────────┐               ┌────────┐
    ├────[RED]────────────────→ +12V          │               │ D9(PWM)├──┐
    │                          │              │               └────────┘  │
    │                          │ IN1 ← ───────┼─────────────────────────┐ │
    │                      ┌───┤ IN2 ← ───────┼─────────┐               │ │
    │                      │   │ ENA ← ───────┼─────────┼──[WHITE]──────┘ │
    │                      │   │ OUT1 ──────→ [MOTOR]   │                │
    │                      │   │ OUT2 ──────→ [MOTOR]   │                │
    │                      │   │ GND  ← ───────────────┐│                │
    │                      │   └──────────────┘        ││                │
    │                      │                           ││                │
    └────[BLACK]───────────┴───────────────────────────┘└────────────GND─┘
```

MOTOR DRIVER CONNECTIONS:

From Arduino Mega to L298N: Arduino D9 (PWM) → L298N ENA (speed control) Arduino D2 (digital) →
L298N IN1 (direction) Arduino D3 (digital) → L298N IN2 (direction) Arduino GND → L298N GND (common
ground - CRITICAL)

From Power to L298N: 12V battery + → L298N +12V 12V battery - → L298N GND (Or use separate battery
for motor power)

From L298N to Motor: L298N OUT1 → Motor terminal 1 L298N OUT2 → Motor terminal 2 (Polarity
determines rotation direction)

MOTOR CONTROL LOGIC:

```
Forward at full speed:
  IN1 = HIGH, IN2 = LOW, ENA = 255
  Code: digitalWrite(2,HIGH); digitalWrite(3,LOW); analogWrite(9,255);

Backward at full speed:
  IN1 = LOW, IN2 = HIGH, ENA = 255
  Code: digitalWrite(2,LOW); digitalWrite(3,HIGH); analogWrite(9,255);

Stop (coast):
  IN1 = LOW, IN2 = LOW, ENA = 0
  Code: digitalWrite(2,LOW); digitalWrite(3,LOW); analogWrite(9,0);

Variable speed (half speed):
  IN1 = HIGH, IN2 = LOW, ENA = 128
  Code: digitalWrite(2,HIGH); digitalWrite(3,LOW); analogWrite(9,128);
```

ARDUINO CODE:

```cpp
const int PWM_PIN = 9;    // Motor speed (analogWrite 0-255)
const int DIR_PIN1 = 2;   // Direction control 1
const int DIR_PIN2 = 3;   // Direction control 2

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  pinMode(DIR_PIN1, OUTPUT);
  pinMode(DIR_PIN2, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // Test sequence

  // Forward at full speed
  Serial.println("Forward - Full speed");
  moveMotor(255, true);  // 255 = full speed, true = forward
  delay(2000);

  // Half speed
  Serial.println("Forward - Half speed");
  moveMotor(128, true);
  delay(2000);

  // Reverse
  Serial.println("Reverse");
  moveMotor(200, false);  // false = reverse
  delay(2000);

  // Stop
  Serial.println("Stop");
  moveMotor(0, true);
  delay(1000);
}

void moveMotor(int speed, boolean direction) {
  // Speed: 0-255 (0=stop, 255=full)
  // Direction: true=forward, false=reverse

  analogWrite(PWM_PIN, speed);

  if (direction) {
    // Forward
    digitalWrite(DIR_PIN1, HIGH);
    digitalWrite(DIR_PIN2, LOW);
  } else {
    // Reverse
    digitalWrite(DIR_PIN1, LOW);
    digitalWrite(DIR_PIN2, HIGH);
  }
}
```

CALIBRATION TESTING:

1. Upload code
2. Motor should follow sequence: full forward → half forward → reverse → stop
3. Verify motor starts moving (minimum speed ~80-100)
4. Test direction changes at low speed first
5. Gradually increase speed if needed

TROUBLESHOOTING:

Problem: Motor doesn't move at all Fixes: - Check 12V battery voltage (should be 11-13V) - Verify
GND connection between Arduino and driver - Check PWM pin receives signal: add serial print in
moveMotor() - Try increasing speed value (100-150)

Problem: Motor moves in wrong direction Fixes: - Swap IN1 and IN2 connections - Or swap motor output
wires

Problem: Motor only moves at full speed Fixes: - Check ENA pin connected to D9 (PWM pin) - Verify
analogWrite() is controlling PWM - Check PWM frequency (should be ~490Hz default)

================================================================================ CIRCUIT 5: DUAL
MOTOR DIRECTION CONTROL (ROVER DRIVE SYSTEM)
================================================================================

Purpose: Control 2 motors independently (left/right drive for rover) Difficulty: Intermediate  
Time: 60 minutes Components: Arduino Mega, 2x L298N drivers, 2x DC motors, 24V battery

CIRCUIT DIAGRAM:

```
Arduino Mega                 Motor Driver 1 (LEFT)           Motor Driver 2 (RIGHT)
  ┌──────────┐               ┌──────────────┐               ┌──────────────┐
  │ D9 (PWM) ├──[WHITE]─────→ ENA           │               │              │
  │ D2       ├──[YELLOW]────→ IN1           │               │              │
  │ D3       ├──[GREEN]─────→ IN2           │               │              │
  │ GND      ├──[BLACK]─────→ GND           │               │              │
  │          │                │ OUT1 ──────→ MOTOR1         │              │
  │ D11(PWM) ├──[WHITE]──────────────────────────────────→ ENA            │
  │ D4       ├──[YELLOW]──────────────────────────────────→ IN1            │
  │ D5       ├──[GREEN]───────────────────────────────────→ IN2            │
  │ GND      ├──[BLACK]───────────────────────────────────→ GND            │
  │          │                │ OUT2 ──────→ MOTOR1     │ OUT1 ──────→ MOTOR2
  │          │                │                         │ OUT2 ──────→ MOTOR2
  └──────────┘                └──────────────┘           └──────────────┘

24V Battery:
  +24V ──→ Both L298N +V inputs
  -24V ──→ Both L298N GND (common with Arduino GND)
```

PINNING (OmniTrek STANDARD): Left Motor: PWM (speed) → Arduino D9 Direction 1 → Arduino D2 Direction
2 → Arduino D3 L298N GND → Arduino GND

Right Motor: PWM (speed) → Arduino D11 Direction 1 → Arduino D4 Direction 2 → Arduino D5 L298N GND →
Arduino GND

MOTOR CONTROL LOGIC (For rover movement):

```
Forward (both motors same direction):
  Left:  IN1=HIGH, IN2=LOW,  ENA=255
  Right: IN1=HIGH, IN2=LOW,  ENA=255

Reverse:
  Left:  IN1=LOW,  IN2=HIGH, ENA=255
  Right: IN1=LOW,  IN2=HIGH, ENA=255

Turn Left (left motor slow, right motor fast):
  Left:  IN1=HIGH, IN2=LOW,  ENA=100
  Right: IN1=HIGH, IN2=LOW,  ENA=255

Turn Right (left motor fast, right motor slow):
  Left:  IN1=HIGH, IN2=LOW,  ENA=255
  Right: IN1=HIGH, IN2=LOW,  ENA=100

Spin Left (left reverse, right forward):
  Left:  IN1=LOW,  IN2=HIGH, ENA=200
  Right: IN1=HIGH, IN2=LOW,  ENA=200

Stop:
  Left:  IN1=LOW,  IN2=LOW,  ENA=0
  Right: IN1=LOW,  IN2=LOW,  ENA=0
```

ARDUINO CODE:

```cpp
// Left Motor (D9, D2, D3)
const int LEFT_PWM = 9;
const int LEFT_DIR1 = 2;
const int LEFT_DIR2 = 3;

// Right Motor (D11, D4, D5)
const int RIGHT_PWM = 11;
const int RIGHT_DIR1 = 4;
const int RIGHT_DIR2 = 5;

void setup() {
  pinMode(LEFT_PWM, OUTPUT);
  pinMode(LEFT_DIR1, OUTPUT);
  pinMode(LEFT_DIR2, OUTPUT);

  pinMode(RIGHT_PWM, OUTPUT);
  pinMode(RIGHT_DIR1, OUTPUT);
  pinMode(RIGHT_DIR2, OUTPUT);

  Serial.begin(9600);
}

void loop() {
  // Forward
  Serial.println("Moving forward...");
  moveRover(255, 255, FORWARD);
  delay(2000);

  // Turn left
  Serial.println("Turning left...");
  moveRover(100, 255, FORWARD);
  delay(2000);

  // Reverse
  Serial.println("Reversing...");
  moveRover(255, 255, REVERSE);
  delay(2000);

  // Spin left
  Serial.println("Spinning left...");
  moveRover(200, 200, SPIN_LEFT);
  delay(2000);

  // Stop
  Serial.println("Stopping...");
  moveRover(0, 0, FORWARD);
  delay(1000);
}

#define FORWARD 0
#define REVERSE 1
#define SPIN_LEFT 2
#define SPIN_RIGHT 3

void moveRover(int leftSpeed, int rightSpeed, int direction) {
  // Set direction
  if (direction == FORWARD) {
    digitalWrite(LEFT_DIR1, HIGH);
    digitalWrite(LEFT_DIR2, LOW);
    digitalWrite(RIGHT_DIR1, HIGH);
    digitalWrite(RIGHT_DIR2, LOW);
  }
  else if (direction == REVERSE) {
    digitalWrite(LEFT_DIR1, LOW);
    digitalWrite(LEFT_DIR2, HIGH);
    digitalWrite(RIGHT_DIR1, LOW);
    digitalWrite(RIGHT_DIR2, HIGH);
  }
  else if (direction == SPIN_LEFT) {
    digitalWrite(LEFT_DIR1, LOW);
    digitalWrite(LEFT_DIR2, HIGH);
    digitalWrite(RIGHT_DIR1, HIGH);
    digitalWrite(RIGHT_DIR2, LOW);
  }
  else if (direction == SPIN_RIGHT) {
    digitalWrite(LEFT_DIR1, HIGH);
    digitalWrite(LEFT_DIR2, LOW);
    digitalWrite(RIGHT_DIR1, LOW);
    digitalWrite(RIGHT_DIR2, HIGH);
  }

  // Set speed
  analogWrite(LEFT_PWM, leftSpeed);
  analogWrite(RIGHT_PWM, rightSpeed);
}
```

TESTING SEQUENCE:

1. Start with both motors at low speed (100-150)
2. Verify both motors turn in same direction (forward)
3. Test reverse direction
4. Test left/right turns
5. Increase speed gradually
6. Fine-tune calibration (one motor faster than other)

CALIBRATION FOR STRAIGHT MOVEMENT: If rover pulls left during forward: - Increase RIGHT speed or
decrease LEFT speed If rover pulls right: - Increase LEFT speed or decrease RIGHT speed Adjust by
changing speed values in moveRover() calls

================================================================================ CIRCUIT 6:
FOUR-MOTOR ROVER CONTROL (FULL OmniTrek)
================================================================================

Purpose: Control all 4 rover motors independently Difficulty: Advanced Time: 90+ minutes Components:
Arduino Mega, 4x L298N drivers, 4x motors, power system

Note: Due to limited PWM pins on mega (15 total, some reserved), need to use RioRand ZS-X11H
controller for main drive motors

SIMPLIFIED APPROACH - Using RioRand for Primary Motors:

```
Arduino Mega                    RioRand ZS-X11H
  ┌──────────┐                 ┌──────────────┐
  │ D9(PWM)  ├──[WHITE]───────→ PWM           │
  │ D7       ├──[YELLOW]──────→ DIR           │
  │ D8       ├──[GREEN]───────→ EN            │
  │ GND      ├──[BLACK]───────→ GND           │
  └──────────┘                 │ OUT ──→ Motors 1-4
                               │ (4 hoverboard motors)
                               └──────────────┘
```

Complete wiring for 4 motors involves multiple driver boards. See PROJECT TEMPLATES
(10_PROJECT_TEMPLATES.txt) for complete 4-motor integration.

================================================================================ CIRCUIT 7: DISTANCE
MEASUREMENT (HC-SR04 ULTRASONIC)
================================================================================

Purpose: Measure distance to obstacles Difficulty: Intermediate Time: 30 minutes Components: Arduino
Mega, HC-SR04 sensor, 5V jumpers

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                              HC-SR04 Sensor
  ┌──────────┐                                 ┌────────┐
  │ D12      ├──[YELLOW]──────────────────────→ TRIG   │
  │ D11      ├──[GREEN]───────────────────────→ ECHO   │
  │ 5V       ├──[RED]─────────────────────────→ VCC    │
  │ GND      ├──[BLACK]───────────────────────→ GND    │
  └──────────┘                                 └────────┘
```

TIMING DIAGRAM:

```
TRIG Signal (from Arduino):
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  └─────┐                                      ┌────┘
        └──────── 10µs ────────┘
  (Arduino sends 10µs pulse to start measurement)

ECHO Signal (from Sensor):
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  └─────┐                                      ┌────┘
        └──────────── echo_time ──────────────┘
  (Pulse width = distance × 2 / speed_of_sound)

If distance = 17cm:
  echo_time = 17cm × 2 / 34300cm/s = 989µs
```

ARDUINO CODE:

```cpp
const int TRIG_PIN = 12;
const int ECHO_PIN = 11;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
}

void loop() {
  long distance_cm = measureDistance();

  Serial.print("Distance: ");
  Serial.print(distance_cm);
  Serial.println(" cm");

  delay(100); // Minimum 60ms between measurements
}

long measureDistance() {
  // Send 10µs pulse to TRIG pin
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Measure echo pulse width
  long echo_time = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout

  // Calculate distance
  // Speed of sound: 343 m/s = 0.0343 cm/µs
  // Distance = (echo_time × speed) / 2 (divide by 2 because pulse travels there and back)
  long distance = (echo_time * 0.034) / 2;

  return distance;
}
```

DISTANCE FORMULA EXPLAINED: echo_time_microseconds × 0.0343 cm/µs = total distance traveled Divide
by 2 because sound travels to object and back Result = distance to object in cm

RANGE TESTING: Close: Place object 10cm away, should read ~10 cm Far: Place object 300cm away,
should read ~300 cm Too far: Beyond ~400cm, becomes unreliable

MULTIPLE SENSORS: Don't trigger all sensors simultaneously (crosstalk) Solution: Trigger one sensor,
wait for result, then next sensor Code: distance1 = measureDistance1(); delay(10); distance2 =
measureDistance2();

================================================================================ CIRCUIT 8: MOTION
DETECTION (HC-SR501 PIR SENSOR)
================================================================================

Purpose: Detect nearby movement Difficulty: Beginner Time: 20 minutes Components: Arduino Mega,
HC-SR501 PIR sensor, 5V jumpers

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                    HC-SR501 PIR Sensor
  ┌──────────┐                       ┌──────────┐
  │ D2       ├──[YELLOW]────────────→ OUT      │
  │ 5V       ├──[RED]───────────────→ VCC      │
  │ GND      ├──[BLACK]─────────────→ GND      │
  └──────────┘                       └──────────┘

  Back of PIR (adjustment pots):
  Sensitivity dial (left): turn right for more range
  Delay time dial (right): turn right for longer trigger
```

ARDUINO CODE:

```cpp
const int PIR_PIN = 2;
const int LED_PIN = 13;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);

  // Give sensor time to calibrate
  Serial.println("Calibrating PIR sensor... wait 30 seconds");
  delay(30000);
  Serial.println("Ready!");
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH) {
    Serial.println("Motion detected!");
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("No motion");
    digitalWrite(LED_PIN, LOW);
  }

  delay(100);
}
```

WARM-UP PROCEDURE:

1. Power on sensor
2. Wait 30-60 seconds for calibration
3. Don't move sensor during this time
4. After calibration, sensor ready to use

ADJUSTMENT: Sensitivity (left pot on back): - Turn clockwise = longer range (up to 7 meters) - Turn
counter-clockwise = shorter range - Adjust based on your use case

Delay (right pot on back): - Adjust how long output stays HIGH after motion detected - Typical: 3
seconds to 5 minutes

MODE JUMPER (usually set to "retriggerable"): - Single: one pulse per detection event -
Retriggerable (default): pulse resets while motion continues

TESTING:

1. Power on, wait 1 minute
2. Move in front of sensor
3. Should see "Motion detected!" in serial monitor
4. Stop moving, wait for delay timeout
5. Adjust sensitivity as needed

================================================================================ CIRCUIT 9:
TEMPERATURE & HUMIDITY SENSOR (DHT22)
================================================================================

Purpose: Read environmental temperature and humidity Difficulty: Beginner Time: 30 minutes
Components: Arduino Mega, DHT22 sensor, 4.7kΩ resistor, jumpers

CIRCUIT DIAGRAM:

```
Arduino Mega 2560                    DHT22 Sensor
  ┌──────────┐                       ┌──────────┐
  │ D6       ├──[YELLOW]────────────→ DATA    │
  │ 5V       ├──[RED]───────────────→ VCC     │
  │ GND      ├──[BLACK]─────────────→ GND     │
  └──────────┘                       └──────────┘

PULL-UP RESISTOR:
  4.7kΩ resistor between:
    - DHT DATA pin and VCC (5V)
    - Essential for reliable operation
```

ARDUINO CODE (using DHT library):

```cpp
#include <DHT.h>

const int DHT_PIN = 6;
const int DHT_TYPE = DHT22;

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  Serial.println("DHT22 initialized");
}

void loop() {
  // Must wait at least 2 seconds between readings
  delay(2000);

  // Read values
  float humidity = dht.readHumidity();
  float temp_c = dht.readTemperature();
  float temp_f = dht.readTemperature(true); // true = Fahrenheit

  // Check for errors
  if (isnan(humidity) || isnan(temp_c)) {
    Serial.println("Error reading DHT sensor!");
    return;
  }

  // Print results
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.print("%  Temperature: ");
  Serial.print(temp_c);
  Serial.print("°C (");
  Serial.print(temp_f);
  Serial.println("°F)");
}
```

LIBRARY INSTALLATION:

1. Arduino IDE → Sketch → Include Library → Manage Libraries
2. Search: "DHT"
3. Install: "DHT sensor library by Adafruit"

READING FREQUENCY: Maximum: 1 reading per 2 seconds Attempting faster reads will return NaN (not a
number) Always wait at least 2000ms between readings

PULL-UP RESISTOR: CRITICAL for reliable operation Without it: random NaN errors 4.7kΩ is standard
value (10kΩ also works) Alternative: Enable Arduino internal pull-up: pinMode(DHT_PIN,
INPUT_PULLUP);

DHT22 vs DHT11: DHT22: Better accuracy ±0.5°C DHT11: Cheaper but less accurate ±2°C Code works with
both (just change DHT_TYPE)

================================================================================ CIRCUIT 10: ANALOG
JOYSTICK INPUT ================================================================================

Purpose: Read joystick position for manual rover control Difficulty: Intermediate Time: 30 minutes
Components: Arduino Mega, analog joystick module, jumpers

CIRCUIT DIAGRAM:

```
Joystick Module                      Arduino Mega 2560
  ┌──────────┐                       ┌──────────┐
  │ +5V      ├──[RED]───────────────→ 5V      │
  │ GND      ├──[BLACK]─────────────→ GND     │
  │ VRx      ├──[YELLOW]────────────→ A0      │
  │ VRy      ├──[GREEN]─────────────→ A1      │
  │ SW       ├──[BLUE]──────────────→ D2      │
  └──────────┘                       └──────────┘
```

JOYSTICK OUTPUTS: VRx (X-axis): Analog value 0-1023 (straight left to right) VRy (Y-axis): Analog
value 0-1023 (straight forward to back) SW (Switch): Digital value (HIGH when not pressed, LOW when
pressed)

Center position (~512) is neutral Offset: center = 512, left = 0, right = 1023

ARDUINO CODE:

```cpp
const int JOY_X = A0;
const int JOY_Y = A1;
const int JOY_SW = 2;

void setup() {
  Serial.begin(9600);
  pinMode(JOY_SW, INPUT_PULLUP);
}

void loop() {
  // Read analog values
  int x_raw = analogRead(JOY_X);
  int y_raw = analogRead(JOY_Y);

  // Convert to centered values (-512 to +512)
  int x_centered = x_raw - 512;
  int y_centered = y_raw - 512;

  // Read button
  int button = digitalRead(JOY_SW);

  // Print raw and processed values
  Serial.print("X: ");
  Serial.print(x_centered);
  Serial.print("  Y: ");
  Serial.print(y_centered);
  Serial.print("  Button: ");
  Serial.println(button == LOW ? "Pressed" : "Released");

  // Use for motor control
  if (y_centered > 50) {
    // Joystick forward - move forward
  } else if (y_centered < -50) {
    // Joystick backward - move backward
  }

  if (x_centered > 50) {
    // Joystick right - turn right
  } else if (x_centered < -50) {
    // Joystick left - turn left
  }

  delay(50);
}
```

DEAD ZONE (IMPORTANT): Joysticks are rarely perfectly centered Without dead zone, rover drifts when
joystick released Solution: Only respond to movements > ±50 units from center

Code example: if (abs(x_centered) > 50) { // Respond to X movement }

INTEGRATION WITH MOTOR CONTROL: Map joystick Y to forward/reverse motor speed Map joystick X to
turning (differential speed to left/right motors) Use button for mode select (manual/autonomous) or
brake

CALIBRATION: If rover doesn't go straight forward with centered joystick: - Offset calibration:
subtract actual center value from reads - Example: if center reads 520 instead of 512, subtract 520

================================================================================ CIRCUIT 11: SERIAL
COMMUNICATION (ARDUINO TO COMPUTER)
================================================================================

Purpose: Communicate with computer via USB serial Difficulty: Beginner Time: 15 minutes Components:
Arduino Mega (USB already built-in)

CIRCUIT DIAGRAM:

```
Arduino Mega 2560
  ┌──────────────────┐
  │ USB Port         │
  │ (Micro B)        │──→ To Computer USB Port
  │                  │
  └──────────────────┘

  Internal connections (already on board):
  TX0 (pin 1) ─→ USB chip → Computer TX
  RX0 (pin 0) ← USB chip ← Computer RX
  GND ─→ USB chip ← GND
```

ARDUINO CODE:

```cpp
void setup() {
  Serial.begin(9600); // Open serial port at 9600 bps
  Serial.println("Arduino initialized!");
}

void loop() {
  // Send data to computer
  Serial.print("Sensor value: ");
  Serial.println(analogRead(A0));

  // Receive data from computer
  if (Serial.available() > 0) {
    char command = Serial.read();
    if (command == 'A') {
      Serial.println("Received command A");
    }
  }

  delay(100);
}
```

BAUD RATES (Common): 9600 → Reliable, standard for many modules 115200 → Fast, common for
ESP8266/ESP32 57600 → Mid-speed Must match on both Arduino and computer program

USING SERIAL MONITOR:

1. Arduino IDE → Tools → Serial Monitor
2. Select baud rate (must match Serial.begin())
3. Click Serial Monitor window
4. See data from Arduino
5. Type in input box to send data

TROUBLESHOOTING:

Problem: Serial Monitor shows garbage Fixes: - Check baud rate matches (both Serial.begin() and
monitor) - Press Arduino reset button - Try different baud rate - Check USB cable (some are
charge-only)

Problem: Code upload fails Fixes: - Check correct COM port selected - Close Serial Monitor (it locks
port during upload) - Try different USB port - Install driver (if on Windows, CH340 driver)

Problem: Can't see any data Fixes: - Verify Serial.begin() called in setup() - Verify Serial.print()
in loop() - Check baud rate again - Try unplugging/replugging USB

================================================================================ CIRCUIT 12: WIFI
COMMUNICATION (ESP8266 TO ARDUINO)
================================================================================

Purpose: Enable WiFi for remote rover control Difficulty: Advanced Time: 2+ hours (includes WiFi
setup) Components: Arduino Mega, ESP8266 (ESP-01 or NodeMCU), level shifter, wires

CIRCUIT DIAGRAM:

```
Arduino Mega 2560            Level Shifter             ESP8266
  ┌──────────┐              ┌──────────────┐          ┌──────────┐
  │ TX1 (18) ├──[5V]───────→ HV1           │         │          │
  │          │              │              ├─────────→ RX (3.3V) │
  │ RX1 (19) ├──[5V]────────┤ HV2          │         │          │
  │          │              │              │     ┌───→ TX (3.3V) │
  │ 5V       ├──[5V]───────→ HV_VCC        │     │   │          │
  │ GND      ├──────────────┤ GND ──────────┼─────┴───→ GND      │
  │          │              │              │         │          │
  │ 3.3V     ├──[5V]────┐   │              │         │          │
  │ regulator│          └──→ LV_VCC        │         │          │
  │          │              │              │    ┌────→ 3.3V      │
  │ GND      ├──────────────┤ GND ──────────┴────→ GND      │
  └──────────┘              └──────────────┘    └──────────┘

Manual Level Shifter (if no module):
  Arduino TX (5V)
        │
        ├─[1kΩ]──┬─→ ESP RX (3.3V)
        │        │
        │       [2kΩ]
        │        │
        └────────┴─ GND
```

POWER SUPPLY FOR ESP8266: Critical: Need stable 1A 3.3V supply Cannot use Arduino 3.3V regulator
(not enough current) Solutions: - AMS1117 3.3V regulator with capacitors - Commercial 5V-to-3.3V
converter - Separate 3.3V supply

CONNECTION STEPS:

1. Install Level Shifter Module
   - HV_VCC to Arduino 5V
   - LV_VCC to 3.3V supply
   - GND to common ground

2. Connect Arduino to Level Shifter
   - Arduino TX1 (pin 18) → Level shifter HV1
   - Arduino RX1 (pin 19) → Level shifter HV2
   - Arduino GND → Level shifter GND

3. Connect Level Shifter to ESP8266
   - Level shifter LV1 → ESP8266 RX
   - Level shifter LV2 → ESP8266 TX
   - Level shifter GND → ESP8266 GND

4. Power ESP8266
   - 3.3V supply → ESP8266 VCC (through capacitors)
   - GND → ESP8266 GND
   - CH_PD → 3.3V (enable pin)

5. Connect Arduino to Computer
   - USB for programming and power

ARDUINO CODE:

```cpp
#include <SoftwareSerial.h>

// Serial1 is hardware serial on pins 18,19 of Mega
// Use Serial1 for ESP8266, Serial for computer

void setup() {
  Serial.begin(115200);  // Computer communication
  Serial1.begin(115200); // ESP8266 communication (may need 9600)

  Serial.println("Arduino ready");
  Serial.println("Sending AT commands to ESP8266...");

  delay(2000); // Give ESP8266 time to boot
}

void loop() {
  // Forward data from computer to ESP8266
  if (Serial.available()) {
    char c = Serial.read();
    Serial1.write(c);
  }

  // Forward data from ESP8266 to computer
  if (Serial1.available()) {
    char c = Serial1.read();
    Serial.write(c);
  }
}
```

TESTING COMMUNICATION:

1. Upload code to Arduino
2. Open Serial Monitor (115200 baud)
3. Type: AT
4. Should see: OK
5. Type: AT+RST (reset ESP8266)
6. Should see boot messages
7. Continue with WiFi setup commands

IMPORTANT BAUD RATES: ESP8266 default: 115200 bps Some modules: 9600 bps May need to match in code
and serial monitor

WiFi SETUP COMMANDS (AT firmware): AT → Test connection AT+CWMODE=1 → Station mode (client)
AT+CWSSID="SSID","pass" → Connect to WiFi AT+CIFSR → Get IP address AT+CIPSTART="TCP","ip",port →
Connect to server

TROUBLESHOOTING:

Problem: No response to AT commands Fixes: - Check baud rate (try 9600 and 115200) - Verify ESP8266
RX/TX not swapped - Check 3.3V power supply (measure with multimeter) - Verify GPIO0 not held low
(prevents normal boot)

Problem: Garbage in serial monitor Fixes: - Baud rate mismatch - Try both 9600 and 115200

Problem: Level shifter not working Fixes: - Check HV_VCC and LV_VCC connections - Verify GND
connected - Test with simple LED circuit first

See 10_PROJECT_TEMPLATES.txt for complete WiFi rover project

================================================================================ CIRCUIT 13-15:
ADVANCED CIRCUITS ================================================================================

Circuits 13-15 (RFID reader integration, multi-sensor network, autonomous behavior) are detailed in
PROJECT_TEMPLATES.txt section 5-7

See: 10_PROJECT_TEMPLATES.txt for complete implementations

================================================================================ TROUBLESHOOTING
GUIDE BY SYMPTOM ================================================================================

NOTHING WORKS AT ALL Step 1: Check power - Multimeter voltage across GND and VCC (should be 5V for
mega) - Check USB cable is working (try different port/cable) - Verify Arduino accepts code uploads

Step 2: Check GND connections - Common ground between all components is CRITICAL - Use multimeter
continuity test - Check multiple GND points connected together

Step 3: Check component power - Measure voltage at each component - Should match expected voltage
(5V or 3.3V) - Check for loose wires

COMPONENT DOESN'T RESPOND

- Check pin connections (compare to pinout diagram)
- Verify correct pins used in Arduino code
- Use digitalWrite to test pin is working
- Check component isn't damaged

CODE UPLOADS FAIL

- Select correct board (Arduino Mega 2560)
- Select correct COM port
- Close Serial Monitor (locks port)
- Try different USB port
- Check USB cable (some are charge-only)

PARTIAL FUNCTIONALITY

- Check all GND connections
- Verify all power connections
- Test individual components one at a time
- Check for shorts (exposed wires touching)

================================================================================ END OF COMPLETE
WIRING GUIDE ================================================================================

Next steps:

1. Pick a circuit above
2. Follow wiring diagram carefully
3. Upload code from section or from 04_CODE_SNIPPETS_LIBRARY.txt
4. Test and troubleshoot
5. Extend or combine circuits

Cross-reference: 03_COMPREHENSIVE_PINOUTS.txt for detailed pin information
04_CODE_SNIPPETS_LIBRARY.txt for more code examples 07_SAFETY_AND_TROUBLESHOOTING.txt for safety
precautions 10_PROJECT_TEMPLATES.txt for complete projects
