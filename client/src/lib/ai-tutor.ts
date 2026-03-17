/**
 * AI Tutor Engine
 *
 * Provides Socratic questioning, progressive hints, contextual explanations,
 * and challenge prompts for electronics learners at any level. Adapts its
 * teaching style to user proficiency and tracks engagement depth so hints
 * become increasingly specific the more a learner asks.
 *
 * Usage:
 *   const tutor = AiTutor.getInstance();
 *   const resp = tutor.getTutorResponse(context, 'What is a pull-up resistor?', 'explain');
 *
 * React hook:
 *   const { ask, hint, socratic, challenge, classify, resetContext } = useTutor();
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TutorStyle = 'socratic' | 'explain' | 'challenge' | 'hint';

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export interface TutorResponse {
  style: TutorStyle;
  question?: string;
  explanation?: string;
  followUp?: string;
  conceptsReferenced: string[];
}

export interface TutorContext {
  userLevel: UserLevel;
  currentTopic?: string;
  recentErrors: string[];
  askCount: number;
}

// ---------------------------------------------------------------------------
// Topic Question Bank  (30+ topics, 3+ questions each)
// ---------------------------------------------------------------------------

export const TOPIC_QUESTION_BANK: Record<string, string[]> = {
  'ohms-law': [
    'If you double the resistance in a circuit but keep the voltage the same, what happens to the current?',
    'Why does a thinner wire have higher resistance than a thicker wire of the same material?',
    'Can you think of a real-world analogy for Ohm\'s Law using water flow?',
    'What would happen to the brightness of an LED if you halved the series resistor value?',
  ],
  'voltage-dividers': [
    'Why does the output voltage of a voltage divider change when you connect a load?',
    'If both resistors in a divider are equal, what fraction of the input voltage appears at the output?',
    'When would you choose a voltage divider over a voltage regulator?',
  ],
  resistors: [
    'Why do we place resistors in series with LEDs?',
    'What determines the power rating you need for a resistor?',
    'How does temperature affect a resistor\'s actual resistance value?',
  ],
  capacitors: [
    'What happens to the voltage across a capacitor the instant you connect it to a DC source?',
    'Why are capacitors often placed near IC power pins?',
    'How does a capacitor block DC but pass AC signals?',
    'What is the relationship between capacitance, charge, and voltage?',
  ],
  inductors: [
    'Why does an inductor oppose changes in current rather than steady-state current?',
    'What causes the voltage spike when you suddenly disconnect an inductor carrying current?',
    'How does an inductor store energy differently from a capacitor?',
  ],
  diodes: [
    'What happens if you connect a diode backwards across a power supply?',
    'Why is there a forward voltage drop across a conducting diode?',
    'When would you use a Schottky diode instead of a standard silicon diode?',
  ],
  transistors: [
    'How does a small base current control a much larger collector current in a BJT?',
    'What is the difference between saturation and active mode in a transistor?',
    'Why is a transistor sometimes described as a "current-controlled switch"?',
  ],
  mosfets: [
    'Why do MOSFETs have essentially zero gate current?',
    'What determines whether a MOSFET is fully on or partially on?',
    'When would you choose an N-channel MOSFET over a P-channel for a low-side switch?',
  ],
  'op-amps': [
    'What does "virtual short" mean in an op-amp with negative feedback?',
    'Why does an inverting amplifier have a defined input impedance but a non-inverting one has very high input impedance?',
    'What happens to an op-amp\'s output if you remove the feedback resistor?',
  ],
  'h-bridges': [
    'Why is shoot-through dangerous in an H-bridge circuit?',
    'How does PWM duty cycle control motor speed through an H-bridge?',
    'What is the purpose of flyback diodes in a motor driver circuit?',
  ],
  pwm: [
    'Why does changing the duty cycle of a PWM signal change the perceived brightness of an LED?',
    'What PWM frequency would you choose for driving a motor, and why?',
    'How can you convert a PWM signal into a smooth analog voltage?',
  ],
  'power-supplies': [
    'What is the difference between a linear regulator and a switching regulator?',
    'Why do switching regulators need an inductor?',
    'What role does the input capacitor play in a voltage regulator circuit?',
  ],
  'voltage-regulators': [
    'When would a low-dropout (LDO) regulator be a better choice than a standard linear regulator?',
    'What is dropout voltage and why does it matter?',
    'Why do voltage regulators need minimum load current to regulate properly?',
  ],
  i2c: [
    'Why does I2C require pull-up resistors on SDA and SCL?',
    'What happens on an I2C bus if two devices have the same address?',
    'How does clock stretching work and when would a slave device use it?',
  ],
  spi: [
    'Why does SPI use a separate chip-select line for each slave?',
    'What advantage does full-duplex communication give SPI over I2C?',
    'How do the four SPI modes differ in terms of clock polarity and phase?',
  ],
  uart: [
    'Why must both sides of a UART connection agree on the baud rate?',
    'What happens if you swap TX and RX accidentally?',
    'Why is UART limited to point-to-point communication?',
  ],
  'adc-dac': [
    'How does increasing the ADC resolution from 10-bit to 12-bit affect measurement precision?',
    'What causes quantization error in an ADC reading?',
    'Why might an ESP32 ADC reading be inaccurate near 0V and 3.3V?',
  ],
  'pcb-design': [
    'Why is a ground plane important for signal integrity?',
    'What factors determine the minimum trace width for a power rail?',
    'Why should you avoid 90-degree trace corners in high-speed designs?',
  ],
  'pcb-layout': [
    'What is the purpose of thermal relief pads on a ground plane?',
    'Why should decoupling capacitors be placed as close to IC power pins as possible?',
    'How does component placement affect routing difficulty?',
  ],
  soldering: [
    'What causes a cold solder joint and how can you identify one?',
    'Why is flux important during the soldering process?',
    'What is the correct sequence: apply heat, then solder, or solder, then heat?',
  ],
  'pull-up-pull-down': [
    'Why does a floating digital input behave unpredictably?',
    'When would you use an internal pull-up resistor versus an external one?',
    'What value of pull-up resistor would you choose for a button, and why?',
  ],
  'decoupling-capacitors': [
    'Why do high-frequency decoupling capacitors need to be physically close to the IC?',
    'What capacitor value is typically used for local decoupling on a digital IC?',
    'Why might you use both a 100nF and a 10uF capacitor near the same IC?',
  ],
  'rc-filters': [
    'How does the cutoff frequency of an RC low-pass filter relate to R and C values?',
    'What happens to frequencies above the cutoff in a low-pass filter?',
    'Why does a single-stage RC filter roll off at -20 dB/decade?',
  ],
  'esd-protection': [
    'Why are MOSFETs particularly vulnerable to electrostatic discharge?',
    'What is the purpose of TVS (transient voltage suppressor) diodes?',
    'How does an ESD wrist strap protect sensitive components?',
  ],
  'circuit-debugging': [
    'What is the first thing you should check when a circuit does not work?',
    'How do you isolate which section of a complex circuit has the fault?',
    'Why is measuring voltage at intermediate nodes useful for debugging?',
  ],
  'arduino-basics': [
    'What is the difference between digital and analog pins on an Arduino?',
    'Why does analogRead() return 0-1023 on an Arduino Uno?',
    'What happens if you draw more than 20mA from a single Arduino GPIO pin?',
  ],
  'esp32-basics': [
    'Why does the ESP32 operate at 3.3V logic while many Arduino boards use 5V?',
    'What is the purpose of the ESP32\'s built-in WiFi and Bluetooth?',
    'Which ESP32 pins are safe for general-purpose I/O and which are restricted?',
  ],
  sensors: [
    'How does a thermistor measure temperature differently from a thermocouple?',
    'Why might you choose an I2C sensor over an analog sensor for the same measurement?',
    'What is sensor calibration and why is it important?',
  ],
  'motor-control': [
    'Why can\'t you drive a DC motor directly from a microcontroller GPIO pin?',
    'What is back-EMF and how does it affect motor control circuits?',
    'How does a PID controller maintain precise motor speed?',
  ],
  batteries: [
    'Why do lithium-ion batteries need a Battery Management System (BMS)?',
    'What is the C-rating of a battery and how does it affect discharge?',
    'How do you calculate how long a battery will power your circuit?',
  ],
  grounding: [
    'What is the difference between digital ground and analog ground?',
    'Why should ground connections form a star topology rather than a daisy chain?',
    'What is a ground loop and how does it introduce noise?',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic pick from an array based on index modulo. */
function pickByIndex<T>(arr: readonly T[], index: number): T {
  return arr[Math.abs(index) % arr.length];
}

/** Normalize a topic string to a TOPIC_QUESTION_BANK key. */
function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Extract topic keywords from a user message (simple heuristic). */
function extractTopics(message: string): string[] {
  const normalized = message.toLowerCase();
  const matched: string[] = [];
  for (const key of Object.keys(TOPIC_QUESTION_BANK)) {
    // Match the key literally or its space-separated form
    const spacedKey = key.replace(/-/g, ' ');
    if (normalized.includes(spacedKey) || normalized.includes(key)) {
      matched.push(key);
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Generate a Socratic question for a given topic.
 * Cycles through available questions based on context.askCount.
 */
export function generateSocraticQuestion(context: TutorContext, topic: string): string {
  const key = normalizeTopic(topic);
  const questions = TOPIC_QUESTION_BANK[key];

  if (!questions || questions.length === 0) {
    // Fallback: generic Socratic prompt
    return `What do you already know about ${topic}, and what part feels unclear?`;
  }

  return pickByIndex(questions, context.askCount);
}

/**
 * Generate a progressively-specific hint for an error.
 *
 * askCount 0  → vague nudge
 * askCount 1  → directional hint
 * askCount 2  → specific guidance
 * askCount 3+ → near-answer
 */
export function generateHint(context: TutorContext, error: string): string {
  const errorLower = error.toLowerCase();

  // Level-aware hint banks keyed by common error patterns
  const hintBanks: Array<{
    pattern: RegExp;
    hints: [string, string, string, string];
  }> = [
    {
      pattern: /short[- ]?circuit/i,
      hints: [
        'Think about what happens when current has a path with almost zero resistance.',
        'Check your connections — is there a direct path between power and ground that bypasses your load?',
        'Look for places where two nodes that should be separate are accidentally connected.',
        'You likely have a wire or trace that connects VCC directly to GND. Trace every power rail connection.',
      ],
    },
    {
      pattern: /no[- ]?power|not[- ]?turning[- ]?on|no[- ]?voltage/i,
      hints: [
        'Start from the source. Is power actually reaching the first component?',
        'Measure voltage at key nodes — power supply output, regulator input, IC supply pins.',
        'Check for reversed polarity, blown fuses, or disconnected ground paths.',
        'Verify: (1) power supply output is correct, (2) all ground connections are intact, (3) no solder bridges or open joints at the IC power pins.',
      ],
    },
    {
      pattern: /led|light/i,
      hints: [
        'Think about what an LED needs to light up — direction and current.',
        'Check that the LED is oriented correctly (anode to positive) and has a current-limiting resistor.',
        'Verify the resistor value gives enough current. V_R = V_supply - V_LED; I = V_R / R. Most LEDs want 10-20mA.',
        'Confirm: (1) correct polarity, (2) resistor in series, (3) resistor value gives 10-20mA, (4) the GPIO pin is actually set HIGH.',
      ],
    },
    {
      pattern: /i2c|sda|scl|address/i,
      hints: [
        'I2C requires specific electrical conditions on its bus lines to work.',
        'Make sure both SDA and SCL have pull-up resistors (typically 4.7kΩ to VCC).',
        'Run an I2C scanner sketch to verify the device is responding at the expected address.',
        'Check: (1) pull-up resistors on SDA/SCL, (2) correct address in your code, (3) shared ground between devices, (4) voltage levels match (3.3V vs 5V).',
      ],
    },
    {
      pattern: /motor|not[- ]?spinning|stall/i,
      hints: [
        'A motor needs sufficient current and the right kind of driver.',
        'Make sure you are driving the motor through a transistor or H-bridge — not directly from a GPIO pin.',
        'Check your motor driver supply voltage and whether the enable pin is active.',
        'Verify: (1) motor supply voltage matches motor rating, (2) H-bridge/driver enable is HIGH, (3) direction pins are set correctly, (4) motor draw does not exceed driver current limit.',
      ],
    },
    {
      pattern: /noise|unstable|jitter|fluctuat/i,
      hints: [
        'Electrical noise often comes from inadequate decoupling or poor grounding.',
        'Add decoupling capacitors (100nF ceramic) close to your IC power pins.',
        'Check your ground path — long ground wires act as antennas. Use a ground plane or star grounding.',
        'Solutions: (1) 100nF + 10µF decoupling at each IC, (2) short, direct ground connections, (3) separate analog and digital grounds, (4) add filtering on sensor inputs.',
      ],
    },
    {
      pattern: /spi|mosi|miso|clock/i,
      hints: [
        'SPI communication depends on matching clock settings between master and slave.',
        'Verify the SPI mode (CPOL/CPHA) and clock speed match what your slave device expects.',
        'Check that chip select (CS) goes LOW before communication and HIGH after.',
        'Debug: (1) CS wired and driven correctly, (2) MOSI→MOSI / MISO←MISO (no crossover), (3) SPI mode matches datasheet, (4) clock ≤ device max frequency.',
      ],
    },
    {
      pattern: /uart|serial|baud/i,
      hints: [
        'Both sides of a serial link must speak the same language — literally the same baud rate.',
        'Check that TX connects to RX and RX connects to TX between the two devices.',
        'Verify matching baud rate, data bits (usually 8), parity (usually None), and stop bits (usually 1).',
        'Full check: (1) TX↔RX crossed correctly, (2) common GND, (3) matching baud rate, (4) voltage levels compatible (3.3V vs 5V — use level shifter if needed).',
      ],
    },
  ];

  // Find matching hint bank
  for (const bank of hintBanks) {
    if (bank.pattern.test(errorLower)) {
      const stage = Math.min(context.askCount, 3);
      return bank.hints[stage];
    }
  }

  // Generic progressive hints for unrecognized errors
  const genericHints: [string, string, string, string] = [
    'Take a step back and think about what the expected behavior should be versus what you are seeing.',
    'Try to narrow down the problem — isolate subsections of the circuit or code and test them independently.',
    `Look closely at the area related to "${error}". Check connections, values, and whether each component is functioning correctly.`,
    `For the error "${error}": systematically verify power, ground, signal connections, and component values at every node in the affected section.`,
  ];
  const stage = Math.min(context.askCount, 3);
  return genericHints[stage];
}

/**
 * Produce a full TutorResponse combining the style, relevant questions,
 * explanations, and follow-up prompts.
 */
export function getTutorResponse(
  context: TutorContext,
  userMessage: string,
  style: TutorStyle,
): TutorResponse {
  const topics = extractTopics(userMessage);
  const primaryTopic = context.currentTopic
    ? normalizeTopic(context.currentTopic)
    : topics[0] ?? undefined;

  const conceptsReferenced = topics.length > 0 ? topics : primaryTopic ? [primaryTopic] : [];

  switch (style) {
    case 'socratic': {
      const question = primaryTopic
        ? generateSocraticQuestion(context, primaryTopic)
        : 'What is the core concept you are trying to understand right now?';
      const followUp = context.userLevel === 'beginner'
        ? 'Take your time — there are no wrong answers. What is your first instinct?'
        : context.userLevel === 'intermediate'
          ? 'Try to reason through it before looking it up.'
          : 'Consider edge cases or failure modes in your answer.';
      return { style: 'socratic', question, followUp, conceptsReferenced };
    }

    case 'explain': {
      const explanation = primaryTopic
        ? buildExplanation(context, primaryTopic, userMessage)
        : 'Could you tell me which specific concept or component you would like explained?';
      const followUp = primaryTopic
        ? `Does that clarify things? If not, try asking about a specific part of ${primaryTopic.replace(/-/g, ' ')}.`
        : undefined;
      return { style: 'explain', explanation, followUp, conceptsReferenced };
    }

    case 'challenge': {
      const question = primaryTopic
        ? buildChallenge(context, primaryTopic)
        : 'Try to design a simple circuit that blinks an LED using only passive components and a power source.';
      const followUp = 'Once you have an answer, I can help you verify it or explore further.';
      return { style: 'challenge', question, followUp, conceptsReferenced };
    }

    case 'hint': {
      const error = context.recentErrors.length > 0
        ? context.recentErrors[context.recentErrors.length - 1]
        : userMessage;
      const explanation = generateHint(context, error);
      const followUp = context.askCount >= 3
        ? 'If you are still stuck, try describing exactly what you expected versus what happened.'
        : 'Would you like another hint, or do you want to try something first?';
      return { style: 'hint', explanation, followUp, conceptsReferenced };
    }
  }
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function buildExplanation(context: TutorContext, topic: string, _userMessage: string): string {
  const level = context.userLevel;

  // Level-adapted explanation prefixes
  const prefixes: Record<UserLevel, string> = {
    beginner: `Let me explain ${topic.replace(/-/g, ' ')} in simple terms.`,
    intermediate: `Here is a more detailed look at ${topic.replace(/-/g, ' ')}.`,
    advanced: `Let\'s dive into the nuances of ${topic.replace(/-/g, ' ')}.`,
  };

  const questions = TOPIC_QUESTION_BANK[topic];
  const relatedPrompt = questions && questions.length > 0
    ? ` A good question to think about: ${pickByIndex(questions, context.askCount)}`
    : '';

  return `${prefixes[level]}${relatedPrompt}`;
}

function buildChallenge(context: TutorContext, topic: string): string {
  const challenges: Record<UserLevel, (t: string) => string> = {
    beginner: (t) =>
      `Can you draw a simple circuit that demonstrates the basic principle of ${t.replace(/-/g, ' ')}?`,
    intermediate: (t) =>
      `Design a circuit using ${t.replace(/-/g, ' ')} that solves a practical problem. What component values would you choose, and why?`,
    advanced: (t) =>
      `Identify the failure modes and edge cases in a real-world ${t.replace(/-/g, ' ')} application. How would you design around them?`,
  };

  return challenges[context.userLevel](topic);
}

// ---------------------------------------------------------------------------
// User Level Classification
// ---------------------------------------------------------------------------

/**
 * Classify a user's level based on their interaction history.
 *
 * Heuristics:
 *   - Uses vocabulary complexity and topic coverage breadth
 *   - More advanced terms / more diverse topics → higher level
 */
export function classifyUserLevel(history: string[]): UserLevel {
  if (history.length === 0) {
    return 'beginner';
  }

  const combined = history.join(' ').toLowerCase();
  const wordCount = combined.split(/\s+/).length;

  // Advanced vocabulary markers
  const advancedTerms = [
    'impedance', 'smith chart', 'transmission line', 'crosstalk', 'differential pair',
    'eye diagram', 's-parameters', 'return loss', 'insertion loss', 'signal integrity',
    'pdn', 'power delivery network', 'emc', 'emi', 'derating', 'thermal resistance',
    'via inductance', 'copper pour', 'stack-up', 'microstrip', 'stripline',
    'nyquist', 'bode plot', 'transfer function', 'laplace', 'fourier',
    'rds(on)', 'gate charge', 'slew rate', 'cmrr', 'psrr',
  ];

  // Intermediate vocabulary markers
  const intermediateTerms = [
    'pull-up', 'pull-down', 'voltage divider', 'decoupling', 'bypass capacitor',
    'pwm', 'duty cycle', 'h-bridge', 'mosfet', 'bjt', 'op-amp', 'feedback',
    'ground plane', 'trace width', 'via', 'solder paste', 'reflow',
    'interrupt', 'dma', 'timer', 'register', 'prescaler',
    'cutoff frequency', 'gain', 'bandwidth', 'ripple', 'efficiency',
    'i2c', 'spi', 'baud rate', 'protocol', 'bus',
  ];

  let advancedHits = 0;
  let intermediateHits = 0;

  for (const term of advancedTerms) {
    if (combined.includes(term)) {
      advancedHits++;
    }
  }

  for (const term of intermediateTerms) {
    if (combined.includes(term)) {
      intermediateHits++;
    }
  }

  // Unique topics mentioned
  const topicsCovered = new Set<string>();
  for (const key of Object.keys(TOPIC_QUESTION_BANK)) {
    const spacedKey = key.replace(/-/g, ' ');
    if (combined.includes(spacedKey) || combined.includes(key)) {
      topicsCovered.add(key);
    }
  }

  // Classification thresholds
  if (advancedHits >= 3 || (advancedHits >= 1 && intermediateHits >= 5)) {
    return 'advanced';
  }
  if (intermediateHits >= 3 || topicsCovered.size >= 5 || wordCount > 500) {
    return 'intermediate';
  }
  return 'beginner';
}

// ---------------------------------------------------------------------------
// AiTutor singleton
// ---------------------------------------------------------------------------

/**
 * Singleton AI Tutor manager. Wraps the stateless functions with a
 * persistent TutorContext, subscribe/notify pattern, and localStorage persistence.
 */
export class AiTutor {
  private static instance: AiTutor | null = null;

  private context: TutorContext;
  private history: string[];
  private subscribers: Set<() => void>;

  constructor() {
    this.context = { userLevel: 'beginner', recentErrors: [], askCount: 0 };
    this.history = [];
    this.subscribers = new Set();
    this.load();
  }

  static getInstance(): AiTutor {
    if (!AiTutor.instance) {
      AiTutor.instance = new AiTutor();
    }
    return AiTutor.instance;
  }

  static resetForTesting(): void {
    AiTutor.instance = null;
  }

  // -----------------------------------------------------------------------
  // Context management
  // -----------------------------------------------------------------------

  getContext(): TutorContext {
    return { ...this.context, recentErrors: [...this.context.recentErrors] };
  }

  setLevel(level: UserLevel): void {
    this.context.userLevel = level;
    this.save();
    this.notify();
  }

  setTopic(topic: string): void {
    this.context.currentTopic = topic;
    this.save();
    this.notify();
  }

  addError(error: string): void {
    this.context.recentErrors.push(error);
    // Keep last 10 errors
    if (this.context.recentErrors.length > 10) {
      this.context.recentErrors = this.context.recentErrors.slice(-10);
    }
    this.save();
    this.notify();
  }

  resetContext(): void {
    this.context = { userLevel: 'beginner', recentErrors: [], askCount: 0 };
    this.history = [];
    this.save();
    this.notify();
  }

  getHistory(): string[] {
    return [...this.history];
  }

  // -----------------------------------------------------------------------
  // Tutor operations
  // -----------------------------------------------------------------------

  ask(userMessage: string, style: TutorStyle): TutorResponse {
    this.history.push(userMessage);
    this.context.askCount++;
    const response = getTutorResponse(this.context, userMessage, style);
    this.save();
    this.notify();
    return response;
  }

  socratic(topic: string): string {
    this.context.askCount++;
    const question = generateSocraticQuestion(this.context, topic);
    this.save();
    this.notify();
    return question;
  }

  hint(error?: string): string {
    const err = error ?? (this.context.recentErrors.length > 0
      ? this.context.recentErrors[this.context.recentErrors.length - 1]
      : 'unknown issue');
    this.context.askCount++;
    const result = generateHint(this.context, err);
    this.save();
    this.notify();
    return result;
  }

  reclassify(): UserLevel {
    const level = classifyUserLevel(this.history);
    this.context.userLevel = level;
    this.save();
    this.notify();
    return level;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = { context: this.context, history: this.history };
      localStorage.setItem('protopulse-ai-tutor', JSON.stringify(data));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem('protopulse-ai-tutor');
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      const data = parsed as Record<string, unknown>;

      if (typeof data.context === 'object' && data.context !== null) {
        const ctx = data.context as Record<string, unknown>;
        if (['beginner', 'intermediate', 'advanced'].includes(ctx.userLevel as string)) {
          this.context.userLevel = ctx.userLevel as UserLevel;
        }
        if (typeof ctx.currentTopic === 'string') {
          this.context.currentTopic = ctx.currentTopic;
        }
        if (Array.isArray(ctx.recentErrors)) {
          this.context.recentErrors = (ctx.recentErrors as unknown[]).filter(
            (e): e is string => typeof e === 'string',
          );
        }
        if (typeof ctx.askCount === 'number') {
          this.context.askCount = ctx.askCount;
        }
      }

      if (Array.isArray(data.history)) {
        this.history = (data.history as unknown[]).filter(
          (h): h is string => typeof h === 'string',
        );
      }
    } catch {
      // Corrupt data — start fresh
    }
  }

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
 * Hook for using the AI tutor in React components.
 * Subscribes to the AiTutor singleton and re-renders on context changes.
 */
export function useTutor(): {
  ask: (userMessage: string, style: TutorStyle) => TutorResponse;
  hint: (error?: string) => string;
  socratic: (topic: string) => string;
  challenge: (topic: string) => TutorResponse;
  classify: () => UserLevel;
  resetContext: () => void;
  context: TutorContext;
  history: string[];
  setLevel: (level: UserLevel) => void;
  setTopic: (topic: string) => void;
  addError: (error: string) => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const tutor = AiTutor.getInstance();
    const unsubscribe = tutor.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const tutor = useMemo(
    () => (typeof window !== 'undefined' ? AiTutor.getInstance() : null),
    [],
  );

  const ask = useCallback(
    (userMessage: string, style: TutorStyle) => {
      return tutor!.ask(userMessage, style);
    },
    [tutor],
  );

  const hintFn = useCallback(
    (error?: string) => {
      return tutor!.hint(error);
    },
    [tutor],
  );

  const socraticFn = useCallback(
    (topic: string) => {
      return tutor!.socratic(topic);
    },
    [tutor],
  );

  const challenge = useCallback(
    (topic: string) => {
      return tutor!.ask(`Challenge me on ${topic}`, 'challenge');
    },
    [tutor],
  );

  const classify = useCallback(() => {
    return tutor!.reclassify();
  }, [tutor]);

  const resetContext = useCallback(() => {
    tutor!.resetContext();
  }, [tutor]);

  const setLevel = useCallback(
    (level: UserLevel) => {
      tutor!.setLevel(level);
    },
    [tutor],
  );

  const setTopic = useCallback(
    (topic: string) => {
      tutor!.setTopic(topic);
    },
    [tutor],
  );

  const addError = useCallback(
    (error: string) => {
      tutor!.addError(error);
    },
    [tutor],
  );

  const emptyContext: TutorContext = { userLevel: 'beginner', recentErrors: [], askCount: 0 };

  return {
    ask,
    hint: hintFn,
    socratic: socraticFn,
    challenge,
    classify,
    resetContext,
    context: tutor?.getContext() ?? emptyContext,
    history: tutor?.getHistory() ?? [],
    setLevel,
    setTopic,
    addError,
  };
}
