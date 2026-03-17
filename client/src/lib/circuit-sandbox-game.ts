/**
 * Circuit Sandbox Game — Challenge-based learning system
 *
 * Provides gamified circuit-building challenges for makers and learners.
 * Each challenge defines a goal, validation logic, hints, and scoring.
 * ChallengeManager tracks progress in localStorage with singleton+subscribe pattern.
 *
 * Usage:
 *   const mgr = ChallengeManager.getInstance();
 *   mgr.startChallenge('led-blink');
 *   const result = mgr.submitSolution(myCircuit);
 *
 * React hook:
 *   const { challenge, progress, submitSolution, hints } = useCircuitChallenge('led-blink');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ChallengeResult {
  passed: boolean;
  score: number; // 0-100
  feedback: string[];
  bonus: string[];
}

/**
 * Lightweight representation of a user's circuit submission.
 * Intentionally decoupled from database row types so challenges
 * can be validated purely client-side without a database connection.
 */
export interface ChallengeCircuit {
  instances: ChallengeInstance[];
  nets: ChallengeNet[];
  wires: ChallengeWire[];
}

export interface ChallengeInstance {
  id: string;
  referenceDesignator: string;
  properties: Record<string, unknown>;
}

export interface ChallengeNet {
  id: string;
  name: string;
  netType: string;
  voltage?: string;
}

export interface ChallengeWire {
  id: string;
  netId: string;
  points: Array<{ x: number; y: number }>;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  goal: string;
  hints: string[];
  validation: (circuit: ChallengeCircuit) => ChallengeResult;
}

export interface ChallengeProgress {
  challengeId: string;
  bestScore: number;
  completedAt: number | null;
  attempts: number;
  hintsUsed: number;
}

export interface ChallengeManagerState {
  activeChallengeId: string | null;
  progress: ChallengeProgress[];
}

// ---------------------------------------------------------------------------
// Validation helpers (shared across built-in challenges)
// ---------------------------------------------------------------------------

function hasInstanceMatching(
  circuit: ChallengeCircuit,
  predicate: (inst: ChallengeInstance) => boolean,
): boolean {
  return circuit.instances.some(predicate);
}

function countInstancesMatching(
  circuit: ChallengeCircuit,
  predicate: (inst: ChallengeInstance) => boolean,
): number {
  return circuit.instances.filter(predicate).length;
}

function hasNetNamed(circuit: ChallengeCircuit, name: string): boolean {
  return circuit.nets.some((n) => n.name.toLowerCase() === name.toLowerCase());
}

function hasNetOfType(circuit: ChallengeCircuit, netType: string): boolean {
  return circuit.nets.some((n) => n.netType === netType);
}

function hasWires(circuit: ChallengeCircuit): boolean {
  return circuit.wires.length > 0;
}

function refDesPrefix(inst: ChallengeInstance): string {
  return inst.referenceDesignator.replace(/\d+$/, '');
}

function instancesByPrefix(circuit: ChallengeCircuit, prefix: string): ChallengeInstance[] {
  return circuit.instances.filter((inst) => refDesPrefix(inst) === prefix);
}

function scoreFromChecks(checks: boolean[], bonusChecks: boolean[] = []): { score: number; passedCount: number } {
  if (checks.length === 0) {
    return { score: 0, passedCount: 0 };
  }
  const passedCount = checks.filter(Boolean).length;
  const baseScore = Math.round((passedCount / checks.length) * 80);
  const bonusPassed = bonusChecks.filter(Boolean).length;
  const bonusScore = bonusChecks.length > 0 ? Math.round((bonusPassed / bonusChecks.length) * 20) : 0;
  return { score: Math.min(100, baseScore + bonusScore), passedCount };
}

// ---------------------------------------------------------------------------
// Built-in challenges
// ---------------------------------------------------------------------------

export const BUILT_IN_CHALLENGES: Challenge[] = [
  // 1. LED Blink (beginner)
  {
    id: 'led-blink',
    title: 'LED Blink',
    description: 'Build the classic "Hello World" of electronics — make an LED blink using a microcontroller.',
    difficulty: 'beginner',
    goal: 'Place an LED, a current-limiting resistor, and a microcontroller. Connect them so the LED can be toggled by a digital pin.',
    hints: [
      'LEDs need a current-limiting resistor to avoid burning out.',
      'Connect the LED anode through a resistor to a digital I/O pin.',
      'The LED cathode goes to GND.',
      'A 220-470 ohm resistor works for most 5V LEDs.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasLed = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'D' || refDesPrefix(i) === 'LED');
      const hasResistor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'R');
      const hasMcu = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'U' || refDesPrefix(i) === 'MCU');
      const hasGnd = hasNetNamed(circuit, 'GND') || hasNetNamed(circuit, 'gnd');
      const hasWiring = hasWires(circuit);

      if (!hasLed) { feedback.push('Missing LED — add a diode (D1 or LED1).'); }
      if (!hasResistor) { feedback.push('Missing current-limiting resistor.'); }
      if (!hasMcu) { feedback.push('Missing microcontroller (U1 or MCU1).'); }
      if (!hasGnd) { feedback.push('Missing GND net — the LED cathode needs a ground connection.'); }
      if (!hasWiring) { feedback.push('No wires placed — connect the components together.'); }

      const checks = [hasLed, hasResistor, hasMcu, hasGnd, hasWiring];
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '5V') || hasNetNamed(circuit, '3V3');
      if (hasVcc) { bonus.push('Power rail present — good practice!'); }

      const { score } = scoreFromChecks(checks, [hasVcc]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 2. Voltage Divider (beginner)
  {
    id: 'voltage-divider',
    title: 'Voltage Divider',
    description: 'Create a resistive voltage divider to step down a voltage to a desired level.',
    difficulty: 'beginner',
    goal: 'Place two resistors in series between VCC and GND with a midpoint tap.',
    hints: [
      'A voltage divider uses two resistors in series.',
      'Vout = Vin * R2 / (R1 + R2).',
      'Connect the top resistor to VCC and the bottom to GND.',
      'The output is taken from the junction between the two resistors.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const resistors = instancesByPrefix(circuit, 'R');
      const hasTwoResistors = resistors.length >= 2;
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '5V') || hasNetNamed(circuit, '3V3');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasOutput = hasNetNamed(circuit, 'VOUT') || hasNetNamed(circuit, 'OUT') || hasNetNamed(circuit, 'MID');
      const hasWiring = hasWires(circuit);

      if (!hasTwoResistors) { feedback.push(`Need at least 2 resistors — found ${resistors.length}.`); }
      if (!hasVcc) { feedback.push('Missing VCC/power net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasOutput) { feedback.push('Missing output/midpoint net (VOUT, OUT, or MID).'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasTwoResistors, hasVcc, hasGnd, hasOutput, hasWiring];
      const hasThreeNets = circuit.nets.length >= 3;
      if (hasThreeNets) { bonus.push('Three or more nets — well-structured!'); }

      const { score } = scoreFromChecks(checks, [hasThreeNets]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 3. Pull-up Resistor (beginner)
  {
    id: 'pull-up-resistor',
    title: 'Pull-Up Resistor',
    description: 'Wire a pull-up resistor for a button input so the signal is clean and stable.',
    difficulty: 'beginner',
    goal: 'Connect a resistor between VCC and a digital input pin, with a button to GND.',
    hints: [
      'A pull-up resistor holds the line HIGH when the button is not pressed.',
      'Typical pull-up values: 4.7K-10K ohms.',
      'The button should connect the input pin to GND when pressed.',
      'Without a pull-up, the input floats and reads random values.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasResistor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'R');
      const hasButton = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'SW' || refDesPrefix(i) === 'BTN' || refDesPrefix(i) === 'S');
      const hasMcu = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'U' || refDesPrefix(i) === 'MCU');
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '5V') || hasNetNamed(circuit, '3V3');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasResistor) { feedback.push('Missing pull-up resistor.'); }
      if (!hasButton) { feedback.push('Missing button/switch (SW1, BTN1, or S1).'); }
      if (!hasMcu) { feedback.push('Missing microcontroller.'); }
      if (!hasVcc) { feedback.push('Missing VCC net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasResistor, hasButton, hasMcu, hasVcc, hasGnd, hasWiring];
      const hasSignalNet = hasNetNamed(circuit, 'BTN_IN') || hasNetNamed(circuit, 'INPUT') || hasNetNamed(circuit, 'SW_IN');
      if (hasSignalNet) { bonus.push('Named signal net — makes intent clear!'); }

      const { score } = scoreFromChecks(checks, [hasSignalNet]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 4. RC Low-Pass Filter (intermediate)
  {
    id: 'rc-filter',
    title: 'RC Low-Pass Filter',
    description: 'Build an RC low-pass filter to attenuate high-frequency noise from a signal.',
    difficulty: 'intermediate',
    goal: 'Place a resistor and capacitor to form a first-order low-pass filter with input and output nets.',
    hints: [
      'An RC filter has a resistor in series and a capacitor to GND.',
      'The cutoff frequency is f = 1 / (2 * π * R * C).',
      'Signal flows: IN → R → OUT, with C from OUT to GND.',
      'For audio filtering, try 1K + 100nF (≈1.6 kHz cutoff).',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasResistor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'R');
      const hasCapacitor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'C');
      const hasInput = hasNetNamed(circuit, 'IN') || hasNetNamed(circuit, 'INPUT') || hasNetNamed(circuit, 'SIG_IN');
      const hasOutput = hasNetNamed(circuit, 'OUT') || hasNetNamed(circuit, 'OUTPUT') || hasNetNamed(circuit, 'FILTERED');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasResistor) { feedback.push('Missing resistor for the RC filter.'); }
      if (!hasCapacitor) { feedback.push('Missing capacitor for the RC filter.'); }
      if (!hasInput) { feedback.push('Missing input net (IN, INPUT, or SIG_IN).'); }
      if (!hasOutput) { feedback.push('Missing output net (OUT, OUTPUT, or FILTERED).'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasResistor, hasCapacitor, hasInput, hasOutput, hasGnd, hasWiring];
      const hasMultipleCaps = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'C') >= 2;
      if (hasMultipleCaps) { bonus.push('Multiple filter stages — extra attenuation!'); }

      const { score } = scoreFromChecks(checks, [hasMultipleCaps]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 5. H-Bridge Motor Driver (intermediate)
  {
    id: 'h-bridge',
    title: 'H-Bridge Motor Driver',
    description: 'Build an H-bridge circuit to control a DC motor in both directions.',
    difficulty: 'intermediate',
    goal: 'Place four switching elements (transistors or an H-bridge IC), a motor, and flyback diodes. Wire control signals.',
    hints: [
      'An H-bridge has 4 switches arranged in an H pattern around the motor.',
      'You can use an IC like L298N or L293D instead of discrete transistors.',
      'Flyback diodes protect against back-EMF from the motor.',
      'Two control signals determine forward, reverse, brake, or coast.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasMotor = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'M' || refDesPrefix(i) === 'MOT');
      const hasDriver = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'U' || refDesPrefix(i) === 'Q' || refDesPrefix(i) === 'IC');
      const hasPower = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, 'VMOT') || hasNetNamed(circuit, '12V');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasControl = hasNetNamed(circuit, 'IN1') || hasNetNamed(circuit, 'CTRL') || hasNetNamed(circuit, 'FWD');
      const hasWiring = hasWires(circuit);

      if (!hasMotor) { feedback.push('Missing motor (M1 or MOT1).'); }
      if (!hasDriver) { feedback.push('Missing H-bridge driver IC or transistors.'); }
      if (!hasPower) { feedback.push('Missing motor power supply net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasControl) { feedback.push('Missing control signal net (IN1, CTRL, or FWD).'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasMotor, hasDriver, hasPower, hasGnd, hasControl, hasWiring];
      const hasFlybackDiodes = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'D') >= 2;
      const hasEnable = hasNetNamed(circuit, 'EN') || hasNetNamed(circuit, 'ENABLE');
      if (hasFlybackDiodes) { bonus.push('Flyback diodes — motor protection included!'); }
      if (hasEnable) { bonus.push('Enable line — supports coast/brake mode.'); }

      const { score } = scoreFromChecks(checks, [hasFlybackDiodes, hasEnable]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 6. 555 Timer Astable (intermediate)
  {
    id: '555-timer',
    title: '555 Timer Astable',
    description: 'Configure a 555 timer in astable mode to generate a square wave.',
    difficulty: 'intermediate',
    goal: 'Place a 555 timer IC, two resistors, and a capacitor in astable configuration.',
    hints: [
      'Astable mode connects pin 7 (DISCHARGE) through R1 to VCC, and through R2 to pin 6 (THRESHOLD).',
      'A capacitor from pin 6 to GND sets the timing.',
      'Pin 2 (TRIGGER) ties to pin 6 (THRESHOLD) in astable mode.',
      'The output frequency: f = 1.44 / ((R1 + 2*R2) * C).',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasTimer = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'U' || refDesPrefix(i) === 'IC' || refDesPrefix(i) === 'NE555');
      const resistors = instancesByPrefix(circuit, 'R');
      const hasTwoResistors = resistors.length >= 2;
      const hasCapacitor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'C');
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '5V');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasOutput = hasNetNamed(circuit, 'OUT') || hasNetNamed(circuit, 'OUTPUT') || hasNetNamed(circuit, 'SQ_WAVE');
      const hasWiring = hasWires(circuit);

      if (!hasTimer) { feedback.push('Missing 555 timer IC.'); }
      if (!hasTwoResistors) { feedback.push(`Need 2 timing resistors — found ${resistors.length}.`); }
      if (!hasCapacitor) { feedback.push('Missing timing capacitor.'); }
      if (!hasVcc) { feedback.push('Missing VCC/power net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasOutput) { feedback.push('Missing output net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasTimer, hasTwoResistors, hasCapacitor, hasVcc, hasGnd, hasOutput, hasWiring];
      const hasDecoupling = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'C') >= 2;
      if (hasDecoupling) { bonus.push('Decoupling capacitor — reduces supply noise!'); }

      const { score } = scoreFromChecks(checks, [hasDecoupling]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 7. Inverting Op-Amp (intermediate)
  {
    id: 'opamp-inverting',
    title: 'Inverting Op-Amp Amplifier',
    description: 'Build an inverting amplifier using an operational amplifier and two resistors.',
    difficulty: 'intermediate',
    goal: 'Place an op-amp IC, an input resistor (Rin), and a feedback resistor (Rf). Wire the inverting input.',
    hints: [
      'Gain = -Rf / Rin — the output is inverted.',
      'The non-inverting input (+) connects to GND or a virtual ground.',
      'Feedback resistor goes from output to inverting input (−).',
      'Use a dual supply (V+ and V−) or single supply with a bias voltage.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasOpAmp = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'U' || refDesPrefix(i) === 'OA' || refDesPrefix(i) === 'IC');
      const resistors = instancesByPrefix(circuit, 'R');
      const hasTwoResistors = resistors.length >= 2;
      const hasInput = hasNetNamed(circuit, 'IN') || hasNetNamed(circuit, 'INPUT') || hasNetNamed(circuit, 'VIN');
      const hasOutput = hasNetNamed(circuit, 'OUT') || hasNetNamed(circuit, 'OUTPUT') || hasNetNamed(circuit, 'VOUT');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasPower = hasNetNamed(circuit, 'V+') || hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, 'VDD');
      const hasWiring = hasWires(circuit);

      if (!hasOpAmp) { feedback.push('Missing op-amp IC.'); }
      if (!hasTwoResistors) { feedback.push(`Need Rin + Rf — found ${resistors.length} resistor(s).`); }
      if (!hasInput) { feedback.push('Missing input net.'); }
      if (!hasOutput) { feedback.push('Missing output net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasPower) { feedback.push('Missing power supply (V+ or VCC).'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasOpAmp, hasTwoResistors, hasInput, hasOutput, hasGnd, hasPower, hasWiring];
      const hasNegSupply = hasNetNamed(circuit, 'V-') || hasNetNamed(circuit, 'VEE') || hasNetNamed(circuit, 'VSS');
      if (hasNegSupply) { bonus.push('Dual supply — full output swing!'); }

      const { score } = scoreFromChecks(checks, [hasNegSupply]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 8. Linear Power Supply (advanced)
  {
    id: 'power-supply',
    title: 'Linear Power Supply',
    description: 'Design a regulated DC power supply from an AC source using a bridge rectifier and voltage regulator.',
    difficulty: 'advanced',
    goal: 'Place a transformer (or AC source), bridge rectifier diodes, filter capacitor, and a voltage regulator IC.',
    hints: [
      'A bridge rectifier uses 4 diodes to convert AC to pulsating DC.',
      'A large filter capacitor smooths the pulsating DC.',
      'A voltage regulator (e.g., LM7805) provides stable output.',
      'Add input and output decoupling capacitors per regulator datasheet.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const diodes = instancesByPrefix(circuit, 'D');
      const hasBridgeRectifier = diodes.length >= 4 || hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'BR');
      const hasRegulator = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'U' || refDesPrefix(i) === 'VR' || refDesPrefix(i) === 'IC');
      const hasFilterCap = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'C');
      const hasInput = hasNetNamed(circuit, 'AC') || hasNetNamed(circuit, 'VAC') || hasNetNamed(circuit, 'AC_IN');
      const hasOutput = hasNetNamed(circuit, 'VOUT') || hasNetNamed(circuit, '5V') || hasNetNamed(circuit, '3V3') || hasNetNamed(circuit, 'VCC');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasBridgeRectifier) { feedback.push('Missing bridge rectifier (4 diodes or a BR1 package).'); }
      if (!hasRegulator) { feedback.push('Missing voltage regulator IC.'); }
      if (!hasFilterCap) { feedback.push('Missing filter capacitor.'); }
      if (!hasInput) { feedback.push('Missing AC input net.'); }
      if (!hasOutput) { feedback.push('Missing regulated output net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasBridgeRectifier, hasRegulator, hasFilterCap, hasInput, hasOutput, hasGnd, hasWiring];
      const hasDecoupling = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'C') >= 3;
      const hasFuse = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'F');
      if (hasDecoupling) { bonus.push('Multiple capacitors — good decoupling practice!'); }
      if (hasFuse) { bonus.push('Input fuse — safety first!'); }

      const { score } = scoreFromChecks(checks, [hasDecoupling, hasFuse]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 9. Analog Sensor Reading (beginner)
  {
    id: 'sensor-reading',
    title: 'Analog Sensor Reading',
    description: 'Connect an analog sensor (potentiometer, LDR, or thermistor) to a microcontroller ADC input.',
    difficulty: 'beginner',
    goal: 'Place a sensor in a voltage divider configuration connected to an ADC pin on a microcontroller.',
    hints: [
      'An analog sensor typically varies its resistance with the measured quantity.',
      'Use a voltage divider with a fixed resistor to convert resistance change to voltage change.',
      'Connect the midpoint to an ADC input pin.',
      'Make sure you have VCC and GND for the divider.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasSensor = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'R' || refDesPrefix(i) === 'RV' || refDesPrefix(i) === 'RT'
        || refDesPrefix(i) === 'LDR' || refDesPrefix(i) === 'SENS');
      const hasMcu = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'U' || refDesPrefix(i) === 'MCU');
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '5V') || hasNetNamed(circuit, '3V3');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasAdcNet = hasNetNamed(circuit, 'ADC') || hasNetNamed(circuit, 'A0') || hasNetNamed(circuit, 'SENSOR_OUT') || hasNetNamed(circuit, 'ANALOG');
      const hasWiring = hasWires(circuit);

      if (!hasSensor) { feedback.push('Missing sensor component (potentiometer, LDR, or thermistor).'); }
      if (!hasMcu) { feedback.push('Missing microcontroller.'); }
      if (!hasVcc) { feedback.push('Missing VCC net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasAdcNet) { feedback.push('Missing ADC/analog net connecting sensor to MCU.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasSensor, hasMcu, hasVcc, hasGnd, hasAdcNet, hasWiring];
      const hasFilterCap = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'C');
      if (hasFilterCap) { bonus.push('Filter capacitor on ADC input — reduces noise!'); }

      const { score } = scoreFromChecks(checks, [hasFilterCap]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 10. Motor Control with PWM (advanced)
  {
    id: 'motor-control',
    title: 'PWM Motor Speed Control',
    description: 'Build a complete motor control circuit with PWM speed regulation and current sensing.',
    difficulty: 'advanced',
    goal: 'Place a MOSFET or driver IC, motor, flyback diode, and current-sense resistor. Connect PWM and feedback signals.',
    hints: [
      'Use an N-channel MOSFET as a low-side switch for the motor.',
      'A flyback diode across the motor protects against back-EMF.',
      'A small current-sense resistor in the ground path measures motor current.',
      'The gate needs a PWM signal from the microcontroller.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasMotor = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'M' || refDesPrefix(i) === 'MOT');
      const hasSwitch = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'Q' || refDesPrefix(i) === 'U' || refDesPrefix(i) === 'IC');
      const hasFlyback = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'D');
      const hasPwm = hasNetNamed(circuit, 'PWM') || hasNetNamed(circuit, 'GATE') || hasNetNamed(circuit, 'CTRL');
      const hasPower = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, 'VMOT') || hasNetNamed(circuit, '12V');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasMotor) { feedback.push('Missing motor.'); }
      if (!hasSwitch) { feedback.push('Missing MOSFET or driver IC.'); }
      if (!hasFlyback) { feedback.push('Missing flyback diode for back-EMF protection.'); }
      if (!hasPwm) { feedback.push('Missing PWM/control signal net.'); }
      if (!hasPower) { feedback.push('Missing motor power supply net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasMotor, hasSwitch, hasFlyback, hasPwm, hasPower, hasGnd, hasWiring];
      const hasSenseResistor = hasNetNamed(circuit, 'ISENSE') || hasNetNamed(circuit, 'SENSE') || hasNetNamed(circuit, 'CS');
      const hasDecoupling = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'C') >= 1;
      if (hasSenseResistor) { bonus.push('Current sensing — enables closed-loop control!'); }
      if (hasDecoupling) { bonus.push('Decoupling capacitor on motor supply.'); }

      const { score } = scoreFromChecks(checks, [hasSenseResistor, hasDecoupling]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 11. I2C Sensor Bus (intermediate)
  {
    id: 'i2c-bus',
    title: 'I2C Sensor Bus',
    description: 'Connect multiple I2C sensors to a microcontroller using the two-wire bus.',
    difficulty: 'intermediate',
    goal: 'Place a microcontroller and at least two I2C devices with pull-up resistors on SDA and SCL.',
    hints: [
      'I2C uses two lines: SDA (data) and SCL (clock).',
      'Both lines need pull-up resistors (typically 4.7K).',
      'Multiple devices share the same bus lines.',
      'Each device has a unique 7-bit address.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasMcu = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'U' || refDesPrefix(i) === 'MCU');
      const ics = instancesByPrefix(circuit, 'U').length + instancesByPrefix(circuit, 'IC').length
        + instancesByPrefix(circuit, 'SENS').length;
      const hasMultipleDevices = ics >= 2;
      const pullUpResistors = instancesByPrefix(circuit, 'R');
      const hasPullUps = pullUpResistors.length >= 2;
      const hasSda = hasNetNamed(circuit, 'SDA');
      const hasScl = hasNetNamed(circuit, 'SCL');
      const hasVcc = hasNetNamed(circuit, 'VCC') || hasNetNamed(circuit, '3V3');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasMcu) { feedback.push('Missing microcontroller.'); }
      if (!hasMultipleDevices) { feedback.push(`Need 2+ I2C devices — found ${ics}.`); }
      if (!hasPullUps) { feedback.push(`Need pull-up resistors on SDA and SCL — found ${pullUpResistors.length}.`); }
      if (!hasSda) { feedback.push('Missing SDA net.'); }
      if (!hasScl) { feedback.push('Missing SCL net.'); }
      if (!hasVcc) { feedback.push('Missing VCC net.'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasMcu, hasMultipleDevices, hasPullUps, hasSda, hasScl, hasVcc, hasGnd, hasWiring];
      const hasDecoupling = countInstancesMatching(circuit, (i) => refDesPrefix(i) === 'C') >= 2;
      if (hasDecoupling) { bonus.push('Per-device decoupling capacitors — excellent!'); }

      const { score } = scoreFromChecks(checks, [hasDecoupling]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },

  // 12. Battery Charger (advanced)
  {
    id: 'battery-charger',
    title: 'Li-Ion Battery Charger',
    description: 'Design a safe lithium-ion battery charging circuit with protection.',
    difficulty: 'advanced',
    goal: 'Place a charge controller IC, battery, protection MOSFET, and indicator LEDs. Wire for CC/CV charging.',
    hints: [
      'Li-Ion cells charge at 4.2V with constant current then constant voltage.',
      'Use a dedicated charger IC like TP4056 or MCP73831.',
      'Protection circuitry prevents over-charge, over-discharge, and short circuit.',
      'Status LEDs show charging vs. complete.',
    ],
    validation: (circuit: ChallengeCircuit): ChallengeResult => {
      const feedback: string[] = [];
      const bonus: string[] = [];

      const hasChargerIc = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'U' || refDesPrefix(i) === 'IC');
      const hasBattery = hasInstanceMatching(circuit, (i) =>
        refDesPrefix(i) === 'BT' || refDesPrefix(i) === 'BAT' || refDesPrefix(i) === 'B');
      const hasLed = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'D' || refDesPrefix(i) === 'LED');
      const hasResistor = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'R');
      const hasVin = hasNetNamed(circuit, 'VIN') || hasNetNamed(circuit, 'USB') || hasNetNamed(circuit, '5V');
      const hasBatNet = hasNetNamed(circuit, 'VBAT') || hasNetNamed(circuit, 'BAT+') || hasNetNamed(circuit, 'BAT');
      const hasGnd = hasNetNamed(circuit, 'GND');
      const hasWiring = hasWires(circuit);

      if (!hasChargerIc) { feedback.push('Missing charge controller IC.'); }
      if (!hasBattery) { feedback.push('Missing battery (BT1, BAT1, or B1).'); }
      if (!hasLed) { feedback.push('Missing status LED(s).'); }
      if (!hasResistor) { feedback.push('Missing programming/current-set resistor.'); }
      if (!hasVin) { feedback.push('Missing input power net (VIN, USB, or 5V).'); }
      if (!hasBatNet) { feedback.push('Missing battery net (VBAT, BAT+).'); }
      if (!hasGnd) { feedback.push('Missing GND net.'); }
      if (!hasWiring) { feedback.push('No wires placed.'); }

      const checks = [hasChargerIc, hasBattery, hasLed, hasResistor, hasVin, hasBatNet, hasGnd, hasWiring];
      const hasProtection = hasInstanceMatching(circuit, (i) => refDesPrefix(i) === 'Q');
      const hasTwoLeds = countInstancesMatching(circuit, (i) =>
        refDesPrefix(i) === 'D' || refDesPrefix(i) === 'LED') >= 2;
      if (hasProtection) { bonus.push('Protection MOSFETs — safety-conscious design!'); }
      if (hasTwoLeds) { bonus.push('Dual status LEDs — clear charge/done indication.'); }

      const { score } = scoreFromChecks(checks, [hasProtection, hasTwoLeds]);
      return { passed: checks.every(Boolean), score, feedback, bonus };
    },
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-circuit-challenges';

// ---------------------------------------------------------------------------
// ChallengeManager
// ---------------------------------------------------------------------------

/**
 * Manages circuit-building challenges with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ChallengeManager {
  private static instance: ChallengeManager | null = null;

  private state: ChallengeManagerState;
  private subscribers: Set<() => void>;

  constructor() {
    this.state = {
      activeChallengeId: null,
      progress: [],
    };
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ChallengeManager {
    if (!ChallengeManager.instance) {
      ChallengeManager.instance = new ChallengeManager();
    }
    return ChallengeManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    ChallengeManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the currently active challenge definition, or null. */
  getActiveChallenge(): Challenge | null {
    if (!this.state.activeChallengeId) {
      return null;
    }
    return BUILT_IN_CHALLENGES.find((c) => c.id === this.state.activeChallengeId) ?? null;
  }

  /** Get the active challenge ID. */
  getActiveChallengeId(): string | null {
    return this.state.activeChallengeId;
  }

  /** Get progress for a specific challenge. */
  getProgress(challengeId: string): ChallengeProgress | null {
    return this.state.progress.find((p) => p.challengeId === challengeId) ?? null;
  }

  /** Get progress for all challenges. */
  getAllProgress(): ChallengeProgress[] {
    return [...this.state.progress];
  }

  /** Get the count of completed challenges (score > 0 with completedAt). */
  getCompletedCount(): number {
    return this.state.progress.filter((p) => p.completedAt !== null).length;
  }

  /** Get total number of available challenges. */
  getTotalChallenges(): number {
    return BUILT_IN_CHALLENGES.length;
  }

  /** Get a challenge definition by ID. */
  getChallengeById(id: string): Challenge | null {
    return BUILT_IN_CHALLENGES.find((c) => c.id === id) ?? null;
  }

  /** Get all challenges, optionally filtered by difficulty. */
  getChallenges(difficulty?: ChallengeDifficulty): Challenge[] {
    if (difficulty) {
      return BUILT_IN_CHALLENGES.filter((c) => c.difficulty === difficulty);
    }
    return [...BUILT_IN_CHALLENGES];
  }

  /** Get the number of hints revealed for the active challenge. */
  getHintsUsed(): number {
    if (!this.state.activeChallengeId) {
      return 0;
    }
    const progress = this.getProgress(this.state.activeChallengeId);
    return progress?.hintsUsed ?? 0;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Start a challenge. Sets it as active and initializes progress if needed. */
  startChallenge(challengeId: string): void {
    const challenge = this.getChallengeById(challengeId);
    if (!challenge) {
      return;
    }

    this.state.activeChallengeId = challengeId;

    // Initialize progress entry if it doesn't exist
    if (!this.getProgress(challengeId)) {
      this.state.progress.push({
        challengeId,
        bestScore: 0,
        completedAt: null,
        attempts: 0,
        hintsUsed: 0,
      });
    }

    this.save();
    this.notify();
  }

  /** Submit a circuit solution for the active challenge. Returns the result. */
  submitSolution(circuit: ChallengeCircuit): ChallengeResult {
    const challenge = this.getActiveChallenge();
    if (!challenge) {
      return { passed: false, score: 0, feedback: ['No active challenge.'], bonus: [] };
    }

    const result = challenge.validation(circuit);
    const progress = this.getProgress(challenge.id);

    if (progress) {
      progress.attempts += 1;
      if (result.score > progress.bestScore) {
        progress.bestScore = result.score;
      }
      if (result.passed && !progress.completedAt) {
        progress.completedAt = Date.now();
      }
    }

    this.save();
    this.notify();
    return result;
  }

  /** Reveal the next hint for the active challenge. Returns the hint text or null. */
  revealHint(): string | null {
    const challenge = this.getActiveChallenge();
    if (!challenge) {
      return null;
    }

    const progress = this.getProgress(challenge.id);
    if (!progress) {
      return null;
    }

    if (progress.hintsUsed >= challenge.hints.length) {
      return null; // All hints already revealed
    }

    const hint = challenge.hints[progress.hintsUsed];
    progress.hintsUsed += 1;

    this.save();
    this.notify();
    return hint;
  }

  /** Abandon the active challenge (does not clear progress). */
  abandonChallenge(): void {
    if (!this.state.activeChallengeId) {
      return;
    }
    this.state.activeChallengeId = null;
    this.save();
    this.notify();
  }

  /** Reset progress for a specific challenge. */
  resetProgress(challengeId: string): void {
    const idx = this.state.progress.findIndex((p) => p.challengeId === challengeId);
    if (idx === -1) {
      return;
    }
    this.state.progress.splice(idx, 1);
    if (this.state.activeChallengeId === challengeId) {
      this.state.activeChallengeId = null;
    }
    this.save();
    this.notify();
  }

  /** Reset all progress. */
  resetAllProgress(): void {
    if (this.state.progress.length === 0 && this.state.activeChallengeId === null) {
      return;
    }
    this.state.progress = [];
    this.state.activeChallengeId = null;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever challenge state changes.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Validate activeChallengeId
      if (typeof data.activeChallengeId === 'string' || data.activeChallengeId === null) {
        this.state.activeChallengeId = data.activeChallengeId as string | null;
      }

      // Validate progress array
      if (Array.isArray(data.progress)) {
        this.state.progress = (data.progress as unknown[]).filter(
          (item: unknown): item is ChallengeProgress =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as ChallengeProgress).challengeId === 'string' &&
            typeof (item as ChallengeProgress).bestScore === 'number' &&
            typeof (item as ChallengeProgress).attempts === 'number' &&
            typeof (item as ChallengeProgress).hintsUsed === 'number' &&
            ((item as ChallengeProgress).completedAt === null ||
              typeof (item as ChallengeProgress).completedAt === 'number'),
        );
      }
    } catch {
      // Corrupt data — start fresh
      this.state = { activeChallengeId: null, progress: [] };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for managing a specific circuit challenge.
 * Subscribes to ChallengeManager and triggers re-renders on state changes.
 */
export function useCircuitChallenge(challengeId: string): {
  challenge: Challenge | null;
  progress: ChallengeProgress | null;
  isActive: boolean;
  startChallenge: () => void;
  submitSolution: (circuit: ChallengeCircuit) => ChallengeResult;
  revealHint: () => string | null;
  revealedHints: string[];
  abandonChallenge: () => void;
  resetProgress: () => void;
  completedCount: number;
  totalChallenges: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = ChallengeManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const challenge = ChallengeManager.getInstance().getChallengeById(challengeId);
  const progress = ChallengeManager.getInstance().getProgress(challengeId);
  const isActive = ChallengeManager.getInstance().getActiveChallengeId() === challengeId;

  const startChallenge = useCallback(() => {
    ChallengeManager.getInstance().startChallenge(challengeId);
  }, [challengeId]);

  const submitSolution = useCallback(
    (circuit: ChallengeCircuit): ChallengeResult => {
      // Ensure this challenge is active before submitting
      const mgr = ChallengeManager.getInstance();
      if (mgr.getActiveChallengeId() !== challengeId) {
        mgr.startChallenge(challengeId);
      }
      return mgr.submitSolution(circuit);
    },
    [challengeId],
  );

  const revealHint = useCallback((): string | null => {
    const mgr = ChallengeManager.getInstance();
    if (mgr.getActiveChallengeId() !== challengeId) {
      mgr.startChallenge(challengeId);
    }
    return mgr.revealHint();
  }, [challengeId]);

  const abandonChallenge = useCallback(() => {
    ChallengeManager.getInstance().abandonChallenge();
  }, []);

  const resetProgress = useCallback(() => {
    ChallengeManager.getInstance().resetProgress(challengeId);
  }, [challengeId]);

  // Compute revealed hints based on progress.hintsUsed
  const revealedHints: string[] = [];
  if (challenge && progress) {
    for (let i = 0; i < progress.hintsUsed; i++) {
      if (i < challenge.hints.length) {
        revealedHints.push(challenge.hints[i]);
      }
    }
  }

  return {
    challenge,
    progress,
    isActive,
    startChallenge,
    submitSolution,
    revealHint,
    revealedHints,
    abandonChallenge,
    resetProgress,
    completedCount: ChallengeManager.getInstance().getCompletedCount(),
    totalChallenges: ChallengeManager.getInstance().getTotalChallenges(),
  };
}
