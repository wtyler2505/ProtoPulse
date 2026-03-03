import type { DesignPattern } from '../types';

export const levelShifter: DesignPattern = {
  id: 'level-shifter',
  name: 'Level Shifter',
  category: 'communication',
  difficulty: 'intermediate',
  description:
    'A circuit that translates logic signals between devices operating at different voltages (e.g., 3.3V and 5V). Critical when connecting modern low-voltage MCUs to legacy 5V peripherals or sensors.',
  whyItWorks:
    'The classic bidirectional MOSFET level shifter uses an N-channel MOSFET with its source on the low-voltage side, drain on the high-voltage side, and gate connected to the low-voltage supply (VLOW). Pull-up resistors on each side hold both lines HIGH by default. When the low-voltage device drives its side LOW, current flows through the MOSFET\'s body diode and channel, pulling the high side LOW too. When the high-voltage device drives its side LOW, the MOSFET\'s source rises above its gate, turning the MOSFET off — but the drain being pulled LOW pulls the source LOW through the MOSFET\'s body diode, which then turns the channel on. This elegant mechanism provides bidirectional level translation with just one MOSFET and two resistors per signal line.',
  components: [
    {
      name: 'N-channel MOSFET',
      type: 'Small-signal N-channel MOSFET',
      value: 'BSS138 (SOT-23) or 2N7000 (TO-92)',
      notes: 'Threshold voltage must be below VLOW (e.g., Vth < 2V for 3.3V systems). BSS138 is the go-to choice for level shifting.',
    },
    {
      name: 'Low-side pull-up resistor',
      type: 'Resistor',
      value: '10 k\u03A9',
      notes: 'Connected between the low-voltage signal line and VLOW (3.3V). Lower values give faster rise times but draw more current.',
    },
    {
      name: 'High-side pull-up resistor',
      type: 'Resistor',
      value: '10 k\u03A9',
      notes: 'Connected between the high-voltage signal line and VHIGH (5V). Must match the low-side pull-up for symmetrical performance.',
    },
  ],
  connections: [
    {
      from: 'MOSFET source',
      to: 'Low-voltage signal line (3.3V side)',
      description: 'The source pin connects to the lower-voltage device\'s I/O pin. The low-side pull-up also connects here.',
    },
    {
      from: 'MOSFET drain',
      to: 'High-voltage signal line (5V side)',
      description: 'The drain pin connects to the higher-voltage device\'s I/O pin. The high-side pull-up also connects here.',
    },
    {
      from: 'MOSFET gate',
      to: 'Low-voltage supply (VLOW, e.g., 3.3V)',
      description: 'The gate connects to the low-voltage supply rail. This biases the MOSFET so it conducts when either side is pulled LOW.',
    },
    {
      from: 'Pull-up resistors',
      to: 'Respective supply rails',
      description: 'Low-side pull-up to VLOW (3.3V), high-side pull-up to VHIGH (5V). These ensure both lines idle HIGH.',
    },
  ],
  tips: [
    'For the rover: the ESP32 is 3.3V and the Arduino Mega is 5V. Every signal between them needs level shifting — SPI, UART, I2C, and GPIO control lines.',
    'For I2C specifically: the BSS138 MOSFET level shifter is perfect because I2C is already open-drain with pull-ups. One BSS138 per line (SDA + SCL = 2 MOSFETs).',
    'For unidirectional high-to-low shifting (e.g., 5V sensor output to 3.3V MCU input), a simple voltage divider (2:1 ratio) is cheaper and simpler than a MOSFET shifter.',
    'Pre-built level shifter modules (like the TXB0108 or the SparkFun BOB-12009) are convenient for prototyping. The TXB0108 auto-detects direction but can have issues with slow I2C signals.',
    'UART only needs unidirectional shifting on each line: TX from 3.3V device needs shifting up to 5V, RX from 5V device needs shifting down to 3.3V.',
  ],
  commonMistakes: [
    'Connecting a 5V output directly to a 3.3V input — most 3.3V devices are NOT 5V tolerant. Check the datasheet for "5V tolerant I/O" before assuming it\'s safe. The ESP32 is NOT 5V tolerant.',
    'Using a voltage divider for bidirectional signals — a resistive divider only works in one direction. For bidirectional protocols like I2C, you need the MOSFET circuit.',
    'Forgetting that the MOSFET shifter only works with open-drain or push-pull signals that can actively pull LOW — it does not work with signals that are actively driven HIGH on both sides.',
    'Using a MOSFET with too high a threshold voltage — if Vth > VLOW, the MOSFET never fully turns on and the circuit fails. BSS138 (Vth ~1.5V) works with 3.3V; 2N7000 variants with Vth > 3V may not.',
  ],
  relatedPatterns: ['pull-up-resistor', 'voltage-divider', 'crystal-oscillator'],
  tags: ['level shifter', '3.3V', '5V', 'MOSFET', 'BSS138', 'bidirectional', 'I2C', 'SPI', 'UART', 'voltage translation'],
};
