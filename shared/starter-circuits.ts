/**
 * Starter Circuits — Pre-built circuit definitions with complete, compilable Arduino code.
 *
 * Each circuit includes a bill of materials, learning objectives, and fully commented
 * Arduino sketches that beginners can flash immediately. Designed for instant gratification:
 * pick a circuit, wire it up, upload the code, and see results.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StarterCategory = 'basics' | 'sensors' | 'displays' | 'motors' | 'communication';
export type StarterDifficulty = 'beginner' | 'intermediate';
export type StarterBoardType = 'uno' | 'nano' | 'mega';

export interface StarterComponent {
  name: string;
  value?: string;
  quantity: number;
}

export interface StarterCircuit {
  id: string;
  name: string;
  description: string;
  category: StarterCategory;
  difficulty: StarterDifficulty;
  arduinoCode: string;
  components: StarterComponent[];
  learningObjectives: string[];
  boardType: StarterBoardType;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Circuit Definitions
// ---------------------------------------------------------------------------

const STARTER_CIRCUITS: StarterCircuit[] = [
  // -----------------------------------------------------------------------
  // 1. LED Blink
  // -----------------------------------------------------------------------
  {
    id: 'starter-led-blink',
    name: 'LED Blink',
    description: 'The classic "Hello World" of electronics. Blink an LED on and off every second using digital output.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['led', 'digital', 'output', 'blink', 'beginner'],
    components: [
      { name: 'LED', value: '5mm Red', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Understand digital output with digitalWrite()',
      'Learn about current-limiting resistors for LEDs',
      'Use delay() for timing',
    ],
    arduinoCode: `// LED Blink — The classic first Arduino project
// Wiring: Pin 13 → 220Ω resistor → LED anode (+) → LED cathode (-) → GND

const int LED_PIN = 13;  // Built-in LED also on pin 13

void setup() {
  // Set the LED pin as an output
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // Turn LED on (5V)
  delay(1000);                  // Wait 1 second
  digitalWrite(LED_PIN, LOW);   // Turn LED off (0V)
  delay(1000);                  // Wait 1 second
}
`,
  },

  // -----------------------------------------------------------------------
  // 2. Traffic Light
  // -----------------------------------------------------------------------
  {
    id: 'starter-traffic-light',
    name: 'Traffic Light',
    description: 'Simulate a traffic light with three LEDs cycling through red, yellow, and green with realistic timing.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['led', 'digital', 'output', 'traffic', 'sequence'],
    components: [
      { name: 'LED', value: '5mm Red', quantity: 1 },
      { name: 'LED', value: '5mm Yellow', quantity: 1 },
      { name: 'LED', value: '5mm Green', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 3 },
    ],
    learningObjectives: [
      'Control multiple digital outputs simultaneously',
      'Create timed sequences with delay()',
      'Understand how real-world systems map to code',
    ],
    arduinoCode: `// Traffic Light — Three LEDs cycling red → green → yellow → red
// Wiring:
//   Pin 4 → 220Ω → Red LED → GND
//   Pin 3 → 220Ω → Yellow LED → GND
//   Pin 2 → 220Ω → Green LED → GND

const int RED_PIN    = 4;
const int YELLOW_PIN = 3;
const int GREEN_PIN  = 2;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
}

// Helper: turn off all LEDs
void allOff() {
  digitalWrite(RED_PIN, LOW);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
}

void loop() {
  // Red phase (stop) — 5 seconds
  allOff();
  digitalWrite(RED_PIN, HIGH);
  delay(5000);

  // Green phase (go) — 4 seconds
  allOff();
  digitalWrite(GREEN_PIN, HIGH);
  delay(4000);

  // Yellow phase (caution) — 2 seconds
  allOff();
  digitalWrite(YELLOW_PIN, HIGH);
  delay(2000);
}
`,
  },

  // -----------------------------------------------------------------------
  // 3. Button Input
  // -----------------------------------------------------------------------
  {
    id: 'starter-button-input',
    name: 'Button Input',
    description: 'Read a pushbutton and toggle an LED. Learn digital input with internal pull-up resistors.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['button', 'digital', 'input', 'led', 'pull-up'],
    components: [
      { name: 'Pushbutton', quantity: 1 },
      { name: 'LED', value: '5mm Red', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Read digital input with digitalRead()',
      'Use INPUT_PULLUP to simplify wiring (no external pull-up resistor needed)',
      'Debounce a mechanical switch in software',
    ],
    arduinoCode: `// Button Input — Press a button to toggle an LED on/off
// Wiring:
//   Pin 2 → one leg of pushbutton; other leg → GND
//   Pin 13 → 220Ω → LED → GND
// Using INPUT_PULLUP so no external pull-up resistor is needed.

const int BUTTON_PIN = 2;
const int LED_PIN    = 13;

bool ledState = false;          // Current LED state
bool lastButtonState = HIGH;    // Previous button reading (HIGH = not pressed with pull-up)
unsigned long lastDebounce = 0; // Timestamp of last state change
const unsigned long DEBOUNCE_MS = 50;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Internal pull-up: reads HIGH when open
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  bool reading = digitalRead(BUTTON_PIN);

  // If the button state changed, reset the debounce timer
  if (reading != lastButtonState) {
    lastDebounce = millis();
  }

  // If the reading has been stable for DEBOUNCE_MS, accept it
  if ((millis() - lastDebounce) > DEBOUNCE_MS) {
    // Detect falling edge (button press with pull-up)
    if (reading == LOW && lastButtonState == HIGH) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    }
  }

  lastButtonState = reading;
}
`,
  },

  // -----------------------------------------------------------------------
  // 4. Potentiometer
  // -----------------------------------------------------------------------
  {
    id: 'starter-potentiometer',
    name: 'Potentiometer Reader',
    description: 'Read an analog potentiometer value and print it to the Serial Monitor. Introduction to analog input.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['analog', 'input', 'serial', 'potentiometer'],
    components: [
      { name: 'Potentiometer', value: '10k\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Use analogRead() to read a 10-bit value (0-1023)',
      'Map analog values to meaningful ranges with map()',
      'Print data to the Serial Monitor for debugging',
    ],
    arduinoCode: `// Potentiometer Reader — Read analog input and display on Serial Monitor
// Wiring:
//   Pot left pin  → 5V
//   Pot wiper pin → A0
//   Pot right pin → GND

const int POT_PIN = A0;

void setup() {
  Serial.begin(9600);  // Start serial communication at 9600 baud
  Serial.println("Potentiometer Reader Ready!");
}

void loop() {
  int rawValue = analogRead(POT_PIN);  // Read 10-bit ADC (0-1023)

  // Map to a percentage (0-100%) for easier understanding
  int percent = map(rawValue, 0, 1023, 0, 100);

  // Map to voltage (0.00 - 5.00V)
  float voltage = rawValue * (5.0 / 1023.0);

  Serial.print("Raw: ");
  Serial.print(rawValue);
  Serial.print("  |  ");
  Serial.print(percent);
  Serial.print("%  |  ");
  Serial.print(voltage, 2);  // 2 decimal places
  Serial.println("V");

  delay(200);  // Read 5 times per second
}
`,
  },

  // -----------------------------------------------------------------------
  // 5. RGB LED
  // -----------------------------------------------------------------------
  {
    id: 'starter-rgb-led',
    name: 'RGB LED Color Mixer',
    description: 'Mix colors with a common-cathode RGB LED using PWM. Cycle through rainbow hues automatically.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['led', 'rgb', 'pwm', 'analog', 'output', 'color'],
    components: [
      { name: 'RGB LED', value: 'Common Cathode', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 3 },
    ],
    learningObjectives: [
      'Use analogWrite() for PWM output (0-255)',
      'Understand RGB color mixing',
      'Learn about PWM pins (marked with ~ on Arduino)',
    ],
    arduinoCode: `// RGB LED Color Mixer — Smoothly cycle through rainbow colors
// Wiring (Common Cathode RGB LED):
//   Pin 9  → 220Ω → Red leg
//   Pin 10 → 220Ω → Green leg
//   Pin 11 → 220Ω → Blue leg
//   Longest leg (cathode) → GND

const int RED_PIN   = 9;   // PWM pin
const int GREEN_PIN = 10;  // PWM pin
const int BLUE_PIN  = 11;  // PWM pin

// Set RGB color using analogWrite (0-255 per channel)
void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  // Red → Yellow (increase green)
  for (int i = 0; i <= 255; i++) { setColor(255, i, 0); delay(5); }
  // Yellow → Green (decrease red)
  for (int i = 255; i >= 0; i--) { setColor(i, 255, 0); delay(5); }
  // Green → Cyan (increase blue)
  for (int i = 0; i <= 255; i++) { setColor(0, 255, i); delay(5); }
  // Cyan → Blue (decrease green)
  for (int i = 255; i >= 0; i--) { setColor(0, i, 255); delay(5); }
  // Blue → Magenta (increase red)
  for (int i = 0; i <= 255; i++) { setColor(i, 0, 255); delay(5); }
  // Magenta → Red (decrease blue)
  for (int i = 255; i >= 0; i--) { setColor(255, 0, i); delay(5); }
}
`,
  },

  // -----------------------------------------------------------------------
  // 6. Servo Sweep
  // -----------------------------------------------------------------------
  {
    id: 'starter-servo-sweep',
    name: 'Servo Sweep',
    description: 'Sweep a servo motor back and forth from 0 to 180 degrees. Great intro to motor control.',
    category: 'motors',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['servo', 'motor', 'pwm', 'sweep', 'library'],
    components: [
      { name: 'Servo Motor', value: 'SG90 or similar', quantity: 1 },
    ],
    learningObjectives: [
      'Use the Servo library to control hobby servos',
      'Understand servo angles (0-180 degrees)',
      'Learn about PWM signal generation for motor control',
    ],
    arduinoCode: `// Servo Sweep — Sweep a servo motor from 0° to 180° and back
// Wiring:
//   Servo signal (orange/yellow) → Pin 9
//   Servo power  (red)           → 5V
//   Servo ground (brown/black)   → GND
// Note: For larger servos, use an external power supply (not USB 5V).

#include <Servo.h>

Servo myServo;           // Create a Servo object
const int SERVO_PIN = 9;

void setup() {
  myServo.attach(SERVO_PIN);  // Attach the servo to pin 9
  Serial.begin(9600);
  Serial.println("Servo Sweep Ready!");
}

void loop() {
  // Sweep from 0° to 180°
  for (int angle = 0; angle <= 180; angle++) {
    myServo.write(angle);    // Move to this angle
    Serial.print("Angle: ");
    Serial.println(angle);
    delay(15);               // Wait for the servo to reach the position
  }

  // Sweep from 180° back to 0°
  for (int angle = 180; angle >= 0; angle--) {
    myServo.write(angle);
    Serial.print("Angle: ");
    Serial.println(angle);
    delay(15);
  }
}
`,
  },

  // -----------------------------------------------------------------------
  // 7. Temperature Sensor (LM35)
  // -----------------------------------------------------------------------
  {
    id: 'starter-temperature-lm35',
    name: 'Temperature Sensor',
    description: 'Read temperature from an LM35 sensor and display Celsius and Fahrenheit on the Serial Monitor.',
    category: 'sensors',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['sensor', 'temperature', 'analog', 'lm35', 'serial'],
    components: [
      { name: 'LM35 Temperature Sensor', quantity: 1 },
    ],
    learningObjectives: [
      'Convert analog readings to real-world units (voltage → temperature)',
      'Understand sensor calibration and datasheet specifications',
      'Format serial output for human-readable display',
    ],
    arduinoCode: `// Temperature Sensor — Read LM35 and display °C and °F
// Wiring:
//   LM35 pin 1 (Vs)   → 5V
//   LM35 pin 2 (Vout) → A0
//   LM35 pin 3 (GND)  → GND
// The LM35 outputs 10mV per °C (e.g., 250mV = 25.0°C).

const int SENSOR_PIN = A0;

void setup() {
  // Use the internal 1.1V reference for better resolution
  // (gives ~0.1°C resolution instead of ~0.5°C with 5V ref)
  analogReference(INTERNAL);
  Serial.begin(9600);
  Serial.println("LM35 Temperature Sensor Ready!");
  Serial.println("---");
}

void loop() {
  int rawValue = analogRead(SENSOR_PIN);

  // With INTERNAL 1.1V reference:
  // Voltage = rawValue * (1.1 / 1024.0)
  // Temperature = Voltage / 0.01  (LM35 outputs 10mV/°C)
  float voltage = rawValue * (1.1 / 1024.0);
  float tempC = voltage / 0.01;
  float tempF = (tempC * 9.0 / 5.0) + 32.0;

  Serial.print("Temperature: ");
  Serial.print(tempC, 1);
  Serial.print(" °C  |  ");
  Serial.print(tempF, 1);
  Serial.println(" °F");

  delay(1000);  // Read once per second
}
`,
  },

  // -----------------------------------------------------------------------
  // 8. Ultrasonic Distance Sensor (HC-SR04)
  // -----------------------------------------------------------------------
  {
    id: 'starter-ultrasonic-hcsr04',
    name: 'Ultrasonic Distance',
    description: 'Measure distance with an HC-SR04 ultrasonic sensor. Calculates centimeters from echo time.',
    category: 'sensors',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['sensor', 'ultrasonic', 'distance', 'hcsr04', 'serial'],
    components: [
      { name: 'HC-SR04 Ultrasonic Sensor', quantity: 1 },
    ],
    learningObjectives: [
      'Use pulseIn() to measure signal duration',
      'Convert time-of-flight to distance using speed of sound',
      'Understand trigger/echo pin protocols',
    ],
    arduinoCode: `// Ultrasonic Distance — HC-SR04 measures distance in centimeters
// Wiring:
//   HC-SR04 VCC  → 5V
//   HC-SR04 Trig → Pin 9
//   HC-SR04 Echo → Pin 10
//   HC-SR04 GND  → GND
// Range: ~2cm to ~400cm

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
  Serial.println("HC-SR04 Ultrasonic Sensor Ready!");
}

float measureDistanceCm() {
  // Send a 10µs HIGH pulse on the trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Measure how long the echo pin stays HIGH (in µs)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout

  if (duration == 0) {
    return -1.0;  // No echo received (out of range)
  }

  // Speed of sound = 343 m/s = 0.0343 cm/µs
  // Distance = (duration * 0.0343) / 2  (round trip)
  return (duration * 0.0343) / 2.0;
}

void loop() {
  float distance = measureDistanceCm();

  if (distance < 0) {
    Serial.println("Out of range!");
  } else {
    Serial.print("Distance: ");
    Serial.print(distance, 1);
    Serial.println(" cm");
  }

  delay(250);  // Measure 4 times per second
}
`,
  },

  // -----------------------------------------------------------------------
  // 9. LCD Hello World (I2C)
  // -----------------------------------------------------------------------
  {
    id: 'starter-lcd-i2c',
    name: 'LCD Hello World',
    description: 'Display text on a 16x2 I2C LCD. Shows a welcome message and a running counter.',
    category: 'displays',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['lcd', 'i2c', 'display', '16x2', 'library'],
    components: [
      { name: 'LCD Display', value: '16x2 with I2C backpack', quantity: 1 },
    ],
    learningObjectives: [
      'Use the LiquidCrystal_I2C library for I2C communication',
      'Understand I2C addressing (typically 0x27 or 0x3F)',
      'Position cursor and print text on LCD',
    ],
    arduinoCode: `// LCD Hello World — Display text on a 16x2 I2C LCD
// Wiring (I2C backpack):
//   LCD SDA → A4 (Arduino Uno SDA)
//   LCD SCL → A5 (Arduino Uno SCL)
//   LCD VCC → 5V
//   LCD GND → GND
// Note: I2C address is usually 0x27. If blank, try 0x3F.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Initialize LCD: address 0x27, 16 columns, 2 rows
LiquidCrystal_I2C lcd(0x27, 16, 2);

unsigned long counter = 0;

void setup() {
  lcd.init();       // Initialize the LCD
  lcd.backlight();  // Turn on the backlight

  // Display welcome message on line 1
  lcd.setCursor(0, 0);         // Column 0, Row 0
  lcd.print("Hello, World!");

  Serial.begin(9600);
  Serial.println("LCD Ready! If blank, try address 0x3F.");
}

void loop() {
  // Update counter on line 2
  lcd.setCursor(0, 1);          // Column 0, Row 1
  lcd.print("Count: ");
  lcd.print(counter);
  lcd.print("     ");           // Clear trailing characters

  counter++;
  delay(500);
}
`,
  },

  // -----------------------------------------------------------------------
  // 10. Photoresistor (LDR)
  // -----------------------------------------------------------------------
  {
    id: 'starter-photoresistor',
    name: 'Photoresistor Light Meter',
    description: 'Build a light sensor with a photoresistor (LDR) and control LED brightness based on ambient light.',
    category: 'sensors',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['sensor', 'ldr', 'analog', 'led', 'pwm', 'light'],
    components: [
      { name: 'Photoresistor (LDR)', quantity: 1 },
      { name: 'Resistor', value: '10k\u03A9', quantity: 1 },
      { name: 'LED', value: '5mm', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Build a voltage divider circuit for analog sensors',
      'Map analog input to PWM output',
      'Create responsive hardware feedback loops',
    ],
    arduinoCode: `// Photoresistor Light Meter — LED brightens as room gets darker
// Wiring:
//   5V → LDR → A0 → 10kΩ → GND  (voltage divider)
//   Pin 9 → 220Ω → LED → GND
// In bright light: LDR resistance is low, A0 reads high → dim LED
// In darkness: LDR resistance is high, A0 reads low → bright LED

const int LDR_PIN = A0;
const int LED_PIN = 9;   // PWM pin

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Light Meter Ready!");
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);  // 0 (dark) to 1023 (bright)

  // Invert: more light = dimmer LED, less light = brighter LED
  int brightness = map(lightLevel, 0, 1023, 255, 0);
  brightness = constrain(brightness, 0, 255);

  analogWrite(LED_PIN, brightness);

  Serial.print("Light: ");
  Serial.print(lightLevel);
  Serial.print("  |  LED: ");
  Serial.println(brightness);

  delay(100);
}
`,
  },

  // -----------------------------------------------------------------------
  // 11. Buzzer Melody
  // -----------------------------------------------------------------------
  {
    id: 'starter-buzzer-melody',
    name: 'Buzzer Melody',
    description: 'Play a simple melody through a piezo buzzer using tone(). A fun intro to sound generation.',
    category: 'basics',
    difficulty: 'beginner',
    boardType: 'uno',
    tags: ['buzzer', 'piezo', 'tone', 'music', 'sound'],
    components: [
      { name: 'Piezo Buzzer', value: 'Passive', quantity: 1 },
    ],
    learningObjectives: [
      'Generate sound with tone() and noTone()',
      'Use arrays to store sequences of data',
      'Understand frequency and musical notes',
    ],
    arduinoCode: `// Buzzer Melody — Play "Twinkle Twinkle Little Star" on a piezo buzzer
// Wiring:
//   Buzzer (+) → Pin 8
//   Buzzer (-) → GND
// Uses a PASSIVE buzzer (active buzzers only beep at one frequency).

const int BUZZER_PIN = 8;

// Note frequencies in Hz (0 = rest/silence)
#define NOTE_C4  262
#define NOTE_D4  294
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_G4  392
#define NOTE_A4  440
#define NOTE_REST 0

// Melody: "Twinkle Twinkle Little Star"
const int melody[] = {
  NOTE_C4, NOTE_C4, NOTE_G4, NOTE_G4, NOTE_A4, NOTE_A4, NOTE_G4,
  NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4, NOTE_D4, NOTE_C4,
  NOTE_G4, NOTE_G4, NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4,
  NOTE_G4, NOTE_G4, NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4,
  NOTE_C4, NOTE_C4, NOTE_G4, NOTE_G4, NOTE_A4, NOTE_A4, NOTE_G4,
  NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4, NOTE_D4, NOTE_C4,
};

// Note durations: 4 = quarter note, 2 = half note
const int durations[] = {
  4, 4, 4, 4, 4, 4, 2,
  4, 4, 4, 4, 4, 4, 2,
  4, 4, 4, 4, 4, 4, 2,
  4, 4, 4, 4, 4, 4, 2,
  4, 4, 4, 4, 4, 4, 2,
  4, 4, 4, 4, 4, 4, 2,
};

const int TEMPO = 1200;  // milliseconds for a whole note
const int NOTE_COUNT = sizeof(melody) / sizeof(melody[0]);

void setup() {
  Serial.begin(9600);
  Serial.println("Playing Twinkle Twinkle Little Star...");
}

void loop() {
  for (int i = 0; i < NOTE_COUNT; i++) {
    int noteDuration = TEMPO / durations[i];

    if (melody[i] == NOTE_REST) {
      noTone(BUZZER_PIN);
    } else {
      tone(BUZZER_PIN, melody[i], noteDuration);
    }

    // Pause between notes (30% of note duration)
    delay(noteDuration * 1.3);
    noTone(BUZZER_PIN);
  }

  delay(2000);  // Pause before repeating
}
`,
  },

  // -----------------------------------------------------------------------
  // 12. DC Motor Control
  // -----------------------------------------------------------------------
  {
    id: 'starter-dc-motor',
    name: 'DC Motor Speed Control',
    description: 'Control a DC motor speed with a potentiometer via a transistor. Learn about transistor switching and PWM.',
    category: 'motors',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['motor', 'dc', 'transistor', 'pwm', 'speed', 'potentiometer'],
    components: [
      { name: 'DC Motor', value: 'Small 3-6V', quantity: 1 },
      { name: 'NPN Transistor', value: 'TIP120 or 2N2222', quantity: 1 },
      { name: 'Diode', value: '1N4007 (flyback)', quantity: 1 },
      { name: 'Resistor', value: '1k\u03A9', quantity: 1 },
      { name: 'Potentiometer', value: '10k\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Use a transistor as a switch for high-current loads',
      'Understand flyback diodes for inductive loads',
      'Map analog input to PWM output for speed control',
    ],
    arduinoCode: `// DC Motor Speed Control — Pot controls motor speed via transistor
// Wiring:
//   Potentiometer wiper → A0 (outer pins to 5V and GND)
//   Pin 9 → 1kΩ → TIP120 Base
//   TIP120 Collector → Motor (−) terminal
//   TIP120 Emitter → GND
//   Motor (+) → External 5V supply (+)
//   1N4007 diode across motor terminals (cathode stripe toward +)
//
// IMPORTANT: Power the motor from an external supply, NOT the Arduino 5V pin.
// The flyback diode protects the transistor from voltage spikes when the motor stops.

const int POT_PIN   = A0;
const int MOTOR_PIN = 9;   // PWM pin → transistor base via 1kΩ

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("DC Motor Speed Control Ready!");
}

void loop() {
  int potValue = analogRead(POT_PIN);              // 0-1023
  int speed = map(potValue, 0, 1023, 0, 255);      // Map to PWM range
  analogWrite(MOTOR_PIN, speed);                    // Set motor speed

  int percent = map(speed, 0, 255, 0, 100);
  Serial.print("Speed: ");
  Serial.print(percent);
  Serial.println("%");

  delay(100);
}
`,
  },

  // -----------------------------------------------------------------------
  // 13. IR Remote Receiver
  // -----------------------------------------------------------------------
  {
    id: 'starter-ir-remote',
    name: 'IR Remote Receiver',
    description: 'Decode infrared remote control signals. Press buttons on any IR remote to see their codes.',
    category: 'communication',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['ir', 'infrared', 'remote', 'receiver', 'decode', 'communication'],
    components: [
      { name: 'IR Receiver Module', value: 'VS1838B or TSOP1738', quantity: 1 },
      { name: 'LED', value: '5mm', quantity: 1 },
      { name: 'Resistor', value: '220\u03A9', quantity: 1 },
    ],
    learningObjectives: [
      'Use the IRremote library for infrared communication',
      'Understand IR signal encoding (NEC, Sony, RC5 protocols)',
      'Decode and react to specific remote buttons',
    ],
    arduinoCode: `// IR Remote Receiver — Decode IR remote control signals
// Wiring:
//   IR Receiver OUT → Pin 11
//   IR Receiver VCC → 5V
//   IR Receiver GND → GND
//   Pin 13 → 220Ω → LED → GND  (toggles with power button)
//
// Install library: Sketch → Include Library → Manage → search "IRremote"

#include <IRremote.hpp>

const int IR_PIN  = 11;
const int LED_PIN = 13;
bool ledState = false;

void setup() {
  Serial.begin(9600);
  Serial.println("IR Remote Receiver Ready!");
  Serial.println("Point any IR remote at the sensor and press buttons.");
  Serial.println("---");

  IrReceiver.begin(IR_PIN, ENABLE_LED_FEEDBACK);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (IrReceiver.decode()) {
    // Print the decoded value
    Serial.print("Protocol: ");
    Serial.print(getProtocolString(IrReceiver.decodedIRData.protocol));
    Serial.print("  |  Code: 0x");
    Serial.print(IrReceiver.decodedIRData.decodedRawData, HEX);
    Serial.print("  |  Command: 0x");
    Serial.println(IrReceiver.decodedIRData.command, HEX);

    // Toggle LED on any button press (ignore repeats)
    if (!(IrReceiver.decodedIRData.flags & IRDATA_FLAGS_IS_REPEAT)) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    }

    IrReceiver.resume();  // Ready to receive the next signal
  }
}
`,
  },

  // -----------------------------------------------------------------------
  // 14. DHT11 Humidity & Temperature
  // -----------------------------------------------------------------------
  {
    id: 'starter-dht11',
    name: 'DHT11 Humidity & Temperature',
    description: 'Read temperature and humidity from a DHT11 sensor. Displays both values with a comfort indicator.',
    category: 'sensors',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['sensor', 'dht11', 'temperature', 'humidity', 'library'],
    components: [
      { name: 'DHT11 Sensor', quantity: 1 },
      { name: 'Resistor', value: '10k\u03A9 (pull-up)', quantity: 1 },
    ],
    learningObjectives: [
      'Use the DHT library for one-wire digital sensors',
      'Read multiple values from a single sensor',
      'Implement data quality checks (NaN detection)',
    ],
    arduinoCode: `// DHT11 Humidity & Temperature — Read ambient conditions
// Wiring:
//   DHT11 pin 1 (VCC)  → 5V
//   DHT11 pin 2 (Data) → Pin 2, also → 10kΩ pull-up to 5V
//   DHT11 pin 3 (NC)   → not connected (if 4-pin module)
//   DHT11 pin 4 (GND)  → GND
// 3-pin modules have the pull-up built in — skip the 10kΩ.
//
// Install library: Sketch → Include Library → Manage → search "DHT sensor library"

#include <DHT.h>

const int DHT_PIN = 2;
#define DHT_TYPE DHT11   // Change to DHT22 for the more accurate sensor

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(9600);
  Serial.println("DHT11 Sensor Ready!");
  Serial.println("---");
  dht.begin();
}

void loop() {
  // DHT11 needs ~2 seconds between readings
  delay(2000);

  float humidity    = dht.readHumidity();         // Relative humidity (%)
  float tempC       = dht.readTemperature();      // Celsius
  float tempF       = dht.readTemperature(true);  // Fahrenheit

  // Check for read errors
  if (isnan(humidity) || isnan(tempC)) {
    Serial.println("Error: Failed to read from DHT sensor!");
    return;
  }

  // Heat index (feels-like temperature)
  float heatIndexC = dht.computeHeatIndex(tempC, humidity, false);

  Serial.print("Temp: ");
  Serial.print(tempC, 1);
  Serial.print(" °C (");
  Serial.print(tempF, 1);
  Serial.print(" °F)  |  Humidity: ");
  Serial.print(humidity, 0);
  Serial.print("%  |  Feels like: ");
  Serial.print(heatIndexC, 1);
  Serial.print(" °C  |  ");

  // Comfort indicator
  if (humidity >= 30 && humidity <= 60 && tempC >= 20 && tempC <= 26) {
    Serial.println("Comfortable");
  } else {
    Serial.println("Uncomfortable");
  }
}
`,
  },

  // -----------------------------------------------------------------------
  // 15. LED Shift Register (74HC595)
  // -----------------------------------------------------------------------
  {
    id: 'starter-shift-register',
    name: 'LED Shift Register',
    description: 'Control 8 LEDs with just 3 Arduino pins using a 74HC595 shift register. Learn SPI-like communication.',
    category: 'displays',
    difficulty: 'intermediate',
    boardType: 'uno',
    tags: ['shift-register', '74hc595', 'led', 'spi', 'digital', 'output'],
    components: [
      { name: '74HC595 Shift Register', quantity: 1 },
      { name: 'LED', value: '5mm', quantity: 8 },
      { name: 'Resistor', value: '220\u03A9', quantity: 8 },
    ],
    learningObjectives: [
      'Expand digital outputs using a shift register',
      'Understand serial-to-parallel data conversion',
      'Use shiftOut() for SPI-like bit-banging',
    ],
    arduinoCode: `// LED Shift Register — 8 LEDs controlled by 3 pins via 74HC595
// Wiring:
//   74HC595 pin 14 (SER/Data)  → Arduino Pin 11
//   74HC595 pin 12 (RCLK/Latch) → Arduino Pin 8
//   74HC595 pin 11 (SRCLK/Clock) → Arduino Pin 12
//   74HC595 pin 16 (VCC) → 5V
//   74HC595 pin 8  (GND) → GND
//   74HC595 pin 13 (OE)  → GND (always enabled)
//   74HC595 pin 10 (SRCLR) → 5V (never clear)
//   74HC595 outputs Q0-Q7 (pins 15, 1-7) → 220Ω → LED → GND

const int DATA_PIN  = 11;  // SER  (Serial data in)
const int LATCH_PIN = 8;   // RCLK (Register clock / latch)
const int CLOCK_PIN = 12;  // SRCLK (Shift register clock)

// Send a byte to the shift register (updates all 8 outputs at once)
void updateShiftRegister(byte data) {
  digitalWrite(LATCH_PIN, LOW);               // Hold latch low while shifting
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, data); // Shift out 8 bits
  digitalWrite(LATCH_PIN, HIGH);              // Latch the data to outputs
}

void setup() {
  pinMode(DATA_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  updateShiftRegister(0);  // All LEDs off
  Serial.begin(9600);
  Serial.println("Shift Register Ready!");
}

void loop() {
  // Pattern 1: Light LEDs one at a time (chase)
  for (int i = 0; i < 8; i++) {
    updateShiftRegister(1 << i);  // Shift a 1 to position i
    delay(150);
  }

  // Pattern 2: Fill from left to right
  for (int i = 0; i < 8; i++) {
    updateShiftRegister((0xFF << (7 - i)) & 0xFF);
    delay(150);
  }

  // Pattern 3: Binary counter (0-255)
  for (int i = 0; i <= 255; i++) {
    updateShiftRegister(i);
    delay(50);
  }

  // All off briefly
  updateShiftRegister(0);
  delay(500);
}
`,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All available starter circuits. */
export function getAllStarterCircuits(): StarterCircuit[] {
  return STARTER_CIRCUITS;
}

/** Filter by category. */
export function getStarterCircuitsByCategory(category: StarterCategory): StarterCircuit[] {
  return STARTER_CIRCUITS.filter((c) => c.category === category);
}

/** Filter by difficulty. */
export function getStarterCircuitsByDifficulty(difficulty: StarterDifficulty): StarterCircuit[] {
  return STARTER_CIRCUITS.filter((c) => c.difficulty === difficulty);
}

/** Search circuits by name, description, or tags. Case-insensitive. */
export function searchStarterCircuits(query: string): StarterCircuit[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return STARTER_CIRCUITS;
  }
  return STARTER_CIRCUITS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q)),
  );
}

/** All distinct categories used by the starter circuits. */
export const STARTER_CATEGORIES: StarterCategory[] = ['basics', 'sensors', 'displays', 'motors', 'communication'];

/** All distinct difficulty levels. */
export const STARTER_DIFFICULTIES: StarterDifficulty[] = ['beginner', 'intermediate'];
