/**
 * Component Code Snippets — Arduino/embedded code snippets for common components.
 *
 * Provides a searchable library of ready-to-use Arduino code snippets organized
 * by component type. Each snippet includes setup(), loop(), pin definitions,
 * required library #includes, and descriptive metadata. The `generateSetupCode`
 * function merges multiple snippets into a single compilable sketch.
 *
 * Designed for ProtoPulse's maker-first philosophy: a beginner who just placed
 * an LED or a servo on the schematic should be one click away from working code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeSnippet {
  /** Unique identifier (kebab-case). */
  readonly id: string;
  /** Component type this snippet is associated with (e.g. 'led', 'servo', 'dht22'). */
  readonly componentType: string;
  /** Human-readable title. */
  readonly title: string;
  /** Arduino/C++ code for the snippet body (setup + loop sections). */
  readonly code: string;
  /** Pin names referenced in the code (e.g. ['LED_PIN', 'BUTTON_PIN']). */
  readonly pins: string[];
  /** One-line description of what the snippet does. */
  readonly description: string;
  /** Arduino library #include directives required (e.g. ['<Servo.h>', '"DHT.h"']). */
  readonly includes: string[];
}

// ---------------------------------------------------------------------------
// Built-in snippet library (20+ entries)
// ---------------------------------------------------------------------------

export const BUILT_IN_SNIPPETS: readonly CodeSnippet[] = [
  // 1 — LED blink
  {
    id: 'led-blink',
    componentType: 'led',
    title: 'LED Blink',
    code: `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}`,
    pins: ['LED_PIN'],
    description: 'Blinks an LED on and off at 1-second intervals.',
    includes: [],
  },

  // 2 — Servo sweep
  {
    id: 'servo-sweep',
    componentType: 'servo',
    title: 'Servo Sweep',
    code: `#include <Servo.h>

const int SERVO_PIN = 9;
Servo myServo;

void setup() {
  myServo.attach(SERVO_PIN);
}

void loop() {
  for (int pos = 0; pos <= 180; pos++) {
    myServo.write(pos);
    delay(15);
  }
  for (int pos = 180; pos >= 0; pos--) {
    myServo.write(pos);
    delay(15);
  }
}`,
    pins: ['SERVO_PIN'],
    description: 'Sweeps a servo motor from 0 to 180 degrees and back.',
    includes: ['<Servo.h>'],
  },

  // 3 — DHT22 temperature/humidity read
  {
    id: 'dht22-read',
    componentType: 'dht22',
    title: 'DHT22 Read',
    code: `#include "DHT.h"

const int DHT_PIN = 2;
DHT dht(DHT_PIN, DHT22);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.print(" C  Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");
  delay(2000);
}`,
    pins: ['DHT_PIN'],
    description: 'Reads temperature and humidity from a DHT22 sensor.',
    includes: ['"DHT.h"'],
  },

  // 4 — Ultrasonic distance (HC-SR04)
  {
    id: 'ultrasonic-distance',
    componentType: 'ultrasonic',
    title: 'Ultrasonic Distance',
    code: `const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = duration * 0.034 / 2.0;
  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");
  delay(500);
}`,
    pins: ['TRIG_PIN', 'ECHO_PIN'],
    description: 'Measures distance using an HC-SR04 ultrasonic sensor.',
    includes: [],
  },

  // 5 — I2C scan
  {
    id: 'i2c-scan',
    componentType: 'i2c',
    title: 'I2C Scanner',
    code: `#include <Wire.h>

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("I2C Scanner ready.");
}

void loop() {
  int deviceCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
      deviceCount++;
    }
  }
  if (deviceCount == 0) {
    Serial.println("No I2C devices found.");
  }
  Serial.println();
  delay(5000);
}`,
    pins: [],
    description: 'Scans the I2C bus and prints the address of every connected device.',
    includes: ['<Wire.h>'],
  },

  // 6 — SPI transfer
  {
    id: 'spi-transfer',
    componentType: 'spi',
    title: 'SPI Transfer',
    code: `#include <SPI.h>

const int CS_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(CS_PIN, OUTPUT);
  digitalWrite(CS_PIN, HIGH);
  SPI.begin();
}

void loop() {
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(CS_PIN, LOW);
  byte response = SPI.transfer(0x00);
  digitalWrite(CS_PIN, HIGH);
  SPI.endTransaction();
  Serial.print("SPI response: 0x");
  Serial.println(response, HEX);
  delay(1000);
}`,
    pins: ['CS_PIN'],
    description: 'Sends a byte over SPI and prints the response.',
    includes: ['<SPI.h>'],
  },

  // 7 — PWM fade
  {
    id: 'pwm-fade',
    componentType: 'led',
    title: 'PWM Fade',
    code: `const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  for (int brightness = 0; brightness <= 255; brightness += 5) {
    analogWrite(LED_PIN, brightness);
    delay(30);
  }
  for (int brightness = 255; brightness >= 0; brightness -= 5) {
    analogWrite(LED_PIN, brightness);
    delay(30);
  }
}`,
    pins: ['LED_PIN'],
    description: 'Fades an LED in and out using PWM.',
    includes: [],
  },

  // 8 — Button debounce
  {
    id: 'button-debounce',
    componentType: 'button',
    title: 'Button Debounce',
    code: `const int BUTTON_PIN = 2;
const int LED_PIN = 13;
const unsigned long DEBOUNCE_MS = 50;

int ledState = LOW;
int lastButtonState = HIGH;
int buttonState = HIGH;
unsigned long lastDebounceTime = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > DEBOUNCE_MS) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
      }
    }
  }
  lastButtonState = reading;
}`,
    pins: ['BUTTON_PIN', 'LED_PIN'],
    description: 'Reads a push-button with software debouncing and toggles an LED.',
    includes: [],
  },

  // 9 — Potentiometer read
  {
    id: 'potentiometer-read',
    componentType: 'potentiometer',
    title: 'Potentiometer Read',
    code: `const int POT_PIN = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int value = analogRead(POT_PIN);
  float voltage = value * (5.0 / 1023.0);
  Serial.print("ADC: ");
  Serial.print(value);
  Serial.print("  Voltage: ");
  Serial.print(voltage, 2);
  Serial.println(" V");
  delay(200);
}`,
    pins: ['POT_PIN'],
    description: 'Reads a potentiometer via ADC and prints voltage.',
    includes: [],
  },

  // 10 — OLED hello (SSD1306)
  {
    id: 'oled-hello',
    componentType: 'oled',
    title: 'OLED Hello',
    code: `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int SCREEN_WIDTH = 128;
const int SCREEN_HEIGHT = 64;
const int OLED_ADDR = 0x3C;

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(9600);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("SSD1306 allocation failed");
    for (;;);
  }
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 20);
  display.println("Hello!");
  display.display();
}

void loop() {
}`,
    pins: [],
    description: 'Displays "Hello!" on an SSD1306 OLED via I2C.',
    includes: ['<Wire.h>', '<Adafruit_GFX.h>', '<Adafruit_SSD1306.h>'],
  },

  // 11 — Relay toggle
  {
    id: 'relay-toggle',
    componentType: 'relay',
    title: 'Relay Toggle',
    code: `const int RELAY_PIN = 7;

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
}

void loop() {
  digitalWrite(RELAY_PIN, HIGH);
  delay(3000);
  digitalWrite(RELAY_PIN, LOW);
  delay(3000);
}`,
    pins: ['RELAY_PIN'],
    description: 'Toggles a relay on and off every 3 seconds.',
    includes: [],
  },

  // 12 — Stepper control (28BYJ-48 via ULN2003)
  {
    id: 'stepper-control',
    componentType: 'stepper',
    title: 'Stepper Control',
    code: `#include <Stepper.h>

const int STEPS_PER_REV = 2048;
const int IN1 = 8;
const int IN2 = 9;
const int IN3 = 10;
const int IN4 = 11;

Stepper stepper(STEPS_PER_REV, IN1, IN3, IN2, IN4);

void setup() {
  stepper.setSpeed(10);
  Serial.begin(9600);
}

void loop() {
  Serial.println("Clockwise...");
  stepper.step(STEPS_PER_REV);
  delay(500);
  Serial.println("Counter-clockwise...");
  stepper.step(-STEPS_PER_REV);
  delay(500);
}`,
    pins: ['IN1', 'IN2', 'IN3', 'IN4'],
    description: 'Rotates a 28BYJ-48 stepper motor one revolution in each direction.',
    includes: ['<Stepper.h>'],
  },

  // 13 — NeoPixel rainbow
  {
    id: 'neopixel-rainbow',
    componentType: 'neopixel',
    title: 'NeoPixel Rainbow',
    code: `#include <Adafruit_NeoPixel.h>

const int NEOPIXEL_PIN = 6;
const int NUM_LEDS = 8;

Adafruit_NeoPixel strip(NUM_LEDS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setBrightness(50);
  strip.show();
}

void loop() {
  for (long hue = 0; hue < 65536; hue += 256) {
    for (int i = 0; i < NUM_LEDS; i++) {
      int pixelHue = hue + (i * 65536L / NUM_LEDS);
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(pixelHue)));
    }
    strip.show();
    delay(10);
  }
}`,
    pins: ['NEOPIXEL_PIN'],
    description: 'Displays a continuously cycling rainbow on a NeoPixel strip.',
    includes: ['<Adafruit_NeoPixel.h>'],
  },

  // 14 — Motor driver (L298N)
  {
    id: 'motor-driver',
    componentType: 'motor',
    title: 'Motor Driver',
    code: `const int ENA_PIN = 5;
const int IN1_PIN = 6;
const int IN2_PIN = 7;

void setup() {
  pinMode(ENA_PIN, OUTPUT);
  pinMode(IN1_PIN, OUTPUT);
  pinMode(IN2_PIN, OUTPUT);
}

void loop() {
  // Forward
  digitalWrite(IN1_PIN, HIGH);
  digitalWrite(IN2_PIN, LOW);
  analogWrite(ENA_PIN, 200);
  delay(2000);

  // Stop
  analogWrite(ENA_PIN, 0);
  delay(500);

  // Reverse
  digitalWrite(IN1_PIN, LOW);
  digitalWrite(IN2_PIN, HIGH);
  analogWrite(ENA_PIN, 200);
  delay(2000);

  // Stop
  analogWrite(ENA_PIN, 0);
  delay(500);
}`,
    pins: ['ENA_PIN', 'IN1_PIN', 'IN2_PIN'],
    description: 'Drives a DC motor forward and reverse using an L298N motor driver.',
    includes: [],
  },

  // 15 — Voltage divider read
  {
    id: 'voltage-divider-read',
    componentType: 'resistor',
    title: 'Voltage Divider Read',
    code: `const int VDIV_PIN = A0;
const float R1 = 30000.0;
const float R2 = 7500.0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(VDIV_PIN);
  float vOut = raw * (5.0 / 1023.0);
  float vIn = vOut * ((R1 + R2) / R2);
  Serial.print("Input voltage: ");
  Serial.print(vIn, 2);
  Serial.println(" V");
  delay(1000);
}`,
    pins: ['VDIV_PIN'],
    description: 'Reads a voltage divider to measure higher voltages via ADC.',
    includes: [],
  },

  // 16 — LDR threshold
  {
    id: 'ldr-threshold',
    componentType: 'ldr',
    title: 'LDR Threshold',
    code: `const int LDR_PIN = A0;
const int LED_PIN = 13;
const int THRESHOLD = 500;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  Serial.print("Light: ");
  Serial.println(lightLevel);
  if (lightLevel < THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(200);
}`,
    pins: ['LDR_PIN', 'LED_PIN'],
    description: 'Turns on an LED when ambient light drops below a threshold.',
    includes: [],
  },

  // 17 — Piezo tone
  {
    id: 'piezo-tone',
    componentType: 'piezo',
    title: 'Piezo Tone',
    code: `const int PIEZO_PIN = 8;

void setup() {
}

void loop() {
  tone(PIEZO_PIN, 262, 500);
  delay(600);
  tone(PIEZO_PIN, 330, 500);
  delay(600);
  tone(PIEZO_PIN, 392, 500);
  delay(600);
  noTone(PIEZO_PIN);
  delay(1000);
}`,
    pins: ['PIEZO_PIN'],
    description: 'Plays a simple C-E-G melody through a piezo buzzer.',
    includes: [],
  },

  // 18 — Rotary encoder read
  {
    id: 'encoder-read',
    componentType: 'encoder',
    title: 'Encoder Read',
    code: `const int CLK_PIN = 2;
const int DT_PIN = 3;
const int SW_PIN = 4;

volatile int encoderPos = 0;
int lastCLK = HIGH;

void setup() {
  Serial.begin(9600);
  pinMode(CLK_PIN, INPUT_PULLUP);
  pinMode(DT_PIN, INPUT_PULLUP);
  pinMode(SW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(CLK_PIN), readEncoder, FALLING);
}

void readEncoder() {
  int dtVal = digitalRead(DT_PIN);
  if (dtVal == HIGH) {
    encoderPos++;
  } else {
    encoderPos--;
  }
}

void loop() {
  static int lastPos = 0;
  if (encoderPos != lastPos) {
    Serial.print("Position: ");
    Serial.println(encoderPos);
    lastPos = encoderPos;
  }
  if (digitalRead(SW_PIN) == LOW) {
    Serial.println("Button pressed!");
    delay(200);
  }
}`,
    pins: ['CLK_PIN', 'DT_PIN', 'SW_PIN'],
    description: 'Reads a rotary encoder position using interrupts and detects button press.',
    includes: [],
  },

  // 19 — External interrupts
  {
    id: 'interrupts-example',
    componentType: 'button',
    title: 'Interrupts',
    code: `const int INT_PIN = 2;
const int LED_PIN = 13;

volatile bool triggered = false;

void setup() {
  Serial.begin(9600);
  pinMode(INT_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(INT_PIN), onTrigger, FALLING);
}

void onTrigger() {
  triggered = true;
}

void loop() {
  if (triggered) {
    triggered = false;
    digitalWrite(LED_PIN, HIGH);
    Serial.println("Interrupt triggered!");
    delay(500);
    digitalWrite(LED_PIN, LOW);
  }
}`,
    pins: ['INT_PIN', 'LED_PIN'],
    description: 'Demonstrates hardware interrupts with a push-button trigger.',
    includes: [],
  },

  // 20 — Millis timing (non-blocking)
  {
    id: 'millis-timing',
    componentType: 'led',
    title: 'Millis Timing',
    code: `const int LED_PIN = 13;
const unsigned long INTERVAL_MS = 1000;

unsigned long previousMillis = 0;
int ledState = LOW;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= INTERVAL_MS) {
    previousMillis = currentMillis;
    ledState = (ledState == LOW) ? HIGH : LOW;
    digitalWrite(LED_PIN, ledState);
  }
  // Other non-blocking work can happen here
}`,
    pins: ['LED_PIN'],
    description: 'Non-blocking LED blink using millis() instead of delay().',
    includes: [],
  },

  // 21 — IR remote receive
  {
    id: 'ir-remote-receive',
    componentType: 'ir_receiver',
    title: 'IR Remote Receive',
    code: `#include <IRremote.h>

const int IR_PIN = 11;

void setup() {
  Serial.begin(9600);
  IrReceiver.begin(IR_PIN, ENABLE_LED_FEEDBACK);
  Serial.println("IR Receiver ready.");
}

void loop() {
  if (IrReceiver.decode()) {
    Serial.print("Protocol: ");
    Serial.print(getProtocolString(IrReceiver.decodedIRData.protocol));
    Serial.print("  Code: 0x");
    Serial.println(IrReceiver.decodedIRData.decodedRawData, HEX);
    IrReceiver.resume();
  }
}`,
    pins: ['IR_PIN'],
    description: 'Receives and decodes IR remote control signals.',
    includes: ['<IRremote.h>'],
  },

  // 22 — LCD 16x2 I2C
  {
    id: 'lcd-i2c',
    componentType: 'lcd',
    title: 'LCD I2C Display',
    code: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int LCD_ADDR = 0x27;
const int LCD_COLS = 16;
const int LCD_ROWS = 2;

LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("ProtoPulse");
  lcd.setCursor(0, 1);
  lcd.print("Ready!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Up: ");
  lcd.print(millis() / 1000);
  lcd.print("s   ");
  delay(1000);
}`,
    pins: [],
    description: 'Displays text and uptime on a 16x2 I2C LCD.',
    includes: ['<Wire.h>', '<LiquidCrystal_I2C.h>'],
  },

  // 23 — BME280 environmental sensor
  {
    id: 'bme280-read',
    componentType: 'bme280',
    title: 'BME280 Read',
    code: `#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) {
    Serial.println("BME280 not found!");
    while (1) delay(10);
  }
  Serial.println("BME280 ready.");
}

void loop() {
  Serial.print("Temp: ");
  Serial.print(bme.readTemperature());
  Serial.print(" C  Pressure: ");
  Serial.print(bme.readPressure() / 100.0);
  Serial.print(" hPa  Humidity: ");
  Serial.print(bme.readHumidity());
  Serial.println(" %");
  delay(2000);
}`,
    pins: [],
    description: 'Reads temperature, pressure, and humidity from a BME280 sensor.',
    includes: ['<Wire.h>', '<Adafruit_BME280.h>'],
  },
] as const;

// ---------------------------------------------------------------------------
// Component type aliases — maps component names to canonical types so that
// "HC-SR04" or "ultrasonic sensor" still matches the 'ultrasonic' type.
// ---------------------------------------------------------------------------

const COMPONENT_TYPE_ALIASES: Record<string, string[]> = {
  led: ['led', 'light_emitting_diode', 'indicator'],
  servo: ['servo', 'servo_motor', 'sg90', 'mg996r'],
  dht22: ['dht22', 'dht11', 'dht', 'temperature_sensor', 'humidity_sensor'],
  ultrasonic: ['ultrasonic', 'hc-sr04', 'hcsr04', 'distance_sensor', 'sonar'],
  i2c: ['i2c', 'i2c_bus', 'wire', 'twi'],
  spi: ['spi', 'spi_bus'],
  button: ['button', 'push_button', 'switch', 'tactile_switch'],
  potentiometer: ['potentiometer', 'pot', 'variable_resistor', 'trimpot'],
  oled: ['oled', 'ssd1306', 'oled_display', 'display'],
  relay: ['relay', 'relay_module'],
  stepper: ['stepper', 'stepper_motor', '28byj-48', 'uln2003'],
  neopixel: ['neopixel', 'ws2812', 'ws2812b', 'addressable_led', 'led_strip', 'rgb_led'],
  motor: ['motor', 'dc_motor', 'l298n', 'motor_driver', 'h-bridge'],
  resistor: ['resistor', 'voltage_divider'],
  ldr: ['ldr', 'photoresistor', 'light_sensor', 'photocell'],
  piezo: ['piezo', 'buzzer', 'speaker', 'piezo_buzzer'],
  encoder: ['encoder', 'rotary_encoder', 'knob'],
  ir_receiver: ['ir_receiver', 'ir', 'infrared', 'remote'],
  lcd: ['lcd', 'lcd_display', 'character_lcd', '1602', '16x2'],
  bme280: ['bme280', 'bmp280', 'barometer', 'environmental_sensor'],
};

// ---------------------------------------------------------------------------
// Pre-computed lookup: alias → canonical component type
// ---------------------------------------------------------------------------

const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(COMPONENT_TYPE_ALIASES)) {
  for (const alias of aliases) {
    // Normalise the alias the same way getSnippetsForComponent normalises input
    const normalised = alias.toLowerCase().replace(/[\s-]+/g, '_');
    aliasToCanonical.set(normalised, canonical);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all snippets whose componentType matches the given type.
 * Matching is case-insensitive and supports aliases (e.g. "hc-sr04" → ultrasonic snippets).
 */
export function getSnippetsForComponent(type: string): CodeSnippet[] {
  const normalised = type.toLowerCase().replace(/[\s-]+/g, '_');

  // Resolve alias to canonical type
  const canonical = aliasToCanonical.get(normalised) ?? normalised;

  return BUILT_IN_SNIPPETS.filter((s) => s.componentType === canonical);
}

/**
 * Searches snippets by a free-text query. Matches against id, title,
 * description, componentType, and pin names. Case-insensitive.
 * Returns all matching snippets (empty array if no matches).
 */
export function searchSnippets(query: string): CodeSnippet[] {
  if (!query || query.trim().length === 0) {
    return [...BUILT_IN_SNIPPETS];
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return BUILT_IN_SNIPPETS.filter((snippet) => {
    const searchable = [
      snippet.id,
      snippet.title,
      snippet.description,
      snippet.componentType,
      ...snippet.pins,
      ...snippet.includes,
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Merges multiple snippets into a single compilable Arduino sketch.
 *
 * - Deduplicates #include directives
 * - Extracts global declarations (everything before the first `void setup()`)
 * - Merges all setup() bodies into one setup()
 * - Merges all loop() bodies into one loop()
 * - Handles snippets that embed #include inline in their code
 */
export function generateSetupCode(snippets: readonly CodeSnippet[]): string {
  if (snippets.length === 0) {
    return '';
  }

  // Collect unique includes
  const includeSet = new Set<string>();
  const globals: string[] = [];
  const setupBodies: string[] = [];
  const loopBodies: string[] = [];

  for (const snippet of snippets) {
    // Add explicit includes
    for (const inc of snippet.includes) {
      includeSet.add(inc);
    }

    const parsed = parseSnippetCode(snippet.code);

    // Inline #include directives found in code
    for (const inc of parsed.inlineIncludes) {
      includeSet.add(inc);
    }

    if (parsed.globals.trim().length > 0) {
      globals.push(`// --- ${snippet.title} ---`);
      globals.push(parsed.globals.trim());
    }

    if (parsed.setupBody.trim().length > 0) {
      setupBodies.push(`  // ${snippet.title}`);
      setupBodies.push(parsed.setupBody);
    }

    if (parsed.loopBody.trim().length > 0) {
      loopBodies.push(`  // ${snippet.title}`);
      loopBodies.push(parsed.loopBody);
    }
  }

  // Build the merged sketch
  const lines: string[] = [];

  // Includes
  const sortedIncludes = Array.from(includeSet).sort();
  if (sortedIncludes.length > 0) {
    for (const inc of sortedIncludes) {
      lines.push(`#include ${inc}`);
    }
    lines.push('');
  }

  // Globals
  if (globals.length > 0) {
    lines.push(...globals);
    lines.push('');
  }

  // setup()
  lines.push('void setup() {');
  if (setupBodies.length > 0) {
    lines.push(setupBodies.join('\n'));
  }
  lines.push('}');
  lines.push('');

  // loop()
  lines.push('void loop() {');
  if (loopBodies.length > 0) {
    lines.push(loopBodies.join('\n'));
  }
  lines.push('}');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal — code parser
// ---------------------------------------------------------------------------

interface ParsedSnippetCode {
  /** #include directives found inline in the code text. */
  inlineIncludes: string[];
  /** Global declarations (variable defs, ISR functions, etc.). */
  globals: string;
  /** Body of setup() without the braces. */
  setupBody: string;
  /** Body of loop() without the braces. */
  loopBody: string;
}

/**
 * Parses a snippet's code string into globals, setup body, and loop body.
 * Also strips inline #include directives so they can be deduplicated.
 */
function parseSnippetCode(code: string): ParsedSnippetCode {
  const inlineIncludes: string[] = [];
  const includeRegex = /^#include\s+(<[^>]+>|"[^"]+")\s*$/gm;
  let match: RegExpExecArray | null;

  // Extract inline includes
  while ((match = includeRegex.exec(code)) !== null) {
    inlineIncludes.push(match[1]);
  }

  // Remove #include lines from the code for further parsing
  const codeNoIncludes = code.replace(/^#include\s+(?:<[^>]+>|"[^"]+")\s*\n?/gm, '');

  // Find setup() and loop() function bodies
  const setupBody = extractFunctionBody(codeNoIncludes, 'setup');
  const loopBody = extractFunctionBody(codeNoIncludes, 'loop');

  // Everything else is globals — remove setup() and loop() function blocks
  let globals = codeNoIncludes;
  globals = removeFunctionBlock(globals, 'setup');
  globals = removeFunctionBlock(globals, 'loop');

  // Also remove any other function definitions that appear as ISRs, etc.
  // but keep them as globals (they should remain in globals)
  // Actually, ISRs like readEncoder() need to be kept — don't strip them.

  return { inlineIncludes, globals, setupBody, loopBody };
}

/**
 * Extracts the body of a `void funcName() { ... }` block (contents between braces).
 * Returns an empty string if the function is not found.
 */
function extractFunctionBody(code: string, funcName: string): string {
  const pattern = new RegExp(`void\\s+${funcName}\\s*\\(\\s*\\)\\s*\\{`);
  const match = pattern.exec(code);
  if (!match) {
    return '';
  }

  const startBrace = match.index + match[0].length;
  let depth = 1;
  let i = startBrace;

  while (i < code.length && depth > 0) {
    if (code[i] === '{') {
      depth++;
    } else if (code[i] === '}') {
      depth--;
    }
    i++;
  }

  // The body is between startBrace and i-1 (the closing brace)
  const body = code.slice(startBrace, i - 1);

  // Re-indent body lines to 2 spaces
  const lines = body.split('\n');
  const trimmed = lines
    .map((line) => {
      const stripped = line.replace(/^\s{0,4}/, '');
      return stripped.length > 0 ? `  ${stripped}` : '';
    })
    .filter((line, idx, arr) => {
      // Remove leading/trailing empty lines
      if (idx === 0 && line.trim() === '') {
        return false;
      }
      if (idx === arr.length - 1 && line.trim() === '') {
        return false;
      }
      return true;
    });

  return trimmed.join('\n');
}

/**
 * Removes a `void funcName() { ... }` block (including the full brace-matched body)
 * from the code string.
 */
function removeFunctionBlock(code: string, funcName: string): string {
  const pattern = new RegExp(`void\\s+${funcName}\\s*\\(\\s*\\)\\s*\\{`);
  const match = pattern.exec(code);
  if (!match) {
    return code;
  }

  const startBrace = match.index + match[0].length;
  let depth = 1;
  let i = startBrace;

  while (i < code.length && depth > 0) {
    if (code[i] === '{') {
      depth++;
    } else if (code[i] === '}') {
      depth--;
    }
    i++;
  }

  // Remove from match.index to i (inclusive of closing brace)
  return code.slice(0, match.index) + code.slice(i);
}
