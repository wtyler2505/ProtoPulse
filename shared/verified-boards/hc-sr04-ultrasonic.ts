/**
 * HC-SR04 Ultrasonic Distance Sensor Module — Verified Board Definition
 *
 * A very common and cheap distance measuring sensor.
 */

import type { VerifiedBoardDefinition, VerifiedPin } from './types';

const PINS: VerifiedPin[] = [
  { id: 'VCC', name: 'VCC', headerGroup: 'main', headerPosition: 0, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['Strictly 5V module. Do not use 3.3V.'] },
  { id: 'TRIG', name: 'Trig', headerGroup: 'main', headerPosition: 1, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'interrupt', signal: 'TRIG' }], warnings: ['Requires a 10us HIGH pulse to trigger measurement'] },
  { id: 'ECHO', name: 'Echo', headerGroup: 'main', headerPosition: 2, role: 'control', direction: 'output', voltage: 5, functions: [{ type: 'interrupt', signal: 'ECHO' }], warnings: ['Outputs a 5V HIGH pulse proportional to distance. Use a voltage divider if connecting to a 3.3V microcontroller.'] },
  { id: 'GND', name: 'GND', headerGroup: 'main', headerPosition: 3, role: 'ground', direction: 'power', voltage: 0, functions: [], warnings: [] },
];

export const HC_SR04_ULTRASONIC: VerifiedBoardDefinition = {
  id: 'hc-sr04-ultrasonic',
  title: 'HC-SR04 Ultrasonic Sensor',
  manufacturer: 'Generic',
  mpn: 'HC-SR04',
  aliases: ['ultrasonic sensor', 'hcsr04', 'distance sensor'],
  family: 'sensor-module',
  description: 'A 5V ultrasonic distance measuring module providing 2cm-400cm non-contact measurement functionality.',
  dimensions: { width: 45, height: 20, thickness: 15 },
  breadboardFit: 'native',
  breadboardNotes: '4-pin header can be inserted directly into a breadboard.',
  pinSpacing: 2.54,
  operatingVoltage: 5,
  inputVoltageRange: [4.5, 5.5],
  maxCurrentPerPin: 20,
  maxTotalCurrent: 20,
  visual: {
    pcbColor: '#1d4ed8', // blue PCB
    silkscreenColor: '#1e3a8a',
  },
  pins: PINS,
  headerLayout: [
    { id: 'main', name: 'Main Header', side: 'bottom', pinCount: 4, pinIds: PINS.map(p => p.id) },
  ],
  buses: [
    { id: 'power', name: 'Power Bus', type: 'power', pinIds: ['VCC', 'GND'] },
    { id: 'control', name: 'Trigger/Echo', type: 'custom', pinIds: ['TRIG', 'ECHO'] }
  ],
  evidence: [
    { type: 'datasheet', label: 'HC-SR04 User Manual', href: 'https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf', confidence: 'high', supports: ['pins'] }
  ],
  verificationNotes: [
    'The standard HC-SR04 is 5V only. There are variants like HC-SR04+ or RCWL-1601 that support 3.3V, but this definition assumes the classic 5V part.'
  ],
  warnings: [
    'Echo pin outputs 5V. Connecting directly to 3.3V logic may damage the microcontroller.'
  ],
};
