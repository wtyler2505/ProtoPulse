import type { DesignPattern } from '../types';

export const hBridge: DesignPattern = {
  id: 'h-bridge',
  name: 'H-Bridge Motor Driver',
  category: 'motor',
  difficulty: 'intermediate',
  description:
    'Four switching elements (MOSFETs or transistors) arranged in an H shape that drive a DC motor in both directions with speed control via PWM. The core circuit behind every bidirectional motor controller.',
  whyItWorks:
    'A DC motor\'s direction depends on the polarity of the voltage across its terminals. An H-bridge creates four paths between the supply and the motor. By turning on the top-left and bottom-right switches, current flows left-to-right through the motor (forward). Turning on the top-right and bottom-left switches reverses the current (reverse). PWM on the enable or high-side switches controls the average voltage and thus motor speed. The "H" shape of the schematic gives the circuit its name. Flyback diodes across each switch protect against the voltage spikes generated when the motor\'s inductance resists current changes during switching.',
  components: [
    {
      name: 'High-side MOSFET (left)',
      type: 'P-channel MOSFET or N-channel with gate driver',
      value: 'IRLZ44N (N-channel, logic-level) or IRF9540 (P-channel)',
      notes: 'Must handle the motor\'s stall current. Rds(on) determines heat dissipation. Logic-level gate threshold is essential when driving from 3.3V/5V MCUs.',
    },
    {
      name: 'High-side MOSFET (right)',
      type: 'P-channel MOSFET or N-channel with gate driver',
      value: 'Same as high-side left',
      notes: 'Matched pair with the left high-side switch for symmetrical operation.',
    },
    {
      name: 'Low-side MOSFET (left)',
      type: 'N-channel MOSFET',
      value: 'IRLZ44N',
      notes: 'N-channel MOSFETs are preferred on the low side because they are easier to drive — the gate voltage is referenced to ground.',
    },
    {
      name: 'Low-side MOSFET (right)',
      type: 'N-channel MOSFET',
      value: 'IRLZ44N',
      notes: 'Matched pair with the left low-side switch.',
    },
    {
      name: 'Flyback diodes (4x)',
      type: 'Schottky diode',
      value: 'SS34 or SB540 (Schottky, fast recovery)',
      notes: 'One across each MOSFET (cathode to drain, anode to source for N-channel). Schottky diodes are preferred for their fast switching and low forward voltage.',
    },
    {
      name: 'Bootstrap capacitors (if using N-channel high-side)',
      type: 'Ceramic capacitor',
      value: '100 nF',
      notes: 'Required for high-side N-channel gate drivers. Not needed if using P-channel high-side switches.',
    },
  ],
  connections: [
    {
      from: 'High-side left drain + high-side right drain',
      to: 'Motor supply voltage (V+)',
      description: 'Both high-side switch drains connect to the positive motor power supply.',
    },
    {
      from: 'Low-side left source + low-side right source',
      to: 'Ground (GND)',
      description: 'Both low-side switch sources connect to the power ground. Add a current-sense resistor here if you need current feedback.',
    },
    {
      from: 'High-side left source + low-side left drain',
      to: 'Motor terminal A',
      description: 'The left leg of the H connects to one motor terminal.',
    },
    {
      from: 'High-side right source + low-side right drain',
      to: 'Motor terminal B',
      description: 'The right leg of the H connects to the other motor terminal.',
    },
    {
      from: 'MOSFET gates',
      to: 'MCU GPIO pins (via gate driver or direct)',
      description: 'Control signals from the MCU determine which pair of switches is on. Never turn on both switches on the same side simultaneously (shoot-through).',
    },
  ],
  tips: [
    'For the rover: the RioRand motor controllers already contain H-bridges. Understanding how they work internally helps you diagnose issues and set PWM frequency correctly.',
    'Always implement dead time (1-5 \u00B5s delay) between turning off one pair and turning on the opposite pair. Without it, both switches on the same side briefly conduct simultaneously (shoot-through), creating a short circuit that can destroy the MOSFETs.',
    'Use a dedicated H-bridge IC (L298N, DRV8833, BTS7960) instead of discrete MOSFETs for motors under 10A — the IC handles dead time, current sensing, and thermal protection.',
    'PWM frequency matters: 20-25 kHz is above human hearing (no motor whine), but too high increases switching losses. 1-5 kHz works but you\'ll hear the motor singing.',
    'Add a large bulk capacitor (100-470 \u00B5F) across the motor power supply, close to the H-bridge. Motor current spikes can cause voltage drops that reset your MCU.',
  ],
  commonMistakes: [
    'Shoot-through — turning on both high-side and low-side switches on the same leg simultaneously creates a short circuit from V+ to GND through the MOSFETs, often destroying them instantly.',
    'Omitting flyback diodes — when a MOSFET turns off, the motor\'s inductance generates a voltage spike that can exceed the MOSFET\'s drain-source voltage rating, punching through the device.',
    'Using non-logic-level MOSFETs with a 3.3V or 5V MCU — standard MOSFETs need 10V+ on the gate to fully turn on. If Rds(on) is specified at Vgs=10V, your 3.3V MCU cannot drive it properly.',
    'Sharing the motor power ground with the MCU without proper decoupling — motor noise on the ground rail causes MCU resets and erratic behavior.',
  ],
  relatedPatterns: ['decoupling-network', 'led-driver', 'voltage-regulator'],
  tags: ['H-bridge', 'motor', 'MOSFET', 'PWM', 'bidirectional', 'driver', 'flyback', 'shoot-through', 'dead time', 'DC motor'],
};
