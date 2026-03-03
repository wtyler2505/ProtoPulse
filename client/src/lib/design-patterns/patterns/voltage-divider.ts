import type { DesignPattern } from '../types';

export const voltageDivider: DesignPattern = {
  id: 'voltage-divider',
  name: 'Voltage Divider',
  category: 'signal',
  difficulty: 'beginner',
  description:
    'Two resistors in series that scale a voltage down by a predictable ratio. The most fundamental analog circuit — used everywhere from sensor reading to biasing transistors.',
  whyItWorks:
    'When current flows through two resistors in series, the voltage drops across each resistor proportionally to its resistance (Ohm\'s law). The output is taken from the junction between R1 (top) and R2 (bottom), giving Vout = Vin \u00D7 R2 / (R1 + R2). This ratio is set entirely by the resistor values, not the input voltage. The key limitation is that any load connected to the output draws current through R2, effectively placing a parallel resistance that changes the ratio — so voltage dividers work best when the load impedance is at least 10\u00D7 higher than R2.',
  components: [
    {
      name: 'R1 (top resistor)',
      type: 'Resistor',
      value: '10 k\u03A9 (typical starting point)',
      notes: 'Connected between Vin and the output node. Higher values waste less power but are more sensitive to loading.',
    },
    {
      name: 'R2 (bottom resistor)',
      type: 'Resistor',
      value: 'Calculated from ratio: R2 = R1 \u00D7 Vout / (Vin - Vout)',
      notes: 'Connected between the output node and ground. The ratio R2/(R1+R2) sets the output voltage.',
    },
  ],
  connections: [
    {
      from: 'R1 terminal 1',
      to: 'Input voltage source (Vin)',
      description: 'The top of the divider connects to the voltage you want to scale down.',
    },
    {
      from: 'R1 terminal 2 + R2 terminal 1',
      to: 'Output node (Vout)',
      description: 'The junction between R1 and R2 is where you measure or tap the divided voltage.',
    },
    {
      from: 'R2 terminal 2',
      to: 'Ground (GND)',
      description: 'The bottom resistor connects to the circuit ground reference.',
    },
  ],
  tips: [
    'For reading a 12V battery with a 3.3V ADC: use R1 = 30 k\u03A9, R2 = 10 k\u03A9 to get a 4:1 ratio (12V \u2192 3V, safely within ADC range).',
    'Keep the total resistance (R1 + R2) between 10 k\u03A9 and 100 k\u03A9 for most applications — low enough to not be affected by noise, high enough to not waste power.',
    'Use 1% tolerance resistors when accuracy matters (e.g., ADC voltage sensing). 5% resistors can give up to 10% error in the output.',
    'For the rover project: use a voltage divider to monitor battery voltage with the Arduino\'s ADC (max 5V input) or ESP32\'s ADC (max 3.3V input).',
    'Add a small filter capacitor (100 nF) across R2 if you\'re feeding an ADC — it smooths out noise and improves readings.',
  ],
  commonMistakes: [
    'Ignoring loading effects — connecting a load with impedance comparable to R2 pulls the output voltage lower than the formula predicts.',
    'Using a voltage divider as a power supply — it cannot supply significant current. Use a voltage regulator instead.',
    'Choosing very high resistor values (> 1 M\u03A9) — these are susceptible to noise pickup and leakage currents, especially in humid environments.',
    'Forgetting that tolerance stacks — two 5% resistors can combine to give nearly 10% error in the voltage ratio.',
  ],
  relatedPatterns: ['pull-up-resistor', 'level-shifter', 'voltage-regulator'],
  tags: ['voltage divider', 'resistor', 'ratio', 'ADC', 'scaling', 'bias', 'R1 R2', 'Vout', 'analog'],
};
