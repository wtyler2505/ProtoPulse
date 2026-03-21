/**
 * Firmware-Aware Simulation — BL-0461
 *
 * Simulates microcontroller firmware execution alongside circuit simulation.
 * Provides:
 *   - Board configurations (Uno, Mega, ESP32, Nano) with accurate pin maps
 *   - Pin state tracking: digital I/O, analog input, PWM output
 *   - Simulation lifecycle: create, load, step, run, pause, reset
 *   - Firmware↔circuit bridge interface for co-simulation
 *   - Interrupt support (rising/falling/change edge detection)
 *   - Timer/counter peripheral models
 *   - millis()/micros() virtual clock tied to simulation time
 *
 * Singleton+subscribe pattern for React integration.
 * Pure module — no DOM/React dependencies in core logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Supported board types for firmware simulation. */
export type FirmwareBoardType = 'uno' | 'mega' | 'esp32' | 'nano';

/** Pin mode for a microcontroller pin. */
export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'PWM' | 'ANALOG_IN' | 'UNSET';

/** Digital logic level. */
export type DigitalValue = 0 | 1;

/** Pin state for a single pin. */
export interface PinState {
  /** Pin number. */
  readonly pin: number;
  /** Current mode. */
  mode: PinMode;
  /** Digital value (0 or 1). */
  digitalValue: DigitalValue;
  /** Analog value (0–1023 for 10-bit ADC, 0–4095 for 12-bit). */
  analogValue: number;
  /** PWM duty cycle (0–255). */
  pwmDuty: number;
  /** Whether this pin supports PWM. */
  readonly hasPwm: boolean;
  /** Whether this pin supports analog input. */
  readonly hasAnalog: boolean;
}

/** Board pin configuration. */
export interface BoardConfig {
  readonly type: FirmwareBoardType;
  readonly label: string;
  /** Total number of digital pins. */
  readonly digitalPinCount: number;
  /** Number of analog input pins. */
  readonly analogPinCount: number;
  /** Analog pin start index (e.g., 14 for Uno A0=14). */
  readonly analogPinStart: number;
  /** PWM-capable pin numbers. */
  readonly pwmPins: readonly number[];
  /** ADC resolution in bits (10 for AVR, 12 for ESP32). */
  readonly adcBits: number;
  /** Clock frequency in Hz. */
  readonly clockHz: number;
  /** Number of hardware timers. */
  readonly timerCount: number;
  /** Available interrupt pins. */
  readonly interruptPins: readonly number[];
  /** SRAM size in bytes. */
  readonly sramBytes: number;
  /** Flash size in bytes. */
  readonly flashBytes: number;
}

/** Interrupt trigger edge type. */
export type InterruptEdge = 'rising' | 'falling' | 'change';

/** Registered interrupt handler. */
export interface InterruptHandler {
  readonly pin: number;
  readonly edge: InterruptEdge;
  readonly callback: () => void;
  enabled: boolean;
}

/** Timer/counter peripheral configuration. */
export interface TimerConfig {
  readonly id: number;
  /** Prescaler divider value. */
  prescaler: number;
  /** Compare match value (TOP). */
  compareMatch: number;
  /** Whether this timer is running. */
  running: boolean;
  /** Callback on compare match (simulated ISR). */
  onCompareMatch: (() => void) | null;
  /** Current counter value. */
  counter: number;
  /** Accumulated fractional ticks. */
  accumulator: number;
}

/** Simulation state. */
export type SimState = 'idle' | 'loaded' | 'running' | 'paused' | 'error';

/** Bridge interface for circuit↔firmware co-simulation. */
export interface CircuitBridge {
  /** Read voltage at a circuit node connected to a pin. Returns volts. */
  readVoltage: (pin: number) => number;
  /** Write a voltage to a circuit node from a pin output. */
  writeVoltage: (pin: number, voltage: number) => void;
  /** Read current flowing through a pin. Returns amps. */
  readCurrent: (pin: number) => number;
  /** Notify circuit that a pin mode changed. */
  onPinModeChange: (pin: number, mode: PinMode) => void;
}

/** A single step result from the simulation. */
export interface StepResult {
  /** Simulation time in microseconds after this step. */
  timeUs: number;
  /** Pin states that changed during this step. */
  changedPins: number[];
  /** Interrupts fired during this step. */
  interruptsFired: number[];
  /** Timers that triggered during this step. */
  timersTriggered: number[];
  /** Whether the step completed without error. */
  ok: boolean;
  /** Error message if ok is false. */
  error?: string;
}

/** Configuration for creating a firmware simulation session. */
export interface FirmwareSimConfig {
  board: FirmwareBoardType;
  /** Step size in microseconds (default 100). */
  stepUs?: number;
  /** Circuit bridge for co-simulation (optional). */
  bridge?: CircuitBridge;
  /** Firmware setup callback — called once on load. */
  setup?: (ctx: FirmwareContext) => void;
  /** Firmware loop callback — called every step. */
  loop?: (ctx: FirmwareContext) => void;
}

/** Context object passed to firmware setup/loop callbacks. */
export interface FirmwareContext {
  /** Current simulation time in milliseconds. */
  millis: () => number;
  /** Current simulation time in microseconds. */
  micros: () => number;
  /** Read a digital pin. */
  digitalRead: (pin: number) => DigitalValue;
  /** Write a digital pin. */
  digitalWrite: (pin: number, value: DigitalValue) => void;
  /** Read an analog pin (returns 0–1023 or 0–4095). */
  analogRead: (pin: number) => number;
  /** Write a PWM value (0–255). */
  analogWrite: (pin: number, duty: number) => void;
  /** Set pin mode. */
  pinMode: (pin: number, mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP') => void;
  /** Attach an interrupt handler. */
  attachInterrupt: (pin: number, callback: () => void, edge: InterruptEdge) => void;
  /** Detach an interrupt handler. */
  detachInterrupt: (pin: number) => void;
  /** Delay simulation by ms (advances time). */
  delay: (ms: number) => void;
  /** Delay simulation by us (advances time). */
  delayMicroseconds: (us: number) => void;
  /** Configure a timer. */
  configureTimer: (id: number, prescaler: number, compareMatch: number, callback: () => void) => void;
  /** Stop a timer. */
  stopTimer: (id: number) => void;
  /** Board type. */
  readonly board: FirmwareBoardType;
}

/** Snapshot of the simulation state for subscribers. */
export interface FirmwareSimSnapshot {
  readonly state: SimState;
  readonly board: BoardConfig | null;
  readonly timeUs: number;
  readonly stepCount: number;
  readonly pinStates: ReadonlyMap<number, PinState>;
  readonly interrupts: readonly InterruptHandler[];
  readonly timers: readonly TimerConfig[];
  readonly lastError: string | null;
  readonly stepUs: number;
}

// ---------------------------------------------------------------------------
// Board Configurations
// ---------------------------------------------------------------------------

export const BOARD_CONFIGS: Record<FirmwareBoardType, BoardConfig> = {
  uno: {
    type: 'uno',
    label: 'Arduino Uno',
    digitalPinCount: 14,
    analogPinCount: 6,
    analogPinStart: 14,
    pwmPins: [3, 5, 6, 9, 10, 11],
    adcBits: 10,
    clockHz: 16_000_000,
    timerCount: 3,
    interruptPins: [2, 3],
    sramBytes: 2048,
    flashBytes: 32_768,
  },
  mega: {
    type: 'mega',
    label: 'Arduino Mega 2560',
    digitalPinCount: 54,
    analogPinCount: 16,
    analogPinStart: 54,
    pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46],
    adcBits: 10,
    clockHz: 16_000_000,
    timerCount: 6,
    interruptPins: [2, 3, 18, 19, 20, 21],
    sramBytes: 8192,
    flashBytes: 262_144,
  },
  esp32: {
    type: 'esp32',
    label: 'ESP32-DevKit',
    digitalPinCount: 34,
    analogPinCount: 18,
    analogPinStart: 34,
    pwmPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 25, 26, 27],
    adcBits: 12,
    clockHz: 240_000_000,
    timerCount: 4,
    interruptPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33],
    sramBytes: 520_192,
    flashBytes: 4_194_304,
  },
  nano: {
    type: 'nano',
    label: 'Arduino Nano',
    digitalPinCount: 14,
    analogPinCount: 8,
    analogPinStart: 14,
    pwmPins: [3, 5, 6, 9, 10, 11],
    adcBits: 10,
    clockHz: 16_000_000,
    timerCount: 3,
    interruptPins: [2, 3],
    sramBytes: 2048,
    flashBytes: 32_768,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPinState(pin: number, config: BoardConfig): PinState {
  return {
    pin,
    mode: 'UNSET',
    digitalValue: 0,
    analogValue: 0,
    pwmDuty: 0,
    hasPwm: config.pwmPins.includes(pin),
    hasAnalog: pin >= config.analogPinStart && pin < config.analogPinStart + config.analogPinCount,
  };
}

function createTimer(id: number): TimerConfig {
  return {
    id,
    prescaler: 1,
    compareMatch: 0xFFFF,
    running: false,
    onCompareMatch: null,
    counter: 0,
    accumulator: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// FirmwareSimManager — Singleton
// ---------------------------------------------------------------------------

export class FirmwareSimManager {
  private static instance: FirmwareSimManager | null = null;

  // Subscriber pattern
  private subscribers = new Set<Listener>();

  // Configuration
  private _board: BoardConfig | null = null;
  private _stepUs = 100;
  private _bridge: CircuitBridge | null = null;
  private _setup: ((ctx: FirmwareContext) => void) | null = null;
  private _loop: ((ctx: FirmwareContext) => void) | null = null;

  // State
  private _state: SimState = 'idle';
  private _timeUs = 0;
  private _stepCount = 0;
  private _lastError: string | null = null;
  private _setupDone = false;

  // Pin state
  private _pins = new Map<number, PinState>();
  private _previousDigitalValues = new Map<number, DigitalValue>();

  // Interrupts
  private _interrupts = new Map<number, InterruptHandler>();

  // Timers
  private _timers = new Map<number, TimerConfig>();

  // Run loop
  private _runTimer: ReturnType<typeof setTimeout> | null = null;

  // Delay accumulation during step (for delay() calls in loop)
  private _pendingDelayUs = 0;

  private constructor() {
    // private — use getInstance()
  }

  static getInstance(): FirmwareSimManager {
    if (!FirmwareSimManager.instance) {
      FirmwareSimManager.instance = new FirmwareSimManager();
    }
    return FirmwareSimManager.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (FirmwareSimManager.instance) {
      FirmwareSimManager.instance.destroy();
      FirmwareSimManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Subscribe
  // ---------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // ---------------------------------------------------------------------------
  // Snapshot (for React)
  // ---------------------------------------------------------------------------

  getSnapshot(): FirmwareSimSnapshot {
    return {
      state: this._state,
      board: this._board,
      timeUs: this._timeUs,
      stepCount: this._stepCount,
      pinStates: new Map(this._pins),
      interrupts: Array.from(this._interrupts.values()),
      timers: Array.from(this._timers.values()),
      lastError: this._lastError,
      stepUs: this._stepUs,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Create a new simulation session. Transitions idle → loaded. */
  create(config: FirmwareSimConfig): void {
    if (this._state !== 'idle') {
      this.reset();
    }

    const boardConfig = BOARD_CONFIGS[config.board];
    if (!boardConfig) {
      this._state = 'error';
      this._lastError = `Unknown board type: ${String(config.board)}`;
      this.notify();
      return;
    }

    this._board = boardConfig;
    this._stepUs = config.stepUs ?? 100;
    this._bridge = config.bridge ?? null;
    this._setup = config.setup ?? null;
    this._loop = config.loop ?? null;
    this._timeUs = 0;
    this._stepCount = 0;
    this._lastError = null;
    this._setupDone = false;
    this._pendingDelayUs = 0;

    // Initialize pins
    this._pins.clear();
    this._previousDigitalValues.clear();
    const totalPins = boardConfig.digitalPinCount + boardConfig.analogPinCount;
    for (let i = 0; i < totalPins; i++) {
      this._pins.set(i, createPinState(i, boardConfig));
    }

    // Initialize timers
    this._timers.clear();
    for (let i = 0; i < boardConfig.timerCount; i++) {
      this._timers.set(i, createTimer(i));
    }

    // Clear interrupts
    this._interrupts.clear();

    this._state = 'loaded';
    this.notify();
  }

  /** Load firmware callbacks after create. */
  load(setup: (ctx: FirmwareContext) => void, loop: (ctx: FirmwareContext) => void): void {
    if (this._state !== 'loaded' && this._state !== 'paused') {
      this._lastError = 'Cannot load firmware: simulation not in loaded or paused state';
      this.notify();
      return;
    }
    this._setup = setup;
    this._loop = loop;
    this._setupDone = false;
    this.notify();
  }

  /** Execute a single simulation step. Returns the step result. */
  step(): StepResult {
    if (this._state !== 'loaded' && this._state !== 'paused' && this._state !== 'running') {
      return {
        timeUs: this._timeUs,
        changedPins: [],
        interruptsFired: [],
        timersTriggered: [],
        ok: false,
        error: `Cannot step: simulation in ${this._state} state`,
      };
    }

    const changedPins: number[] = [];
    const interruptsFired: number[] = [];
    const timersTriggered: number[] = [];

    try {
      // Capture previous digital values for edge detection
      this._pins.forEach((ps, pin) => {
        this._previousDigitalValues.set(pin, ps.digitalValue);
      });

      // Run setup once
      if (!this._setupDone && this._setup) {
        const ctx = this.createContext();
        this._setup(ctx);
        this._setupDone = true;
      }

      // Read from circuit bridge (update analog/digital inputs)
      if (this._bridge) {
        this._pins.forEach((ps, pin) => {
          if (ps.mode === 'INPUT' || ps.mode === 'INPUT_PULLUP' || ps.mode === 'ANALOG_IN') {
            const voltage = this._bridge!.readVoltage(pin);
            if (ps.hasAnalog && (ps.mode === 'ANALOG_IN' || ps.mode === 'INPUT')) {
              const maxAdc = (1 << (this._board?.adcBits ?? 10)) - 1;
              ps.analogValue = clamp(Math.round((voltage / 5.0) * maxAdc), 0, maxAdc);
            }
            const threshold = ps.mode === 'INPUT_PULLUP' ? 2.0 : 2.5;
            const newDigital: DigitalValue = voltage > threshold ? 1 : 0;
            if (newDigital !== ps.digitalValue) {
              ps.digitalValue = newDigital;
              changedPins.push(pin);
            }
          }
        });
      }

      // Run firmware loop
      this._pendingDelayUs = 0;
      if (this._loop) {
        const ctx = this.createContext();
        this._loop(ctx);
      }

      // Advance time
      this._timeUs += this._stepUs + this._pendingDelayUs;
      this._stepCount++;

      // Process timers
      this._timers.forEach((timer) => {
        if (!timer.running) {
          return;
        }
        const ticksPerUs = (this._board?.clockHz ?? 16_000_000) / (timer.prescaler * 1_000_000);
        timer.accumulator += ticksPerUs * this._stepUs;
        const wholeTicks = Math.floor(timer.accumulator);
        timer.accumulator -= wholeTicks;
        timer.counter += wholeTicks;
        if (timer.counter >= timer.compareMatch) {
          timer.counter = timer.counter % (timer.compareMatch + 1);
          timersTriggered.push(timer.id);
          if (timer.onCompareMatch) {
            timer.onCompareMatch();
          }
        }
      });

      // Detect pin changes and fire interrupts
      this._pins.forEach((ps, pin) => {
        const prev = this._previousDigitalValues.get(pin);
        if (prev !== undefined && prev !== ps.digitalValue) {
          if (!changedPins.includes(pin)) {
            changedPins.push(pin);
          }
          const handler = this._interrupts.get(pin);
          if (handler && handler.enabled) {
            const rising = prev === 0 && ps.digitalValue === 1;
            const falling = prev === 1 && ps.digitalValue === 0;
            if (
              handler.edge === 'change' ||
              (handler.edge === 'rising' && rising) ||
              (handler.edge === 'falling' && falling)
            ) {
              interruptsFired.push(pin);
              handler.callback();
            }
          }
        }
      });

      // Write outputs to circuit bridge
      if (this._bridge) {
        this._pins.forEach((ps, pin) => {
          if (ps.mode === 'OUTPUT') {
            this._bridge!.writeVoltage(pin, ps.digitalValue === 1 ? 5.0 : 0.0);
          } else if (ps.mode === 'PWM') {
            this._bridge!.writeVoltage(pin, (ps.pwmDuty / 255) * 5.0);
          }
        });
      }

      // Update state if we were loaded
      if (this._state === 'loaded') {
        this._state = 'paused';
      }

      this.notify();

      return {
        timeUs: this._timeUs,
        changedPins,
        interruptsFired,
        timersTriggered,
        ok: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._state = 'error';
      this._lastError = message;
      this.notify();
      return {
        timeUs: this._timeUs,
        changedPins,
        interruptsFired,
        timersTriggered,
        ok: false,
        error: message,
      };
    }
  }

  /** Start continuous simulation. Transitions to running. */
  run(intervalMs = 10): void {
    if (this._state !== 'loaded' && this._state !== 'paused') {
      return;
    }

    this._state = 'running';
    this.notify();

    const tick = (): void => {
      if (this._state !== 'running') {
        return;
      }
      this.step();
      if (this._state === 'running') {
        this._runTimer = setTimeout(tick, intervalMs);
      }
    };

    this._runTimer = setTimeout(tick, intervalMs);
  }

  /** Pause a running simulation. */
  pause(): void {
    if (this._state !== 'running') {
      return;
    }
    if (this._runTimer !== null) {
      clearTimeout(this._runTimer);
      this._runTimer = null;
    }
    this._state = 'paused';
    this.notify();
  }

  /** Reset the simulation to idle. */
  reset(): void {
    if (this._runTimer !== null) {
      clearTimeout(this._runTimer);
      this._runTimer = null;
    }
    this._state = 'idle';
    this._board = null;
    this._timeUs = 0;
    this._stepCount = 0;
    this._lastError = null;
    this._setupDone = false;
    this._pendingDelayUs = 0;
    this._pins.clear();
    this._previousDigitalValues.clear();
    this._interrupts.clear();
    this._timers.clear();
    this._bridge = null;
    this._setup = null;
    this._loop = null;
    this.notify();
  }

  /** Clean up resources. */
  destroy(): void {
    if (this._runTimer !== null) {
      clearTimeout(this._runTimer);
      this._runTimer = null;
    }
    this.subscribers.clear();
  }

  // ---------------------------------------------------------------------------
  // Direct pin access (for testing and bridge)
  // ---------------------------------------------------------------------------

  /** Get the state of a specific pin. */
  getPinState(pin: number): PinState | undefined {
    return this._pins.get(pin);
  }

  /** Externally set a pin's digital value (e.g., from circuit bridge). */
  setExternalDigital(pin: number, value: DigitalValue): void {
    const ps = this._pins.get(pin);
    if (ps && (ps.mode === 'INPUT' || ps.mode === 'INPUT_PULLUP' || ps.mode === 'UNSET')) {
      ps.digitalValue = value;
      this.notify();
    }
  }

  /** Externally set a pin's analog value (e.g., from circuit bridge). */
  setExternalAnalog(pin: number, value: number): void {
    const ps = this._pins.get(pin);
    if (ps && ps.hasAnalog) {
      const maxAdc = (1 << (this._board?.adcBits ?? 10)) - 1;
      ps.analogValue = clamp(Math.round(value), 0, maxAdc);
      this.notify();
    }
  }

  /** Get the current simulation state. */
  get state(): SimState {
    return this._state;
  }

  /** Get the current simulation time in microseconds. */
  get timeUs(): number {
    return this._timeUs;
  }

  /** Get the current board config. */
  get board(): BoardConfig | null {
    return this._board;
  }

  // ---------------------------------------------------------------------------
  // Firmware Context (Arduino-like API)
  // ---------------------------------------------------------------------------

  private createContext(): FirmwareContext {
    const self = this;
    return {
      board: self._board?.type ?? 'uno',

      millis(): number {
        return Math.floor(self._timeUs / 1000);
      },

      micros(): number {
        return self._timeUs;
      },

      digitalRead(pin: number): DigitalValue {
        const ps = self._pins.get(pin);
        if (!ps) {
          return 0;
        }
        return ps.digitalValue;
      },

      digitalWrite(pin: number, value: DigitalValue): void {
        const ps = self._pins.get(pin);
        if (!ps) {
          return;
        }
        if (ps.mode !== 'OUTPUT' && ps.mode !== 'UNSET') {
          return;
        }
        ps.digitalValue = value;
        if (ps.mode === 'UNSET') {
          ps.mode = 'OUTPUT';
        }
      },

      analogRead(pin: number): number {
        const ps = self._pins.get(pin);
        if (!ps) {
          return 0;
        }
        if (!ps.hasAnalog) {
          return 0;
        }
        if (ps.mode === 'UNSET') {
          ps.mode = 'ANALOG_IN';
        }
        return ps.analogValue;
      },

      analogWrite(pin: number, duty: number): void {
        const ps = self._pins.get(pin);
        if (!ps) {
          return;
        }
        if (!ps.hasPwm) {
          return;
        }
        ps.mode = 'PWM';
        ps.pwmDuty = clamp(Math.round(duty), 0, 255);
      },

      pinMode(pin: number, mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP'): void {
        const ps = self._pins.get(pin);
        if (!ps) {
          return;
        }
        ps.mode = mode;
        if (mode === 'INPUT_PULLUP') {
          ps.digitalValue = 1;
        }
        if (self._bridge) {
          self._bridge.onPinModeChange(pin, mode);
        }
      },

      attachInterrupt(pin: number, callback: () => void, edge: InterruptEdge): void {
        if (!self._board?.interruptPins.includes(pin)) {
          return;
        }
        self._interrupts.set(pin, { pin, edge, callback, enabled: true });
      },

      detachInterrupt(pin: number): void {
        self._interrupts.delete(pin);
      },

      delay(ms: number): void {
        self._pendingDelayUs += ms * 1000;
      },

      delayMicroseconds(us: number): void {
        self._pendingDelayUs += us;
      },

      configureTimer(id: number, prescaler: number, compareMatch: number, callback: () => void): void {
        const timer = self._timers.get(id);
        if (!timer) {
          return;
        }
        timer.prescaler = prescaler;
        timer.compareMatch = compareMatch;
        timer.onCompareMatch = callback;
        timer.running = true;
        timer.counter = 0;
        timer.accumulator = 0;
      },

      stopTimer(id: number): void {
        const timer = self._timers.get(id);
        if (!timer) {
          return;
        }
        timer.running = false;
        timer.counter = 0;
        timer.accumulator = 0;
        timer.onCompareMatch = null;
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience singleton accessor
// ---------------------------------------------------------------------------

export function getFirmwareSimManager(): FirmwareSimManager {
  return FirmwareSimManager.getInstance();
}
