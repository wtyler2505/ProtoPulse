/**
 * Built-in Arduino example sketches for the Examples Browser.
 * Organized by category with actual compilable Arduino code.
 */

export interface ArduinoExample {
  id: string;
  title: string;
  category: ArduinoExampleCategory;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  code: string;
  tags: string[];
}

export type ArduinoExampleCategory =
  | 'Basics'
  | 'Digital'
  | 'Analog'
  | 'Communication'
  | 'Sensors'
  | 'Display'
  | 'Motors';

export const ARDUINO_EXAMPLE_CATEGORIES: ArduinoExampleCategory[] = [
  'Basics',
  'Digital',
  'Analog',
  'Communication',
  'Sensors',
  'Display',
  'Motors',
];

export const ARDUINO_EXAMPLES: ArduinoExample[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    id: 'blink',
    title: 'Blink',
    category: 'Basics',
    description: 'Turn an LED on and off every second. The classic Arduino "Hello World".',
    difficulty: 'beginner',
    tags: ['led', 'digital', 'output', 'beginner'],
    code: `/*
  Blink
  Turns the built-in LED on for one second, then off for one second, repeatedly.
*/

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`,
  },
  {
    id: 'bare-minimum',
    title: 'BareMinimum',
    category: 'Basics',
    description: 'The bare minimum code needed to get started — just setup() and loop().',
    difficulty: 'beginner',
    tags: ['template', 'starter', 'beginner'],
    code: `/*
  BareMinimum
  The minimum code structure for an Arduino sketch.
*/

void setup() {
  // put your setup code here, to run once:
}

void loop() {
  // put your main code here, to run repeatedly:
}
`,
  },
  {
    id: 'fade',
    title: 'Fade',
    category: 'Basics',
    description: 'Fades an LED in and out using analogWrite (PWM).',
    difficulty: 'beginner',
    tags: ['led', 'pwm', 'analog', 'output', 'beginner'],
    code: `/*
  Fade
  Fades an LED on pin 9 using analogWrite().
*/

int led = 9;
int brightness = 0;
int fadeAmount = 5;

void setup() {
  pinMode(led, OUTPUT);
}

void loop() {
  analogWrite(led, brightness);
  brightness = brightness + fadeAmount;
  if (brightness <= 0 || brightness >= 255) {
    fadeAmount = -fadeAmount;
  }
  delay(30);
}
`,
  },

  // ── Digital ─────────────────────────────────────────────────────────────
  {
    id: 'digital-read-serial',
    title: 'DigitalReadSerial',
    category: 'Digital',
    description: 'Read a digital input on pin 2 and print the result to the Serial Monitor.',
    difficulty: 'beginner',
    tags: ['digital', 'input', 'serial', 'button'],
    code: `/*
  DigitalReadSerial
  Reads a digital input on pin 2, prints the result to the Serial Monitor.
  Attach a pushbutton to pin 2 with a 10k pull-down resistor.
*/

int pushButton = 2;

void setup() {
  Serial.begin(9600);
  pinMode(pushButton, INPUT);
}

void loop() {
  int buttonState = digitalRead(pushButton);
  Serial.println(buttonState);
  delay(1);
}
`,
  },
  {
    id: 'button',
    title: 'Button',
    category: 'Digital',
    description: 'Use a pushbutton to control an LED.',
    difficulty: 'beginner',
    tags: ['button', 'led', 'digital', 'input', 'output'],
    code: `/*
  Button
  Turns on the LED when the button is pressed.
  Connect pushbutton to pin 2, LED to pin 13.
*/

const int buttonPin = 2;
const int ledPin = 13;
int buttonState = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT);
}

void loop() {
  buttonState = digitalRead(buttonPin);
  if (buttonState == HIGH) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
`,
  },
  {
    id: 'debounce',
    title: 'Debounce',
    category: 'Digital',
    description: 'Debounce a pushbutton to avoid false triggers from contact bounce.',
    difficulty: 'intermediate',
    tags: ['button', 'debounce', 'digital', 'timing'],
    code: `/*
  Debounce
  Each time the input pin goes from LOW to HIGH (button press),
  the output pin is toggled. Debouncing prevents false triggers.
*/

const int buttonPin = 2;
const int ledPin = 13;

int ledState = HIGH;
int buttonState;
int lastButtonState = LOW;

unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;

void setup() {
  pinMode(buttonPin, INPUT);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, ledState);
}

void loop() {
  int reading = digitalRead(buttonPin);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == HIGH) {
        ledState = !ledState;
      }
    }
  }

  digitalWrite(ledPin, ledState);
  lastButtonState = reading;
}
`,
  },

  // ── Analog ──────────────────────────────────────────────────────────────
  {
    id: 'analog-read-serial',
    title: 'AnalogReadSerial',
    category: 'Analog',
    description: 'Read an analog input (potentiometer) and print it to the Serial Monitor.',
    difficulty: 'beginner',
    tags: ['analog', 'input', 'serial', 'potentiometer'],
    code: `/*
  AnalogReadSerial
  Reads an analog input on pin A0, prints the result to the Serial Monitor.
  Connect a potentiometer's center pin to A0.
*/

void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  Serial.println(sensorValue);
  delay(1);
}
`,
  },
  {
    id: 'analog-in-out-serial',
    title: 'AnalogInOutSerial',
    category: 'Analog',
    description: 'Read an analog input, map it to a PWM output, and print both values.',
    difficulty: 'beginner',
    tags: ['analog', 'pwm', 'map', 'serial'],
    code: `/*
  AnalogInOutSerial
  Reads analog input on A0, maps it to an output range for PWM on pin 9.
*/

const int analogInPin = A0;
const int analogOutPin = 9;

int sensorValue = 0;
int outputValue = 0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  sensorValue = analogRead(analogInPin);
  outputValue = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(analogOutPin, outputValue);

  Serial.print("sensor = ");
  Serial.print(sensorValue);
  Serial.print("\\t output = ");
  Serial.println(outputValue);
  delay(2);
}
`,
  },
  {
    id: 'smoothing',
    title: 'Smoothing',
    category: 'Analog',
    description: 'Smooth analog readings by averaging multiple samples.',
    difficulty: 'intermediate',
    tags: ['analog', 'filter', 'averaging', 'noise'],
    code: `/*
  Smoothing
  Reads repeatedly from an analog input, calculates a running average,
  and prints it to the Serial Monitor.
*/

const int numReadings = 10;
int readings[numReadings];
int readIndex = 0;
int total = 0;
int average = 0;

int inputPin = A0;

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < numReadings; i++) {
    readings[i] = 0;
  }
}

void loop() {
  total = total - readings[readIndex];
  readings[readIndex] = analogRead(inputPin);
  total = total + readings[readIndex];
  readIndex = readIndex + 1;

  if (readIndex >= numReadings) {
    readIndex = 0;
  }

  average = total / numReadings;
  Serial.println(average);
  delay(1);
}
`,
  },

  // ── Communication ───────────────────────────────────────────────────────
  {
    id: 'serial-read',
    title: 'SerialRead',
    category: 'Communication',
    description: 'Read incoming serial data and echo it back.',
    difficulty: 'beginner',
    tags: ['serial', 'communication', 'input'],
    code: `/*
  SerialRead
  Reads incoming serial data byte-by-byte and echoes it back.
*/

void setup() {
  Serial.begin(9600);
  Serial.println("Type something and press Enter:");
}

void loop() {
  if (Serial.available() > 0) {
    char incomingByte = Serial.read();
    Serial.print("Received: ");
    Serial.println(incomingByte);
  }
}
`,
  },
  {
    id: 'serial-passthrough',
    title: 'SerialPassthrough',
    category: 'Communication',
    description: 'Pass data between the hardware serial and software serial ports.',
    difficulty: 'intermediate',
    tags: ['serial', 'communication', 'software-serial'],
    code: `/*
  SerialPassthrough
  Passes data between Serial (USB) and Serial1 (hardware serial pins 0/1).
  Useful for communicating with modules like Bluetooth or WiFi.
  Note: Only works on boards with multiple hardware serial ports.
*/

void setup() {
  Serial.begin(9600);
  Serial1.begin(9600);
}

void loop() {
  if (Serial.available()) {
    Serial1.write(Serial.read());
  }
  if (Serial1.available()) {
    Serial.write(Serial1.read());
  }
}
`,
  },
  {
    id: 'ascii-table',
    title: 'ASCIITable',
    category: 'Communication',
    description: 'Print the ASCII character table to the Serial Monitor.',
    difficulty: 'beginner',
    tags: ['serial', 'ascii', 'characters'],
    code: `/*
  ASCII Table
  Prints the ASCII table (characters 33 to 126).
*/

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    ; // wait for serial port to connect
  }

  Serial.println("ASCII Table ~ Character Map");
}

int thisByte = 33;

void loop() {
  Serial.write(thisByte);
  Serial.print(", dec: ");
  Serial.print(thisByte);
  Serial.print(", hex: ");
  Serial.print(thisByte, HEX);
  Serial.print(", oct: ");
  Serial.print(thisByte, OCT);
  Serial.print(", bin: ");
  Serial.println(thisByte, BIN);

  if (thisByte == 126) {
    while (true) {
      continue;
    }
  }
  thisByte++;
}
`,
  },

  // ── Sensors ─────────────────────────────────────────────────────────────
  {
    id: 'knock',
    title: 'Knock Sensor',
    category: 'Sensors',
    description: 'Detect knocks using a piezo sensor. Lights an LED when a knock exceeds a threshold.',
    difficulty: 'intermediate',
    tags: ['piezo', 'sensor', 'threshold', 'led'],
    code: `/*
  Knock
  Reads a piezo element on analog pin A0.
  If the knock exceeds a threshold, the LED turns on.
*/

const int ledPin = 13;
const int knockSensor = A0;
const int threshold = 100;

int sensorReading = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  sensorReading = analogRead(knockSensor);

  if (sensorReading >= threshold) {
    Serial.print("Knock! Value: ");
    Serial.println(sensorReading);
    digitalWrite(ledPin, HIGH);
    delay(100);
    digitalWrite(ledPin, LOW);
  }
  delay(10);
}
`,
  },
  {
    id: 'temp-sensor',
    title: 'Temperature Sensor',
    category: 'Sensors',
    description: 'Read temperature from a TMP36 sensor and convert to Celsius and Fahrenheit.',
    difficulty: 'intermediate',
    tags: ['temperature', 'sensor', 'tmp36', 'conversion'],
    code: `/*
  Temperature Sensor (TMP36)
  Reads a TMP36 temperature sensor on analog pin A0.
  Converts reading to Celsius and Fahrenheit.
*/

const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorVal = analogRead(sensorPin);
  // Convert ADC reading to voltage (5V reference, 10-bit ADC)
  float voltage = (sensorVal / 1024.0) * 5.0;
  // TMP36: 750mV at 25C, 10mV per degree
  float temperatureC = (voltage - 0.5) * 100.0;
  float temperatureF = (temperatureC * 9.0 / 5.0) + 32.0;

  Serial.print("Voltage: ");
  Serial.print(voltage);
  Serial.print("  Temp C: ");
  Serial.print(temperatureC);
  Serial.print("  Temp F: ");
  Serial.println(temperatureF);
  delay(1000);
}
`,
  },

  // ── Display ─────────────────────────────────────────────────────────────
  {
    id: 'bar-graph',
    title: 'BarGraph',
    category: 'Display',
    description: 'Map an analog input value to a row of LEDs as a bar graph.',
    difficulty: 'intermediate',
    tags: ['led', 'bar-graph', 'analog', 'display'],
    code: `/*
  LED Bar Graph
  Maps an analog input value to a row of 10 LEDs.
  Connect LEDs to pins 2 through 11.
*/

const int analogPin = A0;
const int ledCount = 10;
int ledPins[] = { 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 };

void setup() {
  for (int i = 0; i < ledCount; i++) {
    pinMode(ledPins[i], OUTPUT);
  }
}

void loop() {
  int sensorReading = analogRead(analogPin);
  int ledLevel = map(sensorReading, 0, 1023, 0, ledCount);

  for (int i = 0; i < ledCount; i++) {
    if (i < ledLevel) {
      digitalWrite(ledPins[i], HIGH);
    } else {
      digitalWrite(ledPins[i], LOW);
    }
  }
}
`,
  },
  {
    id: 'row-column-scan',
    title: 'LED Matrix Scan',
    category: 'Display',
    description: 'Control an 8x8 LED matrix by scanning rows and columns.',
    difficulty: 'advanced',
    tags: ['led', 'matrix', 'display', 'scanning'],
    code: `/*
  Row-Column Scanning of an 8x8 LED matrix
  Demonstrates multiplexing technique for controlling many LEDs.
  Rows on pins 2-9, columns on pins 10-17.
*/

const int row[8] = { 2, 3, 4, 5, 6, 7, 8, 9 };
const int col[8] = { 10, 11, 12, 13, A0, A1, A2, A3 };

// Smiley face pattern
byte patterns[8] = {
  B00111100,
  B01000010,
  B10100101,
  B10000001,
  B10100101,
  B10011001,
  B01000010,
  B00111100
};

void setup() {
  for (int i = 0; i < 8; i++) {
    pinMode(row[i], OUTPUT);
    pinMode(col[i], OUTPUT);
    digitalWrite(row[i], LOW);
    digitalWrite(col[i], HIGH);
  }
}

void loop() {
  for (int r = 0; r < 8; r++) {
    digitalWrite(row[r], HIGH);
    for (int c = 0; c < 8; c++) {
      if (patterns[r] & (1 << (7 - c))) {
        digitalWrite(col[c], LOW);
      }
    }
    delayMicroseconds(800);
    for (int c = 0; c < 8; c++) {
      digitalWrite(col[c], HIGH);
    }
    digitalWrite(row[r], LOW);
  }
}
`,
  },

  // ── Motors ──────────────────────────────────────────────────────────────
  {
    id: 'servo-sweep',
    title: 'Servo Sweep',
    category: 'Motors',
    description: 'Sweep a servo motor back and forth across 180 degrees.',
    difficulty: 'beginner',
    tags: ['servo', 'motor', 'sweep', 'pwm'],
    code: `/*
  Servo Sweep
  Sweeps a servo motor from 0 to 180 degrees and back.
  Requires the Servo library.
*/

#include <Servo.h>

Servo myservo;
int pos = 0;

void setup() {
  myservo.attach(9);
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) {
    myservo.write(pos);
    delay(15);
  }
  for (pos = 180; pos >= 0; pos -= 1) {
    myservo.write(pos);
    delay(15);
  }
}
`,
  },
  {
    id: 'servo-knob',
    title: 'Servo Knob',
    category: 'Motors',
    description: 'Control a servo motor position with a potentiometer.',
    difficulty: 'beginner',
    tags: ['servo', 'motor', 'potentiometer', 'analog'],
    code: `/*
  Servo Knob
  Controls a servo position using a potentiometer.
  Potentiometer on A0, servo on pin 9.
*/

#include <Servo.h>

Servo myservo;
int potpin = A0;
int val;

void setup() {
  myservo.attach(9);
}

void loop() {
  val = analogRead(potpin);
  val = map(val, 0, 1023, 0, 180);
  myservo.write(val);
  delay(15);
}
`,
  },
  {
    id: 'dc-motor-control',
    title: 'DC Motor Control',
    category: 'Motors',
    description: 'Control a DC motor speed and direction using an H-bridge (L298N or L293D).',
    difficulty: 'intermediate',
    tags: ['motor', 'dc', 'h-bridge', 'pwm', 'direction'],
    code: `/*
  DC Motor Control
  Controls a DC motor via an H-bridge driver (L298N or L293D).
  ENA (speed) on pin 9, IN1 on pin 8, IN2 on pin 7.
*/

const int enablePin = 9;
const int in1Pin = 8;
const int in2Pin = 7;

void setup() {
  pinMode(enablePin, OUTPUT);
  pinMode(in1Pin, OUTPUT);
  pinMode(in2Pin, OUTPUT);
  Serial.begin(9600);
  Serial.println("DC Motor Control");
  Serial.println("Commands: f=forward, r=reverse, s=stop, 0-9=speed");
}

void setMotor(int speed, bool forward) {
  digitalWrite(in1Pin, forward ? HIGH : LOW);
  digitalWrite(in2Pin, forward ? LOW : HIGH);
  analogWrite(enablePin, speed);
}

void loop() {
  static int motorSpeed = 200;
  static bool motorForward = true;

  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'f') {
      motorForward = true;
      Serial.println("Forward");
    } else if (cmd == 'r') {
      motorForward = false;
      Serial.println("Reverse");
    } else if (cmd == 's') {
      motorSpeed = 0;
      Serial.println("Stop");
    } else if (cmd >= '0' && cmd <= '9') {
      motorSpeed = map(cmd - '0', 0, 9, 0, 255);
      Serial.print("Speed: ");
      Serial.println(motorSpeed);
    }
  }

  setMotor(motorSpeed, motorForward);
  delay(50);
}
`,
  },
];
