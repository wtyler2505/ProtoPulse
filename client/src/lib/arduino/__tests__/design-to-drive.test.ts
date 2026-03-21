import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyComponent,
  inferPinDirection,
  inferPinMappings,
  sanitizeLabel,
  getAvailableModes,
  generateFirmware,
  getDesignToDriveManager,
  resetDesignToDriveManager,
  BOARD_PIN_INFO,
  COMPONENT_TEST_MAP,
} from '../design-to-drive';
import type {
  SchematicInstance,
  CircuitNet,
  ComponentCategory,
  TestMode,
  BoardType,
  FirmwareConfig,
} from '../design-to-drive';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInstance(
  refDes: string,
  label: string,
  props: Record<string, unknown> = {},
  connectedNets?: string[],
): SchematicInstance {
  return { refDes, label, properties: props, connectedNets };
}

function makeNet(name: string, netType = 'signal', voltage?: string): CircuitNet {
  return { name, netType, voltage: voltage ?? null };
}

// ---------------------------------------------------------------------------
// classifyComponent
// ---------------------------------------------------------------------------

describe('classifyComponent', () => {
  it('classifies LED by label keyword', () => {
    expect(classifyComponent(makeInstance('D1', 'Red LED'))).toBe('led');
  });

  it('classifies LED by refDes prefix', () => {
    expect(classifyComponent(makeInstance('LED1', 'Component'))).toBe('led');
  });

  it('classifies resistor by refDes', () => {
    expect(classifyComponent(makeInstance('R1', 'Resistor'))).toBe('resistor');
  });

  it('classifies capacitor by refDes', () => {
    expect(classifyComponent(makeInstance('C1', '100nF'))).toBe('capacitor');
  });

  it('classifies motor by label keyword "servo"', () => {
    expect(classifyComponent(makeInstance('U3', 'Servo Motor'))).toBe('motor');
  });

  it('classifies motor by refDes MOT', () => {
    expect(classifyComponent(makeInstance('MOT1', 'DC Motor'))).toBe('motor');
  });

  it('classifies sensor by label keyword "temp"', () => {
    expect(classifyComponent(makeInstance('U2', 'Temperature Sensor'))).toBe('sensor');
  });

  it('classifies sensor by label keyword "ultrasonic"', () => {
    expect(classifyComponent(makeInstance('U4', 'HC-SR04 Ultrasonic'))).toBe('sensor');
  });

  it('classifies sensor by label keyword "dht"', () => {
    expect(classifyComponent(makeInstance('U5', 'DHT22'))).toBe('sensor');
  });

  it('classifies switch by refDes SW', () => {
    expect(classifyComponent(makeInstance('SW1', 'Push Button'))).toBe('switch');
  });

  it('classifies switch by label keyword "button"', () => {
    expect(classifyComponent(makeInstance('U6', 'Tactile Button'))).toBe('switch');
  });

  it('classifies relay by refDes K', () => {
    expect(classifyComponent(makeInstance('K1', 'SPDT Relay'))).toBe('relay');
  });

  it('classifies display by label keyword "lcd"', () => {
    expect(classifyComponent(makeInstance('U7', 'LCD 16x2'))).toBe('display');
  });

  it('classifies display by label keyword "oled"', () => {
    expect(classifyComponent(makeInstance('U8', 'SSD1306 OLED'))).toBe('display');
  });

  it('classifies communication by label keyword "uart"', () => {
    expect(classifyComponent(makeInstance('U9', 'UART Module'))).toBe('communication');
  });

  it('classifies communication by label keyword "bluetooth"', () => {
    expect(classifyComponent(makeInstance('U10', 'HC-05 Bluetooth'))).toBe('communication');
  });

  it('classifies mcu by label keyword "arduino"', () => {
    expect(classifyComponent(makeInstance('U11', 'Arduino Mega'))).toBe('mcu');
  });

  it('classifies mcu by refDes IC', () => {
    expect(classifyComponent(makeInstance('IC1', 'ATmega328'))).toBe('mcu');
  });

  it('classifies regulator by label keyword', () => {
    expect(classifyComponent(makeInstance('U12', 'LM7805 Voltage Regulator'))).toBe('regulator');
  });

  it('classifies unknown components', () => {
    expect(classifyComponent(makeInstance('X1', 'Something'))).toBe('unknown');
  });

  it('prefers label keyword over refDes prefix', () => {
    // R1 label says "sensor" → should be sensor, not resistor
    expect(classifyComponent(makeInstance('R1', 'Current Sensor'))).toBe('sensor');
  });

  it('classifies via properties.type when no label/refDes match', () => {
    expect(classifyComponent(makeInstance('X1', 'Generic', { type: 'motor' }))).toBe('motor');
  });

  it('classifies stepper motors', () => {
    expect(classifyComponent(makeInstance('M1', 'Stepper'))).toBe('motor');
  });
});

// ---------------------------------------------------------------------------
// inferPinDirection
// ---------------------------------------------------------------------------

describe('inferPinDirection', () => {
  it('returns output for led', () => {
    expect(inferPinDirection('led')).toBe('output');
  });

  it('returns output for motor', () => {
    expect(inferPinDirection('motor')).toBe('output');
  });

  it('returns output for relay', () => {
    expect(inferPinDirection('relay')).toBe('output');
  });

  it('returns output for display', () => {
    expect(inferPinDirection('display')).toBe('output');
  });

  it('returns input for sensor', () => {
    expect(inferPinDirection('sensor')).toBe('input');
  });

  it('returns input for switch', () => {
    expect(inferPinDirection('switch')).toBe('input');
  });

  it('returns bidirectional for communication', () => {
    expect(inferPinDirection('communication')).toBe('bidirectional');
  });

  it('infers output from net name containing "out"', () => {
    expect(inferPinDirection('unknown', 'PWM_OUT')).toBe('output');
  });

  it('infers output from net name containing "tx"', () => {
    expect(inferPinDirection('unknown', 'TX_DATA')).toBe('output');
  });

  it('infers input from net name containing "in"', () => {
    expect(inferPinDirection('unknown', 'SIGNAL_IN')).toBe('input');
  });

  it('infers input from net name containing "adc"', () => {
    expect(inferPinDirection('unknown', 'ADC_CH0')).toBe('input');
  });

  it('returns bidirectional when no heuristic matches', () => {
    expect(inferPinDirection('unknown')).toBe('bidirectional');
  });
});

// ---------------------------------------------------------------------------
// sanitizeLabel
// ---------------------------------------------------------------------------

describe('sanitizeLabel', () => {
  it('converts label to upper-snake-case', () => {
    expect(sanitizeLabel('LED1', 'Red LED', 'led')).toBe('RED_LED');
  });

  it('removes non-alphanumeric characters', () => {
    expect(sanitizeLabel('U1', 'HC-SR04 (Ultrasonic)', 'sensor')).toBe('HC_SR04_ULTRASONIC');
  });

  it('falls back to category_refDes when label matches refDes', () => {
    expect(sanitizeLabel('R1', 'R1', 'resistor')).toBe('RESISTOR_R1');
  });

  it('falls back to category_refDes when label is empty', () => {
    expect(sanitizeLabel('LED1', '', 'led')).toBe('LED_LED1');
  });

  it('truncates to 32 characters', () => {
    const longLabel = 'A'.repeat(50);
    const result = sanitizeLabel('U1', longLabel, 'mcu');
    expect(result.length).toBeLessThanOrEqual(32);
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeLabel('U1', 'DHT---22 Module', 'sensor')).toBe('DHT_22_MODULE');
  });
});

// ---------------------------------------------------------------------------
// inferPinMappings
// ---------------------------------------------------------------------------

describe('inferPinMappings', () => {
  const nets: CircuitNet[] = [
    makeNet('VCC', 'power', '5V'),
    makeNet('GND', 'power', '0V'),
    makeNet('LED_NET', 'signal'),
  ];

  it('infers mappings from a mixed set of instances', () => {
    const instances: SchematicInstance[] = [
      makeInstance('LED1', 'Status LED'),
      makeInstance('SW1', 'Push Button', {}, ['INPUT_NET']),
      makeInstance('MOT1', 'DC Motor'),
    ];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings.length).toBe(3);
    expect(mappings.map((m) => m.componentType)).toContain('led');
    expect(mappings.map((m) => m.componentType)).toContain('switch');
    expect(mappings.map((m) => m.componentType)).toContain('motor');
  });

  it('skips capacitors and regulators', () => {
    const instances: SchematicInstance[] = [
      makeInstance('C1', '100nF'),
      makeInstance('VR1', 'LM7805 Regulator'),
      makeInstance('LED1', 'Red LED'),
    ];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings.length).toBe(1);
    expect(mappings[0].componentType).toBe('led');
  });

  it('uses explicit pin from properties', () => {
    const instances: SchematicInstance[] = [makeInstance('LED1', 'LED', { pin: '7' })];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].pin).toBe('7');
  });

  it('uses pinNumber from properties', () => {
    const instances: SchematicInstance[] = [makeInstance('LED1', 'LED', { pinNumber: 9 })];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].pin).toBe('9');
  });

  it('assigns sensors to analog pins', () => {
    const instances: SchematicInstance[] = [
      makeInstance('U1', 'Temp Sensor'),
      makeInstance('U2', 'Light Sensor (LDR)'),
    ];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].pin).toBe('A0');
    expect(mappings[1].pin).toBe('A1');
  });

  it('assigns motors to PWM pins', () => {
    const instances: SchematicInstance[] = [makeInstance('MOT1', 'DC Motor')];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    const pwmPins = BOARD_PIN_INFO.arduino_uno.pwmPins.map(String);
    expect(pwmPins).toContain(mappings[0].pin);
  });

  it('assigns LEDs to default LED pin when available', () => {
    const instances: SchematicInstance[] = [makeInstance('LED1', 'Status LED')];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].pin).toBe('13');
  });

  it('captures netName from connectedNets', () => {
    const instances: SchematicInstance[] = [
      makeInstance('SW1', 'Button', {}, ['BUTTON_NET']),
    ];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].netName).toBe('BUTTON_NET');
  });

  it('works with esp32 board type', () => {
    const instances: SchematicInstance[] = [makeInstance('LED1', 'LED')];
    const mappings = inferPinMappings(instances, nets, 'esp32');
    expect(mappings.length).toBe(1);
  });

  it('returns empty array for no instances', () => {
    const mappings = inferPinMappings([], nets, 'arduino_uno');
    expect(mappings).toEqual([]);
  });

  it('handles instances with no connectedNets', () => {
    const instances: SchematicInstance[] = [makeInstance('LED1', 'LED', {})];
    const mappings = inferPinMappings(instances, nets, 'arduino_uno');
    expect(mappings[0].netName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAvailableModes
// ---------------------------------------------------------------------------

describe('getAvailableModes', () => {
  it('always includes serial_echo, comprehensive, io_scan', () => {
    const modes = getAvailableModes([]);
    expect(modes).toContain('serial_echo');
    expect(modes).toContain('comprehensive');
    expect(modes).toContain('io_scan');
  });

  it('includes blink when LED present', () => {
    const mappings = inferPinMappings(
      [makeInstance('LED1', 'Red LED')],
      [],
      'arduino_uno',
    );
    const modes = getAvailableModes(mappings);
    expect(modes).toContain('blink');
  });

  it('includes motor_test when motor present', () => {
    const mappings = inferPinMappings(
      [makeInstance('MOT1', 'DC Motor')],
      [],
      'arduino_uno',
    );
    const modes = getAvailableModes(mappings);
    expect(modes).toContain('motor_test');
  });

  it('includes sensor_read when sensor present', () => {
    const mappings = inferPinMappings(
      [makeInstance('U1', 'Temp Sensor')],
      [],
      'arduino_uno',
    );
    const modes = getAvailableModes(mappings);
    expect(modes).toContain('sensor_read');
  });

  it('returns modes in stable order', () => {
    const mappings = inferPinMappings(
      [
        makeInstance('MOT1', 'Motor'),
        makeInstance('LED1', 'LED'),
        makeInstance('U1', 'Sensor'),
      ],
      [],
      'arduino_uno',
    );
    const modes = getAvailableModes(mappings);
    const blinkIdx = modes.indexOf('blink');
    const motorIdx = modes.indexOf('motor_test');
    const sensorIdx = modes.indexOf('sensor_read');
    expect(blinkIdx).toBeLessThan(motorIdx);
    expect(sensorIdx).toBeLessThan(motorIdx);
  });
});

// ---------------------------------------------------------------------------
// COMPONENT_TEST_MAP coverage
// ---------------------------------------------------------------------------

describe('COMPONENT_TEST_MAP', () => {
  it('has entries for all component categories', () => {
    const categories: ComponentCategory[] = [
      'led', 'resistor', 'capacitor', 'motor', 'sensor', 'switch',
      'relay', 'display', 'communication', 'mcu', 'regulator', 'unknown',
    ];
    for (const cat of categories) {
      expect(COMPONENT_TEST_MAP).toHaveProperty(cat);
      expect(Array.isArray(COMPONENT_TEST_MAP[cat])).toBe(true);
    }
  });

  it('maps led to blink and io_scan', () => {
    expect(COMPONENT_TEST_MAP.led).toContain('blink');
    expect(COMPONENT_TEST_MAP.led).toContain('io_scan');
  });

  it('maps motor to motor_test', () => {
    expect(COMPONENT_TEST_MAP.motor).toContain('motor_test');
  });

  it('maps sensor to sensor_read', () => {
    expect(COMPONENT_TEST_MAP.sensor).toContain('sensor_read');
  });
});

// ---------------------------------------------------------------------------
// BOARD_PIN_INFO
// ---------------------------------------------------------------------------

describe('BOARD_PIN_INFO', () => {
  it('has entries for all board types', () => {
    const boards: BoardType[] = [
      'arduino_uno', 'arduino_mega', 'arduino_nano',
      'esp32', 'esp8266', 'raspberry_pi_pico', 'generic',
    ];
    for (const b of boards) {
      const info = BOARD_PIN_INFO[b];
      expect(info.digitalPinCount).toBeGreaterThan(0);
      expect(info.analogPins.length).toBeGreaterThan(0);
      expect(info.pwmPins.length).toBeGreaterThan(0);
      expect(typeof info.defaultLedPin).toBe('number');
    }
  });

  it('arduino_uno has 14 digital pins and 6 analog', () => {
    expect(BOARD_PIN_INFO.arduino_uno.digitalPinCount).toBe(14);
    expect(BOARD_PIN_INFO.arduino_uno.analogPins.length).toBe(6);
  });

  it('arduino_mega has 54 digital pins', () => {
    expect(BOARD_PIN_INFO.arduino_mega.digitalPinCount).toBe(54);
  });

  it('esp32 default LED pin is 2', () => {
    expect(BOARD_PIN_INFO.esp32.defaultLedPin).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// generateFirmware
// ---------------------------------------------------------------------------

describe('generateFirmware', () => {
  const defaultConfig: FirmwareConfig = {
    boardType: 'arduino_uno',
    baudRate: 9600,
    delayMs: 1000,
    verboseSerial: true,
  };

  const mixedMappings = inferPinMappings(
    [
      makeInstance('LED1', 'Status LED'),
      makeInstance('SW1', 'Push Button'),
      makeInstance('MOT1', 'DC Motor'),
      makeInstance('U1', 'Temp Sensor'),
    ],
    [],
    'arduino_uno',
  );

  describe('blink mode', () => {
    it('generates valid Arduino sketch', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('void setup()');
      expect(result.sketch).toContain('void loop()');
      expect(result.sketch).toContain('digitalWrite');
      expect(result.sketch).toContain('Serial.begin(9600)');
    });

    it('targets LED pin', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('HIGH');
      expect(result.sketch).toContain('LOW');
    });

    it('adds warning when no LEDs present', () => {
      const noLedMappings = inferPinMappings(
        [makeInstance('U1', 'Temp Sensor')],
        [],
        'arduino_uno',
      );
      const result = generateFirmware('blink', noLedMappings, defaultConfig);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('No LEDs');
    });

    it('sets correct filename', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.filename).toBe('protopulse_blink_test.ino');
    });

    it('has mode in result', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.mode).toBe('blink');
    });
  });

  describe('io_scan mode', () => {
    it('generates code that toggles outputs and reads inputs', () => {
      const result = generateFirmware('io_scan', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('IO_SCAN');
      expect(result.sketch).toContain('digitalRead');
    });

    it('sets up INPUT_PULLUP for digital inputs', () => {
      const result = generateFirmware('io_scan', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('INPUT_PULLUP');
    });

    it('warns when no mappings', () => {
      const result = generateFirmware('io_scan', [], defaultConfig);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('sensor_read mode', () => {
    it('generates analogRead for analog sensors', () => {
      const sensorMappings = inferPinMappings(
        [makeInstance('U1', 'Temp Sensor')],
        [],
        'arduino_uno',
      );
      const result = generateFirmware('sensor_read', sensorMappings, defaultConfig);
      expect(result.sketch).toContain('analogRead');
      expect(result.sketch).toContain('voltage');
    });

    it('generates digitalRead for digital sensors', () => {
      const switchMappings = inferPinMappings(
        [makeInstance('SW1', 'Push Button', { pin: '4' })],
        [],
        'arduino_uno',
      );
      const result = generateFirmware('sensor_read', switchMappings, defaultConfig);
      expect(result.sketch).toContain('digitalRead');
    });

    it('warns when no sensors found', () => {
      const ledMappings = inferPinMappings(
        [makeInstance('LED1', 'Red LED')],
        [],
        'arduino_uno',
      );
      const result = generateFirmware('sensor_read', ledMappings, defaultConfig);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('motor_test mode', () => {
    it('generates PWM ramp for PWM-capable pins', () => {
      const result = generateFirmware('motor_test', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('analogWrite');
      expect(result.sketch).toContain('MOTOR');
    });

    it('generates digital toggle for non-PWM pins', () => {
      const motorMappings = inferPinMappings(
        [makeInstance('MOT1', 'DC Motor', { pin: '1' })], // pin 1 is not PWM on UNO
        [],
        'arduino_uno',
      );
      const result = generateFirmware('motor_test', motorMappings, defaultConfig);
      expect(result.sketch).toContain('digitalWrite');
    });

    it('warns when no motors found', () => {
      const result = generateFirmware('motor_test', [], defaultConfig);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('serial_echo mode', () => {
    it('generates serial echo code', () => {
      const result = generateFirmware('serial_echo', [], defaultConfig);
      expect(result.sketch).toContain('Serial.readStringUntil');
      expect(result.sketch).toContain('ECHO');
      expect(result.sketch).toContain('millis()');
    });

    it('uses configured baud rate', () => {
      const result = generateFirmware('serial_echo', [], { ...defaultConfig, baudRate: 115200 });
      expect(result.sketch).toContain('Serial.begin(115200)');
    });
  });

  describe('comprehensive mode', () => {
    it('generates 4-phase test', () => {
      const result = generateFirmware('comprehensive', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('testPhase');
      expect(result.sketch).toContain('case 0:');
      expect(result.sketch).toContain('case 1:');
      expect(result.sketch).toContain('case 2:');
      expect(result.sketch).toContain('case 3:');
    });

    it('includes motor ramp phase', () => {
      const result = generateFirmware('comprehensive', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('Motor ramp');
    });

    it('handles no motors gracefully', () => {
      const noMotorMappings = inferPinMappings(
        [makeInstance('LED1', 'LED'), makeInstance('SW1', 'Button')],
        [],
        'arduino_uno',
      );
      const result = generateFirmware('comprehensive', noMotorMappings, defaultConfig);
      expect(result.sketch).toContain('No motors in design');
    });
  });

  describe('common features', () => {
    it('includes header comment', () => {
      const result = generateFirmware('blink', mixedMappings, {
        ...defaultConfig,
        headerComment: 'My custom comment',
      });
      expect(result.sketch).toContain('My custom comment');
    });

    it('includes pin defines', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('#define PIN_');
    });

    it('includes ProtoPulse header', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.sketch).toContain('ProtoPulse Design-to-Drive');
    });

    it('generates non-verbose sketches', () => {
      const result = generateFirmware('blink', mixedMappings, {
        ...defaultConfig,
        verboseSerial: false,
      });
      // Should still have setup/loop but fewer Serial.println
      expect(result.sketch).toContain('void setup()');
      expect(result.sketch).toContain('Serial.begin');
      // BLINK messages should not be present in non-verbose
      const blinkSerialCount = (result.sketch.match(/Serial\.println.*BLINK/g) ?? []).length;
      expect(blinkSerialCount).toBe(0);
    });

    it('provides a summary', () => {
      const result = generateFirmware('blink', mixedMappings, defaultConfig);
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// DesignToDriveManager
// ---------------------------------------------------------------------------

describe('DesignToDriveManager', () => {
  beforeEach(() => {
    resetDesignToDriveManager();
  });

  it('returns singleton instance', () => {
    const a = getDesignToDriveManager();
    const b = getDesignToDriveManager();
    expect(a).toBe(b);
  });

  it('resets singleton', () => {
    const a = getDesignToDriveManager();
    resetDesignToDriveManager();
    const b = getDesignToDriveManager();
    expect(a).not.toBe(b);
  });

  describe('subscribe/notify', () => {
    it('notifies listeners on analyzeDesign', () => {
      const mgr = getDesignToDriveManager();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      expect(called).toBe(1);
    });

    it('notifies listeners on generate', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.generate('blink');
      expect(called).toBe(1);
    });

    it('notifies listeners on updateConfig', () => {
      const mgr = getDesignToDriveManager();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.updateConfig({ baudRate: 115200 });
      expect(called).toBe(1);
    });

    it('notifies listeners on reset', () => {
      const mgr = getDesignToDriveManager();
      let called = 0;
      mgr.subscribe(() => { called++; });
      mgr.reset();
      expect(called).toBe(1);
    });

    it('unsubscribes correctly', () => {
      const mgr = getDesignToDriveManager();
      let called = 0;
      const unsub = mgr.subscribe(() => { called++; });
      unsub();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      expect(called).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('returns initial snapshot', () => {
      const mgr = getDesignToDriveManager();
      const snap = mgr.getSnapshot();
      expect(snap.pinMappings).toEqual([]);
      expect(snap.instanceCount).toBe(0);
      expect(snap.lastGenerated).toBeNull();
      expect(snap.availableModes).toContain('serial_echo');
    });

    it('reflects analyzed design', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED'), makeInstance('MOT1', 'Motor')], []);
      const snap = mgr.getSnapshot();
      expect(snap.pinMappings.length).toBe(2);
      expect(snap.instanceCount).toBe(2);
      expect(snap.availableModes).toContain('blink');
      expect(snap.availableModes).toContain('motor_test');
    });

    it('reflects last generated firmware', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      mgr.generate('blink');
      const snap = mgr.getSnapshot();
      expect(snap.lastGenerated).not.toBeNull();
      expect(snap.lastGenerated?.mode).toBe('blink');
    });
  });

  describe('analyzeDesign', () => {
    it('returns inferred pin mappings', () => {
      const mgr = getDesignToDriveManager();
      const mappings = mgr.analyzeDesign(
        [makeInstance('LED1', 'LED'), makeInstance('U1', 'Temp Sensor')],
        [],
      );
      expect(mappings.length).toBe(2);
    });

    it('updates available modes based on components', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('MOT1', 'Motor')], []);
      expect(mgr.getAvailableModes()).toContain('motor_test');
    });

    it('records instance count', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign(
        [makeInstance('LED1', 'LED'), makeInstance('R1', 'Resistor'), makeInstance('C1', 'Cap')],
        [],
      );
      expect(mgr.getSnapshot().instanceCount).toBe(3);
    });
  });

  describe('updateConfig', () => {
    it('merges partial config', () => {
      const mgr = getDesignToDriveManager();
      mgr.updateConfig({ baudRate: 115200, boardType: 'esp32' });
      const config = mgr.getConfig();
      expect(config.baudRate).toBe(115200);
      expect(config.boardType).toBe('esp32');
      // Unchanged defaults
      expect(config.delayMs).toBe(1000);
      expect(config.verboseSerial).toBe(true);
    });
  });

  describe('generate', () => {
    it('generates firmware for given mode', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      const result = mgr.generate('blink');
      expect(result.sketch).toContain('void setup()');
      expect(result.mode).toBe('blink');
    });

    it('stores last generated result', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      mgr.generate('blink');
      expect(mgr.getSnapshot().lastGenerated?.mode).toBe('blink');
      mgr.generate('serial_echo');
      expect(mgr.getSnapshot().lastGenerated?.mode).toBe('serial_echo');
    });
  });

  describe('generateAll', () => {
    it('generates firmware for all available modes', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign(
        [makeInstance('LED1', 'LED'), makeInstance('MOT1', 'Motor'), makeInstance('U1', 'Sensor')],
        [],
      );
      const results = mgr.generateAll();
      const modes = results.map((r) => r.mode);
      expect(modes).toContain('blink');
      expect(modes).toContain('motor_test');
      expect(modes).toContain('sensor_read');
      expect(modes).toContain('serial_echo');
      expect(modes).toContain('comprehensive');
    });

    it('returns empty array when no modes available (edge case — should not happen)', () => {
      // Force empty modes by not analyzing
      const mgr = getDesignToDriveManager();
      // Available modes always have at least serial_echo, comprehensive, io_scan
      const results = mgr.generateAll();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getTestsForCategory', () => {
    it('returns correct tests for led', () => {
      const mgr = getDesignToDriveManager();
      const tests = mgr.getTestsForCategory('led');
      expect(tests).toContain('blink');
      expect(tests).toContain('io_scan');
    });

    it('returns empty array for capacitor', () => {
      const mgr = getDesignToDriveManager();
      const tests = mgr.getTestsForCategory('capacitor');
      expect(tests).toEqual([]);
    });
  });

  describe('classifyInstance', () => {
    it('delegates to classifyComponent', () => {
      const mgr = getDesignToDriveManager();
      expect(mgr.classifyInstance(makeInstance('LED1', 'Red LED'))).toBe('led');
      expect(mgr.classifyInstance(makeInstance('MOT1', 'Servo Motor'))).toBe('motor');
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      mgr.generate('blink');
      mgr.updateConfig({ baudRate: 115200 });

      mgr.reset();
      const snap = mgr.getSnapshot();
      expect(snap.pinMappings).toEqual([]);
      expect(snap.instanceCount).toBe(0);
      expect(snap.lastGenerated).toBeNull();
      expect(snap.config.baudRate).toBe(9600);
    });
  });

  describe('getPinMappings / getAvailableModes', () => {
    it('returns copies', () => {
      const mgr = getDesignToDriveManager();
      mgr.analyzeDesign([makeInstance('LED1', 'LED')], []);
      const a = mgr.getPinMappings();
      const b = mgr.getPinMappings();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);

      const c = mgr.getAvailableModes();
      const d = mgr.getAvailableModes();
      expect(c).toEqual(d);
      expect(c).not.toBe(d);
    });
  });
});
