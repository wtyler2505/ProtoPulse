/**
 * BL-0431 — AI Root-Cause Analyzer
 *
 * Singleton+subscribe analyzer that maps symptoms across circuit and firmware
 * domains to root causes using a knowledge base of 20+ known failure patterns.
 *
 * Features:
 *   - 20+ known failure patterns (brownout, I2C lockup, SPI timing, ground loops,
 *     floating inputs, decoupling, ESD, thermal runaway, etc.)
 *   - Causal graph construction from symptom observations
 *   - Cross-domain correlation (circuit + firmware symptoms → root cause)
 *   - Probability scoring with evidence weighting
 *   - Transitive cause detection (A causes B causes C)
 *   - Fix recommendations with priority ranking
 *
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Domain a symptom or cause belongs to. */
export type RootCauseDomain = 'circuit' | 'firmware' | 'power' | 'thermal' | 'mechanical' | 'environmental';

/** Severity of a root cause. */
export type CauseSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Priority of a fix recommendation. */
export type FixPriority = 'immediate' | 'high' | 'medium' | 'low';

/** A symptom that can be observed in the system. */
export interface Symptom {
  id: string;
  description: string;
  domain: RootCauseDomain;
  /** Tags for fuzzy matching. */
  tags: string[];
}

/** A known failure pattern with symptoms, causes, and fixes. */
export interface FailurePattern {
  id: string;
  name: string;
  description: string;
  domain: RootCauseDomain;
  severity: CauseSeverity;
  /** Symptom IDs that indicate this pattern. */
  symptomIds: string[];
  /** Pattern IDs that this pattern can cause (transitive). */
  causesPatternIds: string[];
  /** Pattern IDs that can cause this pattern (transitive). */
  causedByPatternIds: string[];
  /** Fix recommendations. */
  fixes: FixRecommendation[];
  /** Minimum evidence weight to consider this pattern likely. */
  evidenceThreshold: number;
}

/** A fix recommendation for a failure pattern. */
export interface FixRecommendation {
  id: string;
  description: string;
  priority: FixPriority;
  domain: RootCauseDomain;
  effort: 'trivial' | 'minor' | 'moderate' | 'major';
  detail: string;
}

/** An observed symptom with optional evidence strength. */
export interface SymptomObservation {
  symptomId: string;
  /** Evidence weight 0-1 (1 = definitely observed). */
  confidence: number;
  /** Additional context from the user. */
  context?: string;
  timestamp: number;
}

/** A node in the causal graph. */
export interface CausalNode {
  patternId: string;
  probability: number;
  matchedSymptoms: string[];
  evidenceWeight: number;
  domain: RootCauseDomain;
}

/** An edge in the causal graph. */
export interface CausalEdge {
  fromPatternId: string;
  toPatternId: string;
  relationship: 'causes' | 'caused_by';
  strength: number;
}

/** The constructed causal graph. */
export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

/** A ranked root cause with probability and supporting evidence. */
export interface RankedRootCause {
  patternId: string;
  patternName: string;
  probability: number;
  severity: CauseSeverity;
  domain: RootCauseDomain;
  matchedSymptoms: string[];
  transitiveEffects: string[];
  fixes: FixRecommendation[];
}

/** Cross-domain correlation result. */
export interface CrossDomainCorrelation {
  circuitPatterns: string[];
  firmwarePatterns: string[];
  correlationStrength: number;
  explanation: string;
}

/** Full analysis result. */
export interface RootCauseAnalysis {
  observations: SymptomObservation[];
  graph: CausalGraph;
  rankedCauses: RankedRootCause[];
  crossDomainCorrelations: CrossDomainCorrelation[];
  timestamp: number;
}

/** Snapshot for subscribers. */
export interface RootCauseSnapshot {
  observations: SymptomObservation[];
  latestAnalysis: RootCauseAnalysis | null;
}

// ---------------------------------------------------------------------------
// Known Symptoms
// ---------------------------------------------------------------------------

const KNOWN_SYMPTOMS: Symptom[] = [
  { id: 'sym-reset-random', description: 'Random MCU resets', domain: 'circuit', tags: ['reset', 'random', 'watchdog', 'brownout'] },
  { id: 'sym-reset-under-load', description: 'Resets when motor or actuator activates', domain: 'power', tags: ['reset', 'load', 'motor', 'inrush'] },
  { id: 'sym-i2c-hang', description: 'I2C bus hangs or stops responding', domain: 'firmware', tags: ['i2c', 'hang', 'freeze', 'bus'] },
  { id: 'sym-spi-corrupt', description: 'SPI data corruption or wrong readings', domain: 'firmware', tags: ['spi', 'corrupt', 'data', 'garbled'] },
  { id: 'sym-adc-noisy', description: 'Noisy or fluctuating ADC readings', domain: 'circuit', tags: ['adc', 'noise', 'fluctuate', 'analog'] },
  { id: 'sym-voltage-sag', description: 'Voltage rail drops below spec', domain: 'power', tags: ['voltage', 'sag', 'drop', 'rail'] },
  { id: 'sym-hot-component', description: 'Component overheating', domain: 'thermal', tags: ['hot', 'heat', 'thermal', 'temperature'] },
  { id: 'sym-no-power', description: 'System does not power on', domain: 'power', tags: ['no', 'power', 'dead', 'off'] },
  { id: 'sym-esd-damage', description: 'Component failure after handling', domain: 'environmental', tags: ['esd', 'static', 'damage', 'handling'] },
  { id: 'sym-ground-bounce', description: 'Signal integrity issues on ground', domain: 'circuit', tags: ['ground', 'bounce', 'noise', 'return'] },
  { id: 'sym-floating-pin', description: 'Unpredictable digital pin behavior', domain: 'circuit', tags: ['floating', 'pin', 'unpredictable', 'input'] },
  { id: 'sym-uart-garbled', description: 'UART communication garbled', domain: 'firmware', tags: ['uart', 'serial', 'garbled', 'baud'] },
  { id: 'sym-pwm-jitter', description: 'PWM output has visible jitter', domain: 'firmware', tags: ['pwm', 'jitter', 'servo', 'motor'] },
  { id: 'sym-watchdog-timeout', description: 'Watchdog timer fires unexpectedly', domain: 'firmware', tags: ['watchdog', 'timeout', 'wdt', 'hang'] },
  { id: 'sym-boot-loop', description: 'System stuck in boot loop', domain: 'firmware', tags: ['boot', 'loop', 'restart', 'crash'] },
  { id: 'sym-intermittent-fault', description: 'Fault occurs intermittently', domain: 'mechanical', tags: ['intermittent', 'sometimes', 'random', 'loose'] },
  { id: 'sym-high-current', description: 'Excessive current draw', domain: 'power', tags: ['current', 'high', 'draw', 'amps'] },
  { id: 'sym-oscillation', description: 'Unwanted oscillation on signal line', domain: 'circuit', tags: ['oscillation', 'ringing', 'overshoot', 'signal'] },
  { id: 'sym-slow-response', description: 'System responds slowly', domain: 'firmware', tags: ['slow', 'lag', 'delay', 'response'] },
  { id: 'sym-memory-leak', description: 'Increasing memory usage over time', domain: 'firmware', tags: ['memory', 'leak', 'heap', 'ram'] },
  { id: 'sym-sensor-drift', description: 'Sensor readings drift over time', domain: 'circuit', tags: ['drift', 'sensor', 'calibration', 'offset'] },
  { id: 'sym-ldo-dropout', description: 'LDO regulator in dropout', domain: 'power', tags: ['ldo', 'dropout', 'regulator', 'voltage'] },
];

// ---------------------------------------------------------------------------
// Known Failure Patterns
// ---------------------------------------------------------------------------

const KNOWN_FAILURE_PATTERNS: FailurePattern[] = [
  {
    id: 'fp-brownout',
    name: 'Brownout / Undervoltage',
    description: 'Supply voltage dips below MCU minimum operating voltage, causing resets or erratic behavior.',
    domain: 'power',
    severity: 'critical',
    symptomIds: ['sym-reset-random', 'sym-reset-under-load', 'sym-voltage-sag', 'sym-boot-loop'],
    causesPatternIds: ['fp-i2c-lockup', 'fp-data-corruption'],
    causedByPatternIds: ['fp-inadequate-decoupling', 'fp-ground-loop'],
    fixes: [
      { id: 'fix-brownout-1', description: 'Add bulk capacitor (100-470uF) near power input', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'Place electrolytic or ceramic cap between VCC and GND at the power entry point.' },
      { id: 'fix-brownout-2', description: 'Use a proper voltage regulator with sufficient headroom', priority: 'high', domain: 'circuit', effort: 'moderate', detail: 'Ensure regulator input voltage stays above dropout voltage even during transients.' },
      { id: 'fix-brownout-3', description: 'Separate power rails for motors and logic', priority: 'high', domain: 'circuit', effort: 'moderate', detail: 'Motor inrush current should not share the same trace as MCU power.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-i2c-lockup',
    name: 'I2C Bus Lockup',
    description: 'I2C bus stuck with SDA held low by a slave device, preventing communication.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-i2c-hang', 'sym-watchdog-timeout', 'sym-slow-response'],
    causesPatternIds: ['fp-watchdog-starvation'],
    causedByPatternIds: ['fp-brownout', 'fp-missing-pullups'],
    fixes: [
      { id: 'fix-i2c-1', description: 'Implement I2C bus recovery (9 clock pulses)', priority: 'immediate', domain: 'firmware', effort: 'minor', detail: 'Toggle SCL 9 times to free stuck slave, then send STOP condition.' },
      { id: 'fix-i2c-2', description: 'Add timeout to all I2C transactions', priority: 'high', domain: 'firmware', effort: 'minor', detail: 'Never block indefinitely waiting for I2C ACK.' },
      { id: 'fix-i2c-3', description: 'Verify pull-up resistor values (2.2k-4.7k typical)', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Too weak or too strong pull-ups cause bus errors.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-spi-timing',
    name: 'SPI Timing Violation',
    description: 'SPI clock too fast for slave device or signal integrity issues on SPI lines.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-spi-corrupt', 'sym-adc-noisy'],
    causesPatternIds: ['fp-data-corruption'],
    causedByPatternIds: ['fp-ground-loop', 'fp-long-traces'],
    fixes: [
      { id: 'fix-spi-1', description: 'Reduce SPI clock speed', priority: 'immediate', domain: 'firmware', effort: 'trivial', detail: 'Start at 1MHz and increase until errors appear, then back off.' },
      { id: 'fix-spi-2', description: 'Add series termination resistors (33-100 ohm)', priority: 'high', domain: 'circuit', effort: 'minor', detail: 'Place resistors at the source end of CLK, MOSI, MISO lines.' },
      { id: 'fix-spi-3', description: 'Keep SPI trace lengths under 10cm', priority: 'medium', domain: 'circuit', effort: 'moderate', detail: 'Long traces act as antennas and pick up noise.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-ground-loop',
    name: 'Ground Loop / Poor Grounding',
    description: 'Multiple ground return paths create voltage differentials causing noise and signal errors.',
    domain: 'circuit',
    severity: 'high',
    symptomIds: ['sym-ground-bounce', 'sym-adc-noisy', 'sym-oscillation'],
    causesPatternIds: ['fp-brownout', 'fp-spi-timing', 'fp-adc-noise'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-gnd-1', description: 'Use star-point grounding topology', priority: 'immediate', domain: 'circuit', effort: 'moderate', detail: 'All ground returns meet at a single point near the power supply.' },
      { id: 'fix-gnd-2', description: 'Separate analog and digital ground planes', priority: 'high', domain: 'circuit', effort: 'major', detail: 'Connect analog and digital grounds only at one point near the ADC.' },
      { id: 'fix-gnd-3', description: 'Thicken ground traces or use ground pour', priority: 'medium', domain: 'circuit', effort: 'minor', detail: 'Reduce ground impedance to minimize voltage drops.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-floating-inputs',
    name: 'Floating Input Pins',
    description: 'Digital input pins left unconnected pick up stray EMI causing random state changes.',
    domain: 'circuit',
    severity: 'medium',
    symptomIds: ['sym-floating-pin', 'sym-intermittent-fault', 'sym-high-current'],
    causesPatternIds: ['fp-excessive-power'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-float-1', description: 'Enable internal pull-up/pull-down resistors', priority: 'immediate', domain: 'firmware', effort: 'trivial', detail: 'Configure unused GPIO pins with INPUT_PULLUP or INPUT_PULLDOWN.' },
      { id: 'fix-float-2', description: 'Add external pull resistors (10k-100k)', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Pull unused pins to a defined logic level.' },
      { id: 'fix-float-3', description: 'Disable unused peripheral pins in firmware', priority: 'medium', domain: 'firmware', effort: 'trivial', detail: 'Set unused pins as outputs driven low to minimize current.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-inadequate-decoupling',
    name: 'Inadequate Decoupling',
    description: 'Missing or improperly placed decoupling capacitors allow high-frequency noise on power rails.',
    domain: 'circuit',
    severity: 'high',
    symptomIds: ['sym-adc-noisy', 'sym-reset-random', 'sym-oscillation', 'sym-spi-corrupt'],
    causesPatternIds: ['fp-brownout', 'fp-adc-noise'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-decap-1', description: 'Place 100nF ceramic cap at every IC VCC pin', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'As close to the pin as possible with short traces to VCC and GND.' },
      { id: 'fix-decap-2', description: 'Add bulk cap (10-47uF) at board power entry', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Handles lower frequency transients and inrush current.' },
      { id: 'fix-decap-3', description: 'Use multi-value decoupling (100nF + 1uF + 10uF)', priority: 'medium', domain: 'circuit', effort: 'minor', detail: 'Different values cover different frequency ranges.' },
    ],
    evidenceThreshold: 0.25,
  },
  {
    id: 'fp-esd-damage',
    name: 'ESD Damage',
    description: 'Electrostatic discharge has damaged sensitive components (MOSFETs, ICs, sensors).',
    domain: 'environmental',
    severity: 'critical',
    symptomIds: ['sym-esd-damage', 'sym-intermittent-fault', 'sym-no-power'],
    causesPatternIds: [],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-esd-1', description: 'Replace damaged components', priority: 'immediate', domain: 'circuit', effort: 'moderate', detail: 'ESD damage is usually permanent — component must be replaced.' },
      { id: 'fix-esd-2', description: 'Add TVS diodes on exposed I/O lines', priority: 'high', domain: 'circuit', effort: 'minor', detail: 'Protect USB, connector pins, and antenna connections.' },
      { id: 'fix-esd-3', description: 'Use ESD-safe handling procedures', priority: 'medium', domain: 'environmental', effort: 'trivial', detail: 'Ground strap, anti-static mat, proper packaging.' },
    ],
    evidenceThreshold: 0.5,
  },
  {
    id: 'fp-thermal-runaway',
    name: 'Thermal Runaway',
    description: 'Component overheating due to excessive power dissipation, potentially leading to failure.',
    domain: 'thermal',
    severity: 'critical',
    symptomIds: ['sym-hot-component', 'sym-high-current', 'sym-reset-random'],
    causesPatternIds: ['fp-excessive-power'],
    causedByPatternIds: ['fp-short-circuit'],
    fixes: [
      { id: 'fix-thermal-1', description: 'Add heatsink to dissipating component', priority: 'immediate', domain: 'mechanical', effort: 'minor', detail: 'Use thermal pad or heatsink with thermal compound.' },
      { id: 'fix-thermal-2', description: 'Reduce switching frequency or duty cycle', priority: 'high', domain: 'firmware', effort: 'minor', detail: 'Lower operating frequency reduces power dissipation.' },
      { id: 'fix-thermal-3', description: 'Upgrade to component with lower Rds(on) or better thermal specs', priority: 'medium', domain: 'circuit', effort: 'moderate', detail: 'Check power dissipation budget vs thermal resistance.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-watchdog-starvation',
    name: 'Watchdog Timer Starvation',
    description: 'Long-running code path prevents watchdog from being fed, causing unexpected resets.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-watchdog-timeout', 'sym-reset-random', 'sym-boot-loop'],
    causesPatternIds: [],
    causedByPatternIds: ['fp-i2c-lockup', 'fp-blocking-code'],
    fixes: [
      { id: 'fix-wdt-1', description: 'Feed watchdog in interrupt or RTOS task', priority: 'immediate', domain: 'firmware', effort: 'minor', detail: 'Do not feed WDT from the main loop if it can block.' },
      { id: 'fix-wdt-2', description: 'Break long operations into chunks', priority: 'high', domain: 'firmware', effort: 'moderate', detail: 'Yield periodically so WDT can be serviced.' },
      { id: 'fix-wdt-3', description: 'Use windowed watchdog for stricter timing', priority: 'low', domain: 'firmware', effort: 'moderate', detail: 'Detect both too-early and too-late feeds.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-adc-noise',
    name: 'ADC Noise / Poor Reference',
    description: 'ADC readings are noisy due to poor reference, grounding, or sampling configuration.',
    domain: 'circuit',
    severity: 'medium',
    symptomIds: ['sym-adc-noisy', 'sym-sensor-drift'],
    causesPatternIds: [],
    causedByPatternIds: ['fp-ground-loop', 'fp-inadequate-decoupling'],
    fixes: [
      { id: 'fix-adc-1', description: 'Use external voltage reference', priority: 'high', domain: 'circuit', effort: 'minor', detail: 'Internal VREF is often noisy — use a dedicated reference IC.' },
      { id: 'fix-adc-2', description: 'Implement software averaging/filtering', priority: 'immediate', domain: 'firmware', effort: 'trivial', detail: 'Average 8-16 samples, or use IIR/moving average filter.' },
      { id: 'fix-adc-3', description: 'Add RC filter on ADC input (1k + 100nF)', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Low-pass filter removes high-frequency noise before ADC.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-uart-baud-mismatch',
    name: 'UART Baud Rate Mismatch',
    description: 'Transmitter and receiver running at different baud rates causing garbled communication.',
    domain: 'firmware',
    severity: 'medium',
    symptomIds: ['sym-uart-garbled'],
    causesPatternIds: [],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-uart-1', description: 'Verify baud rate matches on both ends', priority: 'immediate', domain: 'firmware', effort: 'trivial', detail: 'Check Serial.begin() rate matches the other device.' },
      { id: 'fix-uart-2', description: 'Check crystal/oscillator accuracy', priority: 'medium', domain: 'circuit', effort: 'minor', detail: 'Internal RC oscillator can drift — use external crystal for UART.' },
      { id: 'fix-uart-3', description: 'Use logic analyzer to verify actual baud', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Measure actual bit timing with a scope or logic analyzer.' },
    ],
    evidenceThreshold: 0.5,
  },
  {
    id: 'fp-missing-pullups',
    name: 'Missing Pull-up/Pull-down Resistors',
    description: 'Required pull-up or pull-down resistors missing on bus lines or open-drain outputs.',
    domain: 'circuit',
    severity: 'medium',
    symptomIds: ['sym-i2c-hang', 'sym-floating-pin', 'sym-intermittent-fault'],
    causesPatternIds: ['fp-i2c-lockup'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-pullup-1', description: 'Add pull-up resistors to I2C SDA/SCL (2.2k-4.7k)', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'I2C is open-drain — must have external pull-ups.' },
      { id: 'fix-pullup-2', description: 'Check open-drain/open-collector outputs', priority: 'high', domain: 'circuit', effort: 'trivial', detail: 'Any open-drain output needs an external pull-up to function.' },
    ],
    evidenceThreshold: 0.35,
  },
  {
    id: 'fp-blocking-code',
    name: 'Blocking Code in Main Loop',
    description: 'delay() or blocking waits in main loop prevent timely processing of other tasks.',
    domain: 'firmware',
    severity: 'medium',
    symptomIds: ['sym-slow-response', 'sym-pwm-jitter', 'sym-watchdog-timeout'],
    causesPatternIds: ['fp-watchdog-starvation'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-block-1', description: 'Replace delay() with non-blocking millis() pattern', priority: 'immediate', domain: 'firmware', effort: 'minor', detail: 'Use state machine + millis() comparison instead of delay().' },
      { id: 'fix-block-2', description: 'Use timer interrupts for time-critical tasks', priority: 'high', domain: 'firmware', effort: 'moderate', detail: 'PWM, sampling, and protocol timing in ISR or timer callback.' },
      { id: 'fix-block-3', description: 'Consider RTOS for complex multi-task scheduling', priority: 'low', domain: 'firmware', effort: 'major', detail: 'FreeRTOS on ESP32/STM32 gives preemptive multitasking.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-short-circuit',
    name: 'Short Circuit',
    description: 'Unintended connection between power and ground or between signal lines.',
    domain: 'circuit',
    severity: 'critical',
    symptomIds: ['sym-no-power', 'sym-high-current', 'sym-hot-component'],
    causesPatternIds: ['fp-thermal-runaway'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-short-1', description: 'Visual inspect for solder bridges', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'Use magnifying glass to inspect fine-pitch components.' },
      { id: 'fix-short-2', description: 'Use multimeter continuity test', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'Check between VCC and GND — should not beep.' },
      { id: 'fix-short-3', description: 'Check for crushed traces under components', priority: 'high', domain: 'circuit', effort: 'minor', detail: 'Components placed over traces can short through vias.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-data-corruption',
    name: 'Data Corruption in Memory/Flash',
    description: 'RAM or flash contents corrupted due to power glitches, stack overflow, or DMA errors.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-boot-loop', 'sym-reset-random', 'sym-intermittent-fault'],
    causesPatternIds: [],
    causedByPatternIds: ['fp-brownout', 'fp-spi-timing', 'fp-stack-overflow'],
    fixes: [
      { id: 'fix-data-1', description: 'Implement CRC on stored data', priority: 'high', domain: 'firmware', effort: 'minor', detail: 'Verify integrity of EEPROM/flash data on read.' },
      { id: 'fix-data-2', description: 'Enable brownout detection (BOD)', priority: 'immediate', domain: 'firmware', effort: 'trivial', detail: 'BOD halts CPU before voltage drops low enough to corrupt data.' },
      { id: 'fix-data-3', description: 'Check stack usage and increase if needed', priority: 'high', domain: 'firmware', effort: 'minor', detail: 'Stack overflow corrupts adjacent RAM — monitor high-water mark.' },
    ],
    evidenceThreshold: 0.35,
  },
  {
    id: 'fp-excessive-power',
    name: 'Excessive Power Consumption',
    description: 'System draws more current than expected, draining batteries or overloading supplies.',
    domain: 'power',
    severity: 'medium',
    symptomIds: ['sym-high-current', 'sym-hot-component', 'sym-voltage-sag'],
    causesPatternIds: [],
    causedByPatternIds: ['fp-floating-inputs', 'fp-thermal-runaway'],
    fixes: [
      { id: 'fix-power-1', description: 'Disable unused peripherals and pins', priority: 'high', domain: 'firmware', effort: 'minor', detail: 'Turn off ADC, timers, UART modules not in use.' },
      { id: 'fix-power-2', description: 'Use sleep modes between operations', priority: 'high', domain: 'firmware', effort: 'moderate', detail: 'Deep sleep can reduce current from mA to uA.' },
      { id: 'fix-power-3', description: 'Measure current per subsystem to isolate drain', priority: 'immediate', domain: 'circuit', effort: 'trivial', detail: 'Use current shunt or power profiler to find the culprit.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-long-traces',
    name: 'Long Signal Traces / Poor Routing',
    description: 'Excessively long or unshielded signal traces act as antennas, picking up EMI.',
    domain: 'circuit',
    severity: 'medium',
    symptomIds: ['sym-spi-corrupt', 'sym-oscillation', 'sym-adc-noisy'],
    causesPatternIds: ['fp-spi-timing'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-trace-1', description: 'Keep high-speed signal traces short (<5cm)', priority: 'high', domain: 'circuit', effort: 'moderate', detail: 'Route SPI, I2C, and clock lines as short as possible.' },
      { id: 'fix-trace-2', description: 'Route critical signals over continuous ground plane', priority: 'high', domain: 'circuit', effort: 'moderate', detail: 'Ground plane provides low-impedance return path.' },
      { id: 'fix-trace-3', description: 'Use shielded cables for off-board connections', priority: 'medium', domain: 'mechanical', effort: 'minor', detail: 'External wiring is most susceptible to EMI pickup.' },
    ],
    evidenceThreshold: 0.3,
  },
  {
    id: 'fp-ldo-thermal-shutdown',
    name: 'LDO Thermal Shutdown / Dropout',
    description: 'Linear regulator overheating due to large input-output voltage differential or excessive current.',
    domain: 'power',
    severity: 'high',
    symptomIds: ['sym-hot-component', 'sym-voltage-sag', 'sym-ldo-dropout', 'sym-reset-random'],
    causesPatternIds: ['fp-brownout'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-ldo-1', description: 'Switch to switching regulator for large Vin-Vout differential', priority: 'high', domain: 'circuit', effort: 'major', detail: 'P_dissipation = (Vin - Vout) * Iout — if > 1W, use buck converter.' },
      { id: 'fix-ldo-2', description: 'Add heatsink or copper pour under LDO', priority: 'immediate', domain: 'circuit', effort: 'minor', detail: 'Exposed pad package needs thermal via array to inner ground.' },
      { id: 'fix-ldo-3', description: 'Reduce input voltage to minimize dropout heat', priority: 'medium', domain: 'circuit', effort: 'moderate', detail: 'Use 2-stage regulation if source voltage is much higher than output.' },
    ],
    evidenceThreshold: 0.35,
  },
  {
    id: 'fp-stack-overflow',
    name: 'Stack Overflow',
    description: 'Recursive functions or large local arrays exhaust stack space, corrupting heap or globals.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-reset-random', 'sym-boot-loop', 'sym-intermittent-fault'],
    causesPatternIds: ['fp-data-corruption'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-stack-1', description: 'Avoid large local arrays — use static or global', priority: 'immediate', domain: 'firmware', effort: 'minor', detail: 'char buf[1024] in a function eats 1K of stack per call.' },
      { id: 'fix-stack-2', description: 'Limit recursion depth or convert to iteration', priority: 'high', domain: 'firmware', effort: 'moderate', detail: 'Each recursive call adds a stack frame.' },
      { id: 'fix-stack-3', description: 'Monitor stack high-water mark', priority: 'medium', domain: 'firmware', effort: 'minor', detail: 'Paint stack with pattern at boot, check how deep it went.' },
    ],
    evidenceThreshold: 0.35,
  },
  {
    id: 'fp-memory-leak',
    name: 'Memory Leak',
    description: 'Dynamic allocations (malloc/new) without corresponding frees, eventually exhausting RAM.',
    domain: 'firmware',
    severity: 'high',
    symptomIds: ['sym-memory-leak', 'sym-slow-response', 'sym-reset-random'],
    causesPatternIds: [],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-memleak-1', description: 'Audit all malloc/new calls for matching free/delete', priority: 'immediate', domain: 'firmware', effort: 'moderate', detail: 'Every allocation must have a clear ownership and deallocation path.' },
      { id: 'fix-memleak-2', description: 'Prefer static allocation on embedded systems', priority: 'high', domain: 'firmware', effort: 'moderate', detail: 'Fixed-size buffers and pools avoid fragmentation and leaks.' },
      { id: 'fix-memleak-3', description: 'Log free heap periodically to detect trend', priority: 'high', domain: 'firmware', effort: 'trivial', detail: 'Serial.println(ESP.getFreeHeap()) in loop to track.' },
    ],
    evidenceThreshold: 0.4,
  },
  {
    id: 'fp-clock-config',
    name: 'Clock / Oscillator Misconfiguration',
    description: 'System clock configured incorrectly causing timing-dependent peripherals to misbehave.',
    domain: 'firmware',
    severity: 'medium',
    symptomIds: ['sym-uart-garbled', 'sym-pwm-jitter', 'sym-slow-response'],
    causesPatternIds: ['fp-uart-baud-mismatch'],
    causedByPatternIds: [],
    fixes: [
      { id: 'fix-clock-1', description: 'Verify clock source in startup code / fuse bits', priority: 'immediate', domain: 'firmware', effort: 'minor', detail: 'Check if using internal RC vs external crystal, PLL multiplier.' },
      { id: 'fix-clock-2', description: 'Use external crystal for accurate timing', priority: 'high', domain: 'circuit', effort: 'minor', detail: 'Internal RC can be +/- 10% — crystal is < 50ppm.' },
    ],
    evidenceThreshold: 0.4,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a map from pattern ID to pattern for O(1) lookup. */
function buildPatternMap(): Map<string, FailurePattern> {
  const map = new Map<string, FailurePattern>();
  KNOWN_FAILURE_PATTERNS.forEach((fp) => map.set(fp.id, fp));
  return map;
}

/** Build a map from symptom ID to symptom for O(1) lookup. */
function buildSymptomMap(): Map<string, Symptom> {
  const map = new Map<string, Symptom>();
  KNOWN_SYMPTOMS.forEach((s) => map.set(s.id, s));
  return map;
}

/** Calculate match score between a symptom ID and a set of observations. */
function symptomMatchWeight(
  symptomId: string,
  observations: SymptomObservation[],
): number {
  let maxWeight = 0;
  observations.forEach((obs) => {
    if (obs.symptomId === symptomId) {
      maxWeight = Math.max(maxWeight, obs.confidence);
    }
  });
  return maxWeight;
}

/** Find transitive effects of a pattern (BFS). */
function findTransitiveEffects(
  patternId: string,
  patternMap: Map<string, FailurePattern>,
  maxDepth: number = 3,
): string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: patternId, depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.id) || item.depth > maxDepth) {
      continue;
    }
    visited.add(item.id);

    const pattern = patternMap.get(item.id);
    if (pattern) {
      pattern.causesPatternIds.forEach((childId) => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, depth: item.depth + 1 });
        }
      });
    }
  }

  visited.delete(patternId); // Remove self
  return Array.from(visited);
}

/** Find transitive causes of a pattern (BFS reverse). */
function findTransitiveCauses(
  patternId: string,
  patternMap: Map<string, FailurePattern>,
  maxDepth: number = 3,
): string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: patternId, depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.id) || item.depth > maxDepth) {
      continue;
    }
    visited.add(item.id);

    const pattern = patternMap.get(item.id);
    if (pattern) {
      pattern.causedByPatternIds.forEach((parentId) => {
        if (!visited.has(parentId)) {
          queue.push({ id: parentId, depth: item.depth + 1 });
        }
      });
    }
  }

  visited.delete(patternId);
  return Array.from(visited);
}

// ---------------------------------------------------------------------------
// RootCauseAnalyzer
// ---------------------------------------------------------------------------

export class RootCauseAnalyzer {
  private static instance: RootCauseAnalyzer | null = null;

  private readonly patternMap: Map<string, FailurePattern>;
  private readonly symptomMap: Map<string, Symptom>;
  private observations: SymptomObservation[];
  private latestAnalysis: RootCauseAnalysis | null;
  private subscribers: Set<Listener>;

  constructor() {
    this.patternMap = buildPatternMap();
    this.symptomMap = buildSymptomMap();
    this.observations = [];
    this.latestAnalysis = null;
    this.subscribers = new Set();
  }

  /** Get or create singleton instance. */
  static getInstance(): RootCauseAnalyzer {
    if (!RootCauseAnalyzer.instance) {
      RootCauseAnalyzer.instance = new RootCauseAnalyzer();
    }
    return RootCauseAnalyzer.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    RootCauseAnalyzer.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Get current snapshot. */
  getSnapshot(): RootCauseSnapshot {
    return {
      observations: [...this.observations],
      latestAnalysis: this.latestAnalysis,
    };
  }

  // -------------------------------------------------------------------------
  // Knowledge base queries
  // -------------------------------------------------------------------------

  /** Get all known symptoms. */
  getKnownSymptoms(): Symptom[] {
    return Array.from(this.symptomMap.values());
  }

  /** Get a symptom by ID. */
  getSymptom(symptomId: string): Symptom | null {
    return this.symptomMap.get(symptomId) ?? null;
  }

  /** Get all known failure patterns. */
  getKnownPatterns(): FailurePattern[] {
    return Array.from(this.patternMap.values());
  }

  /** Get a pattern by ID. */
  getPattern(patternId: string): FailurePattern | null {
    return this.patternMap.get(patternId) ?? null;
  }

  /** Search symptoms by text (fuzzy tag match). */
  searchSymptoms(query: string): Symptom[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const results: Array<{ symptom: Symptom; score: number }> = [];

    this.symptomMap.forEach((symptom) => {
      let score = 0;
      const descLower = symptom.description.toLowerCase();

      terms.forEach((term) => {
        if (descLower.includes(term)) {
          score += 2;
        }
        symptom.tags.forEach((tag) => {
          if (tag.includes(term)) {
            score += 1;
          }
        });
      });

      if (score > 0) {
        results.push({ symptom, score });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .map((r) => r.symptom);
  }

  // -------------------------------------------------------------------------
  // Observation management
  // -------------------------------------------------------------------------

  /** Add a symptom observation. */
  addObservation(observation: Omit<SymptomObservation, 'timestamp'>): SymptomObservation {
    if (!this.symptomMap.has(observation.symptomId)) {
      throw new Error(`Unknown symptom ID: "${observation.symptomId}"`);
    }
    if (observation.confidence < 0 || observation.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    const full: SymptomObservation = {
      ...observation,
      timestamp: Date.now(),
    };

    this.observations.push(full);
    this.notify();
    return full;
  }

  /** Remove an observation by symptom ID. */
  removeObservation(symptomId: string): boolean {
    const before = this.observations.length;
    this.observations = this.observations.filter((o) => o.symptomId !== symptomId);
    const removed = this.observations.length < before;
    if (removed) {
      this.notify();
    }
    return removed;
  }

  /** Clear all observations. */
  clearObservations(): void {
    this.observations = [];
    this.latestAnalysis = null;
    this.notify();
  }

  /** Get current observations. */
  getObservations(): SymptomObservation[] {
    return [...this.observations];
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  /** Run full root-cause analysis on current observations. */
  analyze(): RootCauseAnalysis {
    const graph = this.buildCausalGraph();
    const rankedCauses = this.rankRootCauses(graph);
    const crossDomainCorrelations = this.findCrossDomainCorrelations(graph);

    const analysis: RootCauseAnalysis = {
      observations: [...this.observations],
      graph,
      rankedCauses,
      crossDomainCorrelations,
      timestamp: Date.now(),
    };

    this.latestAnalysis = analysis;
    this.notify();
    return analysis;
  }

  /** Build the causal graph from current observations. */
  buildCausalGraph(): CausalGraph {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];
    const observedSymptomIds = new Set(this.observations.map((o) => o.symptomId));

    // Score each pattern against observations
    this.patternMap.forEach((pattern) => {
      const matchedSymptoms: string[] = [];
      let totalWeight = 0;

      pattern.symptomIds.forEach((sid) => {
        if (observedSymptomIds.has(sid)) {
          matchedSymptoms.push(sid);
          totalWeight += symptomMatchWeight(sid, this.observations);
        }
      });

      if (matchedSymptoms.length === 0) {
        return;
      }

      // Probability = (matched symptoms / total symptoms) * average weight
      const matchRatio = matchedSymptoms.length / pattern.symptomIds.length;
      const avgWeight = totalWeight / matchedSymptoms.length;
      const probability = Math.min(1, matchRatio * avgWeight);

      if (totalWeight >= pattern.evidenceThreshold) {
        nodes.push({
          patternId: pattern.id,
          probability,
          matchedSymptoms,
          evidenceWeight: totalWeight,
          domain: pattern.domain,
        });
      }
    });

    // Build edges between matched patterns
    const nodeSet = new Set(nodes.map((n) => n.patternId));

    nodes.forEach((node) => {
      const pattern = this.patternMap.get(node.patternId)!;

      pattern.causesPatternIds.forEach((targetId) => {
        if (nodeSet.has(targetId)) {
          edges.push({
            fromPatternId: node.patternId,
            toPatternId: targetId,
            relationship: 'causes',
            strength: node.probability,
          });
        }
      });

      pattern.causedByPatternIds.forEach((sourceId) => {
        if (nodeSet.has(sourceId)) {
          edges.push({
            fromPatternId: sourceId,
            toPatternId: node.patternId,
            relationship: 'causes',
            strength: nodes.find((n) => n.patternId === sourceId)?.probability ?? 0,
          });
        }
      });
    });

    // Deduplicate edges
    const edgeKeys = new Set<string>();
    const uniqueEdges: CausalEdge[] = [];
    edges.forEach((e) => {
      const key = `${e.fromPatternId}->${e.toPatternId}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        uniqueEdges.push(e);
      }
    });

    return { nodes, edges: uniqueEdges };
  }

  /** Rank root causes by probability, boosted by transitive reach. */
  rankRootCauses(graph: CausalGraph): RankedRootCause[] {
    const ranked: RankedRootCause[] = [];

    graph.nodes.forEach((node) => {
      const pattern = this.patternMap.get(node.patternId);
      if (!pattern) {
        return;
      }

      const transitiveEffects = findTransitiveEffects(node.patternId, this.patternMap);

      // Boost probability if this pattern transitively causes other observed patterns
      let boost = 0;
      transitiveEffects.forEach((effectId) => {
        const effectNode = graph.nodes.find((n) => n.patternId === effectId);
        if (effectNode) {
          boost += 0.1 * effectNode.probability;
        }
      });

      const adjustedProbability = Math.min(1, node.probability + boost);

      ranked.push({
        patternId: node.patternId,
        patternName: pattern.name,
        probability: adjustedProbability,
        severity: pattern.severity,
        domain: pattern.domain,
        matchedSymptoms: node.matchedSymptoms,
        transitiveEffects,
        fixes: pattern.fixes,
      });
    });

    // Sort by probability (descending), then severity
    const severityOrder: Record<CauseSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    ranked.sort((a, b) => {
      const probDiff = b.probability - a.probability;
      if (Math.abs(probDiff) > 0.01) {
        return probDiff;
      }
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return ranked;
  }

  /** Find cross-domain correlations between circuit and firmware patterns. */
  findCrossDomainCorrelations(graph: CausalGraph): CrossDomainCorrelation[] {
    const correlations: CrossDomainCorrelation[] = [];

    const circuitNodes = graph.nodes.filter(
      (n) => n.domain === 'circuit' || n.domain === 'power',
    );
    const firmwareNodes = graph.nodes.filter((n) => n.domain === 'firmware');

    if (circuitNodes.length === 0 || firmwareNodes.length === 0) {
      return correlations;
    }

    // Check for causal links between circuit/power and firmware domains
    circuitNodes.forEach((cn) => {
      const pattern = this.patternMap.get(cn.patternId)!;

      firmwareNodes.forEach((fn) => {
        const causesIt = pattern.causesPatternIds.includes(fn.patternId);
        const causedByIt = pattern.causedByPatternIds.includes(fn.patternId);

        if (causesIt || causedByIt) {
          const strength = (cn.probability + fn.probability) / 2;
          const direction = causesIt ? 'causes' : 'is caused by';
          correlations.push({
            circuitPatterns: [cn.patternId],
            firmwarePatterns: [fn.patternId],
            correlationStrength: strength,
            explanation: `${pattern.name} ${direction} ${this.patternMap.get(fn.patternId)!.name}`,
          });
        }
      });
    });

    // Sort by correlation strength
    correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);

    return correlations;
  }

  /** Get transitive effects for a pattern. */
  getTransitiveEffects(patternId: string): string[] {
    return findTransitiveEffects(patternId, this.patternMap);
  }

  /** Get transitive causes for a pattern. */
  getTransitiveCauses(patternId: string): string[] {
    return findTransitiveCauses(patternId, this.patternMap);
  }

  /** Get fix recommendations for all identified causes, sorted by priority. */
  getRecommendedFixes(analysis?: RootCauseAnalysis): FixRecommendation[] {
    const src = analysis ?? this.latestAnalysis;
    if (!src || src.rankedCauses.length === 0) {
      return [];
    }

    const fixMap = new Map<string, FixRecommendation>();
    const priorityOrder: Record<FixPriority, number> = {
      immediate: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    src.rankedCauses.forEach((cause) => {
      cause.fixes.forEach((fix) => {
        if (!fixMap.has(fix.id)) {
          fixMap.set(fix.id, fix);
        }
      });
    });

    return Array.from(fixMap.values()).sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Notify all subscribers. */
  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }
}
