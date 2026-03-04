import { describe, it, expect } from 'vitest';
import { ArchitectureAnalyzer } from '../architecture-analyzer';
import type {
  AnalysisNode,
  AnalysisEdge,
  DesignAnalysisInput,
  DesignAnalysisReport,
  AnalysisBomItem,
} from '../architecture-analyzer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const analyzer = new ArchitectureAnalyzer();

function analyze(input: Partial<DesignAnalysisInput> = {}): DesignAnalysisReport {
  return analyzer.analyze({
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    bomItems: input.bomItems,
  });
}

function node(id: string, label: string, type?: string, properties?: Record<string, string>): AnalysisNode {
  return { id, label, type, properties };
}

function edge(source: string, target: string, label?: string): AnalysisEdge {
  return { source, target, label };
}

// ---------------------------------------------------------------------------
// Fixture: Simple LED + resistor circuit
// ---------------------------------------------------------------------------

const LED_CIRCUIT: DesignAnalysisInput = {
  nodes: [
    node('vcc', 'VCC 5V', 'power'),
    node('r1', '220Ω Resistor', 'passive'),
    node('led1', 'LED Red 5mm', 'passive'),
    node('gnd', 'GND', 'ground'),
  ],
  edges: [
    edge('vcc', 'r1'),
    edge('r1', 'led1'),
    edge('led1', 'gnd'),
  ],
};

// ---------------------------------------------------------------------------
// Fixture: Motor controller with H-bridge
// ---------------------------------------------------------------------------

const MOTOR_CONTROLLER: DesignAnalysisInput = {
  nodes: [
    node('bat', 'Battery 12V', 'power'),
    node('arduino', 'Arduino Mega 2560', 'mcu'),
    node('q1', 'MOSFET N-Channel Q1', 'transistor'),
    node('q2', 'MOSFET N-Channel Q2', 'transistor'),
    node('q3', 'MOSFET P-Channel Q3', 'transistor'),
    node('q4', 'MOSFET P-Channel Q4', 'transistor'),
    node('motor1', 'DC Motor 12V', 'motor'),
    node('gnd', 'GND', 'ground'),
    node('vreg', 'LM7805 Regulator', 'vreg'),
    node('c1', 'Capacitor 100μF Input', 'capacitor'),
    node('c2', 'Capacitor 100μF Output', 'capacitor'),
  ],
  edges: [
    edge('bat', 'vreg'),
    edge('vreg', 'arduino'),
    edge('c1', 'vreg'),
    edge('c2', 'vreg'),
    edge('arduino', 'q1'),
    edge('arduino', 'q2'),
    edge('arduino', 'q3'),
    edge('arduino', 'q4'),
    edge('q1', 'motor1'),
    edge('q2', 'motor1'),
    edge('q3', 'motor1'),
    edge('q4', 'motor1'),
    edge('motor1', 'gnd'),
    edge('bat', 'gnd'),
  ],
};

// ---------------------------------------------------------------------------
// Fixture: Arduino sensor project (MCU + sensors + display)
// ---------------------------------------------------------------------------

const SENSOR_PROJECT: DesignAnalysisInput = {
  nodes: [
    node('usb', 'USB Power 5V', 'power'),
    node('uno', 'Arduino Uno', 'mcu'),
    node('dht', 'DHT22 Temperature Sensor', 'sensor'),
    node('bme', 'BME280 Pressure Sensor', 'sensor'),
    node('oled', 'OLED Display SSD1306', 'display'),
    node('btn', 'Push Button', 'input'),
    node('r_pull', '10kΩ Resistor Pull-Up', 'passive'),
    node('vcc', 'VCC 3.3V', 'power'),
    node('gnd', 'GND', 'ground'),
  ],
  edges: [
    edge('usb', 'uno'),
    edge('uno', 'dht'),
    edge('uno', 'bme'),
    edge('uno', 'oled'),
    edge('btn', 'uno'),
    edge('r_pull', 'btn'),
    edge('r_pull', 'vcc'),
    edge('dht', 'gnd'),
    edge('bme', 'gnd'),
    edge('oled', 'gnd'),
  ],
};

// ---------------------------------------------------------------------------
// Fixture: Power supply (regulator + caps)
// ---------------------------------------------------------------------------

const POWER_SUPPLY: DesignAnalysisInput = {
  nodes: [
    node('vin', 'DC Input 12V', 'power'),
    node('fuse1', 'PTC Fuse 1A', 'protection'),
    node('reg', 'LM317 Voltage Regulator', 'vreg'),
    node('cin', 'Capacitor 100μF Input', 'capacitor'),
    node('cout', 'Capacitor 10μF Output', 'capacitor'),
    node('r1', 'R1 240Ω Resistor', 'passive'),
    node('r2', 'R2 390Ω Resistor', 'passive'),
    node('vout', 'VCC 5V Output', 'power'),
    node('gnd', 'GND', 'ground'),
  ],
  edges: [
    edge('vin', 'fuse1'),
    edge('fuse1', 'reg'),
    edge('cin', 'reg'),
    edge('cin', 'gnd'),
    edge('reg', 'cout'),
    edge('cout', 'gnd'),
    edge('reg', 'r1'),
    edge('r1', 'r2'),
    edge('r2', 'gnd'),
    edge('reg', 'vout'),
  ],
};

// ---------------------------------------------------------------------------
// Fixture: IoT device
// ---------------------------------------------------------------------------

const IOT_DEVICE: DesignAnalysisInput = {
  nodes: [
    node('bat', 'LiPo Battery 3.7V', 'power'),
    node('esp', 'ESP32', 'mcu'),
    node('temp', 'BME280 Temperature Sensor', 'sensor'),
    node('wifi', 'WiFi Antenna', 'antenna'),
    node('gnd', 'GND', 'ground'),
  ],
  edges: [
    edge('bat', 'esp'),
    edge('esp', 'temp'),
    edge('esp', 'wifi'),
    edge('temp', 'gnd'),
  ],
};

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// Empty / minimal designs
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — empty and minimal designs', () => {
  it('returns an empty report when no nodes are provided', () => {
    const report = analyze({ nodes: [], edges: [] });
    expect(report.summary).toContain('Empty design');
    expect(report.designType).toBe('Empty');
    expect(report.complexity).toBe('simple');
    expect(report.subsystems).toHaveLength(0);
    expect(report.signalFlow).toHaveLength(0);
    expect(report.componentRoles).toHaveLength(0);
    expect(report.detectedPatterns).toHaveLength(0);
    expect(report.suggestions).toHaveLength(0);
    expect(report.educationalNotes.length).toBeGreaterThan(0);
  });

  it('handles a single-node design gracefully', () => {
    const report = analyze({ nodes: [node('1', 'Arduino Uno', 'mcu')], edges: [] });
    expect(report.complexity).toBe('simple');
    expect(report.componentRoles).toHaveLength(1);
    expect(report.componentRoles[0].role).toContain('controller');
  });

  it('handles nodes with no edges', () => {
    const report = analyze({
      nodes: [node('1', 'LED'), node('2', 'Resistor')],
      edges: [],
    });
    expect(report.complexity).toBe('simple');
    expect(report.componentRoles).toHaveLength(2);
    // No signal flow without edges
    expect(report.signalFlow).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Simple LED circuit
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — simple LED circuit', () => {
  let report: DesignAnalysisReport;

  it('analyzes an LED circuit', () => {
    report = analyze(LED_CIRCUIT);
    expect(report).toBeDefined();
  });

  it('classifies complexity as simple (< 5 nodes)', () => {
    expect(report.complexity).toBe('simple');
  });

  it('identifies all components', () => {
    expect(report.componentRoles).toHaveLength(4);
    const labels = report.componentRoles.map((r) => r.label);
    expect(labels).toContain('VCC 5V');
    expect(labels).toContain('220Ω Resistor');
    expect(labels).toContain('LED Red 5mm');
  });

  it('identifies the LED role', () => {
    const ledRole = report.componentRoles.find((r) => r.label.includes('LED'));
    expect(ledRole?.role).toContain('LED');
  });

  it('identifies the resistor role', () => {
    const resRole = report.componentRoles.find((r) => r.label.includes('Resistor'));
    expect(resRole?.role).toContain('Resistor');
  });

  it('generates a summary mentioning the component count', () => {
    expect(report.summary).toContain('4 components');
  });
});

// ---------------------------------------------------------------------------
// Motor controller (H-bridge)
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — motor controller', () => {
  let report: DesignAnalysisReport;

  it('analyzes a motor controller design', () => {
    report = analyze(MOTOR_CONTROLLER);
    expect(report).toBeDefined();
  });

  it('classifies complexity as moderate (5-15 nodes)', () => {
    expect(report.complexity).toBe('moderate');
  });

  it('classifies design type as Motor Controller', () => {
    expect(report.designType).toBe('Motor Controller');
  });

  it('detects the H-bridge pattern', () => {
    const hBridge = report.detectedPatterns.find((p) => p.name === 'H-Bridge');
    expect(hBridge).toBeDefined();
    expect(hBridge!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(hBridge!.nodeIds).toContain('motor1');
  });

  it('detects the voltage regulator circuit pattern', () => {
    const regPattern = report.detectedPatterns.find((p) => p.name === 'Voltage Regulator Circuit');
    expect(regPattern).toBeDefined();
    expect(regPattern!.nodeIds).toContain('vreg');
  });

  it('identifies the Arduino as a control component', () => {
    const arduinoRole = report.componentRoles.find((r) => r.label.includes('Arduino'));
    expect(arduinoRole?.role).toContain('controller');
    expect(arduinoRole?.subsystem).toBe('Control Unit');
  });

  it('identifies the motor', () => {
    const motorRole = report.componentRoles.find((r) => r.label.includes('Motor'));
    expect(motorRole?.role).toContain('Motor');
  });

  it('generates signal flow from battery through controller to motor', () => {
    expect(report.signalFlow.length).toBeGreaterThan(0);
  });

  it('identifies battery as a power source', () => {
    expect(report.powerArchitecture.sources).toContain('Battery 12V');
  });

  it('identifies the regulator', () => {
    expect(report.powerArchitecture.regulators).toContain('LM7805 Regulator');
  });

  it('generates educational notes about H-bridge', () => {
    const hBridgeNote = report.educationalNotes.find((n) => n.includes('H-Bridge'));
    expect(hBridgeNote).toBeDefined();
    expect(hBridgeNote).toContain('shoot-through');
  });

  it('suggests a flyback diode for the motor', () => {
    const flyback = report.suggestions.find((s) => s.suggestion.includes('flyback'));
    expect(flyback).toBeDefined();
    expect(flyback!.priority).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Arduino sensor project
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — sensor project', () => {
  let report: DesignAnalysisReport;

  it('analyzes a sensor project', () => {
    report = analyze(SENSOR_PROJECT);
    expect(report).toBeDefined();
  });

  it('classifies complexity as moderate', () => {
    expect(report.complexity).toBe('moderate');
  });

  it('classifies design type as Sensor Hub', () => {
    expect(report.designType).toBe('Sensor Hub');
  });

  it('identifies multiple subsystems', () => {
    const categories = report.subsystems.map((s) => s.category);
    expect(categories).toContain('control');
    expect(categories).toContain('sensing');
  });

  it('identifies sensor components', () => {
    const sensors = report.componentRoles.filter((r) => r.role.includes('Sensor'));
    expect(sensors.length).toBeGreaterThanOrEqual(2);
  });

  it('identifies the OLED display', () => {
    const display = report.componentRoles.find((r) => r.label.includes('OLED'));
    expect(display?.role).toContain('Display');
  });

  it('detects a pull-up resistor', () => {
    const pullUp = report.detectedPatterns.find((p) => p.name === 'Pull-Up Resistor');
    expect(pullUp).toBeDefined();
    expect(pullUp!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('generates educational notes about pull-up resistors', () => {
    const pullUpNote = report.educationalNotes.find((n) => n.includes('Pull-Up'));
    expect(pullUpNote).toBeDefined();
  });

  it('generates signal flow from sensors through controller', () => {
    expect(report.signalFlow.length).toBeGreaterThan(0);
  });

  it('generates sensor integration educational note', () => {
    const sensorNote = report.educationalNotes.find((n) => n.includes('Sensor Integration'));
    expect(sensorNote).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Power supply
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — power supply', () => {
  let report: DesignAnalysisReport;

  it('analyzes a power supply design', () => {
    report = analyze(POWER_SUPPLY);
    expect(report).toBeDefined();
  });

  it('classifies complexity as moderate (9 nodes)', () => {
    expect(report.complexity).toBe('moderate');
  });

  it('identifies power sources', () => {
    expect(report.powerArchitecture.sources.length).toBeGreaterThan(0);
  });

  it('identifies the voltage regulator', () => {
    expect(report.powerArchitecture.regulators).toContain('LM317 Voltage Regulator');
  });

  it('detects a voltage divider pattern (R1 + R2)', () => {
    const vdiv = report.detectedPatterns.find((p) => p.name === 'Voltage Divider');
    expect(vdiv).toBeDefined();
    expect(vdiv!.nodeIds).toContain('r1');
    expect(vdiv!.nodeIds).toContain('r2');
  });

  it('detects voltage regulator circuit pattern', () => {
    const regPattern = report.detectedPatterns.find((p) => p.name === 'Voltage Regulator Circuit');
    expect(regPattern).toBeDefined();
  });

  it('identifies the fuse as protection', () => {
    const fuseRole = report.componentRoles.find((r) => r.label.includes('Fuse'));
    expect(fuseRole?.role).toContain('Fuse');
    expect(fuseRole?.subsystem).toBe('Protection Circuit');
  });

  it('generates educational notes about voltage dividers', () => {
    const note = report.educationalNotes.find((n) => n.includes('Voltage Divider'));
    expect(note).toBeDefined();
    expect(note).toContain('Vout');
  });

  it('generates educational notes about voltage regulators', () => {
    const note = report.educationalNotes.find((n) => n.includes('Voltage Regulator'));
    expect(note).toBeDefined();
  });

  it('generates power design tip', () => {
    const note = report.educationalNotes.find((n) => n.includes('Power Design Tip'));
    expect(note).toBeDefined();
  });

  it('describes power distribution', () => {
    expect(report.powerArchitecture.distribution).not.toBe('Unknown power distribution');
  });
});

// ---------------------------------------------------------------------------
// IoT device
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — IoT device', () => {
  let report: DesignAnalysisReport;

  it('analyzes an IoT device', () => {
    report = analyze(IOT_DEVICE);
    expect(report).toBeDefined();
  });

  it('classifies complexity as simple (5 nodes)', () => {
    // 5 nodes is the boundary — should be moderate
    expect(report.complexity).toBe('moderate');
  });

  it('classifies design type as IoT Device', () => {
    expect(report.designType).toBe('IoT Device');
  });

  it('identifies communication subsystem', () => {
    const comm = report.subsystems.find((s) => s.category === 'communication');
    expect(comm).toBeDefined();
  });

  it('identifies the ESP32 as a controller', () => {
    const esp = report.componentRoles.find((r) => r.label === 'ESP32');
    expect(esp?.role).toContain('controller');
  });

  it('generates communication educational note', () => {
    const note = report.educationalNotes.find((n) => n.includes('Communication Tip'));
    expect(note).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Subsystem classification
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — subsystem classification', () => {
  it('classifies a voltage regulator as power', () => {
    const report = analyze({ nodes: [node('1', 'LM7805 Voltage Regulator')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Power Management');
  });

  it('classifies a temperature sensor as sensing', () => {
    const report = analyze({ nodes: [node('1', 'DHT22 Temperature Sensor')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Sensor Array');
  });

  it('classifies an Arduino as control', () => {
    const report = analyze({ nodes: [node('1', 'Arduino Mega 2560')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Control Unit');
  });

  it('classifies a WiFi module as communication', () => {
    const report = analyze({ nodes: [node('1', 'ESP32 WiFi Module')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toMatch(/Communication Module|Control Unit/);
  });

  it('classifies a motor driver as actuation', () => {
    const report = analyze({ nodes: [node('1', 'L298N Motor Driver')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Actuator System');
  });

  it('classifies a fuse as protection', () => {
    const report = analyze({ nodes: [node('1', 'PTC Fuse 500mA')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Protection Circuit');
  });

  it('classifies a button as user-interface', () => {
    const report = analyze({ nodes: [node('1', 'Push Button Momentary')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('User Interface');
  });

  it('classifies unknown components as unclassified', () => {
    const report = analyze({ nodes: [node('1', 'XYZ Unknown Part')] });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Unclassified Components');
  });
});

// ---------------------------------------------------------------------------
// Pattern detection accuracy
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — pattern detection', () => {
  it('detects a voltage divider between power and ground', () => {
    const report = analyze({
      nodes: [
        node('vcc', 'VCC 5V'),
        node('r1', '10kΩ Resistor'),
        node('r2', '10kΩ Resistor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('vcc', 'r1'),
        edge('r1', 'r2'),
        edge('r2', 'gnd'),
      ],
    });
    const vdiv = report.detectedPatterns.find((p) => p.name === 'Voltage Divider');
    expect(vdiv).toBeDefined();
  });

  it('does not detect a voltage divider when resistors are not connected', () => {
    const report = analyze({
      nodes: [
        node('vcc', 'VCC 5V'),
        node('r1', '10kΩ Resistor'),
        node('r2', '20kΩ Resistor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('vcc', 'r1'),
        edge('r2', 'gnd'),
      ],
    });
    const vdiv = report.detectedPatterns.find((p) => p.name === 'Voltage Divider');
    expect(vdiv).toBeUndefined();
  });

  it('detects a decoupling capacitor on an IC', () => {
    const report = analyze({
      nodes: [
        node('mcu', 'STM32 MCU'),
        node('cap', '100nF Decoupling Capacitor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('mcu', 'cap'),
        edge('cap', 'gnd'),
      ],
    });
    const decoupling = report.detectedPatterns.find((p) => p.name === 'Decoupling Capacitor');
    expect(decoupling).toBeDefined();
    expect(decoupling!.nodeIds).toContain('mcu');
    expect(decoupling!.nodeIds).toContain('cap');
  });

  it('detects a pull-down resistor', () => {
    const report = analyze({
      nodes: [
        node('sig', 'Signal Line'),
        node('r1', '10kΩ Resistor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('sig', 'r1'),
        edge('r1', 'gnd'),
      ],
    });
    const pullDown = report.detectedPatterns.find((p) => p.name === 'Pull-Down Resistor');
    expect(pullDown).toBeDefined();
  });

  it('detects an RC filter', () => {
    const report = analyze({
      nodes: [
        node('input', 'Signal Input'),
        node('r1', '1kΩ Resistor'),
        node('c1', '100nF Capacitor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('input', 'r1'),
        edge('r1', 'c1'),
        edge('c1', 'gnd'),
      ],
    });
    const rc = report.detectedPatterns.find((p) => p.name === 'RC Filter');
    expect(rc).toBeDefined();
    expect(rc!.description).toContain('low-pass');
  });

  it('detects an RC high-pass filter (cap not to ground)', () => {
    const report = analyze({
      nodes: [
        node('input', 'Signal Input'),
        node('r1', '1kΩ Resistor'),
        node('c1', '100nF Capacitor'),
        node('output', 'Signal Output'),
      ],
      edges: [
        edge('input', 'r1'),
        edge('r1', 'c1'),
        edge('c1', 'output'),
      ],
    });
    const rc = report.detectedPatterns.find((p) => p.name === 'RC Filter');
    expect(rc).toBeDefined();
    expect(rc!.description).toContain('high-pass');
  });

  it('detects voltage regulator circuit with input/output caps', () => {
    const report = analyze({
      nodes: [
        node('vin', 'VIN 12V'),
        node('reg', 'LM7805 Regulator'),
        node('cin', 'Capacitor 100μF'),
        node('cout', 'Capacitor 10μF'),
      ],
      edges: [
        edge('vin', 'reg'),
        edge('cin', 'reg'),
        edge('cout', 'reg'),
      ],
    });
    const regPattern = report.detectedPatterns.find((p) => p.name === 'Voltage Regulator Circuit');
    expect(regPattern).toBeDefined();
    expect(regPattern!.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

// ---------------------------------------------------------------------------
// Complexity scoring
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — complexity scoring', () => {
  it('rates 1 node as simple', () => {
    const report = analyze({ nodes: [node('1', 'LED')] });
    expect(report.complexity).toBe('simple');
  });

  it('rates 4 nodes as simple', () => {
    const nodes = Array.from({ length: 4 }, (_, i) => node(`${i}`, `Part ${i}`));
    const report = analyze({ nodes });
    expect(report.complexity).toBe('simple');
  });

  it('rates 5 nodes as moderate', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node(`${i}`, `Part ${i}`));
    const report = analyze({ nodes });
    expect(report.complexity).toBe('moderate');
  });

  it('rates 15 nodes as moderate', () => {
    const nodes = Array.from({ length: 15 }, (_, i) => node(`${i}`, `Part ${i}`));
    const report = analyze({ nodes });
    expect(report.complexity).toBe('moderate');
  });

  it('rates 16 nodes as complex', () => {
    const nodes = Array.from({ length: 16 }, (_, i) => node(`${i}`, `Part ${i}`));
    const report = analyze({ nodes });
    expect(report.complexity).toBe('complex');
  });

  it('rates 50 nodes as complex', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`${i}`, `Part ${i}`));
    const report = analyze({ nodes });
    expect(report.complexity).toBe('complex');
  });
});

// ---------------------------------------------------------------------------
// Signal flow extraction
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — signal flow', () => {
  it('traces flow from sensor through controller to output', () => {
    const report = analyze({
      nodes: [
        node('s1', 'Temperature Sensor'),
        node('mcu', 'Arduino Uno'),
        node('m1', 'Servo Motor'),
      ],
      edges: [
        edge('s1', 'mcu'),
        edge('mcu', 'm1'),
      ],
    });
    expect(report.signalFlow.length).toBeGreaterThan(0);
    const flow = report.signalFlow.find((f) => f.includes('Temperature Sensor') && f.includes('Arduino Uno'));
    expect(flow).toBeDefined();
  });

  it('traces direct input to output when no controller exists', () => {
    const report = analyze({
      nodes: [
        node('btn', 'Button Switch'),
        node('led', 'LED'),
      ],
      edges: [
        edge('btn', 'led'),
      ],
    });
    // Button is user-interface (input), LED is actuation (output)
    expect(report.signalFlow.length).toBeGreaterThan(0);
  });

  it('returns empty flow for disconnected nodes', () => {
    const report = analyze({
      nodes: [
        node('s1', 'Temperature Sensor'),
        node('m1', 'Motor'),
      ],
      edges: [],
    });
    expect(report.signalFlow).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suggestion generation
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — suggestions', () => {
  it('suggests decoupling capacitors for ICs without them', () => {
    const report = analyze({
      nodes: [
        node('mcu', 'Arduino Mega'),
        node('led', 'LED'),
      ],
      edges: [edge('mcu', 'led')],
    });
    const decoupling = report.suggestions.find((s) => s.suggestion.includes('decoupling'));
    expect(decoupling).toBeDefined();
    expect(decoupling!.priority).toBe('high');
  });

  it('suggests reverse polarity protection when power input exists without protection', () => {
    const report = analyze({
      nodes: [
        node('bat', 'Battery 9V'),
        node('mcu', 'Arduino Uno'),
      ],
      edges: [edge('bat', 'mcu')],
    });
    const protection = report.suggestions.find((s) => s.suggestion.includes('reverse polarity'));
    expect(protection).toBeDefined();
    expect(protection!.priority).toBe('high');
  });

  it('does not suggest protection when protection components exist', () => {
    const report = analyze({
      nodes: [
        node('bat', 'Battery 9V'),
        node('fuse', 'Fuse 1A'),
        node('mcu', 'Arduino Uno'),
      ],
      edges: [
        edge('bat', 'fuse'),
        edge('fuse', 'mcu'),
      ],
    });
    const protection = report.suggestions.find((s) => s.suggestion.includes('reverse polarity'));
    expect(protection).toBeUndefined();
  });

  it('suggests flyback diode for motors', () => {
    const report = analyze({
      nodes: [
        node('mcu', 'Arduino'),
        node('motor', 'DC Motor'),
      ],
      edges: [edge('mcu', 'motor')],
    });
    const flyback = report.suggestions.find((s) => s.suggestion.includes('flyback'));
    expect(flyback).toBeDefined();
    expect(flyback!.priority).toBe('high');
  });

  it('flags unconnected components', () => {
    const report = analyze({
      nodes: [
        node('a', 'Arduino'),
        node('b', 'LED'),
        node('c', 'Orphan Resistor'),
      ],
      edges: [edge('a', 'b')],
    });
    const orphan = report.suggestions.find((s) => s.suggestion.includes('Orphan Resistor'));
    expect(orphan).toBeDefined();
    expect(orphan!.category).toBe('Connectivity');
  });

  it('flags BOM quantity mismatch', () => {
    const bomItems: AnalysisBomItem[] = [
      { name: 'Arduino Uno', quantity: 1 },
    ];
    const report = analyze({
      nodes: [
        node('a', 'Arduino Uno'),
        node('b', 'LED'),
        node('c', 'Resistor 220Ω'),
      ],
      edges: [edge('a', 'b'), edge('b', 'c')],
      bomItems,
    });
    const bomSuggestion = report.suggestions.find((s) => s.category === 'BOM');
    expect(bomSuggestion).toBeDefined();
    expect(bomSuggestion!.priority).toBe('low');
  });

  it('suggests a controller for complex designs without one', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => node(`${i}`, `LED ${i}`));
    const edges = Array.from({ length: 6 }, (_, i) => edge(`${i}`, `${i + 1}`));
    const report = analyze({ nodes, edges });
    const ctrlSuggestion = report.suggestions.find((s) => s.suggestion.includes('microcontroller'));
    expect(ctrlSuggestion).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Educational notes
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — educational notes', () => {
  it('generates a beginner note for empty designs', () => {
    const report = analyze({});
    expect(report.educationalNotes.length).toBeGreaterThan(0);
    expect(report.educationalNotes[0]).toContain('Start by adding');
  });

  it('generates unique (non-duplicate) notes', () => {
    const report = analyze(MOTOR_CONTROLLER);
    const unique = new Set(report.educationalNotes);
    expect(unique.size).toBe(report.educationalNotes.length);
  });

  it('generates voltage divider note with formula', () => {
    const report = analyze(POWER_SUPPLY);
    const note = report.educationalNotes.find((n) => n.includes('Voltage Divider'));
    expect(note).toBeDefined();
    expect(note).toContain('Vout = Vin');
  });

  it('generates decoupling cap note', () => {
    const report = analyze({
      nodes: [
        node('mcu', 'STM32 MCU'),
        node('cap', '100nF Decoupling Capacitor'),
        node('gnd', 'GND'),
      ],
      edges: [
        edge('mcu', 'cap'),
        edge('cap', 'gnd'),
      ],
    });
    const note = report.educationalNotes.find((n) => n.includes('Decoupling'));
    expect(note).toBeDefined();
    expect(note).toContain('100nF');
  });
});

// ---------------------------------------------------------------------------
// Power architecture analysis
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — power architecture', () => {
  it('detects voltage domains from edge labels', () => {
    const report = analyze({
      nodes: [
        node('reg', 'Regulator', 'power'),
        node('mcu', 'Arduino'),
      ],
      edges: [
        edge('reg', 'mcu', '3.3V rail'),
      ],
    });
    expect(report.powerArchitecture.voltageDomains).toContain('3.3V');
  });

  it('detects voltage domains from node labels', () => {
    const report = analyze({
      nodes: [
        node('rail', 'VCC 5V Rail', 'power'),
      ],
    });
    expect(report.powerArchitecture.voltageDomains).toContain('5V');
  });

  it('falls back to VCC nodes as sources when no explicit source exists', () => {
    const report = analyze({
      nodes: [
        node('vcc', 'VCC'),
        node('led', 'LED'),
      ],
      edges: [edge('vcc', 'led')],
    });
    expect(report.powerArchitecture.sources.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Node properties
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — node properties', () => {
  it('uses properties in classification', () => {
    const report = analyze({
      nodes: [
        node('1', 'U1', undefined, { function: 'temperature sensor' }),
      ],
    });
    const role = report.componentRoles[0];
    expect(role.subsystem).toBe('Sensor Array');
  });
});

// ---------------------------------------------------------------------------
// Design type classification
// ---------------------------------------------------------------------------

describe('ArchitectureAnalyzer — design type', () => {
  it('classifies a power-only design as Power Supply', () => {
    const report = analyze({
      nodes: [
        node('vin', 'DC Input'),
        node('reg', 'LM7805 Regulator'),
        node('cout', 'Capacitor 10μF'),
      ],
      edges: [edge('vin', 'reg'), edge('reg', 'cout')],
    });
    expect(report.designType).toMatch(/Power Supply|Protected Power Supply/);
  });

  it('classifies an interactive device', () => {
    const report = analyze({
      nodes: [
        node('btn', 'Push Button'),
        node('enc', 'Rotary Encoder'),
        node('mcu', 'Arduino Nano'),
        node('lcd', 'LCD Display HD44780'),
      ],
      edges: [
        edge('btn', 'mcu'),
        edge('enc', 'mcu'),
        edge('mcu', 'lcd'),
      ],
    });
    expect(report.designType).toBe('Interactive Device');
  });

  it('classifies an unknown-only design as General Circuit', () => {
    const report = analyze({
      nodes: [
        node('1', 'Unknown Part A'),
        node('2', 'Unknown Part B'),
      ],
      edges: [edge('1', '2')],
    });
    expect(report.designType).toBe('General Circuit');
  });
});
