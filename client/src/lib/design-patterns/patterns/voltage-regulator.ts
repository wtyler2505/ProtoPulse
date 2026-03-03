import type { DesignPattern } from '../types';

export const voltageRegulator: DesignPattern = {
  id: 'voltage-regulator',
  name: 'Voltage Regulator',
  category: 'power',
  difficulty: 'intermediate',
  description:
    'A circuit that converts a higher input voltage to a stable, lower output voltage regardless of load variations. The starting point for every power supply design — choose LDO for simplicity or buck converter for efficiency.',
  whyItWorks:
    'An LDO (Low Dropout Regulator) works like an electronically controlled variable resistor in series with the supply. An internal error amplifier compares the output voltage to a reference and adjusts the pass transistor\'s resistance to maintain a constant output. The "dropout" voltage is the minimum difference between input and output needed for regulation — typically 200-500 mV for a true LDO. A buck (switching) regulator uses an inductor, diode, and high-frequency switch to efficiently convert voltage by storing energy in the inductor\'s magnetic field and releasing it at the lower voltage. Buck converters waste far less power as heat (85-95% efficient vs. the LDO\'s (Vout/Vin) \u00D7 100% efficiency), but they generate switching noise and require more components.',
  components: [
    {
      name: 'Voltage regulator IC',
      type: 'LDO or buck converter',
      value: 'AMS1117-3.3 (LDO, 1A) or LM2596 (buck, 3A)',
      notes: 'Choose LDO when (Vin - Vout) is small and current is under 1A. Choose buck when the voltage drop is large or current exceeds 500 mA.',
    },
    {
      name: 'Input capacitor',
      type: 'Ceramic or electrolytic capacitor',
      value: '10 \u00B5F (ceramic X5R or aluminum electrolytic)',
      notes: 'Stabilizes the input to the regulator. Place as close to the Vin pin as possible.',
    },
    {
      name: 'Output capacitor',
      type: 'Ceramic or electrolytic capacitor',
      value: '22 \u00B5F (LDO) or 100-220 \u00B5F (buck)',
      notes: 'Required for regulator stability and transient response. Check the datasheet for minimum capacitance and ESR requirements — some LDOs oscillate with low-ESR ceramic caps.',
    },
    {
      name: 'Inductor (buck converter only)',
      type: 'Power inductor',
      value: '33-47 \u00B5H (for LM2596)',
      notes: 'Must handle the DC bias current without saturating. Use shielded inductors to reduce EMI.',
    },
    {
      name: 'Schottky diode (buck converter only)',
      type: 'Schottky diode',
      value: 'SS34 (3A, 40V)',
      notes: 'Provides the freewheeling current path when the buck switch is off. Must be rated for the full output current.',
    },
  ],
  connections: [
    {
      from: 'Input power source',
      to: 'Regulator Vin pin + input capacitor',
      description: 'Connect the input supply to the Vin pin with the input capacitor placed within 5 mm of the pin.',
    },
    {
      from: 'Regulator Vout pin',
      to: 'Output capacitor + load',
      description: 'The regulated output goes to your circuit. Output capacitor must be close to the Vout pin.',
    },
    {
      from: 'Regulator GND pin',
      to: 'Ground plane',
      description: 'Connect to a solid ground plane. For buck converters, the GND path carries high-frequency switching current — keep it short and wide.',
    },
    {
      from: 'Buck switch output',
      to: 'Inductor input, Schottky cathode',
      description: 'For buck converters: the switch node connects to the inductor and the Schottky diode. This is a high dV/dt node — keep traces short.',
    },
  ],
  tips: [
    'For the rover: the Arduino Mega has an onboard 5V regulator, and the ESP32 module has a 3.3V regulator. But motor power should come from a separate regulator or directly from the battery — never feed motor current through the Arduino\'s regulator.',
    'Calculate thermal dissipation for LDOs: P = (Vin - Vout) \u00D7 Iload. A 12V-to-3.3V LDO at 500 mA dissipates 4.35W — that needs a heatsink or is a sign you should use a buck converter.',
    'Always check the regulator\'s dropout voltage at your required current. A "3.3V LDO" with 1V dropout needs at least 4.3V input to regulate properly.',
    'For noisy loads (motors, servos, relays): use a dedicated regulator for the logic (MCU, sensors) separate from the motor supply. This prevents motor noise from affecting sensitive circuits.',
    'Buck converter PCB layout is critical — the input cap, switch, diode, and inductor form a high-current loop that must be as small as possible to minimize radiated EMI.',
  ],
  commonMistakes: [
    'Using an LDO where a buck converter is needed — a 12V-to-3.3V LDO wastes 72% of its input power as heat, potentially overheating and shutting down under load.',
    'Ignoring dropout voltage — trying to regulate 3.3V from a 3.7V LiPo (which drops to 3.0V when discharged) with a regulator that has 500 mV dropout means it stops regulating below 3.8V.',
    'Choosing the wrong output capacitor — some LDOs require a minimum ESR to remain stable (check the datasheet). Using a low-ESR ceramic when the LDO expects an electrolytic can cause oscillation.',
    'Not providing enough input capacitance for buck converters — the discontinuous input current of a buck converter causes voltage ripple that can affect upstream circuits.',
  ],
  relatedPatterns: ['decoupling-network', 'usb-c-power', 'led-driver'],
  tags: ['regulator', 'LDO', 'buck', 'power supply', 'voltage', '3.3V', '5V', 'dropout', 'AMS1117', 'LM2596', 'efficiency'],
};
