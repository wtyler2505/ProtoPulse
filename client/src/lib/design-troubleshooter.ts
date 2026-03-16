/**
 * Design Troubleshooter — Interactive wizard for diagnosing common electronics mistakes.
 *
 * Provides a searchable library of 17 common circuit/design mistakes with symptoms,
 * root causes, step-by-step fixes, and prevention tips. Aimed at beginners and
 * intermediate makers who may not recognize why their circuit isn't working.
 *
 * Usage:
 *   const ts = DesignTroubleshooter.getInstance();
 *   const results = ts.searchBySymptom('not powering on');
 *   const mistake = ts.getMistake('floating-inputs');
 *
 * React hook:
 *   const { searchBySymptom, getMistake, getAllMistakes, categories } = useDesignTroubleshooter();
 */

import { useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MistakeCategory =
  | 'power'
  | 'signal'
  | 'protection'
  | 'communication'
  | 'analog'
  | 'digital'
  | 'passive';

export type MistakeSeverity = 'critical' | 'major' | 'minor';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface FixStep {
  step: number;
  instruction: string;
  detail: string;
}

export interface DesignMistake {
  id: string;
  title: string;
  category: MistakeCategory;
  severity: MistakeSeverity;
  difficulty: DifficultyLevel;
  symptoms: string[];
  cause: string;
  explanation: string;
  fixSteps: FixStep[];
  preventionTips: string[];
  relatedMistakes: string[];
  tags: string[];
}

export interface SearchResult {
  mistake: DesignMistake;
  score: number;
  matchedSymptoms: string[];
}

// ---------------------------------------------------------------------------
// Built-in Design Mistakes (17)
// ---------------------------------------------------------------------------

const BUILT_IN_MISTAKES: DesignMistake[] = [
  {
    id: 'floating-inputs',
    title: 'Floating Inputs',
    category: 'digital',
    severity: 'major',
    difficulty: 'beginner',
    symptoms: [
      'Circuit behaves erratically or randomly',
      'Output toggles on its own',
      'Touching the circuit changes behavior',
      'Readings are inconsistent or noisy',
    ],
    cause: 'Digital input pins are not connected to a defined logic level (HIGH or LOW).',
    explanation:
      'An unconnected (floating) digital input picks up stray electromagnetic noise and can randomly read as HIGH or LOW. This makes the circuit behave unpredictably. Every digital input must be driven to a known state.',
    fixSteps: [
      { step: 1, instruction: 'Identify all unconnected input pins', detail: 'Check your MCU, logic ICs, and comparators for any input pin that is not wired to another signal.' },
      { step: 2, instruction: 'Add a pull-up or pull-down resistor', detail: 'Use a 10k ohm resistor to tie the pin to VCC (pull-up) or GND (pull-down), depending on the desired default state.' },
      { step: 3, instruction: 'Enable internal pull-ups if available', detail: 'Many microcontrollers (Arduino, ESP32, STM32) have internal pull-up resistors that can be enabled in firmware: pinMode(pin, INPUT_PULLUP).' },
      { step: 4, instruction: 'Verify the fix', detail: 'Check that the pin reads a stable logic level with a multimeter or oscilloscope.' },
    ],
    preventionTips: [
      'Always account for every input pin in your schematic review',
      'Use internal pull-ups/pull-downs where available to save board space',
      'Unused IC inputs should be tied to VCC or GND per the datasheet',
    ],
    relatedMistakes: ['missing-ground', 'i2c-missing-pullups'],
    tags: ['floating', 'pullup', 'pulldown', 'input', 'noise', 'erratic', 'random'],
  },
  {
    id: 'missing-decoupling-caps',
    title: 'Missing Decoupling Capacitors',
    category: 'power',
    severity: 'major',
    difficulty: 'beginner',
    symptoms: [
      'IC resets randomly under load',
      'Analog readings have excessive noise',
      'Communication (SPI/I2C/UART) glitches',
      'Circuit works on bench but fails when motors or relays are added',
    ],
    cause: 'ICs lack bypass capacitors near their power pins, causing voltage dips during switching.',
    explanation:
      'Every digital IC draws short bursts of current when switching. Without a local capacitor to supply this current, the power rail dips momentarily, potentially causing the IC to malfunction or reset. Decoupling caps act as tiny local energy reservoirs.',
    fixSteps: [
      { step: 1, instruction: 'Identify every IC power pin pair (VCC/GND)', detail: 'Check the datasheet for each IC to find all VCC and GND pin pairs.' },
      { step: 2, instruction: 'Place a 100nF ceramic capacitor', detail: 'Add a 100nF (0.1uF) ceramic capacitor as close as physically possible to each VCC/GND pair.' },
      { step: 3, instruction: 'Add bulk capacitance at power entry', detail: 'Place a 10uF-100uF electrolytic or tantalum capacitor where power enters the board.' },
      { step: 4, instruction: 'Keep traces short', detail: 'Route the capacitor with the shortest possible traces directly to the IC pins — long traces add inductance and defeat the purpose.' },
    ],
    preventionTips: [
      'Default rule: one 100nF cap per IC power pin pair, always',
      'Add 10uF bulk cap at each voltage regulator output',
      'Check IC datasheets — some require specific capacitor values',
      'For ADCs, use additional low-ESR caps on the analog supply',
    ],
    relatedMistakes: ['shorted-power-rails', 'wrong-crystal-loading-caps'],
    tags: ['decoupling', 'bypass', 'capacitor', 'noise', 'reset', 'power', 'glitch'],
  },
  {
    id: 'wrong-polarity',
    title: 'Wrong Polarity / Reversed Component',
    category: 'power',
    severity: 'critical',
    difficulty: 'beginner',
    symptoms: [
      'Component gets hot immediately',
      'Magic smoke released',
      'Circuit draws excessive current',
      'Electrolytic capacitor bulges or pops',
      'LED does not light up',
    ],
    cause: 'A polarized component (electrolytic cap, diode, LED, voltage regulator) is installed backwards.',
    explanation:
      'Polarized components have a specific orientation. Reversing them can cause short circuits, overheating, or catastrophic failure. Electrolytic capacitors can vent or explode when reverse-biased. LEDs simply won\'t conduct. Voltage regulators may pass unregulated voltage or short the supply.',
    fixSteps: [
      { step: 1, instruction: 'Disconnect power immediately', detail: 'If you smell burning or see smoke, remove power right away to prevent further damage.' },
      { step: 2, instruction: 'Identify the reversed component', detail: 'Check electrolytic caps (stripe = negative), diodes (band = cathode), LEDs (short lead = cathode), ICs (dot/notch = pin 1).' },
      { step: 3, instruction: 'Inspect for damage', detail: 'Look for discoloration, swelling, melted plastic, or burnt traces. Damaged components must be replaced.' },
      { step: 4, instruction: 'Correct the orientation and test', detail: 'Install the component in the correct orientation. Power on cautiously while monitoring current draw.' },
    ],
    preventionTips: [
      'Always mark polarity on your schematic and PCB silkscreen',
      'Double-check orientation before soldering',
      'Add reverse polarity protection (Schottky diode or P-FET) on power inputs',
      'Use a current-limited power supply during bring-up',
    ],
    relatedMistakes: ['led-without-resistor', 'shorted-power-rails'],
    tags: ['polarity', 'reversed', 'backwards', 'smoke', 'hot', 'electrolytic', 'diode', 'LED'],
  },
  {
    id: 'shorted-power-rails',
    title: 'Shorted Power Rails',
    category: 'power',
    severity: 'critical',
    difficulty: 'beginner',
    symptoms: [
      'Power supply shuts down or current-limits',
      'Voltage regulator gets extremely hot',
      'Board draws much more current than expected',
      'Fuse blows immediately',
      'No voltage at test points',
    ],
    cause: 'VCC and GND are connected together, either by a solder bridge, misrouted trace, or component failure.',
    explanation:
      'A short circuit between power and ground creates a near-zero-resistance path, causing excessive current flow. This can damage the power supply, traces, and components. Common causes: solder bridges between adjacent pads, incorrectly wired connectors, or a failed component breaking down internally.',
    fixSteps: [
      { step: 1, instruction: 'Remove all power', detail: 'Disconnect the power supply completely before investigating.' },
      { step: 2, instruction: 'Measure resistance between VCC and GND', detail: 'Use a multimeter in resistance/continuity mode. A short will read near 0 ohms.' },
      { step: 3, instruction: 'Isolate sections', detail: 'If your board has multiple sections, cut traces or remove ICs to narrow down where the short is located.' },
      { step: 4, instruction: 'Inspect visually', detail: 'Use a magnifying glass to check for solder bridges, whiskers, or damaged components. Check both sides of the PCB.' },
      { step: 5, instruction: 'Fix the short', detail: 'Remove solder bridges with wick/solder sucker. Replace damaged components. Repair cut traces after the short is fixed.' },
    ],
    preventionTips: [
      'Run DRC before fabrication to catch clearance violations',
      'Use a current-limited bench supply during first power-on',
      'Check continuity between VCC and GND before powering a new board',
      'Avoid routing power traces between fine-pitch IC pads',
    ],
    relatedMistakes: ['wrong-polarity', 'missing-decoupling-caps'],
    tags: ['short', 'power', 'vcc', 'gnd', 'bridge', 'fuse', 'current', 'hot'],
  },
  {
    id: 'missing-ground',
    title: 'Missing or Broken Ground Connection',
    category: 'power',
    severity: 'critical',
    difficulty: 'beginner',
    symptoms: [
      'Circuit does not power on at all',
      'Intermittent behavior',
      'Voltage measurements are wrong or unstable',
      'Some ICs work but others do not',
      'Touching ground wire changes behavior',
    ],
    cause: 'One or more components lack a proper ground return path.',
    explanation:
      'Current must flow in a complete loop — from the power supply, through the circuit, and back via ground. A missing or broken ground connection prevents current from returning, causing the affected portion of the circuit to not function. This is especially common with multi-board setups or when using separate power domains.',
    fixSteps: [
      { step: 1, instruction: 'Verify main ground connection', detail: 'Check that the power supply ground is connected to the board ground. Measure continuity.' },
      { step: 2, instruction: 'Check all ground pins on ICs', detail: 'Every IC must have its ground pin(s) connected. An unconnected GND pin means the IC cannot function.' },
      { step: 3, instruction: 'Inspect ground traces for breaks', detail: 'Look for cracked traces, cold solder joints, or unsoldered pins on ground connections.' },
      { step: 4, instruction: 'Connect grounds between boards', detail: 'If using multiple boards (e.g., Arduino + motor driver), ensure they share a common ground.' },
    ],
    preventionTips: [
      'Use a ground pour/plane on your PCB — it makes missing connections obvious',
      'Always connect grounds between different boards and power supplies',
      'Run an ERC check to catch unconnected power pins',
      'Star-ground or ground plane topology is preferred over daisy-chaining',
    ],
    relatedMistakes: ['floating-inputs', 'shorted-power-rails'],
    tags: ['ground', 'gnd', 'return path', 'no power', 'common', 'connection'],
  },
  {
    id: 'voltage-divider-errors',
    title: 'Incorrect Voltage Divider Ratio',
    category: 'analog',
    severity: 'major',
    difficulty: 'intermediate',
    symptoms: [
      'ADC readings are wrong or clipped',
      'Logic level conversion does not work',
      'Signal is too weak or too strong',
      'Voltage at divider output is not the expected value',
    ],
    cause: 'Resistor values in a voltage divider produce the wrong output voltage, or the divider is loaded by downstream circuitry.',
    explanation:
      'A voltage divider uses two resistors to reduce voltage: Vout = Vin * R2 / (R1 + R2). Common errors: swapping R1 and R2, using wrong resistor values, or loading the divider with a low-impedance input that sinks current and pulls the voltage down. The divider output impedance must be much lower than the load impedance.',
    fixSteps: [
      { step: 1, instruction: 'Calculate the expected output', detail: 'Use the formula Vout = Vin * R2 / (R1 + R2). R1 is between Vin and Vout; R2 is between Vout and GND.' },
      { step: 2, instruction: 'Verify resistor values', detail: 'Measure each resistor with a multimeter. Wrong resistor values are a common mistake — check color codes or SMD markings.' },
      { step: 3, instruction: 'Check for loading', detail: 'Measure the output voltage with and without the load connected. If it changes significantly, the load impedance is too low relative to R2.' },
      { step: 4, instruction: 'Use lower resistance values or a buffer', detail: 'If loaded, reduce R1 and R2 proportionally (keeping the ratio) or add an op-amp buffer between the divider and the load.' },
    ],
    preventionTips: [
      'Always verify the divider ratio with the formula before building',
      'Keep divider impedance at least 10x lower than the load impedance',
      'Use ProtoPulse\'s voltage divider calculator to get correct values',
      'For ADC inputs, check the ADC input impedance in the MCU datasheet',
    ],
    relatedMistakes: ['floating-inputs', 'wrong-crystal-loading-caps'],
    tags: ['voltage divider', 'resistor', 'ratio', 'adc', 'level shift', 'loading'],
  },
  {
    id: 'led-without-resistor',
    title: 'LED Without Current-Limiting Resistor',
    category: 'passive',
    severity: 'major',
    difficulty: 'beginner',
    symptoms: [
      'LED burns out quickly',
      'LED is extremely bright then dies',
      'MCU pin gets hot when driving LED',
      'GPIO pin stops working after connecting LED',
    ],
    cause: 'An LED is connected directly to a voltage source or GPIO pin without a series resistor to limit current.',
    explanation:
      'LEDs have very low forward resistance — without a series resistor, the current is limited only by the source impedance, often resulting in current far exceeding the LED\'s maximum rating. This destroys the LED and can damage the driving GPIO pin. The resistor value is calculated as: R = (Vsource - Vf) / If, where Vf is the LED forward voltage and If is the desired current (typically 10-20mA).',
    fixSteps: [
      { step: 1, instruction: 'Determine LED specifications', detail: 'Find the forward voltage (Vf) and maximum current (If) from the LED datasheet. Typical: red Vf=1.8V, green Vf=2.2V, blue/white Vf=3.0V, If=20mA.' },
      { step: 2, instruction: 'Calculate the resistor value', detail: 'R = (Vsource - Vf) / If. Example: 5V source, red LED: R = (5 - 1.8) / 0.020 = 160 ohm. Use the next standard value up: 180 or 220 ohm.' },
      { step: 3, instruction: 'Add the resistor in series', detail: 'Place the resistor between the GPIO/voltage source and the LED anode (or between cathode and ground — same effect).' },
      { step: 4, instruction: 'Verify current draw', detail: 'Measure the current through the LED with a multimeter in series. It should be at or below the rated If.' },
    ],
    preventionTips: [
      'Never connect an LED directly to a voltage source or GPIO',
      'Keep standard LED resistor values handy: 220 ohm for 5V, 68 ohm for 3.3V (typical red LED)',
      'For multiple LEDs, each needs its own resistor unless specifically designed for constant-current drivers',
    ],
    relatedMistakes: ['wrong-polarity', 'floating-inputs'],
    tags: ['led', 'resistor', 'current limiting', 'burn', 'bright', 'gpio'],
  },
  {
    id: 'i2c-missing-pullups',
    title: 'I2C Bus Missing Pull-Up Resistors',
    category: 'communication',
    severity: 'major',
    difficulty: 'intermediate',
    symptoms: [
      'I2C device not detected (scanner shows no address)',
      'Communication hangs or times out',
      'Data corruption on I2C bus',
      'Intermittent communication failures',
      'SDA or SCL line voltage does not reach VCC',
    ],
    cause: 'The I2C bus SDA and SCL lines lack required pull-up resistors to VCC.',
    explanation:
      'I2C is an open-drain bus — devices can only pull lines LOW, and they rely on external pull-up resistors to pull lines HIGH. Without pull-ups, the lines float and never reach a valid HIGH level. Standard I2C needs 4.7k ohm pull-ups for 100kHz, 2.2k ohm for 400kHz. Only ONE set of pull-ups should be on the bus (too many parallel pull-ups reduce the effective resistance too much).',
    fixSteps: [
      { step: 1, instruction: 'Check SDA and SCL voltages', detail: 'With power on and the bus idle, measure SDA and SCL. They should be at VCC (3.3V or 5V). If low or floating, pull-ups are missing.' },
      { step: 2, instruction: 'Add pull-up resistors', detail: 'Connect a 4.7k ohm resistor from SDA to VCC, and another 4.7k ohm from SCL to VCC. Use 2.2k for 400kHz (fast mode).' },
      { step: 3, instruction: 'Check for duplicate pull-ups', detail: 'If using breakout boards (Adafruit, SparkFun), many already include pull-ups. Having pull-ups on multiple boards in parallel reduces the resistance — remove extras if the total is below 1k ohm.' },
      { step: 4, instruction: 'Verify with an I2C scanner', detail: 'Run an I2C scanner sketch to confirm the device is detected at the expected address.' },
    ],
    preventionTips: [
      'Always include I2C pull-ups in your base schematic — it is a bus requirement, not optional',
      'Document which board supplies the pull-ups to avoid duplication',
      'For long I2C runs (>30cm), consider lower pull-up values or an I2C buffer',
    ],
    relatedMistakes: ['floating-inputs', 'spi-bus-contention'],
    tags: ['i2c', 'pull-up', 'sda', 'scl', 'open drain', 'communication', 'bus'],
  },
  {
    id: 'spi-bus-contention',
    title: 'SPI Bus Contention',
    category: 'communication',
    severity: 'major',
    difficulty: 'intermediate',
    symptoms: [
      'SPI device returns garbage data',
      'Multiple SPI devices conflict',
      'One SPI device works, but adding a second breaks both',
      'MISO line shows incorrect voltage levels',
    ],
    cause: 'Multiple SPI devices have their chip select (CS) lines active simultaneously, causing bus contention on the shared MISO line.',
    explanation:
      'SPI uses shared MOSI, MISO, and CLK lines, with individual chip select (CS/SS) lines to address each device. Only ONE device should have CS asserted (LOW) at a time. If two CS lines are both LOW, both devices try to drive MISO simultaneously, causing electrical contention that corrupts data and can damage outputs.',
    fixSteps: [
      { step: 1, instruction: 'Identify all CS pins', detail: 'List every SPI device and its CS pin. Ensure each device has a UNIQUE CS pin — do not share CS between devices.' },
      { step: 2, instruction: 'Verify CS initialization', detail: 'In firmware, set all CS pins HIGH (deselected) at startup, BEFORE initializing SPI. This prevents contention during boot.' },
      { step: 3, instruction: 'Check CS logic in code', detail: 'Before each SPI transaction: drive the target CS LOW, transfer data, then drive CS HIGH before accessing another device.' },
      { step: 4, instruction: 'Add pull-up resistors on CS lines', detail: 'A 10k pull-up to VCC on each CS line ensures devices are deselected if the MCU pin is floating during reset.' },
    ],
    preventionTips: [
      'Initialize all CS pins as HIGH before calling SPI.begin()',
      'Never share a CS pin between two different SPI devices',
      'Add 10k pull-ups on CS lines for robust boot behavior',
      'If running out of GPIO for CS, use a shift register or multiplexer',
    ],
    relatedMistakes: ['i2c-missing-pullups', 'floating-inputs'],
    tags: ['spi', 'chip select', 'cs', 'contention', 'miso', 'bus', 'conflict'],
  },
  {
    id: 'wrong-crystal-loading-caps',
    title: 'Wrong Crystal Loading Capacitors',
    category: 'analog',
    severity: 'major',
    difficulty: 'intermediate',
    symptoms: [
      'MCU clock is inaccurate or unstable',
      'MCU fails to start or start is unreliable',
      'Serial communication (UART) has baud rate errors',
      'Real-time clock drifts excessively',
    ],
    cause: 'The loading capacitors on a crystal oscillator are the wrong value for the crystal\'s specified load capacitance.',
    explanation:
      'A crystal oscillator requires specific loading capacitors (CL) to oscillate at its rated frequency. The formula is: C_each = 2 * (CL - Cstray), where Cstray is typically 3-5pF from PCB traces and IC pins. Wrong values cause the oscillator to run off-frequency, be slow to start, or fail entirely. Always check the crystal datasheet for the required CL value.',
    fixSteps: [
      { step: 1, instruction: 'Find the crystal\'s load capacitance', detail: 'Look up CL in the crystal datasheet. Common values: 12pF, 18pF, 20pF.' },
      { step: 2, instruction: 'Calculate capacitor values', detail: 'C_each = 2 * (CL - Cstray). For CL=20pF, Cstray=5pF: C_each = 2 * (20-5) = 30pF. Use 33pF as the nearest standard value.' },
      { step: 3, instruction: 'Replace the capacitors', detail: 'Use ceramic NP0/C0G capacitors (not X7R/X5R which are voltage-dependent). Place them as close to the crystal pins as possible.' },
      { step: 4, instruction: 'Verify oscillation', detail: 'Use an oscilloscope to confirm the crystal oscillates cleanly at the rated frequency.' },
    ],
    preventionTips: [
      'Always calculate loading caps from the crystal datasheet — do not guess',
      'Use NP0/C0G ceramic caps for oscillator circuits',
      'Keep crystal traces short and avoid routing signals under the crystal',
    ],
    relatedMistakes: ['missing-decoupling-caps', 'voltage-divider-errors'],
    tags: ['crystal', 'oscillator', 'loading', 'capacitor', 'clock', 'frequency', 'xtal'],
  },
  {
    id: 'uart-tx-rx-swap',
    title: 'UART TX/RX Lines Swapped',
    category: 'communication',
    severity: 'major',
    difficulty: 'beginner',
    symptoms: [
      'No serial communication at all',
      'Serial monitor shows nothing',
      'TX LED blinks but no data received',
      'Two devices cannot talk to each other',
    ],
    cause: 'TX on one device is connected to TX on the other (instead of TX to RX crossover).',
    explanation:
      'UART requires a crossover connection: TX (transmit) on device A connects to RX (receive) on device B, and vice versa. This is because TX outputs data and RX receives it. Some boards label pins from the perspective of the module, others from the perspective of the host — read the schematic or datasheet carefully. USB-to-serial adapters typically label from the adapter\'s perspective.',
    fixSteps: [
      { step: 1, instruction: 'Identify TX and RX on both devices', detail: 'Check which pin is transmit (TX/TXD) and which is receive (RX/RXD) on each device.' },
      { step: 2, instruction: 'Cross-connect the lines', detail: 'Connect TX of device A to RX of device B, and RX of device A to TX of device B.' },
      { step: 3, instruction: 'Verify voltage levels', detail: 'Ensure both devices use the same logic voltage (3.3V or 5V). If mismatched, use a level shifter.' },
      { step: 4, instruction: 'Test with a loopback', detail: 'Connect TX to RX on the same device. Send data and check if it echoes back — this validates the port works.' },
    ],
    preventionTips: [
      'Label UART connections clearly on your schematic',
      'When in doubt, try swapping TX and RX — it cannot damage anything',
      'Use the loopback test to verify each UART port independently',
    ],
    relatedMistakes: ['spi-bus-contention', 'i2c-missing-pullups'],
    tags: ['uart', 'serial', 'tx', 'rx', 'swap', 'communication', 'rs232'],
  },
  {
    id: 'exceeding-gpio-current',
    title: 'Exceeding GPIO Current Limits',
    category: 'digital',
    severity: 'major',
    difficulty: 'beginner',
    symptoms: [
      'GPIO pin voltage drops when driving a load',
      'MCU gets hot near a specific pin',
      'GPIO pin stops working after connecting a load',
      'Motor or relay does not activate from GPIO',
    ],
    cause: 'A load draws more current than the MCU GPIO pin can safely source or sink.',
    explanation:
      'Most MCU GPIO pins can source/sink only 10-40mA (check the datasheet). Connecting a motor, relay coil, or multiple LEDs directly overloads the pin, causing voltage drop, overheating, and potential permanent damage. High-current loads need a driver transistor (MOSFET or BJT) or a dedicated driver IC.',
    fixSteps: [
      { step: 1, instruction: 'Check the GPIO current limit', detail: 'Find the "absolute maximum" and "recommended operating" current per pin in the MCU datasheet. Arduino Uno: 40mA max, 20mA recommended per pin.' },
      { step: 2, instruction: 'Measure the load current', detail: 'Use a multimeter to measure how much current the load draws. Compare against the GPIO limit.' },
      { step: 3, instruction: 'Add a driver transistor', detail: 'Use an N-channel MOSFET (for ground-side switching) or NPN transistor with a base resistor. The GPIO drives the gate/base, and the transistor switches the load.' },
      { step: 4, instruction: 'Add a flyback diode for inductive loads', detail: 'Motors and relay coils are inductive — always add a flyback diode (e.g., 1N4148) across the coil to suppress voltage spikes.' },
    ],
    preventionTips: [
      'Never drive motors, relays, or solenoids directly from GPIO',
      'Budget total MCU current — there is usually a per-chip limit too (e.g., 200mA total for ATmega328)',
      'MOSFETs are easier than BJTs for beginners — try IRLZ44N for logic-level switching',
    ],
    relatedMistakes: ['led-without-resistor', 'missing-flyback-diode'],
    tags: ['gpio', 'current', 'overload', 'mosfet', 'transistor', 'driver', 'motor'],
  },
  {
    id: 'missing-flyback-diode',
    title: 'Missing Flyback Diode on Inductive Load',
    category: 'protection',
    severity: 'critical',
    difficulty: 'beginner',
    symptoms: [
      'MCU resets when a relay or motor switches off',
      'Transistor driver fails after some use',
      'Voltage spikes visible on oscilloscope when motor stops',
      'Erratic behavior coinciding with relay/motor switching',
    ],
    cause: 'An inductive load (relay, motor, solenoid) generates a voltage spike when switched off, and no flyback diode is present to clamp it.',
    explanation:
      'Inductors resist changes in current. When you switch off a motor or relay, the collapsing magnetic field generates a voltage spike that can be hundreds of volts — far exceeding what the switching transistor or MCU can handle. A flyback diode (placed reverse-biased across the inductor) provides a path for this current, clamping the voltage to a safe level.',
    fixSteps: [
      { step: 1, instruction: 'Identify all inductive loads', detail: 'Motors, relays, solenoids, and speakers are all inductive loads that need flyback protection.' },
      { step: 2, instruction: 'Add a diode across each inductor', detail: 'Place a diode (1N4001 or 1N4148) with the cathode (banded end) connected to the positive side of the load and the anode to the negative/ground side.' },
      { step: 3, instruction: 'Position close to the load', detail: 'The flyback diode should be as close to the inductive load as possible, not near the MCU.' },
      { step: 4, instruction: 'Consider a Schottky diode for fast loads', detail: 'For high-speed switching (PWM motors), use a Schottky diode (e.g., 1N5819) for faster clamping response.' },
    ],
    preventionTips: [
      'Every relay, motor, and solenoid MUST have a flyback diode — no exceptions',
      'Use motor driver ICs (L298N, DRV8833) — they include built-in protection',
      'Add flyback diodes to your schematic as a default whenever you see an inductor symbol',
    ],
    relatedMistakes: ['exceeding-gpio-current', 'shorted-power-rails'],
    tags: ['flyback', 'diode', 'inductive', 'relay', 'motor', 'solenoid', 'spike', 'protection'],
  },
  {
    id: 'voltage-level-mismatch',
    title: 'Voltage Level Mismatch Between Devices',
    category: 'signal',
    severity: 'major',
    difficulty: 'intermediate',
    symptoms: [
      'Communication works one direction but not the other',
      'Slave device does not respond',
      '3.3V device gets hot when connected to 5V device',
      'Data received is corrupted',
    ],
    cause: 'Two devices operate at different logic voltage levels (e.g., 3.3V and 5V) and are connected directly without level shifting.',
    explanation:
      'Connecting a 5V output directly to a 3.3V input can damage the 3.3V device (if it is not 5V-tolerant) or cause incorrect logic readings. A 3.3V output may not be recognized as HIGH by a 5V input (which typically needs >3.5V). Level shifters, voltage dividers, or bidirectional MOSFET translators solve this.',
    fixSteps: [
      { step: 1, instruction: 'Identify voltage levels of each device', detail: 'Check each device\'s datasheet for VCC/VDD and I/O voltage levels. Note which pins are 5V-tolerant if any.' },
      { step: 2, instruction: 'Determine direction of signals', detail: 'Classify each signal as unidirectional (one way) or bidirectional (e.g., I2C SDA). This determines the type of level shifter needed.' },
      { step: 3, instruction: 'Add appropriate level shifting', detail: 'Unidirectional 5V→3.3V: voltage divider (10k + 20k). Unidirectional 3.3V→5V: MOSFET or 74HCT buffer. Bidirectional: BSS138-based MOSFET level shifter module.' },
      { step: 4, instruction: 'Verify voltage at receiver', detail: 'Measure the signal voltage at the receiving pin. It should be within the input HIGH/LOW thresholds specified in the receiver\'s datasheet.' },
    ],
    preventionTips: [
      'Choose components that operate at the same logic level when possible',
      'Use a bidirectional level shifter module (BSS138 or TXB0108) for mixed-voltage buses',
      'Check datasheets for "5V-tolerant" pins — some 3.3V MCUs can accept 5V on certain pins',
    ],
    relatedMistakes: ['uart-tx-rx-swap', 'i2c-missing-pullups'],
    tags: ['level shift', 'voltage', '3.3v', '5v', 'mismatch', 'logic level', 'tolerance'],
  },
  {
    id: 'unconnected-analog-reference',
    title: 'Unconnected or Wrong Analog Reference',
    category: 'analog',
    severity: 'minor',
    difficulty: 'intermediate',
    symptoms: [
      'ADC readings are noisy or drifting',
      'ADC values max out before expected voltage',
      'Analog readings are inaccurate by a consistent offset',
      'Temperature sensor readings are wrong',
    ],
    cause: 'The MCU\'s analog reference pin (AREF) is floating, or the reference voltage is set incorrectly in firmware.',
    explanation:
      'The ADC compares input voltage against a reference voltage. If using an external reference, the AREF pin must be connected. If using the internal reference, AREF should not have external voltage applied (can damage the MCU). Setting analogReference() wrong in firmware changes the scale of all ADC readings.',
    fixSteps: [
      { step: 1, instruction: 'Determine which reference you need', detail: 'Internal reference (no external parts needed) or external reference (more accurate but requires a voltage reference IC or clean supply).' },
      { step: 2, instruction: 'Configure firmware correctly', detail: 'Arduino: analogReference(DEFAULT) for VCC, analogReference(INTERNAL) for 1.1V, analogReference(EXTERNAL) for AREF pin.' },
      { step: 3, instruction: 'Wire AREF if using external reference', detail: 'Connect a stable voltage to AREF through a low-pass filter (100 ohm + 100nF). Add 100nF bypass cap on AREF for internal reference too.' },
      { step: 4, instruction: 'Calibrate readings', detail: 'Apply a known voltage and compare ADC output. Adjust in software if there is a consistent offset.' },
    ],
    preventionTips: [
      'Bypass AREF with 100nF even when using internal reference — reduces noise',
      'Do not apply external voltage to AREF when using internal reference',
      'For precision applications, use a dedicated voltage reference IC (e.g., LM4040, REF3033)',
    ],
    relatedMistakes: ['voltage-divider-errors', 'missing-decoupling-caps'],
    tags: ['analog', 'adc', 'reference', 'aref', 'noise', 'accuracy', 'calibration'],
  },
  {
    id: 'no-esd-protection',
    title: 'Missing ESD Protection on External Connections',
    category: 'protection',
    severity: 'minor',
    difficulty: 'advanced',
    symptoms: [
      'Board fails after being handled or connected/disconnected',
      'Intermittent failures that correlate with weather (low humidity)',
      'USB or connector pins stop working randomly',
      'IC dies without apparent cause',
    ],
    cause: 'Connectors exposed to human touch or external cables lack ESD protection components.',
    explanation:
      'Electrostatic discharge (ESD) can deliver thousands of volts in nanoseconds through any connector a user can touch: USB, audio jacks, antenna connections, sensor headers. Without TVS diodes or ESD protection ICs on these lines, the energy passes directly into sensitive IC pins and can cause latent or immediate damage.',
    fixSteps: [
      { step: 1, instruction: 'Identify all user-facing connectors', detail: 'USB, headers, screw terminals, audio jacks, antenna connectors — any connection a person might touch or plug/unplug.' },
      { step: 2, instruction: 'Add TVS diode arrays', detail: 'Place a TVS diode array (e.g., PRTR5V0U2X for USB, PESD5V0 for general) on the signal lines at the connector.' },
      { step: 3, instruction: 'Add series resistors if practical', detail: 'A small series resistor (10-100 ohm) on signal lines limits ESD current. Not suitable for high-speed signals (USB 2.0+).' },
      { step: 4, instruction: 'Ensure good grounding', detail: 'Connector ground/shield should connect to board ground through a short, wide trace. This provides the ESD return path.' },
    ],
    preventionTips: [
      'Add ESD protection on every user-accessible connector — it costs cents per line',
      'Use ESD-rated ICs on I/O lines where available',
      'Handle boards with ESD precautions during development (wrist strap, mat)',
    ],
    relatedMistakes: ['missing-flyback-diode', 'voltage-level-mismatch'],
    tags: ['esd', 'tvs', 'protection', 'static', 'connector', 'usb', 'discharge'],
  },
  {
    id: 'wrong-resistor-value',
    title: 'Wrong Resistor Value (Color Code Misread)',
    category: 'passive',
    severity: 'minor',
    difficulty: 'beginner',
    symptoms: [
      'Circuit behavior does not match calculations',
      'LED too bright or too dim',
      'Timer circuit runs at wrong frequency',
      'Pull-up is too strong or too weak',
    ],
    cause: 'A resistor with the wrong value was installed, usually due to misreading the color code or grabbing from the wrong bin.',
    explanation:
      'Resistor color codes can be tricky — brown (1) and red (2) look similar in poor lighting, and the band order can be ambiguous on 4-band resistors. SMD resistor markings (e.g., "102" = 1k, "4R7" = 4.7) also cause confusion. Always verify with a multimeter.',
    fixSteps: [
      { step: 1, instruction: 'Measure the installed resistor', detail: 'Remove power and measure the resistor in-circuit with a multimeter. If other components affect the reading, desolder one leg.' },
      { step: 2, instruction: 'Compare against schematic', detail: 'Check what value is specified in the schematic or BOM for that position.' },
      { step: 3, instruction: 'Replace with correct value', detail: 'Swap the resistor for the correct one. Double-check with a multimeter before installing.' },
    ],
    preventionTips: [
      'Always verify resistor values with a multimeter before soldering',
      'Store resistors in labeled containers or on tape strips',
      'Use ProtoPulse\'s resistor color code calculator',
    ],
    relatedMistakes: ['voltage-divider-errors', 'led-without-resistor'],
    tags: ['resistor', 'color code', 'value', 'wrong', 'measurement', 'e12', 'e24'],
  },
];

// ---------------------------------------------------------------------------
// Fuzzy search helpers
// ---------------------------------------------------------------------------

/** Normalize text for matching. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Split a query into individual tokens. */
function tokenize(query: string): string[] {
  return normalize(query).split(' ').filter((t) => t.length > 0);
}

/** Score a single text against query tokens, returning a 0-1 relevance score. */
function scoreText(text: string, tokens: string[]): number {
  if (tokens.length === 0) { return 0; }
  const normalizedText = normalize(text);
  let matched = 0;
  for (const token of tokens) {
    if (normalizedText.includes(token)) {
      matched++;
    }
  }
  return matched / tokens.length;
}

// ---------------------------------------------------------------------------
// DesignTroubleshooter class
// ---------------------------------------------------------------------------

export class DesignTroubleshooter {
  private static instance: DesignTroubleshooter | null = null;
  private readonly mistakes: DesignMistake[];

  private constructor() {
    this.mistakes = [...BUILT_IN_MISTAKES];
  }

  static getInstance(): DesignTroubleshooter {
    if (!DesignTroubleshooter.instance) {
      DesignTroubleshooter.instance = new DesignTroubleshooter();
    }
    return DesignTroubleshooter.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    DesignTroubleshooter.instance = null;
  }

  /** Get all mistakes. */
  getAllMistakes(): DesignMistake[] {
    return [...this.mistakes];
  }

  /** Get a specific mistake by ID. */
  getMistake(id: string): DesignMistake | undefined {
    return this.mistakes.find((m) => m.id === id);
  }

  /** Get mistakes by category. */
  getByCategory(category: MistakeCategory): DesignMistake[] {
    return this.mistakes.filter((m) => m.category === category);
  }

  /** Get mistakes by severity. */
  getBySeverity(severity: MistakeSeverity): DesignMistake[] {
    return this.mistakes.filter((m) => m.severity === severity);
  }

  /** Get all available categories. */
  getCategories(): MistakeCategory[] {
    const cats = new Set<MistakeCategory>();
    for (const m of this.mistakes) {
      cats.add(m.category);
    }
    return Array.from(cats);
  }

  /** Search mistakes by symptom description (free text). */
  searchBySymptom(query: string): SearchResult[] {
    if (!query.trim()) { return []; }
    const tokens = tokenize(query);
    const results: SearchResult[] = [];

    for (const mistake of this.mistakes) {
      let bestScore = 0;
      const matchedSymptoms: string[] = [];

      // Score against symptoms (highest weight)
      for (const symptom of mistake.symptoms) {
        const symptomScore = scoreText(symptom, tokens);
        if (symptomScore > 0) {
          matchedSymptoms.push(symptom);
          bestScore = Math.max(bestScore, symptomScore * 1.0);
        }
      }

      // Score against title
      const titleScore = scoreText(mistake.title, tokens) * 0.9;
      bestScore = Math.max(bestScore, titleScore);

      // Score against tags
      const tagText = mistake.tags.join(' ');
      const tagScore = scoreText(tagText, tokens) * 0.8;
      bestScore = Math.max(bestScore, tagScore);

      // Score against cause
      const causeScore = scoreText(mistake.cause, tokens) * 0.6;
      bestScore = Math.max(bestScore, causeScore);

      // Score against explanation (lower weight — broad text)
      const explScore = scoreText(mistake.explanation, tokens) * 0.4;
      bestScore = Math.max(bestScore, explScore);

      if (bestScore > 0) {
        results.push({ mistake, score: bestScore, matchedSymptoms });
      }
    }

    // Sort by score descending, then by severity (critical > major > minor)
    const severityOrder: Record<MistakeSeverity, number> = { critical: 3, major: 2, minor: 1 };
    results.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.01) {
        return b.score - a.score;
      }
      return severityOrder[b.mistake.severity] - severityOrder[a.mistake.severity];
    });

    return results;
  }

  /** Get related mistakes for a given mistake ID. */
  getRelated(id: string): DesignMistake[] {
    const mistake = this.getMistake(id);
    if (!mistake) { return []; }
    return mistake.relatedMistakes
      .map((relId) => this.getMistake(relId))
      .filter((m): m is DesignMistake => m !== undefined);
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useDesignTroubleshooter() {
  const ts = useMemo(() => DesignTroubleshooter.getInstance(), []);

  const searchBySymptom = useCallback(
    (query: string) => ts.searchBySymptom(query),
    [ts],
  );

  const getMistake = useCallback(
    (id: string) => ts.getMistake(id),
    [ts],
  );

  const getAllMistakes = useCallback(
    () => ts.getAllMistakes(),
    [ts],
  );

  const getByCategory = useCallback(
    (category: MistakeCategory) => ts.getByCategory(category),
    [ts],
  );

  const getBySeverity = useCallback(
    (severity: MistakeSeverity) => ts.getBySeverity(severity),
    [ts],
  );

  const getCategories = useCallback(
    () => ts.getCategories(),
    [ts],
  );

  const getRelated = useCallback(
    (id: string) => ts.getRelated(id),
    [ts],
  );

  return {
    searchBySymptom,
    getMistake,
    getAllMistakes,
    getByCategory,
    getBySeverity,
    getCategories,
    getRelated,
  };
}
