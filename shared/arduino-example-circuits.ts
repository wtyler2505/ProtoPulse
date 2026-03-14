/**
 * Bundled circuit+code example library (BL-0628).
 *
 * Unlike `arduino-examples.ts` (code-only sketches modeled after Arduino IDE File > Examples),
 * this module provides complete project examples that pair compilable Arduino code with
 * wiring instructions, expected behavior descriptions, required libraries, and component lists.
 * Think of these as self-contained mini-projects a maker can follow end-to-end.
 *
 * Categories extend beyond the basic set: Basics, Digital, Analog, Sensors, Displays, Motors,
 * Communication, and IoT.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExampleCircuitCategory =
  | 'Basics'
  | 'Digital'
  | 'Analog'
  | 'Sensors'
  | 'Displays'
  | 'Motors'
  | 'Communication'
  | 'IoT';

export type ExampleCircuitDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ExampleCircuitComponent {
  name: string;
  value?: string;
  quantity: number;
}

export interface ExampleCircuit {
  /** Stable unique identifier (kebab-case). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Category for tree grouping. */
  category: ExampleCircuitCategory;
  /** Difficulty level. */
  difficulty: ExampleCircuitDifficulty;
  /** One-paragraph description of what this project does. */
  description: string;
  /** Step-by-step wiring instructions (plain text, one step per array element). */
  wiringNotes: string[];
  /** What the user should see/hear/measure when the sketch runs correctly. */
  expectedBehavior: string;
  /** Complete, compilable .ino source code. */
  code: string;
  /** Bill of materials (beyond the Arduino board itself). */
  components: ExampleCircuitComponent[];
  /** Arduino libraries that must be installed (empty array if none). */
  requiredLibraries: string[];
  /** Lowercase search tags. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const EXAMPLE_CIRCUIT_CATEGORIES: ExampleCircuitCategory[] = [
  'Basics',
  'Digital',
  'Analog',
  'Sensors',
  'Displays',
  'Motors',
  'Communication',
  'IoT',
];

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

export const EXAMPLE_CIRCUITS: ExampleCircuit[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    id: 'ec-blink-pattern',
    title: 'LED Blink Pattern',
    category: 'Basics',
    difficulty: 'beginner',
    description:
      'Blink three LEDs in a configurable chase pattern. A step beyond the single-LED blink — introduces arrays, loops, and timing constants you can tweak.',
    wiringNotes: [
      'Connect pin 2 through a 220 ohm resistor to the anode of a red LED, cathode to GND.',
      'Connect pin 3 through a 220 ohm resistor to the anode of a yellow LED, cathode to GND.',
      'Connect pin 4 through a 220 ohm resistor to the anode of a green LED, cathode to GND.',
    ],
    expectedBehavior:
      'The three LEDs light up one at a time in sequence (red, yellow, green) with a brief pause between each. The pattern repeats continuously.',
    components: [
      { name: 'LED', value: '5mm Red', quantity: 1 },
      { name: 'LED', value: '5mm Yellow', quantity: 1 },
      { name: 'LED', value: '5mm Green', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 3 },
    ],
    requiredLibraries: [],
    tags: ['led', 'digital', 'output', 'pattern', 'beginner', 'array'],
    code: `/*
  LED Blink Pattern — Chase three LEDs in sequence.
  Wiring: Pin 2→220R→Red LED→GND, Pin 3→220R→Yellow LED→GND, Pin 4→220R→Green LED→GND
*/

const int LED_PINS[] = {2, 3, 4};
const int LED_COUNT = 3;
const unsigned long STEP_MS = 250; // time each LED stays on

void setup() {
  for (int i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < LED_COUNT; i++) {
    // Turn on only the current LED
    for (int j = 0; j < LED_COUNT; j++) {
      digitalWrite(LED_PINS[j], j == i ? HIGH : LOW);
    }
    delay(STEP_MS);
  }
}
`,
  },
  {
    id: 'ec-pwm-breathing',
    title: 'Breathing LED',
    category: 'Basics',
    difficulty: 'beginner',
    description:
      'Smoothly fade an LED up and down using PWM, creating a "breathing" effect similar to a sleeping laptop indicator.',
    wiringNotes: [
      'Connect pin 9 (PWM) through a 220 ohm resistor to the anode of an LED.',
      'Connect the LED cathode to GND.',
    ],
    expectedBehavior:
      'The LED smoothly brightens from off to full brightness, then dims back to off, creating a gentle breathing rhythm.',
    components: [
      { name: 'LED', value: '5mm', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['led', 'pwm', 'analog', 'output', 'beginner', 'breathing'],
    code: `/*
  Breathing LED — Smooth sine-wave fade using PWM.
  Wiring: Pin 9 (PWM) → 220R → LED → GND
*/

const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // Fade up
  for (int brightness = 0; brightness <= 255; brightness++) {
    analogWrite(LED_PIN, brightness);
    delay(5);
  }
  // Fade down
  for (int brightness = 255; brightness >= 0; brightness--) {
    analogWrite(LED_PIN, brightness);
    delay(5);
  }
  delay(200); // brief pause at "off"
}
`,
  },

  // ── Digital ─────────────────────────────────────────────────────────────
  {
    id: 'ec-toggle-relay',
    title: 'Relay Toggle',
    category: 'Digital',
    difficulty: 'intermediate',
    description:
      'Toggle a relay module on and off with a pushbutton. Demonstrates digital I/O, debouncing, and controlling high-power loads safely.',
    wiringNotes: [
      'Connect pin 2 to one leg of a pushbutton; the other leg to GND (uses INPUT_PULLUP).',
      'Connect pin 7 to the IN pin of a relay module.',
      'Connect relay module VCC to 5V and GND to GND.',
      'The relay NO/COM terminals switch your external load (lamp, fan, etc.).',
    ],
    expectedBehavior:
      'Each button press toggles the relay. You should hear a click from the relay and see the relay indicator LED change state. Serial Monitor shows "Relay ON" or "Relay OFF".',
    components: [
      { name: 'Relay Module', value: '5V 1-channel', quantity: 1 },
      { name: 'Pushbutton', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['relay', 'button', 'digital', 'debounce', 'toggle', 'high-power'],
    code: `/*
  Relay Toggle — Button toggles a relay with debounce.
  Wiring: Pin 2 → Button → GND (INPUT_PULLUP), Pin 7 → Relay IN
*/

const int BUTTON_PIN = 2;
const int RELAY_PIN = 7;
const unsigned long DEBOUNCE_MS = 50;

bool relayState = false;
bool lastButtonState = HIGH;
unsigned long lastDebounce = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.begin(9600);
  Serial.println("Relay Toggle Ready");
}

void loop() {
  bool reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounce = millis();
  }

  if ((millis() - lastDebounce) > DEBOUNCE_MS) {
    if (reading == LOW && lastButtonState == HIGH) {
      relayState = !relayState;
      digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
      Serial.println(relayState ? "Relay ON" : "Relay OFF");
    }
  }

  lastButtonState = reading;
}
`,
  },
  {
    id: 'ec-state-machine',
    title: 'LED State Machine',
    category: 'Digital',
    difficulty: 'intermediate',
    description:
      'Cycle through four distinct states with a pushbutton: off, slow blink, fast blink, solid on. Introduces finite state machines in embedded programming.',
    wiringNotes: [
      'Connect pin 2 to one leg of a pushbutton; the other leg to GND (uses INPUT_PULLUP).',
      'Connect pin 13 through a 220 ohm resistor to an LED anode; cathode to GND.',
    ],
    expectedBehavior:
      'Each button press advances to the next state. State 0: LED off. State 1: slow blink (1Hz). State 2: fast blink (5Hz). State 3: solid on. After state 3, wraps back to state 0.',
    components: [
      { name: 'Pushbutton', quantity: 1 },
      { name: 'LED', value: '5mm', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['state-machine', 'button', 'led', 'digital', 'millis', 'non-blocking'],
    code: `/*
  LED State Machine — 4 modes cycled by button press.
  States: OFF → SLOW_BLINK → FAST_BLINK → SOLID → OFF ...
*/

const int BTN_PIN = 2;
const int LED_PIN = 13;
const unsigned long DEBOUNCE_MS = 50;

enum State { OFF, SLOW_BLINK, FAST_BLINK, SOLID };
State currentState = OFF;

bool lastBtn = HIGH;
unsigned long lastDebounce = 0;
unsigned long lastToggle = 0;
bool ledOn = false;

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("State: OFF");
}

void loop() {
  // --- Button handling ---
  bool btn = digitalRead(BTN_PIN);
  if (btn != lastBtn) lastDebounce = millis();
  if ((millis() - lastDebounce) > DEBOUNCE_MS && btn == LOW && lastBtn == HIGH) {
    currentState = (State)((currentState + 1) % 4);
    const char* names[] = {"OFF", "SLOW_BLINK", "FAST_BLINK", "SOLID"};
    Serial.print("State: ");
    Serial.println(names[currentState]);
  }
  lastBtn = btn;

  // --- LED output ---
  unsigned long now = millis();
  switch (currentState) {
    case OFF:
      digitalWrite(LED_PIN, LOW);
      break;
    case SLOW_BLINK:
      if (now - lastToggle >= 500) { ledOn = !ledOn; lastToggle = now; }
      digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
      break;
    case FAST_BLINK:
      if (now - lastToggle >= 100) { ledOn = !ledOn; lastToggle = now; }
      digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
      break;
    case SOLID:
      digitalWrite(LED_PIN, HIGH);
      break;
  }
}
`,
  },

  // ── Analog ──────────────────────────────────────────────────────────────
  {
    id: 'ec-voltage-meter',
    title: 'DIY Voltage Meter',
    category: 'Analog',
    difficulty: 'intermediate',
    description:
      'Read a voltage divider and display the measured voltage on the Serial Monitor. A practical intro to analog-to-digital conversion and voltage dividers.',
    wiringNotes: [
      'Build a voltage divider: connect two 10k ohm resistors in series from the test voltage to GND.',
      'Connect the junction (midpoint) of the divider to analog pin A0.',
      'The divider halves the input voltage so the Arduino can safely read up to ~10V.',
    ],
    expectedBehavior:
      'Serial Monitor shows the calculated input voltage updated once per second. For a 5V source the display should read approximately 5.00V.',
    components: [
      { name: 'Resistor', value: '10k ohm', quantity: 2 },
    ],
    requiredLibraries: [],
    tags: ['analog', 'voltage', 'divider', 'adc', 'measurement'],
    code: `/*
  DIY Voltage Meter — Read a voltage divider and display real voltage.
  Voltage divider: Vin → 10k → A0 → 10k → GND
  This halves the voltage so the 10-bit ADC (0-5V) can measure 0-10V.
*/

const int ANALOG_PIN = A0;
const float DIVIDER_RATIO = 2.0; // R1 = R2 = 10k → ratio = 2

void setup() {
  Serial.begin(9600);
  Serial.println("DIY Voltage Meter Ready");
  Serial.println("Measuring on A0 (voltage divider x2)");
}

void loop() {
  int raw = analogRead(ANALOG_PIN);
  float adcVoltage = raw * (5.0 / 1023.0);
  float inputVoltage = adcVoltage * DIVIDER_RATIO;

  Serial.print("ADC: ");
  Serial.print(raw);
  Serial.print("  Vadc: ");
  Serial.print(adcVoltage, 3);
  Serial.print("V  Vin: ");
  Serial.print(inputVoltage, 2);
  Serial.println("V");

  delay(1000);
}
`,
  },
  {
    id: 'ec-light-theremin',
    title: 'Light Theremin',
    category: 'Analog',
    difficulty: 'beginner',
    description:
      'Use a photoresistor to control the pitch of a piezo buzzer — wave your hand over the sensor to "play" sounds like a theremin.',
    wiringNotes: [
      '5V to one leg of the photoresistor. Other leg to A0 AND through a 10k ohm resistor to GND.',
      'Piezo buzzer positive leg to pin 8, negative leg to GND.',
    ],
    expectedBehavior:
      'The buzzer tone changes continuously as you cover or uncover the photoresistor. More light produces a higher pitch; less light produces a lower pitch.',
    components: [
      { name: 'Photoresistor (LDR)', quantity: 1 },
      { name: 'Resistor', value: '10k ohm', quantity: 1 },
      { name: 'Piezo Buzzer', value: 'Passive', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['analog', 'ldr', 'buzzer', 'tone', 'sound', 'theremin'],
    code: `/*
  Light Theremin — Photoresistor controls buzzer pitch.
  Wiring: 5V→LDR→A0→10k→GND, Buzzer(+)→Pin 8, Buzzer(-)→GND
*/

const int LDR_PIN = A0;
const int BUZZER_PIN = 8;
const int MIN_FREQ = 100;   // Hz at minimum light
const int MAX_FREQ = 2000;  // Hz at maximum light

void setup() {
  Serial.begin(9600);
  Serial.println("Light Theremin Ready — wave your hand over the sensor!");
}

void loop() {
  int lightValue = analogRead(LDR_PIN);
  int frequency = map(lightValue, 0, 1023, MIN_FREQ, MAX_FREQ);
  frequency = constrain(frequency, MIN_FREQ, MAX_FREQ);

  tone(BUZZER_PIN, frequency);

  Serial.print("Light: ");
  Serial.print(lightValue);
  Serial.print("  Freq: ");
  Serial.print(frequency);
  Serial.println(" Hz");

  delay(20);
}
`,
  },

  // ── Sensors ─────────────────────────────────────────────────────────────
  {
    id: 'ec-pir-motion-alarm',
    title: 'PIR Motion Alarm',
    category: 'Sensors',
    difficulty: 'beginner',
    description:
      'Detect motion with a PIR sensor and sound a buzzer alarm. The sensor has a ~1 minute warm-up time, then triggers on any movement in its field of view.',
    wiringNotes: [
      'PIR OUT pin to digital pin 2.',
      'PIR VCC to 5V, PIR GND to GND.',
      'Piezo buzzer positive to pin 8, negative to GND.',
      'LED anode through 220 ohm resistor to pin 13, cathode to GND.',
    ],
    expectedBehavior:
      'After a ~60 second warm-up, any movement triggers the buzzer and lights the LED for 3 seconds. Serial Monitor shows "Motion detected!" messages.',
    components: [
      { name: 'PIR Motion Sensor', value: 'HC-SR501', quantity: 1 },
      { name: 'Piezo Buzzer', value: 'Active', quantity: 1 },
      { name: 'LED', value: '5mm Red', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['pir', 'motion', 'sensor', 'alarm', 'buzzer', 'security'],
    code: `/*
  PIR Motion Alarm — Buzzer + LED activate on motion.
  Wiring: PIR OUT→Pin 2, Buzzer→Pin 8, LED→220R→Pin 13
*/

const int PIR_PIN = 2;
const int BUZZER_PIN = 8;
const int LED_PIN = 13;
const unsigned long ALARM_DURATION_MS = 3000;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("PIR Motion Alarm — warming up (~60s)...");
  delay(2000); // brief initial settle
  Serial.println("Ready!");
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH) {
    Serial.println("Motion detected!");
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000);
    delay(ALARM_DURATION_MS);
    noTone(BUZZER_PIN);
    digitalWrite(LED_PIN, LOW);
  }
  delay(200);
}
`,
  },
  {
    id: 'ec-soil-moisture',
    title: 'Soil Moisture Monitor',
    category: 'Sensors',
    difficulty: 'beginner',
    description:
      'Read a capacitive soil moisture sensor and categorize the reading as dry, moist, or wet. Great for automated plant watering projects.',
    wiringNotes: [
      'Sensor VCC to 3.3V (some modules accept 5V — check your module).',
      'Sensor GND to GND.',
      'Sensor analog output to A0.',
    ],
    expectedBehavior:
      'Serial Monitor prints the raw analog value and a label: DRY (below 400), MOIST (400-700), or WET (above 700). Values update every 2 seconds.',
    components: [
      { name: 'Capacitive Soil Moisture Sensor', value: 'v1.2 or v2.0', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['sensor', 'soil', 'moisture', 'analog', 'plant', 'garden'],
    code: `/*
  Soil Moisture Monitor — Categorize soil moisture level.
  Wiring: Sensor Vcc→3.3V, GND→GND, Aout→A0
*/

const int SENSOR_PIN = A0;
const int DRY_THRESHOLD = 400;
const int WET_THRESHOLD = 700;

void setup() {
  Serial.begin(9600);
  Serial.println("Soil Moisture Monitor Ready");
}

void loop() {
  int moisture = analogRead(SENSOR_PIN);

  Serial.print("Moisture: ");
  Serial.print(moisture);
  Serial.print(" — ");

  if (moisture < DRY_THRESHOLD) {
    Serial.println("DRY (needs water!)");
  } else if (moisture < WET_THRESHOLD) {
    Serial.println("MOIST (good)");
  } else {
    Serial.println("WET (saturated)");
  }

  delay(2000);
}
`,
  },
  {
    id: 'ec-ir-obstacle',
    title: 'IR Obstacle Detector',
    category: 'Sensors',
    difficulty: 'beginner',
    description:
      'Use an IR obstacle avoidance module to detect nearby objects. Lights an LED and prints distance status when an obstacle is within range.',
    wiringNotes: [
      'IR module VCC to 5V, GND to GND.',
      'IR module OUT to digital pin 3.',
      'LED anode through 220 ohm to pin 13, cathode to GND.',
      'Adjust the module potentiometer to set detection range (typically 2-30 cm).',
    ],
    expectedBehavior:
      'When an object is within the detection range, the LED turns on and Serial Monitor prints "OBSTACLE". When clear, the LED is off and it prints "CLEAR".',
    components: [
      { name: 'IR Obstacle Sensor Module', value: 'FC-51 or similar', quantity: 1 },
      { name: 'LED', value: '5mm', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['ir', 'obstacle', 'sensor', 'detection', 'proximity'],
    code: `/*
  IR Obstacle Detector — Digital obstacle detection with LED indicator.
  Wiring: IR OUT→Pin 3, LED→220R→Pin 13
  Module outputs LOW when obstacle detected (active-low).
*/

const int IR_PIN = 3;
const int LED_PIN = 13;

void setup() {
  pinMode(IR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("IR Obstacle Detector Ready");
}

void loop() {
  bool obstacle = (digitalRead(IR_PIN) == LOW); // active-low

  digitalWrite(LED_PIN, obstacle ? HIGH : LOW);
  Serial.println(obstacle ? "OBSTACLE" : "CLEAR");

  delay(200);
}
`,
  },

  // ── Displays ────────────────────────────────────────────────────────────
  {
    id: 'ec-oled-hello',
    title: 'OLED Hello World',
    category: 'Displays',
    difficulty: 'intermediate',
    description:
      'Display text and a pixel counter on a 128x64 I2C OLED (SSD1306). Shows how to use the Adafruit SSD1306 and GFX libraries.',
    wiringNotes: [
      'OLED SDA to A4 (Arduino Uno).',
      'OLED SCL to A5 (Arduino Uno).',
      'OLED VCC to 3.3V (some modules accept 5V — check yours).',
      'OLED GND to GND.',
    ],
    expectedBehavior:
      'The OLED displays "Hello ProtoPulse!" on the first line and a running counter on the second line, updating once per second.',
    components: [
      { name: 'OLED Display', value: '0.96in 128x64 I2C SSD1306', quantity: 1 },
    ],
    requiredLibraries: ['Adafruit SSD1306', 'Adafruit GFX Library'],
    tags: ['oled', 'display', 'i2c', 'ssd1306', 'text'],
    code: `/*
  OLED Hello World — SSD1306 128x64 I2C display.
  Wiring: SDA→A4, SCL→A5, VCC→3.3V, GND→GND
  Libraries: Adafruit SSD1306, Adafruit GFX Library
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

unsigned long counter = 0;

void setup() {
  Serial.begin(9600);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("SSD1306 allocation failed");
    for (;;); // halt
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Hello ProtoPulse!");
  display.display();
  Serial.println("OLED Ready");
}

void loop() {
  display.fillRect(0, 16, SCREEN_WIDTH, 16, SSD1306_BLACK);
  display.setCursor(0, 16);
  display.print("Count: ");
  display.print(counter);
  display.display();

  counter++;
  delay(1000);
}
`,
  },
  {
    id: 'ec-seven-segment',
    title: '7-Segment Counter',
    category: 'Displays',
    difficulty: 'intermediate',
    description:
      'Drive a common-cathode 7-segment display to count from 0-9 and repeat. Teaches bit-pattern mapping for segment displays.',
    wiringNotes: [
      'Connect segments a-g to pins 2-8 through 220 ohm resistors.',
      'Connect the common cathode to GND.',
      'Segment mapping: pin 2=a, pin 3=b, pin 4=c, pin 5=d, pin 6=e, pin 7=f, pin 8=g.',
    ],
    expectedBehavior:
      'The display counts from 0 to 9, pausing one second on each digit, then repeats.',
    components: [
      { name: '7-Segment Display', value: 'Common Cathode', quantity: 1 },
      { name: 'Resistor', value: '220 ohm', quantity: 7 },
    ],
    requiredLibraries: [],
    tags: ['seven-segment', 'display', 'digital', 'counter', 'bit-pattern'],
    code: `/*
  7-Segment Counter — Count 0-9 on a common-cathode 7-segment display.
  Segments a-g on pins 2-8 via 220R. Common cathode to GND.
*/

// Segment pins: a=2, b=3, c=4, d=5, e=6, f=7, g=8
const int SEG_PINS[] = {2, 3, 4, 5, 6, 7, 8};
const int SEG_COUNT = 7;

// Bit patterns for digits 0-9 (a,b,c,d,e,f,g)
const byte DIGITS[10] = {
  0b1111110, // 0
  0b0110000, // 1
  0b1101101, // 2
  0b1111001, // 3
  0b0110011, // 4
  0b1011011, // 5
  0b1011111, // 6
  0b1110000, // 7
  0b1111111, // 8
  0b1111011, // 9
};

void displayDigit(int digit) {
  byte pattern = DIGITS[digit];
  for (int i = 0; i < SEG_COUNT; i++) {
    digitalWrite(SEG_PINS[i], (pattern >> (6 - i)) & 1 ? HIGH : LOW);
  }
}

void setup() {
  for (int i = 0; i < SEG_COUNT; i++) {
    pinMode(SEG_PINS[i], OUTPUT);
  }
}

void loop() {
  for (int d = 0; d <= 9; d++) {
    displayDigit(d);
    delay(1000);
  }
}
`,
  },
  {
    id: 'ec-neopixel-rainbow',
    title: 'NeoPixel Rainbow',
    category: 'Displays',
    difficulty: 'intermediate',
    description:
      'Drive a strip of WS2812B (NeoPixel) addressable LEDs through a smooth rainbow cycle. Shows how to use the Adafruit NeoPixel library.',
    wiringNotes: [
      'NeoPixel data-in to pin 6 through a 330 ohm resistor.',
      'NeoPixel 5V to external 5V supply (not Arduino 5V for strips > 8 LEDs).',
      'NeoPixel GND to both Arduino GND and external supply GND.',
      'Place a 1000uF capacitor across the 5V supply near the strip.',
    ],
    expectedBehavior:
      'All LEDs display a smooth, continuously shifting rainbow pattern. The entire spectrum cycles approximately once every 5 seconds.',
    components: [
      { name: 'WS2812B LED Strip', value: '8+ LEDs', quantity: 1 },
      { name: 'Resistor', value: '330 ohm', quantity: 1 },
      { name: 'Capacitor', value: '1000uF electrolytic', quantity: 1 },
    ],
    requiredLibraries: ['Adafruit NeoPixel'],
    tags: ['neopixel', 'ws2812', 'led', 'rgb', 'rainbow', 'addressable'],
    code: `/*
  NeoPixel Rainbow — Smooth rainbow cycle on WS2812B strip.
  Wiring: Data→330R→Pin 6, 5V→External supply, GND→shared
  Library: Adafruit NeoPixel
*/

#include <Adafruit_NeoPixel.h>

#define LED_PIN 6
#define NUM_LEDS 8 // change to match your strip

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setBrightness(50); // 0-255, keep low for USB power
  strip.show();
}

// Convert a hue (0-65535) to a color
uint32_t wheel(uint16_t hue) {
  return strip.ColorHSV(hue, 255, 255);
}

long offset = 0;

void loop() {
  for (int i = 0; i < NUM_LEDS; i++) {
    uint16_t hue = (i * 65536L / NUM_LEDS + offset) % 65536;
    strip.setPixelColor(i, strip.gamma32(wheel(hue)));
  }
  strip.show();
  offset += 256;
  delay(20);
}
`,
  },

  // ── Motors ──────────────────────────────────────────────────────────────
  {
    id: 'ec-stepper-position',
    title: 'Stepper Motor Position',
    category: 'Motors',
    difficulty: 'intermediate',
    description:
      'Control a 28BYJ-48 stepper motor with a ULN2003 driver. Rotate precise amounts using the Stepper library — enter a number of steps via Serial to move.',
    wiringNotes: [
      'ULN2003 IN1→pin 8, IN2→pin 9, IN3→pin 10, IN4→pin 11.',
      'ULN2003 power jumper: connect to 5V and GND (external supply recommended for smooth operation).',
      'Motor connector plugs directly into the ULN2003 board.',
    ],
    expectedBehavior:
      'Open Serial Monitor and type a number of steps (positive = clockwise, negative = counterclockwise). The motor rotates that many steps. 2048 steps = one full revolution.',
    components: [
      { name: 'Stepper Motor', value: '28BYJ-48', quantity: 1 },
      { name: 'ULN2003 Driver Board', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['stepper', 'motor', 'position', 'uln2003', '28byj-48', 'serial'],
    code: `/*
  Stepper Motor Position — Serial-controlled 28BYJ-48 stepper.
  Wiring: ULN2003 IN1-IN4 → Pins 8-11
  Type number of steps in Serial Monitor. 2048 = one full revolution.
*/

#include <Stepper.h>

const int STEPS_PER_REV = 2048; // 28BYJ-48 in half-step mode
Stepper stepper(STEPS_PER_REV, 8, 10, 9, 11); // note pin order for ULN2003

void setup() {
  stepper.setSpeed(10); // RPM
  Serial.begin(9600);
  Serial.println("Stepper Motor Ready");
  Serial.println("Enter steps (2048=full rev, negative=reverse):");
}

void loop() {
  if (Serial.available() > 0) {
    int steps = Serial.parseInt();
    if (steps != 0) {
      Serial.print("Moving ");
      Serial.print(steps);
      Serial.println(" steps...");
      stepper.step(steps);
      Serial.println("Done.");
    }
  }
}
`,
  },
  {
    id: 'ec-esc-motor',
    title: 'ESC Motor Throttle',
    category: 'Motors',
    difficulty: 'advanced',
    description:
      'Control a brushless DC motor through an ESC using the Servo library. Includes an arming sequence and potentiometer throttle.',
    wiringNotes: [
      'ESC signal wire (usually white or yellow) to pin 9.',
      'ESC power wires to the battery (NOT through the Arduino).',
      'Potentiometer wiper to A0; outer pins to 5V and GND.',
      'IMPORTANT: Remove propellers before testing! Brushless motors are powerful.',
    ],
    expectedBehavior:
      'On startup the ESC arms (you may hear a series of beeps). After arming, turn the potentiometer to control motor speed from 0-100%. Serial Monitor shows the throttle percentage.',
    components: [
      { name: 'ESC', value: '30A', quantity: 1 },
      { name: 'Brushless Motor', quantity: 1 },
      { name: 'Potentiometer', value: '10k ohm', quantity: 1 },
      { name: 'LiPo Battery', value: '3S 11.1V (for motor)', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['esc', 'brushless', 'motor', 'servo', 'throttle', 'drone', 'advanced'],
    code: `/*
  ESC Motor Throttle — Brushless motor control via ESC + pot.
  Wiring: ESC signal→Pin 9, Pot wiper→A0
  SAFETY: Remove propellers before testing!
*/

#include <Servo.h>

Servo esc;
const int ESC_PIN = 9;
const int POT_PIN = A0;

void setup() {
  Serial.begin(9600);
  Serial.println("ESC Motor Throttle");
  Serial.println("SAFETY: Remove propellers!");

  esc.attach(ESC_PIN, 1000, 2000); // min/max pulse width in us

  // Arm ESC: send minimum throttle for 2 seconds
  Serial.println("Arming ESC...");
  esc.writeMicroseconds(1000);
  delay(2000);
  Serial.println("Armed. Turn pot to control speed.");
}

void loop() {
  int potValue = analogRead(POT_PIN);
  int throttle = map(potValue, 0, 1023, 1000, 2000);
  esc.writeMicroseconds(throttle);

  int percent = map(throttle, 1000, 2000, 0, 100);
  Serial.print("Throttle: ");
  Serial.print(percent);
  Serial.println("%");

  delay(50);
}
`,
  },

  // ── Communication ───────────────────────────────────────────────────────
  {
    id: 'ec-i2c-scanner',
    title: 'I2C Device Scanner',
    category: 'Communication',
    difficulty: 'beginner',
    description:
      'Scan the I2C bus and list all connected device addresses. Essential diagnostic tool when working with I2C sensors and displays.',
    wiringNotes: [
      'Connect your I2C device SDA to A4 (Uno) or the board SDA pin.',
      'Connect your I2C device SCL to A5 (Uno) or the board SCL pin.',
      'Both devices share 5V and GND.',
      'Most breakout boards have built-in pull-ups; if using bare ICs, add 4.7k ohm pull-ups on SDA and SCL to 3.3V.',
    ],
    expectedBehavior:
      'Serial Monitor prints the addresses (in hex) of all devices found on the I2C bus. Common addresses: 0x27 or 0x3F (LCD), 0x3C or 0x3D (OLED), 0x68 (MPU6050).',
    components: [],
    requiredLibraries: [],
    tags: ['i2c', 'scanner', 'diagnostic', 'wire', 'communication', 'address'],
    code: `/*
  I2C Device Scanner — Find all devices on the I2C bus.
  Wiring: SDA→A4, SCL→A5 (Arduino Uno)
*/

#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(9600);
  while (!Serial); // wait for USB serial
  Serial.println("I2C Scanner — scanning...");
}

void loop() {
  int devicesFound = 0;

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("Device found at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      devicesFound++;
    }
  }

  if (devicesFound == 0) {
    Serial.println("No I2C devices found.");
  } else {
    Serial.print(devicesFound);
    Serial.println(" device(s) found.");
  }

  Serial.println("---");
  delay(5000);
}
`,
  },
  {
    id: 'ec-spi-loopback',
    title: 'SPI Loopback Test',
    category: 'Communication',
    difficulty: 'intermediate',
    description:
      'Test the SPI bus by wiring MOSI to MISO and verifying that sent bytes are received back. A useful hardware-level diagnostic.',
    wiringNotes: [
      'Connect MOSI (pin 11) directly to MISO (pin 12) with a jumper wire.',
      'No other components needed — this is a self-test.',
    ],
    expectedBehavior:
      'Serial Monitor shows "Sent: 0xAB  Received: 0xAB  OK" for each test byte. If MOSI is not connected to MISO, received values will differ and show "FAIL".',
    components: [],
    requiredLibraries: [],
    tags: ['spi', 'loopback', 'test', 'diagnostic', 'communication'],
    code: `/*
  SPI Loopback Test — Wire MOSI→MISO to verify the SPI bus.
  Wiring: Connect pin 11 (MOSI) to pin 12 (MISO) with a jumper.
*/

#include <SPI.h>

void setup() {
  Serial.begin(9600);
  SPI.begin();
  Serial.println("SPI Loopback Test");
  Serial.println("Connect MOSI (11) to MISO (12)");
  Serial.println("---");
}

void loop() {
  byte testBytes[] = {0xAA, 0x55, 0xFF, 0x00, 0xAB, 0xCD};
  int passCount = 0;

  for (int i = 0; i < 6; i++) {
    byte received = SPI.transfer(testBytes[i]);
    bool ok = (received == testBytes[i]);
    if (ok) passCount++;

    Serial.print("Sent: 0x");
    Serial.print(testBytes[i], HEX);
    Serial.print("  Received: 0x");
    Serial.print(received, HEX);
    Serial.println(ok ? "  OK" : "  FAIL");
  }

  Serial.print("Result: ");
  Serial.print(passCount);
  Serial.println("/6 passed");
  Serial.println("---");

  delay(3000);
}
`,
  },

  // ── IoT ─────────────────────────────────────────────────────────────────
  {
    id: 'ec-wifi-web-server',
    title: 'WiFi Web Server',
    category: 'IoT',
    difficulty: 'intermediate',
    description:
      'Host a simple web page on an ESP32/ESP8266 that shows sensor readings. Access it from any browser on the same network.',
    wiringNotes: [
      'This sketch runs on ESP32 or ESP8266 boards (not Arduino Uno).',
      'Connect a potentiometer wiper to ADC pin (GPIO 34 on ESP32, A0 on ESP8266).',
      'Potentiometer outer pins to 3.3V and GND.',
    ],
    expectedBehavior:
      'Serial Monitor shows the IP address. Open that IP in a browser to see a web page displaying the current potentiometer reading, auto-refreshing every 2 seconds.',
    components: [
      { name: 'ESP32 or ESP8266 Board', quantity: 1 },
      { name: 'Potentiometer', value: '10k ohm', quantity: 1 },
    ],
    requiredLibraries: ['WiFi (built-in for ESP32)', 'ESP8266WiFi (for ESP8266)'],
    tags: ['wifi', 'web', 'server', 'esp32', 'esp8266', 'iot', 'http'],
    code: `/*
  WiFi Web Server — Serve sensor data as a web page.
  Board: ESP32 (change #include for ESP8266).
  Wiring: Pot wiper → GPIO 34 (ESP32) or A0 (ESP8266)
*/

#include <WiFi.h> // For ESP8266: #include <ESP8266WiFi.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASSWORD";
const int SENSOR_PIN = 34; // GPIO 34 on ESP32

WiFiServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  server.begin();
}

void loop() {
  WiFiClient client = server.available();
  if (!client) return;

  // Wait for request
  while (client.connected() && !client.available()) {
    delay(1);
  }

  String request = client.readStringUntil('\\r');
  client.flush();

  int sensorValue = analogRead(SENSOR_PIN);
  float voltage = sensorValue * (3.3 / 4095.0);

  // Send HTML response
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println();
  client.println("<!DOCTYPE html><html><head>");
  client.println("<meta http-equiv='refresh' content='2'>");
  client.println("<style>body{font-family:monospace;background:#1a1a2e;color:#0ff;padding:2em;}</style>");
  client.println("</head><body>");
  client.println("<h1>ProtoPulse Sensor Dashboard</h1>");
  client.print("<p>Analog: ");
  client.print(sensorValue);
  client.print(" &nbsp; Voltage: ");
  client.print(voltage, 2);
  client.println("V</p>");
  client.println("</body></html>");

  delay(1);
  client.stop();
}
`,
  },
  {
    id: 'ec-mqtt-publish',
    title: 'MQTT Sensor Publisher',
    category: 'IoT',
    difficulty: 'advanced',
    description:
      'Publish temperature readings to an MQTT broker from an ESP32. Pairs with any MQTT dashboard (Node-RED, Home Assistant, etc.).',
    wiringNotes: [
      'This sketch runs on an ESP32 board.',
      'LM35 or TMP36 sensor output to GPIO 34.',
      'Sensor VCC to 3.3V, GND to GND.',
    ],
    expectedBehavior:
      'The ESP32 connects to WiFi, then to the MQTT broker, and publishes temperature readings to "protopulse/temperature" every 5 seconds. Use an MQTT client (mosquitto_sub, MQTT Explorer) to see the messages.',
    components: [
      { name: 'ESP32 Board', quantity: 1 },
      { name: 'Temperature Sensor', value: 'LM35 or TMP36', quantity: 1 },
    ],
    requiredLibraries: ['PubSubClient', 'WiFi (built-in)'],
    tags: ['mqtt', 'iot', 'esp32', 'temperature', 'publish', 'broker'],
    code: `/*
  MQTT Sensor Publisher — ESP32 publishes temperature to MQTT.
  Libraries: PubSubClient, WiFi (built-in)
  Wiring: Sensor → GPIO 34
*/

#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* MQTT_SERVER = "broker.hivemq.com"; // free public broker
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "protopulse/temperature";

const int SENSOR_PIN = 34;

WiFiClient espClient;
PubSubClient mqtt(espClient);

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print(" connected: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("MQTT connecting...");
    if (mqtt.connect("protopulse-sensor")) {
      Serial.println(" connected!");
    } else {
      Serial.print(" failed (rc=");
      Serial.print(mqtt.state());
      Serial.println("). Retrying in 5s...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  connectWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  int raw = analogRead(SENSOR_PIN);
  float voltage = raw * (3.3 / 4095.0);
  float tempC = voltage / 0.01; // LM35: 10mV per degree

  char payload[32];
  snprintf(payload, sizeof(payload), "%.1f", tempC);

  mqtt.publish(MQTT_TOPIC, payload);
  Serial.print("Published: ");
  Serial.print(tempC, 1);
  Serial.println(" C");

  delay(5000);
}
`,
  },
  {
    id: 'ec-blynk-led',
    title: 'Remote LED Control',
    category: 'IoT',
    difficulty: 'intermediate',
    description:
      'Control an LED remotely over WiFi using a simple HTTP toggle endpoint on an ESP32. No external service required — the ESP32 IS the server.',
    wiringNotes: [
      'This sketch runs on an ESP32.',
      'LED anode through 220 ohm resistor to GPIO 2 (built-in LED on many ESP32 boards).',
      'LED cathode to GND (or just use the built-in LED).',
    ],
    expectedBehavior:
      'Serial Monitor shows the IP address. Visit http://<IP>/on to turn the LED on and http://<IP>/off to turn it off. The page shows the current LED state.',
    components: [
      { name: 'ESP32 Board', quantity: 1 },
      { name: 'LED', value: '5mm (optional, use built-in)', quantity: 1 },
      { name: 'Resistor', value: '220 ohm (optional)', quantity: 1 },
    ],
    requiredLibraries: ['WiFi (built-in)'],
    tags: ['wifi', 'iot', 'esp32', 'led', 'remote', 'http', 'control'],
    code: `/*
  Remote LED Control — Toggle LED via HTTP endpoints on ESP32.
  Visit http://<IP>/on or http://<IP>/off from any browser.
*/

#include <WiFi.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASSWORD";
const int LED_PIN = 2; // built-in LED on many ESP32 boards

WiFiServer server(80);
bool ledState = false;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  server.begin();
}

void loop() {
  WiFiClient client = server.available();
  if (!client) return;

  String request = "";
  while (client.connected() && client.available()) {
    request += (char)client.read();
    if (request.endsWith("\\r\\n\\r\\n")) break;
  }

  if (request.indexOf("GET /on") >= 0) {
    ledState = true;
    digitalWrite(LED_PIN, HIGH);
  } else if (request.indexOf("GET /off") >= 0) {
    ledState = false;
    digitalWrite(LED_PIN, LOW);
  }

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println();
  client.println("<!DOCTYPE html><html><head>");
  client.println("<style>body{font-family:monospace;background:#1a1a2e;color:#0ff;padding:2em;text-align:center;}");
  client.println("a{color:#0ff;font-size:2em;margin:1em;display:inline-block;}</style></head><body>");
  client.print("<h1>LED is ");
  client.print(ledState ? "ON" : "OFF");
  client.println("</h1>");
  client.println("<a href='/on'>Turn ON</a> | <a href='/off'>Turn OFF</a>");
  client.println("</body></html>");
  client.stop();
}
`,
  },

  // ── More Sensors ────────────────────────────────────────────────────────
  {
    id: 'ec-joystick',
    title: 'Analog Joystick',
    category: 'Sensors',
    difficulty: 'beginner',
    description:
      'Read X and Y axes plus the button from a dual-axis analog joystick module. Map readings to directional labels.',
    wiringNotes: [
      'Joystick VRx to A0, VRy to A1.',
      'Joystick SW (button) to digital pin 2 (use INPUT_PULLUP).',
      'Joystick VCC to 5V, GND to GND.',
    ],
    expectedBehavior:
      'Serial Monitor shows X, Y values (0-1023) and direction (UP, DOWN, LEFT, RIGHT, CENTER). Pressing the joystick button prints "BUTTON PRESSED".',
    components: [
      { name: 'Analog Joystick Module', value: 'KY-023 or similar', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['joystick', 'analog', 'sensor', 'input', 'gamepad', 'axis'],
    code: `/*
  Analog Joystick — Read X/Y axes and button, show direction.
  Wiring: VRx→A0, VRy→A1, SW→Pin 2 (INPUT_PULLUP), 5V, GND
*/

const int VRX_PIN = A0;
const int VRY_PIN = A1;
const int SW_PIN = 2;

const int CENTER = 512;
const int DEAD_ZONE = 100;

void setup() {
  pinMode(SW_PIN, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Joystick Ready");
}

void loop() {
  int x = analogRead(VRX_PIN);
  int y = analogRead(VRY_PIN);
  bool button = (digitalRead(SW_PIN) == LOW);

  Serial.print("X: ");
  Serial.print(x);
  Serial.print("  Y: ");
  Serial.print(y);
  Serial.print("  Dir: ");

  if (x < CENTER - DEAD_ZONE) Serial.print("LEFT");
  else if (x > CENTER + DEAD_ZONE) Serial.print("RIGHT");
  else if (y < CENTER - DEAD_ZONE) Serial.print("UP");
  else if (y > CENTER + DEAD_ZONE) Serial.print("DOWN");
  else Serial.print("CENTER");

  if (button) Serial.print(" [BUTTON]");
  Serial.println();

  delay(150);
}
`,
  },

  // ── More Communication ──────────────────────────────────────────────────
  {
    id: 'ec-serial-json',
    title: 'Serial JSON Protocol',
    category: 'Communication',
    difficulty: 'intermediate',
    description:
      'Send sensor readings as JSON over Serial. Perfect for pairing with ProtoPulse digital twin or any serial-parsing application.',
    wiringNotes: [
      'Potentiometer wiper to A0; outer pins to 5V and GND.',
      'LDR in voltage divider: 5V → LDR → A1 → 10k ohm → GND.',
      'No other connections needed — data goes over USB serial.',
    ],
    expectedBehavior:
      'Serial Monitor shows JSON objects like {"pot":512,"light":340,"uptime":5000} every 500ms. Any serial-reading application can parse these directly.',
    components: [
      { name: 'Potentiometer', value: '10k ohm', quantity: 1 },
      { name: 'Photoresistor (LDR)', quantity: 1 },
      { name: 'Resistor', value: '10k ohm', quantity: 1 },
    ],
    requiredLibraries: [],
    tags: ['serial', 'json', 'communication', 'protocol', 'telemetry'],
    code: `/*
  Serial JSON Protocol — Send sensor data as JSON lines.
  Wiring: Pot→A0, LDR voltage divider→A1
  Output format: {"pot":512,"light":340,"uptime":5000}
*/

const int POT_PIN = A0;
const int LDR_PIN = A1;

void setup() {
  Serial.begin(115200);
}

void loop() {
  int pot = analogRead(POT_PIN);
  int light = analogRead(LDR_PIN);
  unsigned long uptime = millis();

  // Manual JSON formatting (no library needed)
  Serial.print("{\"pot\":");
  Serial.print(pot);
  Serial.print(",\"light\":");
  Serial.print(light);
  Serial.print(",\"uptime\":");
  Serial.print(uptime);
  Serial.println("}");

  delay(500);
}
`,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All available circuit+code examples. */
export function getAllExampleCircuits(): ExampleCircuit[] {
  return EXAMPLE_CIRCUITS;
}

/** Filter by category. */
export function getExampleCircuitsByCategory(category: ExampleCircuitCategory): ExampleCircuit[] {
  return EXAMPLE_CIRCUITS.filter((c) => c.category === category);
}

/** Filter by difficulty. */
export function getExampleCircuitsByDifficulty(difficulty: ExampleCircuitDifficulty): ExampleCircuit[] {
  return EXAMPLE_CIRCUITS.filter((c) => c.difficulty === difficulty);
}

/** Search examples by title, description, tags, or wiring notes. Case-insensitive. */
export function searchExampleCircuits(query: string): ExampleCircuit[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return EXAMPLE_CIRCUITS;
  }
  return EXAMPLE_CIRCUITS.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q)) ||
      c.wiringNotes.some((n) => n.toLowerCase().includes(q)),
  );
}

/** Number of examples per category. */
export function getExampleCircuitCategoryCounts(): Record<ExampleCircuitCategory, number> {
  const counts = {} as Record<ExampleCircuitCategory, number>;
  for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
    counts[cat] = 0;
  }
  for (const ex of EXAMPLE_CIRCUITS) {
    counts[ex.category]++;
  }
  return counts;
}
