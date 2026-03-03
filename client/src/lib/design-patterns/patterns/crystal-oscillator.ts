import type { DesignPattern } from '../types';

export const crystalOscillator: DesignPattern = {
  id: 'crystal-oscillator',
  name: 'Crystal Oscillator',
  category: 'digital',
  difficulty: 'advanced',
  description:
    'A quartz crystal with load capacitors that generates a precise clock signal for a microcontroller. Critical for accurate timing, UART communication, and USB connectivity.',
  whyItWorks:
    'A quartz crystal is a tiny piece of piezoelectric material that vibrates mechanically at a very precise frequency when an electric field is applied. The MCU\u2019s oscillator amplifier provides energy to keep the crystal vibrating, and the crystal\u2019s mechanical resonance locks the frequency to parts-per-million accuracy. The load capacitors (C1, C2) form a resonant tank circuit with the crystal, and their values determine the exact oscillation frequency. The crystal datasheet specifies a required load capacitance (CL), and the correct cap values are chosen to match: C1 = C2 = 2 \u00D7 (CL - Cstray), where Cstray is the parasitic capacitance of the PCB traces and MCU pins (typically 2\u20135 pF).',
  components: [
    {
      name: 'Quartz crystal',
      type: 'Crystal oscillator',
      value: '16 MHz (Arduino Mega) or 8/12 MHz',
      notes: 'Must match the MCU\u2019s expected clock frequency. Check the MCU datasheet for supported ranges.',
    },
    {
      name: 'Load capacitor C1',
      type: 'Ceramic capacitor (C0G/NP0)',
      value: '22 pF (typical for 16 MHz crystal with 20 pF CL)',
      notes: 'Use C0G/NP0 dielectric for stable capacitance. Never use X7R or Y5V for oscillator loads.',
    },
    {
      name: 'Load capacitor C2',
      type: 'Ceramic capacitor (C0G/NP0)',
      value: '22 pF',
      notes: 'Must match C1 for symmetrical operation.',
    },
  ],
  connections: [
    {
      from: 'Crystal pin 1',
      to: 'MCU XTAL1 (OSC_IN) + C1 to GND',
      description: 'One crystal terminal goes to the oscillator input pin. C1 connects from this node to ground.',
    },
    {
      from: 'Crystal pin 2',
      to: 'MCU XTAL2 (OSC_OUT) + C2 to GND',
      description: 'The other crystal terminal goes to the oscillator output pin. C2 connects from this node to ground.',
    },
    {
      from: 'C1 and C2 ground connections',
      to: 'Board ground (close to MCU)',
      description: 'Both load caps should connect to the ground plane directly beneath or adjacent to the crystal. Keep the ground return path short.',
    },
  ],
  tips: [
    'Keep the crystal and load caps as close to the MCU\u2019s XTAL pins as possible — long traces add stray capacitance and can pick up noise.',
    'Do not route any high-speed signals near the crystal traces — crosstalk can inject noise and cause clock jitter.',
    'For the rover\u2019s Arduino Mega: 16 MHz crystal with 22 pF caps is the standard configuration.',
    'If using a ceramic resonator instead of a crystal (less accurate, but caps are built-in), you do not need external load caps.',
    'Some MCUs (like ESP32) have an internal oscillator and only need a crystal for more precise timing or USB. Check if yours actually needs one.',
    'For accurate UART at high baud rates (115200+), crystal accuracy matters. A ceramic resonator may cause framing errors.',
  ],
  commonMistakes: [
    'Using the wrong load capacitor values — this shifts the oscillation frequency away from the nominal value, causing UART communication errors, USB enumeration failure, or inaccurate timers.',
    'Forgetting to account for stray capacitance — if the datasheet says CL = 20 pF and you use 20 pF caps on each side, the effective load is ~12 pF, which is too high (frequency shifts down).',
    'Placing the crystal far from the MCU — long traces add stray capacitance and act as antennas for noise pickup.',
    'Running digital signal traces under or near the crystal — the oscillator circuit is sensitive to interference.',
    'Using X7R or Y5V capacitors — their capacitance varies significantly with voltage and temperature, drifting the clock frequency.',
  ],
  relatedPatterns: ['decoupling-network', 'level-shifter'],
  tags: ['crystal', 'oscillator', 'clock', 'MCU', 'Arduino', 'frequency', 'quartz', 'XTAL', 'load capacitor', 'pF'],
};
