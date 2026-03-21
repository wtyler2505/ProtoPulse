// ---------------------------------------------------------------------------
// Board Doctor — Guided Diagnostic Decision Tree
// ---------------------------------------------------------------------------
// Interactive, conversational diagnostic engine that guides makers through
// troubleshooting common Arduino/embedded board problems. Uses a decision-
// tree structure with 20+ nodes covering 7 symptom categories. Each leaf
// produces a structured DiagnosticResult with diagnosis, potential causes,
// actionable solutions, and severity rating. Includes session history
// tracking and fuzzy symptom matching.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity of a diagnostic finding. */
export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

/** The 7 symptom categories the board doctor covers. */
export type SymptomCategory =
  | 'board_not_detected'
  | 'upload_fails'
  | 'serial_garbled'
  | 'program_crashes'
  | 'sensor_wrong_values'
  | 'motor_not_spinning'
  | 'wifi_wont_connect';

/** Human-readable labels for each symptom category. */
export const SYMPTOM_LABELS: Record<SymptomCategory, string> = {
  board_not_detected: 'Board Not Detected',
  upload_fails: 'Upload Fails',
  serial_garbled: 'Serial Output Garbled',
  program_crashes: 'Program Crashes / Freezes',
  sensor_wrong_values: 'Sensor Reads Wrong Values',
  motor_not_spinning: 'Motor Not Spinning',
  wifi_wont_connect: 'WiFi Won\'t Connect',
};

/** Type of a node in the decision tree. */
export type DecisionNodeType = 'question' | 'leaf';

/** A question node in the decision tree — asks the user something. */
export interface QuestionNode {
  readonly id: string;
  readonly type: 'question';
  readonly category: SymptomCategory;
  /** The question to ask the user. */
  readonly question: string;
  /** Contextual help text shown below the question. */
  readonly hint?: string;
  /** Node ID to follow when user answers "yes". */
  readonly yesNext: string;
  /** Node ID to follow when user answers "no". */
  readonly noNext: string;
}

/** A leaf node — the terminal diagnosis. */
export interface LeafNode {
  readonly id: string;
  readonly type: 'leaf';
  readonly category: SymptomCategory;
  /** Short diagnosis title. */
  readonly diagnosis: string;
  /** Array of potential root causes. */
  readonly causes: readonly string[];
  /** Ordered list of actionable solutions — beginner-friendly. */
  readonly solutions: readonly string[];
  /** Severity of the issue. */
  readonly severity: DiagnosticSeverity;
}

/** Union of all decision tree node types. */
export type DecisionNode = QuestionNode | LeafNode;

/** Result produced when the user reaches a leaf node. */
export interface DiagnosticResult {
  readonly nodeId: string;
  readonly category: SymptomCategory;
  readonly diagnosis: string;
  readonly causes: readonly string[];
  readonly solutions: readonly string[];
  readonly severity: DiagnosticSeverity;
  /** The path of question node IDs traversed to reach this result. */
  readonly path: readonly string[];
  /** Timestamp when diagnosis was reached. */
  readonly timestamp: number;
}

/** A single answer recorded in the session. */
export interface SessionAnswer {
  readonly nodeId: string;
  readonly answer: 'yes' | 'no';
  readonly timestamp: number;
}

/** Session state for a diagnostic conversation. */
export interface DiagnosticSession {
  readonly id: string;
  readonly category: SymptomCategory;
  readonly startedAt: number;
  readonly answers: readonly SessionAnswer[];
  readonly currentNodeId: string;
  readonly result: DiagnosticResult | null;
  readonly isComplete: boolean;
}

/** Fuzzy match result for symptom search. */
export interface SymptomMatch {
  readonly category: SymptomCategory;
  readonly label: string;
  readonly score: number;
}

// ---------------------------------------------------------------------------
// Decision Tree Definitions — 7 categories, 20+ nodes
// ---------------------------------------------------------------------------

export const DECISION_TREE: readonly DecisionNode[] = [
  // =========================================================================
  // CATEGORY: board_not_detected
  // =========================================================================
  {
    id: 'bnd-root',
    type: 'question',
    category: 'board_not_detected',
    question: 'Is the power LED on the board lit up?',
    hint: 'Most boards have a small red or green LED near the USB connector that turns on when powered.',
    yesNext: 'bnd-driver',
    noNext: 'bnd-no-power',
  },
  {
    id: 'bnd-no-power',
    type: 'leaf',
    category: 'board_not_detected',
    diagnosis: 'Board has no power',
    causes: [
      'USB cable is charge-only (no data wires)',
      'USB cable is damaged or not fully inserted',
      'USB port is not providing power',
      'Board has a blown voltage regulator',
    ],
    solutions: [
      'Try a different USB cable — many cheap cables are charge-only and cannot carry data.',
      'Try a different USB port directly on your computer (avoid USB hubs).',
      'If the board has a barrel jack, try powering it with an external supply (7-12V for most Arduinos).',
      'Inspect the board for burn marks or damaged components near the USB connector.',
    ],
    severity: 'critical',
  },
  {
    id: 'bnd-driver',
    type: 'question',
    category: 'board_not_detected',
    question: 'Does the board appear in your system\'s device list?',
    hint: 'Windows: Device Manager → Ports (COM & LPT). Mac: Terminal → ls /dev/cu.*. Linux: Terminal → ls /dev/ttyUSB* /dev/ttyACM*.',
    yesNext: 'bnd-port-busy',
    noNext: 'bnd-no-driver',
  },
  {
    id: 'bnd-no-driver',
    type: 'leaf',
    category: 'board_not_detected',
    diagnosis: 'Missing USB-to-serial driver',
    causes: [
      'The USB-to-serial chip on the board (CH340, CP2102, or FTDI) requires a driver not installed on your system',
      'The driver is installed but not loaded correctly',
      'The board uses a native USB chip (e.g., ATmega32U4) that needs different handling',
    ],
    solutions: [
      'Identify the USB chip on your board — common ones: CH340/CH341 (Chinese clones), CP2102/CP2104 (ESP32 boards), FTDI FT232 (official Arduinos).',
      'Download and install the matching driver from the manufacturer website.',
      'On Linux, add yourself to the "dialout" group: sudo usermod -a -G dialout $USER, then log out and back in.',
      'Restart your computer after installing drivers.',
    ],
    severity: 'critical',
  },
  {
    id: 'bnd-port-busy',
    type: 'leaf',
    category: 'board_not_detected',
    diagnosis: 'Port is busy or locked by another application',
    causes: [
      'Another program (Arduino IDE, PuTTY, screen, another Serial Monitor) has the port open',
      'A previous connection was not closed cleanly',
      'The browser did not release the Web Serial port',
    ],
    solutions: [
      'Close any other serial terminal programs (Arduino IDE Serial Monitor, PuTTY, screen, minicom).',
      'Close other browser tabs that might have a Web Serial connection open.',
      'Unplug and re-plug the USB cable to reset the port.',
      'On Linux, kill stale lock files: sudo rm /var/lock/LCK..ttyUSB0 (adjust port name).',
    ],
    severity: 'warning',
  },

  // =========================================================================
  // CATEGORY: upload_fails
  // =========================================================================
  {
    id: 'uf-root',
    type: 'question',
    category: 'upload_fails',
    question: 'Does the upload get past the "Connecting..." phase?',
    hint: 'If it says "Connecting..." and then times out, the board is not entering programming mode.',
    yesNext: 'uf-verify',
    noNext: 'uf-cant-connect',
  },
  {
    id: 'uf-cant-connect',
    type: 'question',
    category: 'upload_fails',
    question: 'Is this an ESP32 or ESP8266 board?',
    hint: 'ESP boards often need a button sequence to enter programming mode.',
    yesNext: 'uf-esp-boot',
    noNext: 'uf-sync-error',
  },
  {
    id: 'uf-esp-boot',
    type: 'leaf',
    category: 'upload_fails',
    diagnosis: 'ESP board not entering download mode',
    causes: [
      'The BOOT/IO0 button was not held during reset',
      'Auto-reset circuit is not working (missing capacitor on DTR/RTS)',
      'Wrong board variant selected in settings',
    ],
    solutions: [
      'Hold the BOOT button, press RESET, then release BOOT — then start the upload.',
      'Some boards auto-detect: just start the upload and the IDE handles the reset.',
      'Verify you have the correct ESP32/ESP8266 board variant selected.',
      'Check that your USB cable supports data (not charge-only).',
    ],
    severity: 'critical',
  },
  {
    id: 'uf-sync-error',
    type: 'leaf',
    category: 'upload_fails',
    diagnosis: 'Bootloader sync failure',
    causes: [
      'Wrong board type selected in settings',
      'Something connected to pins 0 (RX) and 1 (TX) is interfering',
      'The bootloader is corrupted or missing',
      'The USB cable is flaky or too long',
    ],
    solutions: [
      'Verify the correct board type is selected (e.g., "Arduino Uno" not "Arduino Mega").',
      'Disconnect anything from digital pins 0 and 1 during upload.',
      'Press the reset button right as the upload starts.',
      'If the bootloader is corrupted, burn a new one with an ISP programmer or another Arduino as ISP.',
    ],
    severity: 'critical',
  },
  {
    id: 'uf-verify',
    type: 'question',
    category: 'upload_fails',
    question: 'Does the error mention "verification failed" or "content mismatch"?',
    hint: 'Verification errors mean data was written but reads back differently.',
    yesNext: 'uf-verify-fail',
    noNext: 'uf-size',
  },
  {
    id: 'uf-verify-fail',
    type: 'leaf',
    category: 'upload_fails',
    diagnosis: 'Flash verification failure',
    causes: [
      'Unreliable USB connection causing data corruption',
      'Insufficient power during flash write',
      'Flash memory nearing end of write-cycle life (rare)',
    ],
    solutions: [
      'Use a shorter, higher-quality USB cable.',
      'Connect the board directly to the computer (no hub).',
      'Remove power-hungry peripherals during upload.',
      'Try again — single-occurrence verification failures are often transient.',
    ],
    severity: 'warning',
  },
  {
    id: 'uf-size',
    type: 'leaf',
    category: 'upload_fails',
    diagnosis: 'Sketch too large or compilation error',
    causes: [
      'The compiled sketch exceeds the board\'s flash memory',
      'Compilation failed before upload could start',
      'Too many libraries included',
    ],
    solutions: [
      'Check the compiler output for "Sketch too big" messages.',
      'Remove unused #include libraries.',
      'Use F() macro for string literals: Serial.println(F("text")) saves RAM.',
      'Consider a board with more memory (Arduino Mega, ESP32).',
    ],
    severity: 'warning',
  },

  // =========================================================================
  // CATEGORY: serial_garbled
  // =========================================================================
  {
    id: 'sg-root',
    type: 'question',
    category: 'serial_garbled',
    question: 'Are you seeing random symbols/characters instead of readable text?',
    hint: 'Garbled output that looks like "⸮⸮⸮" or "????" is almost always a baud rate mismatch.',
    yesNext: 'sg-baud',
    noNext: 'sg-partial',
  },
  {
    id: 'sg-baud',
    type: 'leaf',
    category: 'serial_garbled',
    diagnosis: 'Baud rate mismatch',
    causes: [
      'The Serial Monitor baud rate does not match Serial.begin() in your sketch',
      'The sketch changed baud rate but the monitor was not updated',
    ],
    solutions: [
      'Check your sketch for the Serial.begin() call — note the number (e.g., 9600, 115200).',
      'Set the Serial Monitor to the exact same baud rate.',
      'Common baud rates: 9600 (default for many examples), 115200 (ESP32 default).',
      'If unsure, try 9600 first, then 115200.',
    ],
    severity: 'info',
  },
  {
    id: 'sg-partial',
    type: 'question',
    category: 'serial_garbled',
    question: 'Do you see some correct text mixed with garbage characters?',
    hint: 'Partial corruption suggests electrical noise or buffer overflow.',
    yesNext: 'sg-noise',
    noNext: 'sg-encoding',
  },
  {
    id: 'sg-noise',
    type: 'leaf',
    category: 'serial_garbled',
    diagnosis: 'Electrical noise on serial line',
    causes: [
      'Long or unshielded wires picking up electromagnetic interference',
      'Ground loop between the board and connected peripherals',
      'Serial buffer overflow — data sent faster than it can be processed',
    ],
    solutions: [
      'Use shorter wires for serial connections.',
      'Add a common ground between all connected devices.',
      'Reduce the baud rate (try 9600 instead of 115200).',
      'Add a small delay between Serial.print() calls to prevent buffer overflow.',
      'Use shielded USB cable if interference is suspected.',
    ],
    severity: 'warning',
  },
  {
    id: 'sg-encoding',
    type: 'leaf',
    category: 'serial_garbled',
    diagnosis: 'Character encoding or line ending mismatch',
    causes: [
      'The firmware is sending binary data but the monitor expects text',
      'Line ending settings (CR, LF, CR+LF) do not match',
      'The firmware uses Serial.write() (binary) instead of Serial.print() (text)',
    ],
    solutions: [
      'Check if your sketch uses Serial.write() — this sends raw bytes, not human-readable text.',
      'If you need text output, use Serial.print() or Serial.println() instead.',
      'Try changing the line ending setting in the Serial Monitor (None, Newline, Carriage Return, Both).',
      'If you intentionally send binary, use a hex viewer mode if available.',
    ],
    severity: 'info',
  },

  // =========================================================================
  // CATEGORY: program_crashes
  // =========================================================================
  {
    id: 'pc-root',
    type: 'question',
    category: 'program_crashes',
    question: 'Does the program run for a while before crashing, or does it crash immediately on startup?',
    hint: 'Answer "yes" if it runs for seconds/minutes before crashing. Answer "no" if it crashes at boot.',
    yesNext: 'pc-runtime',
    noNext: 'pc-boot',
  },
  {
    id: 'pc-boot',
    type: 'question',
    category: 'program_crashes',
    question: 'Do you see a "stack overflow" or "watchdog reset" message in serial output?',
    hint: 'ESP32/ESP8266 boards print crash info to serial. AVR boards usually just restart silently.',
    yesNext: 'pc-stack',
    noNext: 'pc-init-fail',
  },
  {
    id: 'pc-stack',
    type: 'leaf',
    category: 'program_crashes',
    diagnosis: 'Stack overflow or watchdog timeout at boot',
    causes: [
      'Large arrays or buffers allocated on the stack in setup()',
      'Recursive function call without termination',
      'setup() takes too long and triggers the watchdog timer (ESP boards)',
    ],
    solutions: [
      'Move large arrays from local (stack) to global scope or use malloc/new (heap).',
      'On ESP32, increase the task stack size or call yield()/delay(1) in long loops.',
      'Add yield() calls in long-running setup operations to feed the watchdog.',
      'Check for infinite recursion in constructors or init functions.',
    ],
    severity: 'critical',
  },
  {
    id: 'pc-init-fail',
    type: 'leaf',
    category: 'program_crashes',
    diagnosis: 'Initialization failure — hardware not connected or misconfigured',
    causes: [
      'A sensor or peripheral referenced in setup() is not connected',
      'I2C/SPI address mismatch — the code talks to a wrong address',
      'Library initialization fails silently and causes undefined behavior',
    ],
    solutions: [
      'Add Serial.println() at the start of setup() to confirm the board boots.',
      'Run an I2C scanner sketch to verify device addresses.',
      'Check that all peripherals are wired correctly before initializing their libraries.',
      'Wrap hardware init calls in if-checks: if (!sensor.begin()) { Serial.println("Sensor not found!"); }',
    ],
    severity: 'critical',
  },
  {
    id: 'pc-runtime',
    type: 'question',
    category: 'program_crashes',
    question: 'Does the crash happen at a consistent time or under specific conditions (e.g., when a sensor is read or motor activated)?',
    hint: 'Consistent timing suggests a software bug. Random timing suggests power or memory issues.',
    yesNext: 'pc-trigger',
    noNext: 'pc-memory',
  },
  {
    id: 'pc-trigger',
    type: 'leaf',
    category: 'program_crashes',
    diagnosis: 'Crash triggered by specific operation',
    causes: [
      'Null pointer dereference when accessing hardware that is not responding',
      'Division by zero from a sensor returning unexpected 0 value',
      'Buffer overflow when constructing strings or handling incoming data',
      'ISR (interrupt service routine) conflicts or too-long ISR execution',
    ],
    solutions: [
      'Add null/range checks before using sensor values.',
      'Guard against division by zero: if (value != 0) { result = total / value; }',
      'Use fixed-size buffers and check bounds before writing.',
      'Keep ISR handlers as short as possible — set a flag and process in loop().',
      'Add Serial.println() around the suspected code to narrow down the exact line.',
    ],
    severity: 'warning',
  },
  {
    id: 'pc-memory',
    type: 'leaf',
    category: 'program_crashes',
    diagnosis: 'Memory exhaustion — heap or stack overflow over time',
    causes: [
      'Memory leak from String concatenation in loop() (Arduino String class allocates heap)',
      'Fragmented heap from repeated malloc/free or String operations',
      'Stack overflow from deep call chains or large local variables',
    ],
    solutions: [
      'Avoid using the String class in loop() — use char arrays (C strings) instead.',
      'Pre-allocate buffers at startup instead of dynamic allocation.',
      'Monitor free memory: Serial.println(ESP.getFreeHeap()) on ESP, or freeMemory() on AVR.',
      'Reduce local variable sizes in deeply nested functions.',
      'Use PROGMEM for constant data (lookup tables, strings) on AVR boards.',
    ],
    severity: 'warning',
  },

  // =========================================================================
  // CATEGORY: sensor_wrong_values
  // =========================================================================
  {
    id: 'swv-root',
    type: 'question',
    category: 'sensor_wrong_values',
    question: 'Is the sensor reading always the same value (stuck), or does it fluctuate but seem incorrect?',
    hint: 'A stuck value (always 0, always 1023) suggests a wiring or pin issue. Fluctuating wrong values suggest calibration or noise.',
    yesNext: 'swv-stuck',
    noNext: 'swv-fluctuating',
  },
  {
    id: 'swv-stuck',
    type: 'question',
    category: 'sensor_wrong_values',
    question: 'Is the reading stuck at 0 or the maximum value (1023 for 10-bit ADC, 4095 for 12-bit)?',
    hint: 'Reading at extremes (0 or max) usually means the pin is floating or disconnected.',
    yesNext: 'swv-floating',
    noNext: 'swv-wrong-pin',
  },
  {
    id: 'swv-floating',
    type: 'leaf',
    category: 'sensor_wrong_values',
    diagnosis: 'Floating or disconnected analog pin',
    causes: [
      'The sensor is not connected to the pin your code reads',
      'The wire connection is loose or broken',
      'The pin is floating (no pull-up/pull-down resistor) when the sensor is disconnected',
    ],
    solutions: [
      'Double-check the wiring — make sure the sensor output goes to the exact analog pin your code references.',
      'Use a multimeter to verify voltage at the pin with the sensor connected.',
      'Add a 10K pull-down resistor between the analog pin and GND to prevent floating.',
      'Try reading a different analog pin to verify the ADC is working.',
    ],
    severity: 'warning',
  },
  {
    id: 'swv-wrong-pin',
    type: 'leaf',
    category: 'sensor_wrong_values',
    diagnosis: 'Wrong pin or incorrect ADC configuration',
    causes: [
      'Code reads from the wrong pin number (e.g., A0 vs A1)',
      'Pin mode not set correctly (analog vs digital mismatch)',
      'ADC reference voltage is wrong (internal vs external AREF)',
    ],
    solutions: [
      'Verify the pin number in your code matches the physical wiring: analogRead(A0) reads pin A0.',
      'Do not call pinMode() on analog input pins — analogRead() configures the pin automatically.',
      'Check analogReference() setting — default is the supply voltage (5V or 3.3V).',
      'Try reading the pin with a simple test sketch to isolate the problem.',
    ],
    severity: 'info',
  },
  {
    id: 'swv-fluctuating',
    type: 'question',
    category: 'sensor_wrong_values',
    question: 'Are the values noisy (jumping around rapidly) or offset (consistently too high/low)?',
    hint: 'Answer "yes" if values jump around randomly. Answer "no" if they are stable but wrong.',
    yesNext: 'swv-noisy',
    noNext: 'swv-calibration',
  },
  {
    id: 'swv-noisy',
    type: 'leaf',
    category: 'sensor_wrong_values',
    diagnosis: 'Noisy sensor readings from electromagnetic interference or poor wiring',
    causes: [
      'Long unshielded sensor wires picking up electromagnetic noise',
      'Sensor and motor sharing the same power rail causing voltage spikes',
      'Missing bypass/decoupling capacitors on the sensor power supply',
      'ADC sampling rate too high for the sensor\'s settling time',
    ],
    solutions: [
      'Add a 100nF (0.1uF) ceramic capacitor between the sensor\'s VCC and GND pins, as close to the sensor as possible.',
      'Use shorter wires and keep sensor wires away from motor/power wires.',
      'Average multiple readings in software: take 10 samples and divide by 10.',
      'Power sensors from a separate, clean power rail if motors are causing noise.',
      'Add a small delay (1-10ms) between analogRead() calls.',
    ],
    severity: 'warning',
  },
  {
    id: 'swv-calibration',
    type: 'leaf',
    category: 'sensor_wrong_values',
    diagnosis: 'Sensor needs calibration or voltage level mismatch',
    causes: [
      'The sensor output range does not match the ADC input range',
      'A 5V sensor connected to a 3.3V board (or vice versa) gives scaled readings',
      'The sensor requires calibration (offset/gain adjustment)',
    ],
    solutions: [
      'Check if your board is 5V or 3.3V — use a matching sensor or add a voltage divider/level shifter.',
      'Use the map() function to scale raw values to real units: map(raw, 0, 1023, minReal, maxReal).',
      'Read the sensor datasheet for calibration procedures and expected output range.',
      'For temperature sensors, verify the formula converts ADC counts to degrees correctly.',
    ],
    severity: 'info',
  },

  // =========================================================================
  // CATEGORY: motor_not_spinning
  // =========================================================================
  {
    id: 'mns-root',
    type: 'question',
    category: 'motor_not_spinning',
    question: 'Is the motor connected through a motor driver (H-bridge, ESC, or motor shield)?',
    hint: 'DC motors cannot be driven directly from Arduino pins — they need a driver circuit.',
    yesNext: 'mns-driver-check',
    noNext: 'mns-no-driver',
  },
  {
    id: 'mns-no-driver',
    type: 'leaf',
    category: 'motor_not_spinning',
    diagnosis: 'Motor connected directly to Arduino pin — no driver circuit',
    causes: [
      'Arduino GPIO pins can only supply 20-40mA — motors need 100mA-several amps',
      'Connecting a motor directly can damage the Arduino pin or the microcontroller',
      'Even small motors draw too much current for direct GPIO drive',
    ],
    solutions: [
      'NEVER connect a motor directly to an Arduino pin — this can damage the board!',
      'Use a motor driver: L298N or L293D for small DC motors, TB6612FNG for more efficiency.',
      'For servos, use a dedicated servo library and external 5V power for more than 1-2 servos.',
      'For stepper motors, use a driver like A4988, DRV8825, or TMC2209.',
    ],
    severity: 'critical',
  },
  {
    id: 'mns-driver-check',
    type: 'question',
    category: 'motor_not_spinning',
    question: 'Does the motor driver have a separate power supply connected (not just the Arduino 5V)?',
    hint: 'Motor drivers need their own power — the Arduino\'s 5V pin can\'t supply enough current for motors.',
    yesNext: 'mns-pwm',
    noNext: 'mns-power',
  },
  {
    id: 'mns-power',
    type: 'leaf',
    category: 'motor_not_spinning',
    diagnosis: 'Motor driver has no separate power supply',
    causes: [
      'The motor driver is powered only from Arduino\'s 5V pin which cannot supply enough current',
      'Motor power input (VM/VIN) is not connected to a battery or power supply',
      'Power supply voltage does not match the motor\'s rated voltage',
    ],
    solutions: [
      'Connect a separate power supply (battery pack or DC adapter) to the motor driver\'s motor-power input.',
      'Match the voltage to your motor\'s rating (e.g., 6V, 12V, 24V).',
      'Connect the GND of the power supply to the Arduino GND (common ground).',
      'Make sure the power supply can deliver enough current for your motor (check the motor\'s stall current).',
    ],
    severity: 'critical',
  },
  {
    id: 'mns-pwm',
    type: 'question',
    category: 'motor_not_spinning',
    question: 'Are you using a PWM-capable pin for speed control?',
    hint: 'Only pins marked with ~ (tilde) on the Arduino support analogWrite() for PWM.',
    yesNext: 'mns-code',
    noNext: 'mns-no-pwm',
  },
  {
    id: 'mns-no-pwm',
    type: 'leaf',
    category: 'motor_not_spinning',
    diagnosis: 'Speed control pin is not PWM-capable',
    causes: [
      'analogWrite() on a non-PWM pin outputs only HIGH or LOW, not a variable speed signal',
      'The enable/speed pin of the motor driver needs a PWM signal for speed control',
    ],
    solutions: [
      'Use a PWM-capable pin: Arduino Uno pins 3, 5, 6, 9, 10, 11; Mega pins 2-13, 44-46.',
      'On ESP32, use ledcWrite() instead of analogWrite().',
      'If you only need on/off (no speed control), use digitalWrite(pin, HIGH) instead.',
      'Check your board\'s pinout diagram for PWM-capable pins (marked with ~).',
    ],
    severity: 'warning',
  },
  {
    id: 'mns-code',
    type: 'leaf',
    category: 'motor_not_spinning',
    diagnosis: 'Motor driver wiring or code logic issue',
    causes: [
      'Direction pins (IN1/IN2) are both LOW or both HIGH (motor brakes instead of spinning)',
      'Enable pin is LOW (motor disabled)',
      'PWM value is too low for the motor to overcome static friction',
      'Wiring between Arduino and motor driver is incorrect',
    ],
    solutions: [
      'For L298N: set IN1=HIGH, IN2=LOW for forward; IN1=LOW, IN2=HIGH for reverse. Enable pin must be HIGH or PWM.',
      'Try a higher PWM value (start with 255 for full speed to verify it works, then reduce).',
      'Verify the enable jumper on the L298N — remove it and connect the enable pin to a PWM output.',
      'Add Serial.println() to verify your code is actually reaching the motor control lines.',
      'Test with a simple sketch: digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); analogWrite(ENA, 255);',
    ],
    severity: 'info',
  },

  // =========================================================================
  // CATEGORY: wifi_wont_connect
  // =========================================================================
  {
    id: 'wwc-root',
    type: 'question',
    category: 'wifi_wont_connect',
    question: 'Does your board have built-in WiFi (e.g., ESP32, ESP8266, Arduino MKR WiFi)?',
    hint: 'Arduino Uno, Mega, and Nano do not have WiFi — they need a separate WiFi module.',
    yesNext: 'wwc-ssid',
    noNext: 'wwc-no-wifi',
  },
  {
    id: 'wwc-no-wifi',
    type: 'leaf',
    category: 'wifi_wont_connect',
    diagnosis: 'Board does not have WiFi capability',
    causes: [
      'Arduino Uno, Mega, Nano (classic ATmega boards) do not have WiFi hardware',
      'A separate WiFi module (ESP-01, WiFi shield) may not be connected or configured',
    ],
    solutions: [
      'Use a board with built-in WiFi: ESP32, ESP8266 (NodeMCU/Wemos D1 Mini), Arduino MKR WiFi 1010.',
      'If you need to add WiFi to an existing board, use an ESP-01 module connected via serial.',
      'For IoT projects, ESP32 is recommended — it has WiFi + Bluetooth + more GPIO + more memory.',
    ],
    severity: 'info',
  },
  {
    id: 'wwc-ssid',
    type: 'question',
    category: 'wifi_wont_connect',
    question: 'Have you double-checked that the SSID (network name) and password in your code are exactly correct?',
    hint: 'WiFi credentials are case-sensitive. "MyNetwork" is different from "mynetwork".',
    yesNext: 'wwc-band',
    noNext: 'wwc-credentials',
  },
  {
    id: 'wwc-credentials',
    type: 'leaf',
    category: 'wifi_wont_connect',
    diagnosis: 'WiFi credentials (SSID or password) are incorrect',
    causes: [
      'Typo in the SSID or password — these are case-sensitive',
      'Hidden characters (trailing spaces, special characters) in the credentials',
      'The network name changed or the password was updated',
    ],
    solutions: [
      'Copy-paste the SSID and password directly into your code to avoid typos.',
      'Print the credentials to serial before connecting: Serial.println(ssid); to verify.',
      'Try connecting to a mobile hotspot with a simple name/password to test.',
      'Make sure there are no leading/trailing spaces in the SSID or password strings.',
    ],
    severity: 'info',
  },
  {
    id: 'wwc-band',
    type: 'question',
    category: 'wifi_wont_connect',
    question: 'Is your WiFi network operating on the 2.4GHz band (not 5GHz)?',
    hint: 'ESP32 and ESP8266 only support 2.4GHz WiFi. 5GHz networks are invisible to them.',
    yesNext: 'wwc-distance',
    noNext: 'wwc-5ghz',
  },
  {
    id: 'wwc-5ghz',
    type: 'leaf',
    category: 'wifi_wont_connect',
    diagnosis: 'Network is 5GHz only — not supported by the board',
    causes: [
      'ESP32 and ESP8266 only support 2.4GHz WiFi',
      'Many modern routers combine 2.4GHz and 5GHz under one SSID, defaulting to 5GHz',
    ],
    solutions: [
      'Log into your router settings and ensure the 2.4GHz band is enabled.',
      'If your router combines bands, create a separate 2.4GHz-only SSID for IoT devices.',
      'Move the board closer to the router — it may connect to 2.4GHz at closer range.',
      'Use a mobile hotspot set to 2.4GHz for testing.',
    ],
    severity: 'warning',
  },
  {
    id: 'wwc-distance',
    type: 'leaf',
    category: 'wifi_wont_connect',
    diagnosis: 'WiFi signal too weak or connection timeout',
    causes: [
      'Board is too far from the WiFi router or access point',
      'Physical obstacles (walls, metal surfaces) blocking the signal',
      'The on-board antenna is weak (PCB antenna) — external antenna not connected',
      'Too many devices on the network causing congestion',
    ],
    solutions: [
      'Move the board closer to the WiFi router for testing.',
      'Check signal strength: WiFi.RSSI() — values above -70 dBm are good, below -80 dBm is weak.',
      'If your ESP32 has an external antenna connector (U.FL), attach an antenna and set the antenna switch.',
      'Add a retry loop with delay: if (WiFi.status() != WL_CONNECTED) { delay(500); WiFi.begin(ssid, pass); }',
      'Use WiFi.setAutoReconnect(true) on ESP32 to handle intermittent drops.',
    ],
    severity: 'warning',
  },
] as const;

// ---------------------------------------------------------------------------
// Fuzzy Symptom Keywords — for matching user input to categories
// ---------------------------------------------------------------------------

const SYMPTOM_KEYWORDS: Record<SymptomCategory, readonly string[]> = {
  board_not_detected: [
    'not detected', 'not found', 'no port', 'no device', 'cannot find',
    'not recognized', 'not showing', 'invisible', 'missing', 'no board',
    'usb', 'driver', 'com port', 'ttyusb', 'ttyacm', 'plug', 'connect',
    'detect', 'recognize', 'discover', 'see', 'find',
  ],
  upload_fails: [
    'upload', 'flash', 'program', 'burn', 'write', 'compile', 'build',
    'avrdude', 'esptool', 'sync', 'bootloader', 'timeout', 'stk500',
    'failed to upload', 'upload error', 'cannot upload', 'sketch',
  ],
  serial_garbled: [
    'garbled', 'garbage', 'gibberish', 'symbols', 'wrong characters',
    'corrupt', 'unreadable', 'baud', 'serial', 'monitor', 'output',
    'characters', 'encoding', 'scrambled', 'noise', 'junk',
  ],
  program_crashes: [
    'crash', 'freeze', 'hang', 'reset', 'reboot', 'restart', 'watchdog',
    'stack overflow', 'exception', 'panic', 'guru meditation', 'wdt',
    'stuck', 'stop', 'unresponsive', 'lock up', 'not responding',
  ],
  sensor_wrong_values: [
    'sensor', 'reading', 'value', 'wrong', 'incorrect', 'inaccurate',
    'stuck', 'zero', '1023', '4095', 'analog', 'adc', 'temperature',
    'noisy', 'fluctuate', 'calibration', 'offset', 'measure', 'read',
  ],
  motor_not_spinning: [
    'motor', 'spin', 'rotate', 'move', 'turn', 'pwm', 'speed',
    'driver', 'h-bridge', 'l298', 'l293', 'servo', 'stepper',
    'actuator', 'not moving', 'not spinning', 'won\'t move',
  ],
  wifi_wont_connect: [
    'wifi', 'wi-fi', 'wireless', 'network', 'ssid', 'connect',
    'internet', 'esp32', 'esp8266', 'iot', 'mqtt', 'http', 'web',
    'access point', 'router', '2.4ghz', '5ghz', 'wlan',
  ],
};

// ---------------------------------------------------------------------------
// Node lookup index
// ---------------------------------------------------------------------------

const NODE_MAP = new Map<string, DecisionNode>(
  DECISION_TREE.map((n) => [n.id, n]),
);

/** Root node ID for each symptom category. */
const CATEGORY_ROOTS: Record<SymptomCategory, string> = {
  board_not_detected: 'bnd-root',
  upload_fails: 'uf-root',
  serial_garbled: 'sg-root',
  program_crashes: 'pc-root',
  sensor_wrong_values: 'swv-root',
  motor_not_spinning: 'mns-root',
  wifi_wont_connect: 'wwc-root',
};

// ---------------------------------------------------------------------------
// Node Accessors
// ---------------------------------------------------------------------------

/** Get a decision tree node by its ID. */
export function getNodeById(id: string): DecisionNode | undefined {
  return NODE_MAP.get(id);
}

/** Get the root node ID for a symptom category. */
export function getRootNodeId(category: SymptomCategory): string {
  return CATEGORY_ROOTS[category];
}

/** Get all categories available. */
export function getAllCategories(): SymptomCategory[] {
  return Object.keys(CATEGORY_ROOTS) as SymptomCategory[];
}

/** Get all leaf nodes in the tree. */
export function getAllLeafNodes(): LeafNode[] {
  return DECISION_TREE.filter((n): n is LeafNode => n.type === 'leaf') as LeafNode[];
}

/** Get all nodes for a specific category. */
export function getNodesForCategory(category: SymptomCategory): DecisionNode[] {
  return DECISION_TREE.filter((n) => n.category === category) as DecisionNode[];
}

// ---------------------------------------------------------------------------
// Fuzzy Symptom Matching
// ---------------------------------------------------------------------------

/**
 * Tokenize input text into lowercase words, removing punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Compute a fuzzy match score between input text and a keyword list.
 * Returns a score between 0.0 and 1.0.
 */
function computeMatchScore(inputTokens: string[], keywords: readonly string[]): number {
  if (inputTokens.length === 0 || keywords.length === 0) {
    return 0;
  }

  let matchedKeywords = 0;
  const inputText = inputTokens.join(' ');

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    // Multi-word keywords: check if the full phrase appears in the input
    if (kwLower.includes(' ')) {
      if (inputText.includes(kwLower)) {
        matchedKeywords += 2; // Phrase matches are worth double
      }
    } else {
      // Single-word keywords: require exact token match or that one fully
      // contains the other with a minimum length of 3 to avoid false positives
      // from short common words like "is", "no", "up"
      for (const token of inputTokens) {
        if (token === kwLower) {
          matchedKeywords += 1;
          break;
        }
        if (token.length >= 3 && kwLower.length >= 3) {
          if (token.includes(kwLower) || kwLower.includes(token)) {
            matchedKeywords += 1;
            break;
          }
        }
      }
    }
  }

  // Normalize: fraction of keywords matched, capped at 1.0
  return Math.min(matchedKeywords / Math.max(keywords.length * 0.3, 1), 1.0);
}

/**
 * Match a user's symptom description to the best-fitting categories.
 * Returns all categories sorted by match score (best first).
 * Only returns categories with a score > 0.
 */
export function matchSymptom(description: string): SymptomMatch[] {
  const tokens = tokenize(description);
  if (tokens.length === 0) {
    return [];
  }

  const results: SymptomMatch[] = [];
  const categories = getAllCategories();

  for (const category of categories) {
    const keywords = SYMPTOM_KEYWORDS[category];
    const score = computeMatchScore(tokens, keywords);
    if (score > 0) {
      results.push({
        category,
        label: SYMPTOM_LABELS[category],
        score,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get the best-matching category for a symptom description.
 * Returns null if no match found.
 */
export function matchBestCategory(description: string): SymptomCategory | null {
  const matches = matchSymptom(description);
  if (matches.length === 0) {
    return null;
  }
  return matches[0].category;
}

// ---------------------------------------------------------------------------
// Session Management — BoardDoctor Singleton
// ---------------------------------------------------------------------------

/** Listener callback type. */
export type BoardDoctorListener = () => void;

let sessionCounter = 0;

/** Generate a unique session ID. */
function generateSessionId(): string {
  sessionCounter += 1;
  return `bd-session-${Date.now()}-${sessionCounter}`;
}

/**
 * BoardDoctor — singleton diagnostic engine.
 *
 * Manages diagnostic sessions, tracks history, and provides the
 * conversational interface for guided troubleshooting.
 */
export class BoardDoctor {
  private static instance: BoardDoctor | null = null;

  private currentSession: DiagnosticSession | null = null;
  private sessionHistory: DiagnosticResult[] = [];
  private listeners: Set<BoardDoctorListener> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  /** Get the singleton instance. */
  static getInstance(): BoardDoctor {
    if (!BoardDoctor.instance) {
      BoardDoctor.instance = new BoardDoctor();
    }
    return BoardDoctor.instance;
  }

  /** Reset the singleton (primarily for testing). */
  static resetInstance(): void {
    BoardDoctor.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: BoardDoctorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Session Lifecycle
  // -----------------------------------------------------------------------

  /** Start a new diagnostic session for a symptom category. */
  startSession(category: SymptomCategory): DiagnosticSession {
    const rootId = getRootNodeId(category);
    const session: DiagnosticSession = {
      id: generateSessionId(),
      category,
      startedAt: Date.now(),
      answers: [],
      currentNodeId: rootId,
      result: null,
      isComplete: false,
    };
    this.currentSession = session;
    this.notify();
    return session;
  }

  /** Start a session from a symptom description (fuzzy matching). */
  startSessionFromDescription(description: string): DiagnosticSession | null {
    const category = matchBestCategory(description);
    if (!category) {
      return null;
    }
    return this.startSession(category);
  }

  /** Answer the current question in the active session. */
  answer(response: 'yes' | 'no'): DiagnosticSession {
    if (!this.currentSession || this.currentSession.isComplete) {
      throw new Error('No active diagnostic session');
    }

    const currentNode = getNodeById(this.currentSession.currentNodeId);
    if (!currentNode || currentNode.type !== 'question') {
      throw new Error('Current node is not a question');
    }

    const sessionAnswer: SessionAnswer = {
      nodeId: currentNode.id,
      answer: response,
      timestamp: Date.now(),
    };

    const nextNodeId = response === 'yes' ? currentNode.yesNext : currentNode.noNext;
    const nextNode = getNodeById(nextNodeId);

    if (!nextNode) {
      throw new Error(`Decision tree broken: node "${nextNodeId}" not found`);
    }

    const newAnswers = [...this.currentSession.answers, sessionAnswer];

    if (nextNode.type === 'leaf') {
      // Reached a diagnosis
      const answerPath = newAnswers.map((a) => a.nodeId);
      const result: DiagnosticResult = {
        nodeId: nextNode.id,
        category: nextNode.category,
        diagnosis: nextNode.diagnosis,
        causes: nextNode.causes,
        solutions: nextNode.solutions,
        severity: nextNode.severity,
        path: answerPath,
        timestamp: Date.now(),
      };

      this.currentSession = {
        ...this.currentSession,
        answers: newAnswers,
        currentNodeId: nextNodeId,
        result,
        isComplete: true,
      };

      // Add to history
      this.sessionHistory = [...this.sessionHistory, result];
    } else {
      // Continue to next question
      this.currentSession = {
        ...this.currentSession,
        answers: newAnswers,
        currentNodeId: nextNodeId,
        result: null,
        isComplete: false,
      };
    }

    this.notify();
    return this.currentSession;
  }

  /** Get the current session. */
  getSession(): DiagnosticSession | null {
    return this.currentSession;
  }

  /** Get the current question node (or null if session is complete or no session). */
  getCurrentQuestion(): QuestionNode | null {
    if (!this.currentSession || this.currentSession.isComplete) {
      return null;
    }
    const node = getNodeById(this.currentSession.currentNodeId);
    if (!node || node.type !== 'question') {
      return null;
    }
    return node;
  }

  /** Get the current result (or null if session is not complete). */
  getCurrentResult(): DiagnosticResult | null {
    if (!this.currentSession) {
      return null;
    }
    return this.currentSession.result;
  }

  /** Cancel the current session without recording a result. */
  cancelSession(): void {
    if (this.currentSession) {
      this.currentSession = null;
      this.notify();
    }
  }

  /** Check if there is an active session. */
  hasActiveSession(): boolean {
    return this.currentSession !== null && !this.currentSession.isComplete;
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /** Get all past diagnostic results. */
  getHistory(): readonly DiagnosticResult[] {
    return this.sessionHistory;
  }

  /** Get the most recent diagnostic result. */
  getLastResult(): DiagnosticResult | null {
    if (this.sessionHistory.length === 0) {
      return null;
    }
    return this.sessionHistory[this.sessionHistory.length - 1];
  }

  /** Get history filtered by category. */
  getHistoryByCategory(category: SymptomCategory): DiagnosticResult[] {
    return this.sessionHistory.filter((r) => r.category === category);
  }

  /** Clear all session history. */
  clearHistory(): void {
    this.sessionHistory = [];
    this.notify();
  }

  /** Get the total number of completed diagnostics. */
  getCompletedCount(): number {
    return this.sessionHistory.length;
  }
}
