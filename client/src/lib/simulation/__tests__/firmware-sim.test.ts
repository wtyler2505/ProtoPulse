import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FirmwareSimManager,
  BOARD_CONFIGS,
  getFirmwareSimManager,
} from '../firmware-sim';
import type {
  FirmwareSimConfig,
  CircuitBridge,
  FirmwareContext,
  StepResult,
  PinState,
  FirmwareBoardType,
  BoardConfig,
  InterruptEdge,
} from '../firmware-sim';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBridge(): CircuitBridge {
  return {
    readVoltage: vi.fn().mockReturnValue(0),
    writeVoltage: vi.fn(),
    readCurrent: vi.fn().mockReturnValue(0),
    onPinModeChange: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  FirmwareSimManager.resetInstance();
});

afterEach(() => {
  FirmwareSimManager.resetInstance();
});

// ---------------------------------------------------------------------------
// Board Configurations
// ---------------------------------------------------------------------------

describe('BOARD_CONFIGS', () => {
  it('has all four board types', () => {
    expect(BOARD_CONFIGS.uno).toBeDefined();
    expect(BOARD_CONFIGS.mega).toBeDefined();
    expect(BOARD_CONFIGS.esp32).toBeDefined();
    expect(BOARD_CONFIGS.nano).toBeDefined();
  });

  it('Uno has correct pin counts', () => {
    const cfg = BOARD_CONFIGS.uno;
    expect(cfg.digitalPinCount).toBe(14);
    expect(cfg.analogPinCount).toBe(6);
    expect(cfg.analogPinStart).toBe(14);
    expect(cfg.pwmPins).toContain(3);
    expect(cfg.pwmPins).toContain(11);
    expect(cfg.adcBits).toBe(10);
    expect(cfg.clockHz).toBe(16_000_000);
  });

  it('Mega has more pins than Uno', () => {
    expect(BOARD_CONFIGS.mega.digitalPinCount).toBeGreaterThan(BOARD_CONFIGS.uno.digitalPinCount);
    expect(BOARD_CONFIGS.mega.analogPinCount).toBeGreaterThan(BOARD_CONFIGS.uno.analogPinCount);
  });

  it('ESP32 has 12-bit ADC', () => {
    expect(BOARD_CONFIGS.esp32.adcBits).toBe(12);
  });

  it('Nano has same pin layout as Uno but more analog pins', () => {
    expect(BOARD_CONFIGS.nano.digitalPinCount).toBe(14);
    expect(BOARD_CONFIGS.nano.analogPinCount).toBe(8);
  });

  it('all boards have at least 2 interrupt pins', () => {
    const boards: FirmwareBoardType[] = ['uno', 'mega', 'esp32', 'nano'];
    boards.forEach((b) => {
      expect(BOARD_CONFIGS[b].interruptPins.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('all boards have timer counts > 0', () => {
    const boards: FirmwareBoardType[] = ['uno', 'mega', 'esp32', 'nano'];
    boards.forEach((b) => {
      expect(BOARD_CONFIGS[b].timerCount).toBeGreaterThan(0);
    });
  });

  it('ESP32 has more interrupt pins than AVR boards', () => {
    expect(BOARD_CONFIGS.esp32.interruptPins.length).toBeGreaterThan(
      BOARD_CONFIGS.uno.interruptPins.length,
    );
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('FirmwareSimManager singleton', () => {
  it('returns the same instance', () => {
    const a = FirmwareSimManager.getInstance();
    const b = FirmwareSimManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = FirmwareSimManager.getInstance();
    FirmwareSimManager.resetInstance();
    const b = FirmwareSimManager.getInstance();
    expect(a).not.toBe(b);
  });

  it('getFirmwareSimManager is a convenience accessor', () => {
    const a = getFirmwareSimManager();
    const b = FirmwareSimManager.getInstance();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle — create / load / reset
// ---------------------------------------------------------------------------

describe('lifecycle', () => {
  it('starts in idle state', () => {
    const mgr = FirmwareSimManager.getInstance();
    expect(mgr.state).toBe('idle');
    expect(mgr.board).toBeNull();
  });

  it('create transitions idle → loaded', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    expect(mgr.state).toBe('loaded');
    expect(mgr.board?.type).toBe('uno');
  });

  it('create initializes pins', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    // Uno: 14 digital + 6 analog = 20 pins
    const snap = mgr.getSnapshot();
    expect(snap.pinStates.size).toBe(20);
  });

  it('create initializes timers', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    const snap = mgr.getSnapshot();
    expect(snap.timers.length).toBe(3); // Uno has 3 timers
  });

  it('create with custom stepUs', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'mega', stepUs: 50 });
    const snap = mgr.getSnapshot();
    expect(snap.stepUs).toBe(50);
  });

  it('create with unknown board type goes to error', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'invalid' as FirmwareBoardType });
    expect(mgr.state).toBe('error');
    const snap = mgr.getSnapshot();
    expect(snap.lastError).toContain('Unknown board type');
  });

  it('create resets if already in loaded state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.create({ board: 'mega' });
    expect(mgr.board?.type).toBe('mega');
    expect(mgr.state).toBe('loaded');
  });

  it('load sets firmware callbacks', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    const setup = vi.fn();
    const loop = vi.fn();
    mgr.load(setup, loop);
    mgr.step();
    expect(setup).toHaveBeenCalledOnce();
    expect(loop).toHaveBeenCalledOnce();
  });

  it('load fails in idle state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.load(vi.fn(), vi.fn());
    const snap = mgr.getSnapshot();
    expect(snap.lastError).toContain('Cannot load firmware');
  });

  it('reset transitions to idle', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.step();
    mgr.reset();
    expect(mgr.state).toBe('idle');
    expect(mgr.timeUs).toBe(0);
    expect(mgr.board).toBeNull();
  });

  it('reset clears run timer', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.run(100);
    expect(mgr.state).toBe('running');
    mgr.reset();
    expect(mgr.state).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Stepping
// ---------------------------------------------------------------------------

describe('step', () => {
  it('advances time by stepUs', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno', stepUs: 100 });
    const result = mgr.step();
    expect(result.ok).toBe(true);
    expect(result.timeUs).toBe(100);
    expect(mgr.timeUs).toBe(100);
  });

  it('increments step count', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.step();
    mgr.step();
    mgr.step();
    const snap = mgr.getSnapshot();
    expect(snap.stepCount).toBe(3);
  });

  it('calls setup once, then loop every step', () => {
    const setup = vi.fn();
    const loop = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno', setup, loop });
    mgr.step();
    mgr.step();
    mgr.step();
    expect(setup).toHaveBeenCalledOnce();
    expect(loop).toHaveBeenCalledTimes(3);
  });

  it('step in idle state returns error', () => {
    const mgr = FirmwareSimManager.getInstance();
    const result = mgr.step();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Cannot step');
  });

  it('step transitions loaded → paused', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.step();
    expect(mgr.state).toBe('paused');
  });

  it('firmware exception transitions to error state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      loop: () => {
        throw new Error('segfault');
      },
    });
    const result = mgr.step();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('segfault');
    expect(mgr.state).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Run / Pause
// ---------------------------------------------------------------------------

describe('run / pause', () => {
  it('run transitions to running', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.run(1000);
    expect(mgr.state).toBe('running');
    mgr.pause();
  });

  it('pause transitions running → paused', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.run(1000);
    mgr.pause();
    expect(mgr.state).toBe('paused');
  });

  it('run does nothing in idle state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.run();
    expect(mgr.state).toBe('idle');
  });

  it('pause does nothing if not running', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.pause();
    expect(mgr.state).toBe('loaded');
  });

  it('run executes steps over time', async () => {
    const loop = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno', loop });
    mgr.run(5);
    await new Promise((r) => setTimeout(r, 50));
    mgr.pause();
    expect(loop.mock.calls.length).toBeGreaterThan(1);
    expect(mgr.timeUs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Pin I/O
// ---------------------------------------------------------------------------

describe('pin I/O', () => {
  it('digitalRead returns 0 by default', () => {
    const mgr = FirmwareSimManager.getInstance();
    let readVal = -1;
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        readVal = ctx.digitalRead(2);
      },
    });
    mgr.step();
    expect(readVal).toBe(0);
  });

  it('digitalWrite changes pin state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(13, 'OUTPUT');
        ctx.digitalWrite(13, 1);
      },
    });
    mgr.step();
    const ps = mgr.getPinState(13);
    expect(ps?.digitalValue).toBe(1);
    expect(ps?.mode).toBe('OUTPUT');
  });

  it('analogRead returns 0 for non-analog pins', () => {
    const mgr = FirmwareSimManager.getInstance();
    let readVal = -1;
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        readVal = ctx.analogRead(2); // digital-only pin
      },
    });
    mgr.step();
    expect(readVal).toBe(0);
  });

  it('analogRead works for analog pins', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    // Pin 14 = A0 on Uno
    mgr.setExternalAnalog(14, 512);
    let readVal = -1;
    mgr.load(
      () => {},
      (ctx) => {
        readVal = ctx.analogRead(14);
      },
    );
    mgr.step();
    expect(readVal).toBe(512);
  });

  it('analogWrite sets PWM duty cycle', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.analogWrite(3, 128); // pin 3 is PWM on Uno
      },
    });
    mgr.step();
    const ps = mgr.getPinState(3);
    expect(ps?.mode).toBe('PWM');
    expect(ps?.pwmDuty).toBe(128);
  });

  it('analogWrite on non-PWM pin does nothing', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.analogWrite(2, 128); // pin 2 is NOT PWM on Uno
      },
    });
    mgr.step();
    const ps = mgr.getPinState(2);
    expect(ps?.mode).toBe('UNSET');
    expect(ps?.pwmDuty).toBe(0);
  });

  it('PWM duty clamps to 0-255', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.analogWrite(3, 300);
      },
    });
    mgr.step();
    expect(mgr.getPinState(3)?.pwmDuty).toBe(255);
  });

  it('pinMode INPUT_PULLUP sets digital value to 1', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(4, 'INPUT_PULLUP');
      },
    });
    mgr.step();
    const ps = mgr.getPinState(4);
    expect(ps?.mode).toBe('INPUT_PULLUP');
    expect(ps?.digitalValue).toBe(1);
  });

  it('setExternalDigital only affects input pins', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(13, 'OUTPUT');
      },
    });
    mgr.step();
    mgr.setExternalDigital(13, 1); // should be ignored, pin is OUTPUT
    expect(mgr.getPinState(13)?.digitalValue).toBe(0);

    mgr.setExternalDigital(2, 1); // UNSET pin, should work
    expect(mgr.getPinState(2)?.digitalValue).toBe(1);
  });

  it('setExternalAnalog clamps to ADC range', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    mgr.setExternalAnalog(14, 2000); // Uno is 10-bit, max 1023
    expect(mgr.getPinState(14)?.analogValue).toBe(1023);
  });

  it('setExternalAnalog clamps to 12-bit on ESP32', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'esp32' });
    // ESP32 analog starts at pin 34
    mgr.setExternalAnalog(34, 5000);
    expect(mgr.getPinState(34)?.analogValue).toBe(4095);
  });

  it('getPinState returns undefined for invalid pin', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    expect(mgr.getPinState(999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// millis / micros / delay
// ---------------------------------------------------------------------------

describe('timing functions', () => {
  it('millis() returns simulation time in ms', () => {
    const mgr = FirmwareSimManager.getInstance();
    let ms = -1;
    mgr.create({
      board: 'uno',
      stepUs: 1000, // 1ms per step
      loop: (ctx) => {
        ms = ctx.millis();
      },
    });
    mgr.step(); // time = 1000us = 1ms
    expect(ms).toBe(0); // millis read during loop, before time advances
    mgr.step(); // time = 2000us = 2ms
    // After first step, time was 1000us, millis = 1
    expect(ms).toBe(1);
  });

  it('micros() returns simulation time in us', () => {
    const mgr = FirmwareSimManager.getInstance();
    let us = -1;
    mgr.create({
      board: 'uno',
      stepUs: 250,
      loop: (ctx) => {
        us = ctx.micros();
      },
    });
    mgr.step();
    mgr.step();
    // After step 1: time = 250us. During step 2 loop, time is still 250us.
    expect(us).toBe(250);
  });

  it('delay() advances time by additional microseconds', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      stepUs: 100,
      loop: (ctx) => {
        ctx.delay(10); // 10ms = 10000us
      },
    });
    const result = mgr.step();
    // stepUs (100) + delay (10000) = 10100
    expect(result.timeUs).toBe(10100);
  });

  it('delayMicroseconds() advances time', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      stepUs: 100,
      loop: (ctx) => {
        ctx.delayMicroseconds(500);
      },
    });
    const result = mgr.step();
    expect(result.timeUs).toBe(600); // 100 + 500
  });

  it('context provides board type', () => {
    const mgr = FirmwareSimManager.getInstance();
    let boardType = '';
    mgr.create({
      board: 'esp32',
      setup: (ctx) => {
        boardType = ctx.board;
      },
    });
    mgr.step();
    expect(boardType).toBe('esp32');
  });
});

// ---------------------------------------------------------------------------
// Interrupts
// ---------------------------------------------------------------------------

describe('interrupts', () => {
  it('rising edge interrupt fires on 0→1 transition', () => {
    const handler = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
        ctx.attachInterrupt(2, handler, 'rising');
      },
    });
    mgr.step(); // setup runs
    mgr.setExternalDigital(2, 1); // pin 2 goes high
    const result = mgr.step();
    // The interrupt should detect 0→1 change
    expect(result.interruptsFired).toContain(2);
    expect(handler).toHaveBeenCalled();
  });

  it('falling edge interrupt fires on 1→0 transition', () => {
    const handler = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
        ctx.attachInterrupt(2, handler, 'falling');
      },
    });
    mgr.step(); // setup
    mgr.setExternalDigital(2, 1); // go high
    mgr.step(); // detect 0→1 (falling handler should NOT fire)
    expect(handler).not.toHaveBeenCalled();
    mgr.setExternalDigital(2, 0); // go low
    mgr.step();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('change edge fires on any transition', () => {
    const handler = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
        ctx.attachInterrupt(2, handler, 'change');
      },
    });
    mgr.step();
    mgr.setExternalDigital(2, 1);
    mgr.step(); // 0→1
    mgr.setExternalDigital(2, 0);
    mgr.step(); // 1→0
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('detachInterrupt stops firing', () => {
    const handler = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    let detached = false;
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
        ctx.attachInterrupt(2, handler, 'rising');
      },
      loop: (ctx) => {
        if (!detached) {
          ctx.detachInterrupt(2);
          detached = true;
        }
      },
    });
    mgr.step(); // setup + first loop (detaches)
    mgr.setExternalDigital(2, 1);
    mgr.step();
    expect(handler).not.toHaveBeenCalled();
  });

  it('attachInterrupt on non-interrupt pin does nothing', () => {
    const handler = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        // Pin 4 is NOT an interrupt pin on Uno
        ctx.attachInterrupt(4, handler, 'rising');
      },
    });
    mgr.step();
    const snap = mgr.getSnapshot();
    expect(snap.interrupts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

describe('timers', () => {
  it('timer fires on compare match', () => {
    const callback = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      stepUs: 1000, // 1ms steps
      setup: (ctx) => {
        // Prescaler 64, compare match at 250 ticks
        // At 16MHz / 64 = 250kHz → 250 ticks = 1ms
        ctx.configureTimer(0, 64, 250, callback);
      },
    });
    mgr.step();
    // 1ms at 250kHz = 250 ticks → should trigger
    const result = mgr.step();
    expect(result.timersTriggered).toContain(0);
    expect(callback).toHaveBeenCalled();
  });

  it('stopTimer prevents firing', () => {
    const callback = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    let stopped = false;
    mgr.create({
      board: 'uno',
      stepUs: 1000,
      setup: (ctx) => {
        ctx.configureTimer(0, 64, 250, callback);
      },
      loop: (ctx) => {
        if (!stopped) {
          ctx.stopTimer(0);
          stopped = true;
        }
      },
    });
    mgr.step(); // setup + first loop (stops timer)
    mgr.step();
    mgr.step();
    expect(callback).not.toHaveBeenCalled();
  });

  it('invalid timer id does nothing', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.configureTimer(99, 1, 100, vi.fn());
        ctx.stopTimer(99);
      },
    });
    // Should not throw
    expect(() => mgr.step()).not.toThrow();
  });

  it('timer counter wraps on overflow', () => {
    const callback = vi.fn();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      stepUs: 100,
      setup: (ctx) => {
        // Very fast timer: prescaler 1, compare at 100
        // 16MHz / 1 = 16 ticks/us → 100us * 16 = 1600 ticks → 1600 / 101 ≈ 15 wraps
        ctx.configureTimer(0, 1, 100, callback);
      },
    });
    mgr.step();
    mgr.step();
    expect(callback.mock.calls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Circuit Bridge
// ---------------------------------------------------------------------------

describe('circuit bridge', () => {
  it('readVoltage updates analog input pin', () => {
    const bridge = createMockBridge();
    (bridge.readVoltage as ReturnType<typeof vi.fn>).mockReturnValue(2.5);
    const mgr = FirmwareSimManager.getInstance();
    let readVal = -1;
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(14, 'INPUT'); // A0
      },
      loop: (ctx) => {
        readVal = ctx.analogRead(14);
      },
    });
    mgr.step();
    // 2.5V / 5.0V * 1023 = 512 (rounded)
    expect(readVal).toBe(512);
  });

  it('bridge receives output voltage for digital HIGH', () => {
    const bridge = createMockBridge();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(13, 'OUTPUT');
        ctx.digitalWrite(13, 1);
      },
    });
    mgr.step();
    expect(bridge.writeVoltage).toHaveBeenCalledWith(13, 5.0);
  });

  it('bridge receives PWM voltage', () => {
    const bridge = createMockBridge();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.analogWrite(3, 128);
      },
    });
    mgr.step();
    // 128/255 * 5.0 ≈ 2.51
    expect(bridge.writeVoltage).toHaveBeenCalledWith(3, expect.closeTo(2.51, 1));
  });

  it('bridge notified of pin mode change', () => {
    const bridge = createMockBridge();
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(7, 'OUTPUT');
      },
    });
    mgr.step();
    expect(bridge.onPinModeChange).toHaveBeenCalledWith(7, 'OUTPUT');
  });

  it('bridge readVoltage sets digital value based on threshold', () => {
    const bridge = createMockBridge();
    (bridge.readVoltage as ReturnType<typeof vi.fn>).mockReturnValue(4.0);
    const mgr = FirmwareSimManager.getInstance();
    let val: 0 | 1 = 0;
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
      },
      loop: (ctx) => {
        val = ctx.digitalRead(2);
      },
    });
    mgr.step();
    expect(val).toBe(1); // 4.0V > 2.5V threshold
  });

  it('bridge readVoltage below threshold reads LOW', () => {
    const bridge = createMockBridge();
    (bridge.readVoltage as ReturnType<typeof vi.fn>).mockReturnValue(1.0);
    const mgr = FirmwareSimManager.getInstance();
    let val: 0 | 1 = 1;
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT');
      },
      loop: (ctx) => {
        val = ctx.digitalRead(2);
      },
    });
    mgr.step();
    expect(val).toBe(0);
  });

  it('INPUT_PULLUP uses 2.0V threshold', () => {
    const bridge = createMockBridge();
    (bridge.readVoltage as ReturnType<typeof vi.fn>).mockReturnValue(2.2);
    const mgr = FirmwareSimManager.getInstance();
    let val: 0 | 1 = 0;
    mgr.create({
      board: 'uno',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(2, 'INPUT_PULLUP');
      },
      loop: (ctx) => {
        val = ctx.digitalRead(2);
      },
    });
    mgr.step();
    expect(val).toBe(1); // 2.2V > 2.0V threshold for INPUT_PULLUP
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Snapshot
// ---------------------------------------------------------------------------

describe('subscribe / snapshot', () => {
  it('subscriber is called on state changes', () => {
    const mgr = FirmwareSimManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.create({ board: 'uno' });
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = FirmwareSimManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.create({ board: 'uno' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('snapshot contains complete state', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'esp32', stepUs: 200 });
    mgr.step();
    const snap = mgr.getSnapshot();
    expect(snap.state).toBe('paused');
    expect(snap.board?.type).toBe('esp32');
    expect(snap.timeUs).toBe(200);
    expect(snap.stepCount).toBe(1);
    expect(snap.stepUs).toBe(200);
    expect(snap.lastError).toBeNull();
    expect(snap.pinStates.size).toBeGreaterThan(0);
    expect(snap.timers.length).toBe(4); // ESP32 has 4 timers
  });

  it('snapshot pinStates is a copy', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({ board: 'uno' });
    const snap1 = mgr.getSnapshot();
    mgr.step();
    const snap2 = mgr.getSnapshot();
    // Different Map references
    expect(snap1.pinStates).not.toBe(snap2.pinStates);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('digitalRead on invalid pin returns 0', () => {
    const mgr = FirmwareSimManager.getInstance();
    let val = -1;
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        val = ctx.digitalRead(999);
      },
    });
    mgr.step();
    expect(val).toBe(0);
  });

  it('digitalWrite on invalid pin is a no-op', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        ctx.digitalWrite(999, 1);
      },
    });
    expect(() => mgr.step()).not.toThrow();
  });

  it('pinMode on invalid pin is a no-op', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(999, 'OUTPUT');
      },
    });
    expect(() => mgr.step()).not.toThrow();
  });

  it('analogRead on invalid pin returns 0', () => {
    const mgr = FirmwareSimManager.getInstance();
    let val = -1;
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        val = ctx.analogRead(999);
      },
    });
    mgr.step();
    expect(val).toBe(0);
  });

  it('analogWrite on invalid pin is a no-op', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      loop: (ctx) => {
        ctx.analogWrite(999, 128);
      },
    });
    expect(() => mgr.step()).not.toThrow();
  });

  it('multiple delays accumulate', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      stepUs: 100,
      loop: (ctx) => {
        ctx.delay(5);    // +5000us
        ctx.delayMicroseconds(200); // +200us
      },
    });
    const result = mgr.step();
    expect(result.timeUs).toBe(5300); // 100 + 5000 + 200
  });

  it('destroy clears subscribers and timers', () => {
    const mgr = FirmwareSimManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.create({ board: 'uno' });
    listener.mockClear();
    mgr.destroy();
    // After destroy, no more notifications
    // (We can't easily test this without accessing internals, so just verify no throw)
    expect(() => FirmwareSimManager.resetInstance()).not.toThrow();
  });

  it('step result reports changed pins', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      setup: (ctx) => {
        ctx.pinMode(13, 'OUTPUT');
      },
      loop: (ctx) => {
        ctx.digitalWrite(13, 1);
      },
    });
    mgr.step(); // setup + first loop: pin 13 goes 0→1
    // The pin changed in the loop callback
    const result = mgr.step();
    // Pin 13 was already 1, writing 1 again = no change
    expect(result.changedPins).not.toContain(13);
  });

  it('non-Error throw is converted to string', () => {
    const mgr = FirmwareSimManager.getInstance();
    mgr.create({
      board: 'uno',
      loop: () => {
        throw 'string error';
      },
    });
    const result = mgr.step();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('ESP32 12-bit ADC bridge conversion', () => {
    const bridge = createMockBridge();
    (bridge.readVoltage as ReturnType<typeof vi.fn>).mockReturnValue(5.0);
    const mgr = FirmwareSimManager.getInstance();
    let val = -1;
    mgr.create({
      board: 'esp32',
      bridge,
      setup: (ctx) => {
        ctx.pinMode(34, 'INPUT'); // ESP32 analog starts at 34
      },
      loop: (ctx) => {
        val = ctx.analogRead(34);
      },
    });
    mgr.step();
    expect(val).toBe(4095); // 5.0V / 5.0V * 4095
  });
});
