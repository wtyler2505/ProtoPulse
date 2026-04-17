/**
 * RioRand KJL-01 BLDC Motor Controller — Verified Board Definition
 *
 * 350W 6-60V 3-phase brushless DC motor speed controller with hall sensor
 * feedback (120 degree electrical angle). 16A continuous / 20A peak.
 *
 * This is a consumer-grade Chinese motor controller with limited official
 * documentation. Evidence is marketplace-level (Amazon listing + general
 * BLDC controller conventions). Terminal layout is based on the product
 * listing and common BLDC controller standards.
 *
 * Sources:
 * - https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D
 * - General BLDC controller wiring conventions (community knowledge)
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup } from './types';

// ---------------------------------------------------------------------------
// Pin definitions
// ---------------------------------------------------------------------------

const POWER_PINS: VerifiedPin[] = [
  {
    id: 'V_PLUS',
    name: 'V+',
    headerGroup: 'power-input',
    headerPosition: 0,
    role: 'power',
    direction: 'power',
    voltage: 60,
    functions: [],
    warnings: ['Main DC power input: 6-60V. Match to motor voltage rating. Observe polarity — no reverse protection on most units.'],
  },
  {
    id: 'V_MINUS',
    name: 'V-',
    headerGroup: 'power-input',
    headerPosition: 1,
    role: 'ground',
    direction: 'power',
    voltage: 0,
    functions: [],
    warnings: ['Power ground return. Use heavy gauge wire rated for motor current (16A continuous).'],
  },
];

const MOTOR_PHASE_PINS: VerifiedPin[] = [
  {
    id: 'PHASE_U',
    name: 'U',
    headerGroup: 'motor-output',
    headerPosition: 0,
    role: 'power',
    direction: 'output',
    voltage: 60,
    maxCurrent: 16000,
    functions: [],
    warnings: ['Motor phase U — high current output. Match color coding to motor wires. Wrong phase order reverses direction or causes vibration.'],
  },
  {
    id: 'PHASE_V',
    name: 'V',
    headerGroup: 'motor-output',
    headerPosition: 1,
    role: 'power',
    direction: 'output',
    voltage: 60,
    maxCurrent: 16000,
    functions: [],
    warnings: ['Motor phase V — high current output.'],
  },
  {
    id: 'PHASE_W',
    name: 'W',
    headerGroup: 'motor-output',
    headerPosition: 2,
    role: 'power',
    direction: 'output',
    voltage: 60,
    maxCurrent: 16000,
    functions: [],
    warnings: ['Motor phase W — high current output.'],
  },
];

const HALL_SENSOR_PINS: VerifiedPin[] = [
  {
    id: 'HALL_VCC',
    name: 'Hall +5V',
    headerGroup: 'hall-sensor',
    headerPosition: 0,
    role: 'power',
    direction: 'output',
    voltage: 5,
    functions: [],
    warnings: ['5V supply for hall sensors. Usually red wire from motor hall connector.'],
  },
  {
    id: 'HALL_GND',
    name: 'Hall GND',
    headerGroup: 'hall-sensor',
    headerPosition: 1,
    role: 'ground',
    direction: 'power',
    voltage: 0,
    functions: [],
    warnings: ['Ground for hall sensors. Usually black wire from motor hall connector.'],
  },
  {
    id: 'HALL_A',
    name: 'Ha',
    headerGroup: 'hall-sensor',
    headerPosition: 2,
    role: 'communication',
    direction: 'input',
    voltage: 5,
    functions: [{ type: 'hall', signal: 'Ha', notes: 'Hall sensor A — 120 degree offset' }],
    warnings: ['Hall sensor A signal. Usually yellow wire. 120 degree electrical angle.'],
  },
  {
    id: 'HALL_B',
    name: 'Hb',
    headerGroup: 'hall-sensor',
    headerPosition: 3,
    role: 'communication',
    direction: 'input',
    voltage: 5,
    functions: [{ type: 'hall', signal: 'Hb', notes: 'Hall sensor B — 120 degree offset' }],
    warnings: ['Hall sensor B signal. Usually green wire.'],
  },
  {
    id: 'HALL_C',
    name: 'Hc',
    headerGroup: 'hall-sensor',
    headerPosition: 4,
    role: 'communication',
    direction: 'input',
    voltage: 5,
    functions: [{ type: 'hall', signal: 'Hc', notes: 'Hall sensor C — 120 degree offset' }],
    warnings: ['Hall sensor C signal. Usually blue wire.'],
  },
];

const CONTROL_PINS: VerifiedPin[] = [
  {
    id: 'SPEED',
    name: 'VR/Speed',
    headerGroup: 'control',
    headerPosition: 0,
    role: 'control',
    direction: 'input',
    voltage: 5,
    functions: [{ type: 'adc', channel: 'Speed', notes: '0-5V analog speed control input. Can be driven by Arduino analogWrite via RC filter or DAC.' }],
    warnings: ['0-5V analog input for external speed control. Overrides on-board potentiometer when connected. Use a 0-5V signal only.'],
  },
  {
    id: 'STOP',
    name: 'STOP',
    headerGroup: 'control',
    headerPosition: 1,
    role: 'control',
    direction: 'input',
    voltage: 5,
    functions: [],
    warnings: ['Active LOW — connect to GND to stop motor. Normally open (motor runs). Can be driven by Arduino digital output (set LOW to stop, leave floating or HIGH to run).'],
  },
  {
    id: 'BRAKE',
    name: 'BRAKE',
    headerGroup: 'control',
    headerPosition: 2,
    role: 'control',
    direction: 'input',
    voltage: 5,
    functions: [],
    warnings: ['Active HIGH — connect to 5V to engage brake. Normally open (no brake). Provides dynamic braking by shorting motor phases.'],
  },
  {
    id: 'DIR',
    name: 'DIR',
    headerGroup: 'control',
    headerPosition: 3,
    role: 'control',
    direction: 'input',
    voltage: 5,
    functions: [],
    warnings: ['Direction control — connect to GND to reverse motor direction. Normally open (forward). Can be driven by Arduino digital output.'],
  },
];

const ALL_PINS: VerifiedPin[] = [
  ...POWER_PINS,
  ...MOTOR_PHASE_PINS,
  ...HALL_SENSOR_PINS,
  ...CONTROL_PINS,
];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  {
    id: 'motor-phases',
    name: 'Motor Phase Outputs (U/V/W)',
    type: 'custom',
    pinIds: ['PHASE_U', 'PHASE_V', 'PHASE_W'],
    notes: '3-phase BLDC motor output. Phase order determines rotation direction. If motor vibrates instead of spinning, swap any two phase wires.',
  },
  {
    id: 'hall-sensors',
    name: 'Hall Sensor Interface',
    type: 'hall',
    pinIds: ['HALL_VCC', 'HALL_GND', 'HALL_A', 'HALL_B', 'HALL_C'],
    protocol: '120 degree electrical angle',
    notes: '5-wire hall sensor interface: +5V, GND, Ha, Hb, Hc. 120 degree offset between sensors. If motor runs rough, try swapping Ha/Hc.',
  },
  {
    id: 'mcu-control',
    name: 'MCU Control Interface',
    type: 'custom',
    pinIds: ['SPEED', 'STOP', 'BRAKE', 'DIR'],
    notes: 'External control terminals for microcontroller interface. SPEED: 0-5V analog. STOP: active low. BRAKE: active high. DIR: low = reverse.',
  },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'power-input', name: 'DC Power Input', side: 'left', pinCount: 2, pinIds: ['V_PLUS', 'V_MINUS'] },
  { id: 'motor-output', name: 'Motor Phase Output (U/V/W)', side: 'right', pinCount: 3, pinIds: ['PHASE_U', 'PHASE_V', 'PHASE_W'] },
  { id: 'hall-sensor', name: 'Hall Sensor Connector', side: 'bottom', pinCount: 5, pinIds: HALL_SENSOR_PINS.map((p) => p.id) },
  { id: 'control', name: 'Control Terminals', side: 'bottom', pinCount: 4, pinIds: CONTROL_PINS.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const RIORAND_KJL01: VerifiedBoardDefinition = {
  id: 'riorand-kjl01',
  title: 'RioRand KJL-01 BLDC Controller',
  manufacturer: 'RioRand',
  mpn: 'KJL-01',
  aliases: [
    'RioRand Motor Controller',
    'RioRand BLDC Controller',
    'RioRand 6-60V Controller',
    'RioRand 350W Controller',
    'KJL-01',
    'RioRand B087M2378D',
  ],
  family: 'driver',
  description: 'RioRand KJL-01 — 350W 6-60V 3-phase PWM DC brushless motor speed controller with hall sensor feedback. Supports 120 degree electrical angle BLDC motors. 16A continuous / 20A peak. Screw terminal connections for power, motor phases, hall sensors, and control signals (speed, stop, brake, direction). On-board potentiometer for manual speed adjustment. Overcurrent protection.',

  dimensions: { width: 75, height: 50, thickness: 2 },
  breadboardFit: 'not_breadboard_friendly',
  breadboardNotes: 'Screw terminal connections and high-current traces make this controller completely unsuitable for breadboard mounting. Connect via jumper wires from screw terminals to breadboard for signal-level control lines (SPEED, STOP, BRAKE, DIR) only. Power and motor phase connections must use appropriately rated wire.',
  pinSpacing: 5.08,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 5,
  inputVoltageRange: [6, 60],
  maxCurrentPerPin: 16000,
  maxTotalCurrent: 20000,

  visual: {


    pcbColor: '#dc2626',


    silkscreenColor: '#b91c1c',


  },


  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    {
      type: 'marketplace-listing',
      label: 'Amazon Product Listing — RioRand 350W 6-60V BLDC Controller (B087M2378D)',
      href: 'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D',
      supports: ['outline', 'labels'],
      confidence: 'medium',
      reviewStatus: 'accepted',
    },
    {
      type: 'community-svg',
      label: 'General BLDC controller wiring conventions (community knowledge)',
      supports: ['pins', 'labels'],
      confidence: 'medium',
      reviewStatus: 'accepted',
      note: 'Terminal layout based on standard BLDC controller conventions and Amazon listing photos. Not from official manufacturer documentation.',
    },
  ],

  verificationNotes: [
    'Terminal layout is based on Amazon listing + standard BLDC controller conventions — no official manufacturer datasheet found.',
    'The KJL-01 model designation is visible on the PCB silkscreen in Amazon listing photos.',
    'Control terminal voltage levels (5V logic, active-low STOP, active-high BRAKE) are standard for this class of Chinese BLDC controllers.',
    'Physical dimensions are approximate — measured from Amazon listing photos, not a mechanical drawing.',
    'The on-board potentiometer overrides the external SPEED input when no external signal is connected.',
    'Overcurrent protection threshold is not documented — exercise caution with motor sizing.',
  ],

  warnings: [
    'No reverse polarity protection — double-check V+/V- before applying power.',
    'Motor phase wiring order matters — wrong order causes vibration or reverse rotation, not damage.',
    'Hall sensor wiring order matters — wrong order causes erratic behavior. If motor runs rough, try swapping Ha and Hc.',
    'Control signals are 5V logic — safe to drive directly from Arduino (5V) or ESP32 (3.3V, but check threshold).',
    'Keep high-current wires (power, motor phases) away from signal wires (hall, control) to avoid EMI interference.',
    'This controller has no heatsink — add thermal management for sustained loads above 10A.',
  ],
};
