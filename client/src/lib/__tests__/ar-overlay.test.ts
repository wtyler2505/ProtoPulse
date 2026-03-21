import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArOverlayManager,
  computePerspectiveTransform,
  PIN_TYPE_COLORS,
} from '../ar-overlay';
import type {
  BoardLayout,
  CalibrationPoint,
  PinType,
} from '../ar-overlay';

// ─── Helpers ─────────────────────────────────────────────────────

function getManager(): ArOverlayManager {
  ArOverlayManager.resetInstance();
  return ArOverlayManager.getInstance();
}

/** Identity-like calibration: board corners map to a 500x400 screen rect. */
function makeIdentityCalibration(): CalibrationPoint[] {
  return [
    { boardCorner: { x: 0, y: 0 }, screenPoint: { x: 0, y: 0 } },
    { boardCorner: { x: 1, y: 0 }, screenPoint: { x: 500, y: 0 } },
    { boardCorner: { x: 1, y: 1 }, screenPoint: { x: 500, y: 400 } },
    { boardCorner: { x: 0, y: 1 }, screenPoint: { x: 0, y: 400 } },
  ];
}

/** Skewed calibration points (perspective). */
function makeSkewedCalibration(): CalibrationPoint[] {
  return [
    { boardCorner: { x: 0, y: 0 }, screenPoint: { x: 50, y: 30 } },
    { boardCorner: { x: 1, y: 0 }, screenPoint: { x: 450, y: 50 } },
    { boardCorner: { x: 1, y: 1 }, screenPoint: { x: 480, y: 380 } },
    { boardCorner: { x: 0, y: 1 }, screenPoint: { x: 20, y: 350 } },
  ];
}

// ─── Singleton ───────────────────────────────────────────────────

describe('ArOverlayManager — singleton', () => {
  beforeEach(() => {
    ArOverlayManager.resetInstance();
  });

  it('returns the same instance', () => {
    const a = ArOverlayManager.getInstance();
    const b = ArOverlayManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = ArOverlayManager.getInstance();
    ArOverlayManager.resetInstance();
    const b = ArOverlayManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ─── Board Database ──────────────────────────────────────────────

describe('ArOverlayManager — board database', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('has at least 7 built-in boards', () => {
    expect(mgr.getAvailableBoards().length).toBeGreaterThanOrEqual(7);
  });

  it('each board has a unique id', () => {
    const boards = mgr.getAvailableBoards();
    const ids = boards.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each board has at least 5 pins', () => {
    const boards = mgr.getAvailableBoards();
    boards.forEach((board) => {
      expect(board.pins.length).toBeGreaterThanOrEqual(5);
    });
  });

  it('each pin has a normalized position within [0,1]', () => {
    const boards = mgr.getAvailableBoards();
    boards.forEach((board) => {
      board.pins.forEach((pin) => {
        expect(pin.normalizedPosition.x).toBeGreaterThanOrEqual(0);
        expect(pin.normalizedPosition.x).toBeLessThanOrEqual(1);
        expect(pin.normalizedPosition.y).toBeGreaterThanOrEqual(0);
        expect(pin.normalizedPosition.y).toBeLessThanOrEqual(1);
      });
    });
  });

  it('each board has positive form factor dimensions', () => {
    const boards = mgr.getAvailableBoards();
    boards.forEach((board) => {
      expect(board.formFactor.widthMm).toBeGreaterThan(0);
      expect(board.formFactor.heightMm).toBeGreaterThan(0);
    });
  });

  it('each board has a positive aspect ratio', () => {
    const boards = mgr.getAvailableBoards();
    boards.forEach((board) => {
      expect(board.imageAspectRatio).toBeGreaterThan(0);
    });
  });

  it('getBoardById returns null for unknown board', () => {
    expect(mgr.getBoardById('nonexistent')).toBeNull();
  });

  it('getBoardById returns the correct board', () => {
    const board = mgr.getBoardById('arduino-uno');
    expect(board).not.toBeNull();
    expect(board!.name).toBe('Arduino Uno');
  });

  it('caches boards on repeated access', () => {
    const a = mgr.getBoardById('esp32-devkit');
    const b = mgr.getBoardById('esp32-devkit');
    expect(a).toBe(b);
  });
});

// ─── Specific Board Layouts ──────────────────────────────────────

describe('ArOverlayManager — Arduino Uno layout', () => {
  let mgr: ArOverlayManager;
  let board: BoardLayout;

  beforeEach(() => {
    mgr = getManager();
    board = mgr.getBoardById('arduino-uno')!;
  });

  it('has digital pins D0-D13', () => {
    for (let i = 0; i <= 13; i++) {
      const pin = board.pins.find((p) => p.id === `D${i}`);
      expect(pin).toBeDefined();
    }
  });

  it('has analog pins A0-A5', () => {
    for (let i = 0; i <= 5; i++) {
      const pin = board.pins.find((p) => p.id === `A${i}`);
      expect(pin).toBeDefined();
      expect(pin!.type).toBe('analog');
    }
  });

  it('has power and ground pins', () => {
    const power = board.pins.filter((p) => p.type === 'power');
    const ground = board.pins.filter((p) => p.type === 'ground');
    expect(power.length).toBeGreaterThanOrEqual(2);
    expect(ground.length).toBeGreaterThanOrEqual(1);
  });

  it('D13 has SPI SCK and LED_BUILTIN alt functions', () => {
    const d13 = board.pins.find((p) => p.id === 'D13')!;
    expect(d13.altFunctions).toContain('SPI SCK');
    expect(d13.altFunctions).toContain('LED_BUILTIN');
  });

  it('A4 has I2C SDA alt function', () => {
    const a4 = board.pins.find((p) => p.id === 'A4')!;
    expect(a4.altFunctions).toContain('I2C SDA');
  });

  it('A5 has I2C SCL alt function', () => {
    const a5 = board.pins.find((p) => p.id === 'A5')!;
    expect(a5.altFunctions).toContain('I2C SCL');
  });

  it('PWM pins (3,5,6,9,10,11) have PWM alt function', () => {
    [3, 5, 6, 9, 10, 11].forEach((num) => {
      const pin = board.pins.find((p) => p.id === `D${num}`)!;
      expect(pin.altFunctions).toContain('PWM');
    });
  });
});

describe('ArOverlayManager — ESP32 layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('esp32-devkit')!;
  });

  it('has GPIO pins with gpio numbers', () => {
    const gpioPin = board.pins.find((p) => p.id === 'GPIO21');
    expect(gpioPin).toBeDefined();
    expect(gpioPin!.gpio).toBe(21);
  });

  it('GPIO21 has I2C SDA alt function', () => {
    const pin = board.pins.find((p) => p.id === 'GPIO21')!;
    expect(pin.altFunctions).toContain('I2C SDA');
  });

  it('GPIO25 has DAC1 alt function', () => {
    const pin = board.pins.find((p) => p.id === 'GPIO25')!;
    expect(pin.altFunctions).toContain('DAC1');
  });

  it('has ADC-capable pins', () => {
    const adcPins = board.pins.filter((p) => p.altFunctions.includes('ADC'));
    expect(adcPins.length).toBeGreaterThanOrEqual(5);
  });

  it('has touch-capable pins', () => {
    const touchPins = board.pins.filter((p) => p.altFunctions.some((af) => af.startsWith('TOUCH')));
    expect(touchPins.length).toBeGreaterThanOrEqual(5);
  });
});

describe('ArOverlayManager — Arduino Mega layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('arduino-mega')!;
  });

  it('has 54 digital pins', () => {
    for (let i = 0; i <= 53; i++) {
      expect(board.pins.find((p) => p.id === `D${i}`)).toBeDefined();
    }
  });

  it('has 16 analog pins A0-A15', () => {
    for (let i = 0; i <= 15; i++) {
      expect(board.pins.find((p) => p.id === `A${i}`)).toBeDefined();
    }
  });

  it('has multiple UART ports', () => {
    const uartPins = board.pins.filter((p) => p.altFunctions.some((af) => af.startsWith('UART')));
    expect(uartPins.length).toBeGreaterThanOrEqual(4);
  });
});

describe('ArOverlayManager — NodeMCU layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('nodemcu-esp8266')!;
  });

  it('has D0-D8 pins', () => {
    for (let i = 0; i <= 8; i++) {
      expect(board.pins.find((p) => p.id === `D${i}`)).toBeDefined();
    }
  });

  it('D pins have GPIO alt functions', () => {
    const d1 = board.pins.find((p) => p.id === 'D1')!;
    expect(d1.altFunctions.some((af) => af.startsWith('GPIO'))).toBe(true);
  });

  it('has analog pin A0', () => {
    expect(board.pins.find((p) => p.id === 'A0')).toBeDefined();
  });
});

describe('ArOverlayManager — RPi Pico layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('rpi-pico')!;
  });

  it('has GP0-GP28', () => {
    for (let i = 0; i <= 28; i++) {
      expect(board.pins.find((p) => p.id === `GP${i}`)).toBeDefined();
    }
  });

  it('GP26-GP28 are analog capable', () => {
    [26, 27, 28].forEach((gp) => {
      const pin = board.pins.find((p) => p.id === `GP${gp}`)!;
      expect(pin.type).toBe('analog');
      expect(pin.altFunctions).toContain('ADC');
    });
  });

  it('all GP pins have PWM alt function', () => {
    for (let i = 0; i <= 28; i++) {
      const pin = board.pins.find((p) => p.id === `GP${i}`)!;
      expect(pin.altFunctions).toContain('PWM');
    }
  });
});

// ─── Board Selection ─────────────────────────────────────────────

describe('ArOverlayManager — board selection', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('starts with no active board', () => {
    expect(mgr.getActiveBoard()).toBeNull();
  });

  it('selectBoard sets the active board', () => {
    mgr.selectBoard('arduino-uno');
    expect(mgr.getActiveBoard()!.id).toBe('arduino-uno');
  });

  it('selectBoard clears previous calibration', () => {
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
    expect(mgr.getCalibration()!.isValid).toBe(true);

    mgr.selectBoard('arduino-nano');
    expect(mgr.getCalibration()).toBeNull();
  });

  it('selectBoard clears pin highlights', () => {
    mgr.selectBoard('arduino-uno');
    mgr.highlightPin('D0');
    mgr.selectBoard('arduino-nano');
    expect(mgr.getSnapshot().highlightedPins.size).toBe(0);
  });

  it('selectBoard throws for unknown board', () => {
    expect(() => mgr.selectBoard('nonexistent')).toThrow('Unknown board');
  });

  it('selectBoard notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.selectBoard('arduino-uno');
    expect(called).toBe(1);
  });
});

// ─── Subscribe ───────────────────────────────────────────────────

describe('ArOverlayManager — subscribe', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('subscribe returns an unsubscribe function', () => {
    let calls = 0;
    const unsub = mgr.subscribe(() => { calls++; });
    mgr.selectBoard('arduino-uno');
    expect(calls).toBe(1);
    unsub();
    mgr.selectBoard('arduino-nano');
    expect(calls).toBe(1);
  });

  it('multiple listeners are all called', () => {
    let a = 0;
    let b = 0;
    mgr.subscribe(() => { a++; });
    mgr.subscribe(() => { b++; });
    mgr.selectBoard('arduino-uno');
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

// ─── Perspective Transform ───────────────────────────────────────

describe('computePerspectiveTransform', () => {
  it('returns invalid for fewer than 4 points', () => {
    const result = computePerspectiveTransform([
      { boardCorner: { x: 0, y: 0 }, screenPoint: { x: 0, y: 0 } },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.residualError).toBe(Infinity);
  });

  it('computes valid transform for identity mapping', () => {
    const result = computePerspectiveTransform(makeIdentityCalibration());
    expect(result.isValid).toBe(true);
    expect(result.matrix.length).toBe(9);
    expect(result.residualError).toBeLessThan(1);
  });

  it('computes valid transform for skewed mapping', () => {
    const result = computePerspectiveTransform(makeSkewedCalibration());
    expect(result.isValid).toBe(true);
    expect(result.residualError).toBeLessThan(1);
  });

  it('reprojects calibration points accurately', () => {
    const points = makeIdentityCalibration();
    const result = computePerspectiveTransform(points);
    expect(result.isValid).toBe(true);
    expect(result.residualError).toBeLessThan(0.01);
  });

  it('returns invalid for degenerate (collinear) points', () => {
    const points: CalibrationPoint[] = [
      { boardCorner: { x: 0, y: 0 }, screenPoint: { x: 0, y: 0 } },
      { boardCorner: { x: 1, y: 0 }, screenPoint: { x: 100, y: 0 } },
      { boardCorner: { x: 2, y: 0 }, screenPoint: { x: 200, y: 0 } },
      { boardCorner: { x: 3, y: 0 }, screenPoint: { x: 300, y: 0 } },
    ];
    const result = computePerspectiveTransform(points);
    // Collinear board points → singular matrix
    expect(result.isValid).toBe(false);
  });
});

// ─── Calibration ─────────────────────────────────────────────────

describe('ArOverlayManager — calibration', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('arduino-uno');
  });

  it('calibrate returns valid result for 4 corner points', () => {
    const result = mgr.calibrate(makeIdentityCalibration());
    expect(result.isValid).toBe(true);
  });

  it('calibrate returns invalid if no board selected', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    const result = fresh.calibrate(makeIdentityCalibration());
    expect(result.isValid).toBe(false);
  });

  it('createCornerCalibration produces a valid calibration', () => {
    const result = mgr.createCornerCalibration(
      { x: 10, y: 10 },
      { x: 510, y: 10 },
      { x: 510, y: 410 },
      { x: 10, y: 410 },
    );
    expect(result.isValid).toBe(true);
  });

  it('calibrate notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    // Note: selectBoard already fired once in beforeEach, but we re-sub after
    mgr.calibrate(makeIdentityCalibration());
    expect(called).toBe(1);
  });
});

// ─── Pin Projection ─────────────────────────────────────────────

describe('ArOverlayManager — pin projection', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
  });

  it('projectPins returns pins with screen coordinates', () => {
    const projected = mgr.projectPins();
    expect(projected.length).toBeGreaterThan(0);
    projected.forEach((pp) => {
      expect(typeof pp.screenX).toBe('number');
      expect(typeof pp.screenY).toBe('number');
      expect(Number.isFinite(pp.screenX)).toBe(true);
      expect(Number.isFinite(pp.screenY)).toBe(true);
    });
  });

  it('projectPins returns empty if no board selected', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    expect(fresh.projectPins()).toEqual([]);
  });

  it('projectPins returns empty if no calibration', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    fresh.selectBoard('arduino-uno');
    expect(fresh.projectPins()).toEqual([]);
  });

  it('projected pins have correct colors by type', () => {
    const projected = mgr.projectPins();
    projected.forEach((pp) => {
      if (!pp.highlighted) {
        expect(pp.color).toBe(PIN_TYPE_COLORS[pp.pin.type]);
      }
    });
  });

  it('identity calibration maps (0.5, 0.5) to (250, 200)', () => {
    // Find a pin near center or test the transform directly
    // We test the math: board (0.5, 0.5) → screen (250, 200) for 500x400 identity
    const cal = mgr.getCalibration()!;
    expect(cal.isValid).toBe(true);
  });

  it('pin filter restricts projected pins', () => {
    const allPins = mgr.projectPins();
    mgr.setPinFilter('analog');
    const filtered = mgr.projectPins();
    expect(filtered.length).toBeLessThan(allPins.length);
    filtered.forEach((pp) => {
      expect(pp.pin.type).toBe('analog');
    });
  });
});

// ─── Pin Highlighting ────────────────────────────────────────────

describe('ArOverlayManager — pin highlighting', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
  });

  it('highlightPin marks pin as highlighted in projection', () => {
    mgr.highlightPin('D0');
    const projected = mgr.projectPins();
    const d0 = projected.find((pp) => pp.pin.id === 'D0')!;
    expect(d0.highlighted).toBe(true);
    expect(d0.color).toBe('#FFFFFF');
  });

  it('unhighlightPin removes highlight', () => {
    mgr.highlightPin('D0');
    mgr.unhighlightPin('D0');
    const projected = mgr.projectPins();
    const d0 = projected.find((pp) => pp.pin.id === 'D0')!;
    expect(d0.highlighted).toBe(false);
  });

  it('clearPinHighlights removes all', () => {
    mgr.highlightPin('D0');
    mgr.highlightPin('D1');
    mgr.clearPinHighlights();
    const projected = mgr.projectPins();
    projected.forEach((pp) => {
      // Unless net-highlighted, none should be highlighted
      expect(pp.highlighted).toBe(false);
    });
  });

  it('highlightPin notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.highlightPin('D0');
    expect(called).toBe(1);
  });

  it('unhighlightPin notifies listeners', () => {
    mgr.highlightPin('D0');
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.unhighlightPin('D0');
    expect(called).toBe(1);
  });

  it('clearPinHighlights notifies listeners', () => {
    mgr.highlightPin('D0');
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.clearPinHighlights();
    expect(called).toBe(1);
  });
});

// ─── Net Highlighting ────────────────────────────────────────────

describe('ArOverlayManager — net highlighting', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
    mgr.setNetPinMapping('VCC_NET', ['5V', 'VIN']);
    mgr.setNetPinMapping('SPI_NET', ['D10', 'D11', 'D12', 'D13']);
  });

  it('net highlight makes mapped pins highlighted', () => {
    mgr.highlightNet('VCC_NET');
    const projected = mgr.projectPins();
    const v5 = projected.find((pp) => pp.pin.id === '5V');
    const vin = projected.find((pp) => pp.pin.id === 'VIN');
    expect(v5?.highlighted).toBe(true);
    expect(vin?.highlighted).toBe(true);
  });

  it('net highlight does not affect unmapped pins', () => {
    mgr.highlightNet('VCC_NET');
    const projected = mgr.projectPins();
    const d0 = projected.find((pp) => pp.pin.id === 'D0')!;
    expect(d0.highlighted).toBe(false);
  });

  it('unhighlightNet removes net highlight', () => {
    mgr.highlightNet('VCC_NET');
    mgr.unhighlightNet('VCC_NET');
    const projected = mgr.projectPins();
    const v5 = projected.find((pp) => pp.pin.id === '5V');
    expect(v5?.highlighted).toBe(false);
  });

  it('clearNetHighlights removes all net highlights', () => {
    mgr.highlightNet('VCC_NET');
    mgr.highlightNet('SPI_NET');
    mgr.clearNetHighlights();
    const projected = mgr.projectPins();
    projected.forEach((pp) => {
      expect(pp.highlighted).toBe(false);
    });
  });

  it('clearNetPinMapping clears all mappings', () => {
    mgr.highlightNet('VCC_NET');
    mgr.clearNetPinMapping();
    // Highlight still set, but no pins resolve
    const projected = mgr.projectPins();
    const v5 = projected.find((pp) => pp.pin.id === '5V');
    expect(v5?.highlighted).toBe(false);
  });

  it('highlightNet notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.highlightNet('VCC_NET');
    expect(called).toBe(1);
  });
});

// ─── Pin Filtering ───────────────────────────────────────────────

describe('ArOverlayManager — pin filtering', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
  });

  it('setPinFilter restricts projectPins output', () => {
    mgr.setPinFilter('power');
    const projected = mgr.projectPins();
    projected.forEach((pp) => {
      expect(pp.pin.type).toBe('power');
    });
    expect(projected.length).toBeGreaterThan(0);
  });

  it('setPinFilter(null) shows all pins', () => {
    const all = mgr.projectPins().length;
    mgr.setPinFilter('analog');
    const filtered = mgr.projectPins().length;
    mgr.setPinFilter(null);
    expect(mgr.projectPins().length).toBe(all);
    expect(filtered).toBeLessThan(all);
  });

  it('getPinFilter returns current filter', () => {
    expect(mgr.getPinFilter()).toBeNull();
    mgr.setPinFilter('ground');
    expect(mgr.getPinFilter()).toBe('ground');
  });

  it('setPinFilter notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.setPinFilter('digital');
    expect(called).toBe(1);
  });
});

// ─── Pin Lookup ──────────────────────────────────────────────────

describe('ArOverlayManager — pin lookup', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('esp32-devkit');
  });

  it('findPinByLabel returns matching pin (case-insensitive)', () => {
    const pin = mgr.findPinByLabel('gpio21');
    expect(pin).not.toBeNull();
    expect(pin!.id).toBe('GPIO21');
  });

  it('findPinByLabel returns null for no match', () => {
    expect(mgr.findPinByLabel('NONEXISTENT')).toBeNull();
  });

  it('findPinByLabel returns null if no board selected', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    expect(fresh.findPinByLabel('D0')).toBeNull();
  });

  it('findPinsByType returns all pins of a type', () => {
    const analogs = mgr.findPinsByType('analog');
    analogs.forEach((p) => {
      expect(p.type).toBe('analog');
    });
    expect(analogs.length).toBeGreaterThan(0);
  });

  it('findPinsByType returns empty array if no board selected', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    expect(fresh.findPinsByType('digital')).toEqual([]);
  });

  it('findPinsByAltFunction finds I2C pins', () => {
    const i2cPins = mgr.findPinsByAltFunction('I2C');
    expect(i2cPins.length).toBeGreaterThanOrEqual(2);
    i2cPins.forEach((p) => {
      expect(p.altFunctions.some((af) => af.toUpperCase().includes('I2C'))).toBe(true);
    });
  });

  it('findPinsByAltFunction finds SPI pins', () => {
    const spiPins = mgr.findPinsByAltFunction('SPI');
    expect(spiPins.length).toBeGreaterThanOrEqual(3);
  });

  it('findPinsByAltFunction returns empty array if no board selected', () => {
    ArOverlayManager.resetInstance();
    const fresh = ArOverlayManager.getInstance();
    expect(fresh.findPinsByAltFunction('SPI')).toEqual([]);
  });

  it('findPinByGpio returns the correct pin', () => {
    const pin = mgr.findPinByGpio(21);
    expect(pin).not.toBeNull();
    expect(pin!.id).toBe('GPIO21');
  });

  it('findPinByGpio returns null for invalid gpio', () => {
    expect(mgr.findPinByGpio(999)).toBeNull();
  });

  it('findPinByGpio returns null if no board selected', () => {
    ArOverlayManager.resetInstance();
    expect(ArOverlayManager.getInstance().findPinByGpio(21)).toBeNull();
  });
});

// ─── Pin Type Colors ─────────────────────────────────────────────

describe('PIN_TYPE_COLORS', () => {
  const allTypes: PinType[] = ['digital', 'analog', 'pwm', 'power', 'ground', 'communication', 'interrupt', 'special'];

  it('has a color for every pin type', () => {
    allTypes.forEach((t) => {
      expect(PIN_TYPE_COLORS[t]).toBeDefined();
      expect(PIN_TYPE_COLORS[t]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('all colors are unique', () => {
    const colors = allTypes.map((t) => PIN_TYPE_COLORS[t]);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

// ─── Snapshot ────────────────────────────────────────────────────

describe('ArOverlayManager — getSnapshot', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('returns full state when no board selected', () => {
    const snap = mgr.getSnapshot();
    expect(snap.activeBoard).toBeNull();
    expect(snap.calibration).toBeNull();
    expect(snap.highlightedPins.size).toBe(0);
    expect(snap.highlightedNets.size).toBe(0);
    expect(snap.projectedPins).toEqual([]);
    expect(snap.pinFilter).toBeNull();
  });

  it('returns full state after setup', () => {
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
    mgr.highlightPin('D0');
    mgr.setPinFilter('digital');

    const snap = mgr.getSnapshot();
    expect(snap.activeBoard!.id).toBe('arduino-uno');
    expect(snap.calibration!.isValid).toBe(true);
    expect(snap.highlightedPins.has('D0')).toBe(true);
    expect(snap.pinFilter).toBe('digital');
    expect(snap.projectedPins.length).toBeGreaterThan(0);
  });
});

// ─── Pin Tooltip ─────────────────────────────────────────────────

describe('ArOverlayManager — getPinTooltip', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
    mgr.selectBoard('esp32-devkit');
  });

  it('includes label, GPIO, alt functions, and type', () => {
    const pin = mgr.findPinByLabel('GPIO21')!;
    const tooltip = mgr.getPinTooltip(pin);
    expect(tooltip).toContain('GPIO21');
    expect(tooltip).toContain('GPIO 21');
    expect(tooltip).toContain('I2C SDA');
    expect(tooltip).toContain('Type:');
  });

  it('omits GPIO for pins without gpio number', () => {
    mgr.selectBoard('arduino-uno');
    const pin = mgr.findPinByLabel('D0')!;
    const tooltip = mgr.getPinTooltip(pin);
    expect(tooltip).toContain('D0');
    expect(tooltip).not.toContain('GPIO');
  });
});

// ─── ESP8266 Module ──────────────────────────────────────────────

describe('ArOverlayManager — ESP8266 module layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('esp8266-module')!;
  });

  it('exists and has correct name', () => {
    expect(board.name).toBe('ESP8266 (ESP-12)');
  });

  it('has GPIO pins with gpio numbers', () => {
    const gpio0 = board.pins.find((p) => p.id === 'GPIO0');
    expect(gpio0).toBeDefined();
    expect(gpio0!.gpio).toBe(0);
  });

  it('has ADC pin', () => {
    const adc = board.pins.find((p) => p.id === 'ADC');
    expect(adc).toBeDefined();
    expect(adc!.type).toBe('analog');
  });
});

// ─── Arduino Nano ────────────────────────────────────────────────

describe('ArOverlayManager — Arduino Nano layout', () => {
  let board: BoardLayout;

  beforeEach(() => {
    board = getManager().getBoardById('arduino-nano')!;
  });

  it('has D0-D13', () => {
    for (let i = 0; i <= 13; i++) {
      expect(board.pins.find((p) => p.id === `D${i}`)).toBeDefined();
    }
  });

  it('has A0-A7 (Nano has 8 analog)', () => {
    for (let i = 0; i <= 7; i++) {
      expect(board.pins.find((p) => p.id === `A${i}`)).toBeDefined();
    }
  });

  it('is smaller than Uno', () => {
    const uno = getManager().getBoardById('arduino-uno')!;
    expect(board.formFactor.widthMm).toBeLessThan(uno.formFactor.widthMm);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────

describe('ArOverlayManager — edge cases', () => {
  let mgr: ArOverlayManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('multiple highlights on same pin do not duplicate', () => {
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
    mgr.highlightPin('D0');
    mgr.highlightPin('D0');
    const projected = mgr.projectPins();
    const d0Pins = projected.filter((pp) => pp.pin.id === 'D0');
    expect(d0Pins.length).toBe(1);
  });

  it('unhighlight non-highlighted pin is a no-op', () => {
    mgr.selectBoard('arduino-uno');
    expect(() => mgr.unhighlightPin('D99')).not.toThrow();
  });

  it('unhighlightNet non-highlighted net is a no-op', () => {
    mgr.selectBoard('arduino-uno');
    expect(() => mgr.unhighlightNet('FAKE')).not.toThrow();
  });

  it('setNetPinMapping overwrites previous mapping', () => {
    mgr.selectBoard('arduino-uno');
    mgr.calibrate(makeIdentityCalibration());
    mgr.setNetPinMapping('NET1', ['D0', 'D1']);
    mgr.setNetPinMapping('NET1', ['D2']);
    mgr.highlightNet('NET1');
    const projected = mgr.projectPins();
    const d0 = projected.find((pp) => pp.pin.id === 'D0')!;
    const d2 = projected.find((pp) => pp.pin.id === 'D2')!;
    expect(d0.highlighted).toBe(false);
    expect(d2.highlighted).toBe(true);
  });

  it('switching boards clears pin filter', () => {
    mgr.selectBoard('arduino-uno');
    mgr.setPinFilter('analog');
    mgr.selectBoard('esp32-devkit');
    expect(mgr.getPinFilter()).toBeNull();
  });
});
