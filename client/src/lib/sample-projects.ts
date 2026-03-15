/**
 * Sample Projects — pre-loaded project definitions for "learn by doing".
 *
 * Each sample project includes a name, description, difficulty level,
 * key workflows it demonstrates, a category, and preloaded data
 * (architecture nodes, edges, BOM items) that get created when the user
 * opens the sample.
 *
 * 5 built-in samples:
 *   1. Blink LED (beginner)
 *   2. Temperature Logger (beginner)
 *   3. Motor Controller (intermediate)
 *   4. Audio Amplifier (intermediate)
 *   5. IoT Weather Station (advanced)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SampleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type SampleCategory = 'digital' | 'analog' | 'iot' | 'power' | 'mixed-signal';

export interface SampleWorkflow {
  readonly name: string;
  readonly description: string;
}

export interface PreloadedNode {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly label: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly data: Record<string, unknown> | null;
}

export interface PreloadedEdge {
  readonly edgeId: string;
  readonly source: string;
  readonly target: string;
  readonly label: string;
  readonly animated: boolean;
  readonly signalType: string | null;
  readonly voltage: string | null;
}

export interface PreloadedBomItem {
  readonly partNumber: string;
  readonly manufacturer: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly supplier: string;
  readonly category: string;
}

export interface SampleProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly difficulty: SampleDifficulty;
  readonly category: SampleCategory;
  readonly icon: string;
  readonly estimatedTime: string;
  readonly workflows: readonly SampleWorkflow[];
  readonly learningObjectives: readonly string[];
  readonly preloadedData: {
    readonly nodes: readonly PreloadedNode[];
    readonly edges: readonly PreloadedEdge[];
    readonly bomItems: readonly PreloadedBomItem[];
  };
}

// ---------------------------------------------------------------------------
// Difficulty metadata
// ---------------------------------------------------------------------------

export const DIFFICULTY_META: Record<SampleDifficulty, { label: string; color: string; sortOrder: number }> = {
  beginner: { label: 'Beginner', color: 'text-green-400', sortOrder: 0 },
  intermediate: { label: 'Intermediate', color: 'text-yellow-400', sortOrder: 1 },
  advanced: { label: 'Advanced', color: 'text-red-400', sortOrder: 2 },
};

export const CATEGORY_META: Record<SampleCategory, { label: string }> = {
  digital: { label: 'Digital' },
  analog: { label: 'Analog' },
  iot: { label: 'IoT' },
  power: { label: 'Power' },
  'mixed-signal': { label: 'Mixed Signal' },
};

// ---------------------------------------------------------------------------
// Built-in sample projects
// ---------------------------------------------------------------------------

export const SAMPLE_PROJECTS: readonly SampleProject[] = [
  {
    id: 'blink-led',
    name: 'Blink LED',
    description:
      'The classic first project: make an LED blink with an Arduino. Learn basic circuit architecture, resistor selection, and BOM management.',
    difficulty: 'beginner',
    category: 'digital',
    icon: 'Lightbulb',
    estimatedTime: '10 min',
    workflows: [
      { name: 'Architecture Design', description: 'Create a block diagram with Arduino and LED' },
      { name: 'BOM Management', description: 'Add components and track costs' },
      { name: 'Validation', description: 'Run DRC to check your design' },
    ],
    learningObjectives: [
      'Create architecture nodes and connect them',
      'Add BOM items with pricing',
      'Run design rule checks',
      'Export your design',
    ],
    preloadedData: {
      nodes: [
        {
          nodeId: 'sample-blink-mcu',
          nodeType: 'microcontroller',
          label: 'Arduino Uno',
          positionX: 100,
          positionY: 200,
          data: { description: 'ATmega328P-based development board' },
        },
        {
          nodeId: 'sample-blink-resistor',
          nodeType: 'passive',
          label: '220 Ohm Resistor',
          positionX: 350,
          positionY: 150,
          data: { description: 'Current limiting resistor for LED' },
        },
        {
          nodeId: 'sample-blink-led',
          nodeType: 'indicator',
          label: 'Red LED',
          positionX: 550,
          positionY: 200,
          data: { description: '5mm red LED, Vf=2.0V, If=20mA' },
        },
      ],
      edges: [
        {
          edgeId: 'sample-blink-e1',
          source: 'sample-blink-mcu',
          target: 'sample-blink-resistor',
          label: 'Digital Pin 13',
          animated: false,
          signalType: 'digital',
          voltage: '5V',
        },
        {
          edgeId: 'sample-blink-e2',
          source: 'sample-blink-resistor',
          target: 'sample-blink-led',
          label: 'LED Anode',
          animated: false,
          signalType: 'digital',
          voltage: null,
        },
      ],
      bomItems: [
        {
          partNumber: 'A000066',
          manufacturer: 'Arduino',
          description: 'Arduino Uno Rev3',
          quantity: 1,
          unitPrice: '23.00',
          supplier: 'Arduino Store',
          category: 'Development Boards',
        },
        {
          partNumber: 'CFR-25JB-52-220R',
          manufacturer: 'Yageo',
          description: '220 Ohm 1/4W Carbon Film Resistor',
          quantity: 1,
          unitPrice: '0.10',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'WP7113ID',
          manufacturer: 'Kingbright',
          description: '5mm Red LED, 2V 20mA',
          quantity: 1,
          unitPrice: '0.35',
          supplier: 'DigiKey',
          category: 'Indicators',
        },
      ],
    },
  },
  {
    id: 'temperature-logger',
    name: 'Temperature Logger',
    description:
      'Build a temperature monitoring system using a DS18B20 sensor, Arduino, and SD card. Learn sensor interfacing, data logging, and power considerations.',
    difficulty: 'beginner',
    category: 'digital',
    icon: 'Thermometer',
    estimatedTime: '20 min',
    workflows: [
      { name: 'Sensor Integration', description: 'Wire a DS18B20 temperature sensor' },
      { name: 'Data Storage', description: 'Add SD card module for logging' },
      { name: 'Power Planning', description: 'Consider power consumption for battery operation' },
      { name: 'BOM Optimization', description: 'Find cost-effective components' },
    ],
    learningObjectives: [
      'Interface digital sensors with pull-up resistors',
      'Design multi-block architectures',
      'Consider power budgets',
      'Use the AI assistant for component selection',
    ],
    preloadedData: {
      nodes: [
        {
          nodeId: 'sample-temp-mcu',
          nodeType: 'microcontroller',
          label: 'Arduino Nano',
          positionX: 300,
          positionY: 200,
          data: { description: 'Compact ATmega328P board' },
        },
        {
          nodeId: 'sample-temp-sensor',
          nodeType: 'sensor',
          label: 'DS18B20',
          positionX: 100,
          positionY: 100,
          data: { description: 'Digital temperature sensor, 1-Wire, ±0.5°C accuracy' },
        },
        {
          nodeId: 'sample-temp-pullup',
          nodeType: 'passive',
          label: '4.7k Resistor',
          positionX: 100,
          positionY: 300,
          data: { description: '1-Wire bus pull-up resistor' },
        },
        {
          nodeId: 'sample-temp-sd',
          nodeType: 'storage',
          label: 'SD Card Module',
          positionX: 500,
          positionY: 200,
          data: { description: 'SPI-based microSD card breakout' },
        },
        {
          nodeId: 'sample-temp-power',
          nodeType: 'power',
          label: '9V Battery',
          positionX: 300,
          positionY: 400,
          data: { description: '9V alkaline battery for portable operation' },
        },
      ],
      edges: [
        {
          edgeId: 'sample-temp-e1',
          source: 'sample-temp-sensor',
          target: 'sample-temp-mcu',
          label: '1-Wire Data',
          animated: false,
          signalType: 'digital',
          voltage: '5V',
        },
        {
          edgeId: 'sample-temp-e2',
          source: 'sample-temp-pullup',
          target: 'sample-temp-sensor',
          label: 'Pull-up',
          animated: false,
          signalType: null,
          voltage: '5V',
        },
        {
          edgeId: 'sample-temp-e3',
          source: 'sample-temp-mcu',
          target: 'sample-temp-sd',
          label: 'SPI Bus',
          animated: false,
          signalType: 'spi',
          voltage: null,
        },
        {
          edgeId: 'sample-temp-e4',
          source: 'sample-temp-power',
          target: 'sample-temp-mcu',
          label: 'VIN',
          animated: false,
          signalType: 'power',
          voltage: '9V',
        },
      ],
      bomItems: [
        {
          partNumber: 'A000005',
          manufacturer: 'Arduino',
          description: 'Arduino Nano',
          quantity: 1,
          unitPrice: '20.00',
          supplier: 'Arduino Store',
          category: 'Development Boards',
        },
        {
          partNumber: 'DS18B20+',
          manufacturer: 'Maxim Integrated',
          description: 'DS18B20 Digital Temperature Sensor TO-92',
          quantity: 1,
          unitPrice: '3.95',
          supplier: 'DigiKey',
          category: 'Sensors',
        },
        {
          partNumber: 'CFR-25JB-52-4K7',
          manufacturer: 'Yageo',
          description: '4.7k Ohm 1/4W Resistor',
          quantity: 1,
          unitPrice: '0.10',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'BOB-13743',
          manufacturer: 'SparkFun',
          description: 'microSD Card Breakout Board',
          quantity: 1,
          unitPrice: '4.50',
          supplier: 'SparkFun',
          category: 'Storage',
        },
      ],
    },
  },
  {
    id: 'motor-controller',
    name: 'Motor Controller',
    description:
      'Design a DC motor speed controller with PWM, an H-bridge driver, and current sensing. Covers power electronics, protection circuits, and control loops.',
    difficulty: 'intermediate',
    category: 'power',
    icon: 'Cog',
    estimatedTime: '30 min',
    workflows: [
      { name: 'Power Architecture', description: 'Design motor driver power stage with H-bridge' },
      { name: 'Protection Circuits', description: 'Add flyback diodes and current limiting' },
      { name: 'Control Interface', description: 'PWM speed control with feedback' },
      { name: 'Thermal Analysis', description: 'Check power dissipation in driver IC' },
      { name: 'DRC Validation', description: 'Verify power trace widths and clearances' },
    ],
    learningObjectives: [
      'Design power electronics with proper protection',
      'Use H-bridge motor driver ICs',
      'Implement current sensing for overcurrent protection',
      'Run thermal analysis on power components',
      'Validate power designs with DRC',
    ],
    preloadedData: {
      nodes: [
        {
          nodeId: 'sample-motor-mcu',
          nodeType: 'microcontroller',
          label: 'Arduino Mega',
          positionX: 100,
          positionY: 250,
          data: { description: 'ATmega2560 for PWM generation and control logic' },
        },
        {
          nodeId: 'sample-motor-driver',
          nodeType: 'ic',
          label: 'L298N Motor Driver',
          positionX: 350,
          positionY: 150,
          data: { description: 'Dual full-bridge driver, 2A per channel' },
        },
        {
          nodeId: 'sample-motor-m1',
          nodeType: 'actuator',
          label: 'DC Motor',
          positionX: 600,
          positionY: 150,
          data: { description: '12V DC motor, 1.5A stall current' },
        },
        {
          nodeId: 'sample-motor-sense',
          nodeType: 'sensor',
          label: 'Current Sense (0.1 Ohm)',
          positionX: 350,
          positionY: 350,
          data: { description: 'Shunt resistor for motor current measurement' },
        },
        {
          nodeId: 'sample-motor-psu',
          nodeType: 'power',
          label: '12V Power Supply',
          positionX: 350,
          positionY: 50,
          data: { description: '12V 3A DC power supply' },
        },
        {
          nodeId: 'sample-motor-diodes',
          nodeType: 'passive',
          label: 'Flyback Diodes',
          positionX: 600,
          positionY: 300,
          data: { description: '1N4007 diodes for back-EMF protection' },
        },
      ],
      edges: [
        {
          edgeId: 'sample-motor-e1',
          source: 'sample-motor-mcu',
          target: 'sample-motor-driver',
          label: 'PWM + Direction',
          animated: true,
          signalType: 'digital',
          voltage: '5V',
        },
        {
          edgeId: 'sample-motor-e2',
          source: 'sample-motor-driver',
          target: 'sample-motor-m1',
          label: 'Motor Drive',
          animated: true,
          signalType: 'power',
          voltage: '12V',
        },
        {
          edgeId: 'sample-motor-e3',
          source: 'sample-motor-psu',
          target: 'sample-motor-driver',
          label: 'VCC',
          animated: false,
          signalType: 'power',
          voltage: '12V',
        },
        {
          edgeId: 'sample-motor-e4',
          source: 'sample-motor-sense',
          target: 'sample-motor-mcu',
          label: 'Current Feedback',
          animated: false,
          signalType: 'analog',
          voltage: null,
        },
        {
          edgeId: 'sample-motor-e5',
          source: 'sample-motor-diodes',
          target: 'sample-motor-m1',
          label: 'Protection',
          animated: false,
          signalType: null,
          voltage: null,
        },
      ],
      bomItems: [
        {
          partNumber: 'A000067',
          manufacturer: 'Arduino',
          description: 'Arduino Mega 2560 Rev3',
          quantity: 1,
          unitPrice: '38.50',
          supplier: 'Arduino Store',
          category: 'Development Boards',
        },
        {
          partNumber: 'L298N',
          manufacturer: 'STMicroelectronics',
          description: 'Dual Full-Bridge Motor Driver',
          quantity: 1,
          unitPrice: '6.30',
          supplier: 'DigiKey',
          category: 'ICs',
        },
        {
          partNumber: '1N4007',
          manufacturer: 'ON Semiconductor',
          description: '1A 1000V Rectifier Diode',
          quantity: 4,
          unitPrice: '0.15',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'ERJ-6ENF0R10V',
          manufacturer: 'Panasonic',
          description: '0.1 Ohm 1/8W Current Sense Resistor',
          quantity: 1,
          unitPrice: '0.25',
          supplier: 'Mouser',
          category: 'Passives',
        },
      ],
    },
  },
  {
    id: 'audio-amplifier',
    name: 'Audio Amplifier',
    description:
      'Design a Class AB audio amplifier with an LM386 IC. Learn analog circuit design, decoupling, gain configuration, and audio signal path layout.',
    difficulty: 'intermediate',
    category: 'analog',
    icon: 'Volume2',
    estimatedTime: '25 min',
    workflows: [
      { name: 'Analog Signal Path', description: 'Design input coupling, gain stage, and output' },
      { name: 'Decoupling Strategy', description: 'Place bypass capacitors for noise reduction' },
      { name: 'Gain Configuration', description: 'Set amplifier gain with feedback components' },
      { name: 'Simulation', description: 'Run AC analysis to verify frequency response' },
      { name: 'Export', description: 'Generate schematic and BOM for assembly' },
    ],
    learningObjectives: [
      'Understand analog amplifier architectures',
      'Design proper power supply decoupling',
      'Configure gain with external components',
      'Use AC simulation to verify frequency response',
      'Export designs for manufacturing',
    ],
    preloadedData: {
      nodes: [
        {
          nodeId: 'sample-audio-input',
          nodeType: 'connector',
          label: '3.5mm Audio Jack',
          positionX: 50,
          positionY: 200,
          data: { description: 'Stereo audio input connector' },
        },
        {
          nodeId: 'sample-audio-coupling',
          nodeType: 'passive',
          label: '10uF Input Coupling',
          positionX: 200,
          positionY: 200,
          data: { description: 'DC blocking capacitor for input signal' },
        },
        {
          nodeId: 'sample-audio-amp',
          nodeType: 'ic',
          label: 'LM386 Amplifier',
          positionX: 400,
          positionY: 200,
          data: { description: 'Low-voltage audio power amplifier, 20-200 gain' },
        },
        {
          nodeId: 'sample-audio-gain',
          nodeType: 'passive',
          label: '10uF + 1.2k Gain',
          positionX: 400,
          positionY: 350,
          data: { description: 'Gain setting network (pins 1-8), Av=200' },
        },
        {
          nodeId: 'sample-audio-output-cap',
          nodeType: 'passive',
          label: '250uF Output Cap',
          positionX: 580,
          positionY: 200,
          data: { description: 'Output coupling capacitor' },
        },
        {
          nodeId: 'sample-audio-speaker',
          nodeType: 'actuator',
          label: '8 Ohm Speaker',
          positionX: 730,
          positionY: 200,
          data: { description: '8 ohm 0.5W speaker' },
        },
        {
          nodeId: 'sample-audio-bypass',
          nodeType: 'passive',
          label: '100nF + 10uF Bypass',
          positionX: 400,
          positionY: 50,
          data: { description: 'Power supply bypass capacitors' },
        },
      ],
      edges: [
        {
          edgeId: 'sample-audio-e1',
          source: 'sample-audio-input',
          target: 'sample-audio-coupling',
          label: 'Audio In',
          animated: false,
          signalType: 'analog',
          voltage: null,
        },
        {
          edgeId: 'sample-audio-e2',
          source: 'sample-audio-coupling',
          target: 'sample-audio-amp',
          label: 'Coupled Signal',
          animated: false,
          signalType: 'analog',
          voltage: null,
        },
        {
          edgeId: 'sample-audio-e3',
          source: 'sample-audio-gain',
          target: 'sample-audio-amp',
          label: 'Gain Feedback',
          animated: false,
          signalType: null,
          voltage: null,
        },
        {
          edgeId: 'sample-audio-e4',
          source: 'sample-audio-amp',
          target: 'sample-audio-output-cap',
          label: 'Amplified Output',
          animated: true,
          signalType: 'analog',
          voltage: null,
        },
        {
          edgeId: 'sample-audio-e5',
          source: 'sample-audio-output-cap',
          target: 'sample-audio-speaker',
          label: 'Speaker Drive',
          animated: true,
          signalType: 'analog',
          voltage: null,
        },
        {
          edgeId: 'sample-audio-e6',
          source: 'sample-audio-bypass',
          target: 'sample-audio-amp',
          label: 'VCC Bypass',
          animated: false,
          signalType: 'power',
          voltage: '9V',
        },
      ],
      bomItems: [
        {
          partNumber: 'LM386N-1',
          manufacturer: 'Texas Instruments',
          description: 'Low Voltage Audio Power Amplifier',
          quantity: 1,
          unitPrice: '1.50',
          supplier: 'DigiKey',
          category: 'ICs',
        },
        {
          partNumber: 'UVR0J100MDD',
          manufacturer: 'Nichicon',
          description: '10uF 6.3V Electrolytic Capacitor',
          quantity: 2,
          unitPrice: '0.20',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'UVR0J251MPD',
          manufacturer: 'Nichicon',
          description: '250uF 6.3V Electrolytic Capacitor',
          quantity: 1,
          unitPrice: '0.45',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'C0805C104K5R',
          manufacturer: 'Kemet',
          description: '100nF 50V Ceramic Capacitor',
          quantity: 1,
          unitPrice: '0.10',
          supplier: 'DigiKey',
          category: 'Passives',
        },
        {
          partNumber: 'SJ1-3523N',
          manufacturer: 'CUI Devices',
          description: '3.5mm Stereo Audio Jack',
          quantity: 1,
          unitPrice: '1.20',
          supplier: 'Mouser',
          category: 'Connectors',
        },
        {
          partNumber: 'AS07108PO-R',
          manufacturer: 'PUI Audio',
          description: '8 Ohm 0.5W Speaker 28mm',
          quantity: 1,
          unitPrice: '2.50',
          supplier: 'DigiKey',
          category: 'Actuators',
        },
      ],
    },
  },
  {
    id: 'iot-weather-station',
    name: 'IoT Weather Station',
    description:
      'Build a connected weather station with ESP32, BME280 sensor, OLED display, and MQTT telemetry. Covers wireless design, low-power modes, and cloud connectivity.',
    difficulty: 'advanced',
    category: 'iot',
    icon: 'Cloud',
    estimatedTime: '45 min',
    workflows: [
      { name: 'System Architecture', description: 'Design multi-subsystem IoT device' },
      { name: 'Sensor Integration', description: 'Wire I2C sensor and display' },
      { name: 'Wireless Design', description: 'Configure ESP32 Wi-Fi and antenna considerations' },
      { name: 'Power Management', description: 'Battery + solar with deep sleep scheduling' },
      { name: 'Firmware Scaffold', description: 'Generate starter firmware from architecture' },
      { name: 'Digital Twin', description: 'Set up live telemetry monitoring' },
    ],
    learningObjectives: [
      'Design multi-subsystem IoT architectures',
      'Interface I2C sensors and displays',
      'Plan wireless communication and antenna placement',
      'Implement low-power strategies with deep sleep',
      'Generate firmware scaffolds from block diagrams',
      'Use the digital twin for live monitoring',
    ],
    preloadedData: {
      nodes: [
        {
          nodeId: 'sample-iot-mcu',
          nodeType: 'microcontroller',
          label: 'ESP32-WROOM-32',
          positionX: 350,
          positionY: 250,
          data: { description: 'Dual-core Wi-Fi + BLE MCU, 4MB flash' },
        },
        {
          nodeId: 'sample-iot-sensor',
          nodeType: 'sensor',
          label: 'BME280',
          positionX: 100,
          positionY: 150,
          data: { description: 'Temperature, humidity, and pressure sensor (I2C)' },
        },
        {
          nodeId: 'sample-iot-display',
          nodeType: 'indicator',
          label: '0.96" OLED SSD1306',
          positionX: 600,
          positionY: 150,
          data: { description: '128x64 I2C OLED display module' },
        },
        {
          nodeId: 'sample-iot-antenna',
          nodeType: 'rf',
          label: 'PCB Antenna',
          positionX: 350,
          positionY: 50,
          data: { description: '2.4GHz PCB antenna for Wi-Fi' },
        },
        {
          nodeId: 'sample-iot-ldo',
          nodeType: 'power',
          label: 'AMS1117-3.3V LDO',
          positionX: 100,
          positionY: 400,
          data: { description: '3.3V 1A LDO regulator' },
        },
        {
          nodeId: 'sample-iot-battery',
          nodeType: 'power',
          label: '18650 Li-Ion Battery',
          positionX: 100,
          positionY: 250,
          data: { description: '3.7V 2600mAh rechargeable cell' },
        },
        {
          nodeId: 'sample-iot-solar',
          nodeType: 'power',
          label: '6V Solar Panel',
          positionX: 100,
          positionY: 550,
          data: { description: '6V 1W mini solar panel for trickle charging' },
        },
        {
          nodeId: 'sample-iot-charger',
          nodeType: 'ic',
          label: 'TP4056 Charger',
          positionX: 100,
          positionY: 700,
          data: { description: 'Li-Ion charge controller with protection' },
        },
      ],
      edges: [
        {
          edgeId: 'sample-iot-e1',
          source: 'sample-iot-sensor',
          target: 'sample-iot-mcu',
          label: 'I2C (SDA/SCL)',
          animated: false,
          signalType: 'i2c',
          voltage: '3.3V',
        },
        {
          edgeId: 'sample-iot-e2',
          source: 'sample-iot-mcu',
          target: 'sample-iot-display',
          label: 'I2C (SDA/SCL)',
          animated: false,
          signalType: 'i2c',
          voltage: '3.3V',
        },
        {
          edgeId: 'sample-iot-e3',
          source: 'sample-iot-mcu',
          target: 'sample-iot-antenna',
          label: 'RF',
          animated: true,
          signalType: 'rf',
          voltage: null,
        },
        {
          edgeId: 'sample-iot-e4',
          source: 'sample-iot-battery',
          target: 'sample-iot-ldo',
          label: 'VBAT',
          animated: false,
          signalType: 'power',
          voltage: '3.7V',
        },
        {
          edgeId: 'sample-iot-e5',
          source: 'sample-iot-ldo',
          target: 'sample-iot-mcu',
          label: '3.3V Rail',
          animated: false,
          signalType: 'power',
          voltage: '3.3V',
        },
        {
          edgeId: 'sample-iot-e6',
          source: 'sample-iot-solar',
          target: 'sample-iot-charger',
          label: 'Solar Input',
          animated: false,
          signalType: 'power',
          voltage: '6V',
        },
        {
          edgeId: 'sample-iot-e7',
          source: 'sample-iot-charger',
          target: 'sample-iot-battery',
          label: 'Charge',
          animated: false,
          signalType: 'power',
          voltage: '4.2V',
        },
      ],
      bomItems: [
        {
          partNumber: 'ESP32-WROOM-32',
          manufacturer: 'Espressif',
          description: 'ESP32-WROOM-32 Wi-Fi + BLE Module',
          quantity: 1,
          unitPrice: '3.50',
          supplier: 'LCSC',
          category: 'MCUs',
        },
        {
          partNumber: 'BME280',
          manufacturer: 'Bosch Sensortec',
          description: 'Environmental Sensor (Temp/Humidity/Pressure)',
          quantity: 1,
          unitPrice: '4.50',
          supplier: 'DigiKey',
          category: 'Sensors',
        },
        {
          partNumber: 'SSD1306',
          manufacturer: 'Solomon Systech',
          description: '0.96" 128x64 I2C OLED Display',
          quantity: 1,
          unitPrice: '3.00',
          supplier: 'AliExpress',
          category: 'Displays',
        },
        {
          partNumber: 'AMS1117-3.3',
          manufacturer: 'Advanced Monolithic Systems',
          description: '3.3V 1A LDO Voltage Regulator',
          quantity: 1,
          unitPrice: '0.25',
          supplier: 'LCSC',
          category: 'Power',
        },
        {
          partNumber: 'TP4056',
          manufacturer: 'NanJing Top Power',
          description: '1A Li-Ion Battery Charger IC',
          quantity: 1,
          unitPrice: '0.30',
          supplier: 'LCSC',
          category: 'Power',
        },
        {
          partNumber: 'NCR18650B',
          manufacturer: 'Panasonic',
          description: '18650 3.7V 3400mAh Li-Ion Cell',
          quantity: 1,
          unitPrice: '4.50',
          supplier: 'Amazon',
          category: 'Power',
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// SampleProjectManager — singleton access pattern
// ---------------------------------------------------------------------------

export class SampleProjectManager {
  private static instance: SampleProjectManager | null = null;

  static getInstance(): SampleProjectManager {
    if (!SampleProjectManager.instance) {
      SampleProjectManager.instance = new SampleProjectManager();
    }
    return SampleProjectManager.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    SampleProjectManager.instance = null;
  }

  getAllSamples(): readonly SampleProject[] {
    return SAMPLE_PROJECTS;
  }

  getSampleById(id: string): SampleProject | undefined {
    return SAMPLE_PROJECTS.find((s) => s.id === id);
  }

  getSamplesByDifficulty(difficulty: SampleDifficulty): readonly SampleProject[] {
    return SAMPLE_PROJECTS.filter((s) => s.difficulty === difficulty);
  }

  getSamplesByCategory(category: SampleCategory): readonly SampleProject[] {
    return SAMPLE_PROJECTS.filter((s) => s.category === category);
  }

  searchSamples(query: string): readonly SampleProject[] {
    if (!query.trim()) {
      return SAMPLE_PROJECTS;
    }
    const q = query.toLowerCase().trim();
    return SAMPLE_PROJECTS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.workflows.some((w) => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)) ||
        s.learningObjectives.some((lo) => lo.toLowerCase().includes(q)),
    );
  }

  /** Compute total BOM cost for a sample project. */
  computeTotalCost(sample: SampleProject): number {
    return sample.preloadedData.bomItems.reduce((sum, item) => {
      return sum + item.quantity * parseFloat(item.unitPrice);
    }, 0);
  }

  /** Get unique difficulties present in the sample set. */
  getAvailableDifficulties(): readonly SampleDifficulty[] {
    const set = new Set<SampleDifficulty>();
    for (const s of SAMPLE_PROJECTS) {
      set.add(s.difficulty);
    }
    return Array.from(set).sort((a, b) => DIFFICULTY_META[a].sortOrder - DIFFICULTY_META[b].sortOrder);
  }

  /** Get unique categories present in the sample set. */
  getAvailableCategories(): readonly SampleCategory[] {
    const set = new Set<SampleCategory>();
    for (const s of SAMPLE_PROJECTS) {
      set.add(s.category);
    }
    return Array.from(set);
  }
}
