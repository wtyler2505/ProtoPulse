/**
 * L298N Dual H-Bridge Motor Driver Module — Verified Board Definition
 *
 * One of the most common motor driver modules for hobbyist robotics.
 * Uses the L298N chip to drive two DC motors or one stepper motor.
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus } from './types';

const POWER_PINS: VerifiedPin[] = [
  {
    id: 'VCC_12V',
    name: '12V',
    headerGroup: 'power',
    headerPosition: 0,
    role: 'power',
    direction: 'power',
    voltage: 12,
    warnings: ['Main motor power input. Technically accepts up to 35V, but typically labeled 12V. Remove 5V-EN jumper if supplying >12V to avoid burning the onboard regulator.'],
  },
  {
    id: 'GND',
    name: 'GND',
    headerGroup: 'power',
    headerPosition: 1,
    role: 'ground',
    direction: 'power',
    voltage: 0,
    warnings: ['Common ground. Must be connected to the microcontroller ground.'],
  },
  {
    id: 'VCC_5V',
    name: '5V',
    headerGroup: 'power',
    headerPosition: 2,
    role: 'power',
    direction: 'bidirectional',
    voltage: 5,
    warnings: ['If 5V-EN jumper is present, this is a 5V OUTPUT from the onboard regulator. If jumper is removed, this is a 5V INPUT to power the logic.'],
  },
];

const MOTOR_A_PINS: VerifiedPin[] = [
  { id: 'OUT1', name: 'OUT1', headerGroup: 'motor_a', headerPosition: 0, role: 'power', direction: 'output', voltage: 12, maxCurrent: 2000, warnings: ['Motor A output 1'] },
  { id: 'OUT2', name: 'OUT2', headerGroup: 'motor_a', headerPosition: 1, role: 'power', direction: 'output', voltage: 12, maxCurrent: 2000, warnings: ['Motor A output 2'] },
];

const MOTOR_B_PINS: VerifiedPin[] = [
  { id: 'OUT3', name: 'OUT3', headerGroup: 'motor_b', headerPosition: 0, role: 'power', direction: 'output', voltage: 12, maxCurrent: 2000, warnings: ['Motor B output 1'] },
  { id: 'OUT4', name: 'OUT4', headerGroup: 'motor_b', headerPosition: 1, role: 'power', direction: 'output', voltage: 12, maxCurrent: 2000, warnings: ['Motor B output 2'] },
];

const LOGIC_PINS: VerifiedPin[] = [
  { id: 'ENA', name: 'ENA', headerGroup: 'logic', headerPosition: 0, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'pwm', signal: 'PWM' }], warnings: ['Enable A (PWM for Motor A speed). Keep jumper on for full speed.'] },
  { id: 'IN1', name: 'IN1', headerGroup: 'logic', headerPosition: 1, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'gpio', signal: 'DIR' }], warnings: ['Direction control 1 for Motor A'] },
  { id: 'IN2', name: 'IN2', headerGroup: 'logic', headerPosition: 2, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'gpio', signal: 'DIR' }], warnings: ['Direction control 2 for Motor A'] },
  { id: 'IN3', name: 'IN3', headerGroup: 'logic', headerPosition: 3, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'gpio', signal: 'DIR' }], warnings: ['Direction control 1 for Motor B'] },
  { id: 'IN4', name: 'IN4', headerGroup: 'logic', headerPosition: 4, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'gpio', signal: 'DIR' }], warnings: ['Direction control 2 for Motor B'] },
  { id: 'ENB', name: 'ENB', headerGroup: 'logic', headerPosition: 5, role: 'control', direction: 'input', voltage: 5, functions: [{ type: 'pwm', signal: 'PWM' }], warnings: ['Enable B (PWM for Motor B speed). Keep jumper on for full speed.'] },
];

export const L298N_MOTOR_DRIVER: VerifiedBoardDefinition = {
  id: 'l298n-motor-driver',
  title: 'L298N Dual Motor Driver Module',
  manufacturer: 'Generic',
  mpn: 'L298N-MOD',
  aliases: ['l298n module', 'h-bridge module', 'dual motor driver'],
  family: 'board-module',
  description: 'Classic L298N dual H-bridge motor driver module. Controls two DC motors or one bipolar stepper motor. Includes an onboard 5V regulator.',
  dimensions: { width: 43, height: 43, thickness: 27 },
  breadboardFit: 'not_breadboard_friendly',
  breadboardNotes: 'Module has screw terminals and male headers, designed for jumper wire connections, not direct breadboard insertion.',
  pinSpacing: 2.54,
  operatingVoltage: 5,
  inputVoltageRange: [5, 35],
  maxCurrentPerPin: 2000,
  maxTotalCurrent: 4000,
  visual: {
    pcbColor: '#dc2626', // classic red L298N pcb
    silkscreenColor: '#b91c1c',
  },
  pins: [...POWER_PINS, ...MOTOR_A_PINS, ...MOTOR_B_PINS, ...LOGIC_PINS],
  headerLayout: [
    { id: 'power', side: 'bottom', pinCount: 3, pinIds: POWER_PINS.map(p => p.id) },
    { id: 'motor_a', side: 'left', pinCount: 2, pinIds: MOTOR_A_PINS.map(p => p.id) },
    { id: 'motor_b', side: 'right', pinCount: 2, pinIds: MOTOR_B_PINS.map(p => p.id) },
    { id: 'logic', side: 'bottom', pinCount: 6, pinIds: LOGIC_PINS.map(p => p.id) },
  ],
  buses: [
    { id: 'motor_a_out', name: 'Motor A Output', pinIds: ['OUT1', 'OUT2'] },
    { id: 'motor_b_out', name: 'Motor B Output', pinIds: ['OUT3', 'OUT4'] },
    { id: 'motor_a_ctrl', name: 'Motor A Control', pinIds: ['ENA', 'IN1', 'IN2'] },
    { id: 'motor_b_ctrl', name: 'Motor B Control', pinIds: ['ENB', 'IN3', 'IN4'] }
  ],
  evidence: [
    { type: 'datasheet', title: 'L298 Datasheet', href: 'https://www.st.com/resource/en/datasheet/l298.pdf', confidence: 'high' }
  ],
  verificationNotes: [
    'Logic pins ENA and ENB are typically jumpered to 5V for 100% duty cycle.',
    'Common issue: users forget to connect common ground.'
  ],
  warnings: [
    'DO NOT supply more than 12V if the 5V-EN jumper is installed. The onboard regulator will overheat.',
    'L298N has significant voltage drop (up to 2V-4V) across the transistors. A 12V supply might only deliver 9-10V to the motors.'
  ],
};
