import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MCU_TEMPLATES,
  validateBoardDefinition,
  inferMcuFromCircuit,
  generatePlatformIOConfig,
  generateBoardsTxt,
  generatePinsArduinoH,
  CustomBoardManager,
} from '../custom-board-def';
import type {
  CustomBoardDefinition,
  PinDefinition,
  McuTemplate,
  CircuitInstanceForInference,
} from '../custom-board-def';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock crypto.randomUUID
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Helper: create a valid board definition
// ---------------------------------------------------------------------------

function makeBoard(overrides: Partial<CustomBoardDefinition> = {}): CustomBoardDefinition {
  return {
    id: 'test-board-1',
    name: 'My Custom Board',
    mcuTemplateId: 'atmega328p',
    pins: MCU_TEMPLATES.find((t) => t.id === 'atmega328p')!.pins.slice(),
    variant: 'my_custom_board',
    fqbn: 'custom:avr:my_custom_board',
    description: 'A test board',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MCU Templates
// ---------------------------------------------------------------------------

describe('MCU_TEMPLATES', () => {
  it('has 6 templates', () => {
    expect(MCU_TEMPLATES).toHaveLength(6);
  });

  it('includes ATmega328P', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'atmega328p');
    expect(t).toBeDefined();
    expect(t!.name).toBe('ATmega328P');
    expect(t!.architecture).toBe('avr');
    expect(t!.clockSpeedMHz).toBe(16);
    expect(t!.flashKB).toBe(32);
    expect(t!.ramKB).toBe(2);
    expect(t!.operatingVoltage).toBe(5.0);
  });

  it('includes ATmega2560', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'atmega2560');
    expect(t).toBeDefined();
    expect(t!.flashKB).toBe(256);
    expect(t!.ramKB).toBe(8);
    expect(t!.adcChannels).toBe(16);
  });

  it('includes ESP32', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'esp32');
    expect(t).toBeDefined();
    expect(t!.architecture).toBe('esp32');
    expect(t!.clockSpeedMHz).toBe(240);
    expect(t!.operatingVoltage).toBe(3.3);
  });

  it('includes ESP32-S3', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'esp32s3');
    expect(t).toBeDefined();
    expect(t!.flashKB).toBe(8192);
    expect(t!.ramKB).toBe(512);
  });

  it('includes STM32F103', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'stm32f103');
    expect(t).toBeDefined();
    expect(t!.architecture).toBe('stm32');
    expect(t!.clockSpeedMHz).toBe(72);
  });

  it('includes RP2040', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040');
    expect(t).toBeDefined();
    expect(t!.architecture).toBe('rp2040');
    expect(t!.clockSpeedMHz).toBe(133);
    expect(t!.ramKB).toBe(264);
  });

  it('all templates have non-empty pins', () => {
    for (const t of MCU_TEMPLATES) {
      expect(t.pins.length).toBeGreaterThan(0);
    }
  });

  it('all templates have valid fqbnBase format', () => {
    const fqbnRegex = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;
    for (const t of MCU_TEMPLATES) {
      expect(fqbnRegex.test(t.fqbnBase)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Pin Definitions
// ---------------------------------------------------------------------------

describe('Pin Definitions', () => {
  it('ATmega328P has 20 pins (D0-D13 + A0-A5)', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'atmega328p')!;
    expect(t.pins).toHaveLength(20);
  });

  it('ATmega328P has SPI pins on D10-D13', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'atmega328p')!;
    const spiPins = t.pins.filter((p) => p.capabilities.includes('spi'));
    expect(spiPins.length).toBe(4);
    expect(spiPins.map((p) => p.spi!.role).sort()).toEqual(['MISO', 'MOSI', 'SCK', 'SS']);
  });

  it('ATmega328P has I2C on A4/A5', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'atmega328p')!;
    const i2cPins = t.pins.filter((p) => p.capabilities.includes('i2c'));
    expect(i2cPins).toHaveLength(2);
    expect(i2cPins.map((p) => p.i2c!.role).sort()).toEqual(['SCL', 'SDA']);
  });

  it('ESP32 has DAC-capable pins', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'esp32')!;
    const dacPins = t.pins.filter((p) => p.capabilities.includes('dac'));
    expect(dacPins.length).toBeGreaterThanOrEqual(2);
  });

  it('ESP32 has touch-capable pins', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'esp32')!;
    const touchPins = t.pins.filter((p) => p.capabilities.includes('touch'));
    expect(touchPins.length).toBeGreaterThan(0);
  });

  it('RP2040 has 30 GPIO pins', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040')!;
    expect(t.pins).toHaveLength(30);
  });

  it('RP2040 pins are named GP0-GP29', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040')!;
    expect(t.pins[0].name).toBe('GP0');
    expect(t.pins[29].name).toBe('GP29');
  });

  it('RP2040 has ADC on GP26-GP29', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040')!;
    const analogPins = t.pins.filter((p) => p.capabilities.includes('analog'));
    expect(analogPins).toHaveLength(4);
    expect(analogPins[0].name).toBe('GP26');
    expect(analogPins[0].analogChannel).toBe(0);
  });

  it('RP2040 has I2C on GP0-GP3', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040')!;
    const i2cPins = t.pins.filter((p) => p.capabilities.includes('i2c'));
    expect(i2cPins).toHaveLength(4);
  });

  it('RP2040 has SPI on GP16-GP19', () => {
    const t = MCU_TEMPLATES.find((t) => t.id === 'rp2040')!;
    const spiPins = t.pins.filter((p) => p.capabilities.includes('spi'));
    expect(spiPins).toHaveLength(4);
  });

  it('all pins have unique numbers within each template', () => {
    for (const t of MCU_TEMPLATES) {
      const pinNumbers = t.pins.map((p) => p.pin);
      const uniqueNumbers = new Set(pinNumbers);
      expect(uniqueNumbers.size).toBe(pinNumbers.length);
    }
  });

  it('all pins have unique names within each template', () => {
    for (const t of MCU_TEMPLATES) {
      const pinNames = t.pins.map((p) => p.name);
      const uniqueNames = new Set(pinNames);
      expect(uniqueNames.size).toBe(pinNames.length);
    }
  });
});

// ---------------------------------------------------------------------------
// validateBoardDefinition
// ---------------------------------------------------------------------------

describe('validateBoardDefinition', () => {
  it('returns no errors for a valid board', () => {
    const board = makeBoard();
    const issues = validateBoardDefinition(board);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('errors on empty id', () => {
    const board = makeBoard({ id: '' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'id' && i.severity === 'error')).toBe(true);
  });

  it('errors on empty name', () => {
    const board = makeBoard({ name: '  ' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'name' && i.severity === 'error')).toBe(true);
  });

  it('errors on empty variant', () => {
    const board = makeBoard({ variant: '' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'variant' && i.severity === 'error')).toBe(true);
  });

  it('errors on empty fqbn', () => {
    const board = makeBoard({ fqbn: '' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'fqbn' && i.severity === 'error')).toBe(true);
  });

  it('errors on invalid fqbn format', () => {
    const board = makeBoard({ fqbn: 'invalid-fqbn' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'fqbn' && i.message.includes('format'))).toBe(true);
  });

  it('errors on invalid variant format (starts with number)', () => {
    const board = makeBoard({ variant: '123board' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'variant' && i.message.includes('letter'))).toBe(true);
  });

  it('errors on unknown MCU template', () => {
    const board = makeBoard({ mcuTemplateId: 'nonexistent' });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'mcuTemplateId' && i.severity === 'error')).toBe(true);
  });

  it('warns on empty pins', () => {
    const board = makeBoard({ pins: [] });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.field === 'pins' && i.severity === 'warning')).toBe(true);
  });

  it('errors on duplicate pin numbers', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital'] },
      { pin: 0, name: 'D0_dup', gpio: 1, capabilities: ['digital'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('Duplicate pin number'))).toBe(true);
  });

  it('errors on duplicate pin names', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital'] },
      { pin: 1, name: 'D0', gpio: 1, capabilities: ['digital'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('Duplicate pin name'))).toBe(true);
  });

  it('warns on analog capability without analogChannel', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'A0', gpio: 0, capabilities: ['digital', 'analog'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('analogChannel'))).toBe(true);
  });

  it('warns on I2C capability without i2c role', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital', 'i2c'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('I2C role'))).toBe(true);
  });

  it('warns on SPI capability without spi role', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital', 'spi'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('SPI role'))).toBe(true);
  });

  it('warns on UART capability without uart role', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital', 'uart'] },
    ];
    const board = makeBoard({ pins });
    const issues = validateBoardDefinition(board);
    expect(issues.some((i) => i.message.includes('UART role'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inferMcuFromCircuit
// ---------------------------------------------------------------------------

describe('inferMcuFromCircuit', () => {
  it('infers ATmega328P from component type', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'ATmega328P' },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('atmega328p');
  });

  it('infers ATmega2560 from component type', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'ATmega2560' },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('atmega2560');
  });

  it('infers ESP32 from component properties', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'MCU', properties: { model: 'ESP32 Dev Kit' } },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('esp32');
  });

  it('infers ESP32-S3 specifically (before generic ESP32)', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'ESP32-S3 DevKitC' },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('esp32s3');
  });

  it('infers STM32F103 from properties', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'Blue Pill', properties: { mcu: 'STM32F103C8T6' } },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('stm32f103');
  });

  it('infers RP2040 from component type', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'RP2040 Pico' },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('rp2040');
  });

  it('returns null for unknown components', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'LED' },
      { componentType: 'Resistor 10k' },
    ];
    expect(inferMcuFromCircuit(instances)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(inferMcuFromCircuit([])).toBeNull();
  });

  it('scans all instances, not just the first', () => {
    const instances: CircuitInstanceForInference[] = [
      { componentType: 'LED' },
      { componentType: 'Resistor' },
      { componentType: 'ESP32' },
    ];
    expect(inferMcuFromCircuit(instances)).toBe('esp32');
  });
});

// ---------------------------------------------------------------------------
// generatePlatformIOConfig
// ---------------------------------------------------------------------------

describe('generatePlatformIOConfig', () => {
  it('generates valid config for ATmega328P board', () => {
    const board = makeBoard();
    const config = generatePlatformIOConfig(board);
    expect(config).toContain('[env:default]');
    expect(config).toContain('platform = atmelavr');
    expect(config).toContain('framework = arduino');
    expect(config).toContain('upload_speed = 115200');
    expect(config).toContain(`board = ${board.variant}`);
  });

  it('generates ESP32 platform for ESP32 board', () => {
    const board = makeBoard({ mcuTemplateId: 'esp32', variant: 'my_esp32' });
    const config = generatePlatformIOConfig(board);
    expect(config).toContain('platform = espressif32');
    expect(config).toContain('upload_protocol = esptool');
    expect(config).toContain('BOARD_HAS_PSRAM');
  });

  it('generates STM32 platform for STM32 board', () => {
    const board = makeBoard({ mcuTemplateId: 'stm32f103', variant: 'my_stm32' });
    const config = generatePlatformIOConfig(board);
    expect(config).toContain('platform = ststm32');
  });

  it('generates RP2040 platform', () => {
    const board = makeBoard({ mcuTemplateId: 'rp2040', variant: 'my_pico' });
    const config = generatePlatformIOConfig(board);
    expect(config).toContain('platform = raspberrypi');
  });

  it('throws for unknown MCU template', () => {
    const board = makeBoard({ mcuTemplateId: 'nonexistent' });
    expect(() => generatePlatformIOConfig(board)).toThrow('Unknown MCU template');
  });

  it('includes board name in comments', () => {
    const board = makeBoard({ name: 'My Special Board' });
    const config = generatePlatformIOConfig(board);
    expect(config).toContain('My Special Board');
  });
});

// ---------------------------------------------------------------------------
// generateBoardsTxt
// ---------------------------------------------------------------------------

describe('generateBoardsTxt', () => {
  it('generates valid boards.txt entry', () => {
    const board = makeBoard();
    const txt = generateBoardsTxt(board);
    expect(txt).toContain(`${board.variant}.name=${board.name}`);
    expect(txt).toContain(`${board.variant}.build.mcu=atmega328p`);
    expect(txt).toContain(`${board.variant}.build.f_cpu=16000000L`);
    expect(txt).toContain(`${board.variant}.build.variant=${board.variant}`);
  });

  it('calculates correct flash size', () => {
    const board = makeBoard();
    const txt = generateBoardsTxt(board);
    // ATmega328P = 32KB = 32768 bytes
    expect(txt).toContain('upload.maximum_size=32768');
  });

  it('uses correct upload protocol', () => {
    const board = makeBoard();
    const txt = generateBoardsTxt(board);
    expect(txt).toContain('upload.protocol=arduino');
  });

  it('generates ESP32 boards.txt with correct MCU', () => {
    const board = makeBoard({ mcuTemplateId: 'esp32', variant: 'my_esp' });
    const txt = generateBoardsTxt(board);
    expect(txt).toContain('build.mcu=esp32');
    expect(txt).toContain('build.f_cpu=240000000L');
  });

  it('throws for unknown MCU template', () => {
    const board = makeBoard({ mcuTemplateId: 'nonexistent' });
    expect(() => generateBoardsTxt(board)).toThrow('Unknown MCU template');
  });
});

// ---------------------------------------------------------------------------
// generatePinsArduinoH
// ---------------------------------------------------------------------------

describe('generatePinsArduinoH', () => {
  it('generates valid header with include guard', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#ifndef PINS_MY_CUSTOM_BOARD_H');
    expect(header).toContain('#define PINS_MY_CUSTOM_BOARD_H');
    expect(header).toContain('#endif');
  });

  it('defines NUM_DIGITAL_PINS and NUM_ANALOG_INPUTS', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#define NUM_DIGITAL_PINS');
    expect(header).toContain('#define NUM_ANALOG_INPUTS');
  });

  it('defines LED_BUILTIN', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#define LED_BUILTIN');
  });

  it('defines I2C pins (SDA/SCL)', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#define PIN_WIRE_SDA');
    expect(header).toContain('#define PIN_WIRE_SCL');
    expect(header).toContain('static const uint8_t SDA');
    expect(header).toContain('static const uint8_t SCL');
  });

  it('defines SPI pins', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#define PIN_SPI_MOSI');
    expect(header).toContain('#define PIN_SPI_MISO');
    expect(header).toContain('#define PIN_SPI_SCK');
    expect(header).toContain('#define PIN_SPI_SS');
  });

  it('defines UART pins', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('#define PIN_SERIAL_TX');
    expect(header).toContain('#define PIN_SERIAL_RX');
  });

  it('includes MCU name in comment', () => {
    const board = makeBoard();
    const header = generatePinsArduinoH(board);
    expect(header).toContain('ATmega328P');
  });

  it('throws for unknown MCU template', () => {
    const board = makeBoard({ mcuTemplateId: 'nonexistent' });
    expect(() => generatePinsArduinoH(board)).toThrow('Unknown MCU template');
  });

  it('handles board with no analog pins', () => {
    const pins: PinDefinition[] = [
      { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital'] },
    ];
    const board = makeBoard({ pins });
    const header = generatePinsArduinoH(board);
    expect(header).toContain('NUM_ANALOG_INPUTS 0');
    expect(header).not.toContain('PIN_A0');
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — singleton + lifecycle
// ---------------------------------------------------------------------------

describe('CustomBoardManager', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('returns singleton instance', () => {
    const a = CustomBoardManager.getInstance();
    const b = CustomBoardManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates fresh instance', () => {
    const a = CustomBoardManager.getInstance();
    CustomBoardManager.resetInstance();
    const b = CustomBoardManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('starts with empty boards', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getBoards()).toHaveLength(0);
  });

  it('getTemplates returns all MCU templates', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getTemplates()).toHaveLength(6);
  });

  it('getTemplate finds by id', () => {
    const mgr = CustomBoardManager.getInstance();
    const t = mgr.getTemplate('esp32');
    expect(t).toBeDefined();
    expect(t!.name).toBe('ESP32');
  });

  it('getTemplate returns undefined for unknown', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getTemplate('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — CRUD
// ---------------------------------------------------------------------------

describe('CustomBoardManager — CRUD', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('createBoard adds a board from template', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('My Uno Clone', 'atmega328p', 'uno_clone');
    expect(board.name).toBe('My Uno Clone');
    expect(board.mcuTemplateId).toBe('atmega328p');
    expect(board.variant).toBe('uno_clone');
    expect(board.fqbn).toBe('custom:avr:uno_clone');
    expect(board.pins.length).toBe(20); // ATmega328P pin count
    expect(mgr.getBoards()).toHaveLength(1);
  });

  it('createBoard throws for unknown template', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.createBoard('Bad', 'nonexistent', 'bad')).toThrow('Unknown MCU template');
  });

  it('createBoard with description', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Rover Board', 'esp32', 'rover_v1', 'OmniTrek Nexus rover controller');
    expect(board.description).toBe('OmniTrek Nexus rover controller');
  });

  it('createBoard persists to localStorage', () => {
    const mgr = CustomBoardManager.getInstance();
    mgr.createBoard('Test', 'rp2040', 'test_board');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('getBoard finds by id', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'esp32', 'test');
    const found = mgr.getBoard(board.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test');
  });

  it('getBoard returns undefined for unknown id', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getBoard('nonexistent')).toBeUndefined();
  });

  it('updateBoard modifies fields', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Old Name', 'atmega328p', 'old_variant');
    const updated = mgr.updateBoard(board.id, { name: 'New Name', description: 'Updated desc' });
    expect(updated.name).toBe('New Name');
    expect(updated.description).toBe('Updated desc');
    expect(updated.updatedAt).not.toBe(board.updatedAt);
  });

  it('updateBoard throws for unknown id', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.updateBoard('nonexistent', { name: 'X' })).toThrow('Board not found');
  });

  it('deleteBoard removes the board', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Temp', 'rp2040', 'temp');
    expect(mgr.getBoards()).toHaveLength(1);
    const result = mgr.deleteBoard(board.id);
    expect(result).toBe(true);
    expect(mgr.getBoards()).toHaveLength(0);
  });

  it('deleteBoard returns false for unknown id', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.deleteBoard('nonexistent')).toBe(false);
  });

  it('subscribe notifies on create', () => {
    const mgr = CustomBoardManager.getInstance();
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.createBoard('Test', 'esp32', 'test');
    expect(called).toBeGreaterThan(0);
  });

  it('subscribe notifies on update', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'esp32', 'test');
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.updateBoard(board.id, { name: 'Updated' });
    expect(called).toBeGreaterThan(0);
  });

  it('subscribe notifies on delete', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'esp32', 'test');
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.deleteBoard(board.id);
    expect(called).toBeGreaterThan(0);
  });

  it('unsubscribe stops notifications', () => {
    const mgr = CustomBoardManager.getInstance();
    let called = 0;
    const unsub = mgr.subscribe(() => { called++; });
    unsub();
    mgr.createBoard('Test', 'esp32', 'test');
    expect(called).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — validation
// ---------------------------------------------------------------------------

describe('CustomBoardManager — validate', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('validate returns issues for a board', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'atmega328p', 'test');
    const issues = mgr.validate(board.id);
    // A valid board from template should have no errors
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('validate returns error for unknown board', () => {
    const mgr = CustomBoardManager.getInstance();
    const issues = mgr.validate('nonexistent');
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — inference
// ---------------------------------------------------------------------------

describe('CustomBoardManager — inferFromCircuit', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
  });

  it('returns template for matching MCU', () => {
    const mgr = CustomBoardManager.getInstance();
    const result = mgr.inferFromCircuit([{ componentType: 'ATmega328P' }]);
    expect(result).toBeDefined();
    expect(result!.id).toBe('atmega328p');
  });

  it('returns null for no match', () => {
    const mgr = CustomBoardManager.getInstance();
    const result = mgr.inferFromCircuit([{ componentType: 'LED' }]);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — code generation
// ---------------------------------------------------------------------------

describe('CustomBoardManager — code generation', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('generatePlatformIO throws for unknown board', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.generatePlatformIO('nonexistent')).toThrow('Board not found');
  });

  it('generatePlatformIO returns valid config', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'esp32', 'test_esp');
    const config = mgr.generatePlatformIO(board.id);
    expect(config).toContain('[env:default]');
    expect(config).toContain('espressif32');
  });

  it('generateBoardsTxt throws for unknown board', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.generateBoardsTxt('nonexistent')).toThrow('Board not found');
  });

  it('generateBoardsTxt returns valid entry', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('My Board', 'atmega328p', 'my_board');
    const txt = mgr.generateBoardsTxt(board.id);
    expect(txt).toContain('my_board.name=My Board');
  });

  it('generatePinsHeader throws for unknown board', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.generatePinsHeader('nonexistent')).toThrow('Board not found');
  });

  it('generatePinsHeader returns valid C header', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Test', 'stm32f103', 'test_stm');
    const header = mgr.generatePinsHeader(board.id);
    expect(header).toContain('#ifndef PINS_TEST_STM_H');
    expect(header).toContain('STM32F103');
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — export/import
// ---------------------------------------------------------------------------

describe('CustomBoardManager — export/import', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('exports board as JSON', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Export Test', 'esp32', 'export_test');
    const json = mgr.exportBoard(board.id);
    const parsed = JSON.parse(json) as { version: number; board: CustomBoardDefinition };
    expect(parsed.version).toBe(1);
    expect(parsed.board.name).toBe('Export Test');
  });

  it('exportBoard throws for unknown board', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.exportBoard('nonexistent')).toThrow('Board not found');
  });

  it('imports board from JSON', () => {
    const mgr = CustomBoardManager.getInstance();
    const board = mgr.createBoard('Original', 'rp2040', 'original');
    const json = mgr.exportBoard(board.id);

    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    const mgr2 = CustomBoardManager.getInstance();
    const imported = mgr2.importBoard(json);
    expect(imported.name).toBe('Original');
    expect(imported.id).not.toBe(board.id); // New UUID assigned
    expect(mgr2.getBoards()).toHaveLength(1);
  });

  it('import rejects invalid format', () => {
    const mgr = CustomBoardManager.getInstance();
    expect(() => mgr.importBoard('{"version": 2}')).toThrow('Invalid board definition format');
  });

  it('import rejects board with validation errors', () => {
    const mgr = CustomBoardManager.getInstance();
    const invalidJson = JSON.stringify({
      version: 1,
      board: {
        id: 'x',
        name: '', // Error: empty name
        mcuTemplateId: 'atmega328p',
        pins: [],
        variant: 'test',
        fqbn: 'custom:avr:test',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(() => mgr.importBoard(invalidJson)).toThrow('Invalid board definition');
  });
});

// ---------------------------------------------------------------------------
// CustomBoardManager — localStorage persistence
// ---------------------------------------------------------------------------

describe('CustomBoardManager — persistence', () => {
  beforeEach(() => {
    CustomBoardManager.resetInstance();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('loads boards from localStorage on init', () => {
    const boards: CustomBoardDefinition[] = [makeBoard()];
    localStorageMock.setItem('protopulse-custom-boards', JSON.stringify(boards));

    CustomBoardManager.resetInstance();
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getBoards()).toHaveLength(1);
    expect(mgr.getBoards()[0].name).toBe('My Custom Board');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.setItem('protopulse-custom-boards', 'not-valid-json');

    CustomBoardManager.resetInstance();
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getBoards()).toHaveLength(0);
  });

  it('handles non-array localStorage data gracefully', () => {
    localStorageMock.setItem('protopulse-custom-boards', JSON.stringify({ not: 'array' }));

    CustomBoardManager.resetInstance();
    const mgr = CustomBoardManager.getInstance();
    expect(mgr.getBoards()).toHaveLength(0);
  });
});
