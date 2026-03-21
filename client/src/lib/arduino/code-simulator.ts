/**
 * CodeSimulator — Arduino code simulation in the browser.
 *
 * Provides a simulated MCU environment with pin states, serial buffers,
 * millis/micros counters, and line-by-line execution of Arduino sketches.
 * Supports basic Arduino API: digital/analog I/O, Serial, timing, math,
 * and sensor input injection.
 *
 * 4 board profiles: Arduino Uno, Mega, Nano, ESP32.
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';

export interface PinState {
  mode: PinMode;
  digital: 0 | 1;
  analog: number; // 0-1023 for ADC, 0-255 for PWM
  pwm: boolean;
}

export interface SerialBuffer {
  baudRate: number;
  output: string[];
  input: string[];
  enabled: boolean;
}

export interface McuState {
  pins: Map<number, PinState>;
  serial: SerialBuffer;
  serial1: SerialBuffer;
  millis: number;
  micros: number;
  variables: Map<string, SimVariable>;
  interrupts: Map<number, InterruptHandler>;
  interruptsEnabled: boolean;
}

export type SimVariableType = 'int' | 'float' | 'bool' | 'string' | 'byte' | 'long' | 'unsigned int' | 'unsigned long' | 'char' | 'double';

export interface SimVariable {
  name: string;
  type: SimVariableType;
  value: number | string | boolean;
  scope: 'global' | 'local';
}

export interface InterruptHandler {
  pin: number;
  mode: 'RISING' | 'FALLING' | 'CHANGE' | 'LOW' | 'HIGH';
  functionName: string;
}

export type SimulatorStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface BreakpointInfo {
  line: number;
  enabled: boolean;
  condition?: string;
}

export interface SimulatorError {
  line: number;
  message: string;
  type: 'syntax' | 'runtime' | 'type';
}

export interface SensorInput {
  pin: number;
  value: number;
  timestamp: number;
}

export interface BoardProfile {
  name: string;
  fqbn: string;
  digitalPins: number;
  analogPins: number;
  pwmPins: readonly number[];
  interruptPins: readonly number[];
  flashKB: number;
  sramKB: number;
  clockMHz: number;
  hasSerial1: boolean;
  analogReadMax: number;
  analogWriteMax: number;
}

export interface SimulatorSnapshot {
  status: SimulatorStatus;
  currentLine: number;
  totalLines: number;
  mcu: McuState;
  errors: SimulatorError[];
  executionCount: number;
  breakpoints: BreakpointInfo[];
  board: BoardProfile;
  sketchName: string;
  elapsedMs: number;
}

export interface ParsedSketch {
  globals: string[];
  setupBody: string[];
  loopBody: string[];
  functions: Map<string, ParsedFunction>;
  rawLines: string[];
}

export interface ParsedFunction {
  name: string;
  params: string[];
  body: string[];
  startLine: number;
}

// ---------------------------------------------------------------------------
// Board profiles
// ---------------------------------------------------------------------------

export const BOARD_PROFILES: Record<string, BoardProfile> = {
  'arduino:avr:uno': {
    name: 'Arduino Uno',
    fqbn: 'arduino:avr:uno',
    digitalPins: 14,
    analogPins: 6,
    pwmPins: [3, 5, 6, 9, 10, 11],
    interruptPins: [2, 3],
    flashKB: 32,
    sramKB: 2,
    clockMHz: 16,
    hasSerial1: false,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'arduino:avr:mega': {
    name: 'Arduino Mega',
    fqbn: 'arduino:avr:mega',
    digitalPins: 54,
    analogPins: 16,
    pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    interruptPins: [2, 3, 18, 19, 20, 21],
    flashKB: 256,
    sramKB: 8,
    clockMHz: 16,
    hasSerial1: true,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'arduino:avr:nano': {
    name: 'Arduino Nano',
    fqbn: 'arduino:avr:nano',
    digitalPins: 14,
    analogPins: 8,
    pwmPins: [3, 5, 6, 9, 10, 11],
    interruptPins: [2, 3],
    flashKB: 32,
    sramKB: 2,
    clockMHz: 16,
    hasSerial1: false,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'esp32:esp32:esp32': {
    name: 'ESP32',
    fqbn: 'esp32:esp32:esp32',
    digitalPins: 40,
    analogPins: 18,
    pwmPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27],
    interruptPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27],
    flashKB: 4096,
    sramKB: 520,
    clockMHz: 240,
    hasSerial1: true,
    analogReadMax: 4095,
    analogWriteMax: 255,
  },
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BOARD = 'arduino:avr:uno';
const MAX_SERIAL_LINES = 500;
const MAX_EXECUTION_STEPS = 100_000;
const DEFAULT_BAUD = 9600;

// Arduino constants
const HIGH = 1;
const LOW = 0;
const LED_BUILTIN = 13;

// ---------------------------------------------------------------------------
// Sketch parser
// ---------------------------------------------------------------------------

/**
 * Parse an Arduino sketch into structured sections.
 * Handles setup(), loop(), global declarations, and user-defined functions.
 */
export function parseSketch(source: string): ParsedSketch {
  const rawLines = source.split('\n');
  const globals: string[] = [];
  const functions = new Map<string, ParsedFunction>();
  let setupBody: string[] = [];
  let loopBody: string[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    // Skip blank lines and single-line comments at top level
    if (line === '' || line.startsWith('//') || line.startsWith('#include')) {
      globals.push(rawLines[i]);
      i++;
      continue;
    }

    // Block comment
    if (line.startsWith('/*')) {
      while (i < rawLines.length && !rawLines[i].includes('*/')) {
        globals.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) {
        globals.push(rawLines[i]);
        i++;
      }
      continue;
    }

    // Detect function definitions
    const funcMatch = line.match(/^(\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
    if (funcMatch) {
      const [, , funcName, params] = funcMatch;
      const startLine = i;
      const body: string[] = [];
      let braceCount = line.includes('{') ? 1 : 0;

      if (braceCount === 0) {
        i++;
        // Next line should have opening brace
        if (i < rawLines.length && rawLines[i].trim() === '{') {
          braceCount = 1;
          i++;
        }
      } else {
        i++;
      }

      while (i < rawLines.length && braceCount > 0) {
        const bodyLine = rawLines[i];
        const trimmed = bodyLine.trim();
        for (const ch of trimmed) {
          if (ch === '{') {
            braceCount++;
          }
          if (ch === '}') {
            braceCount--;
          }
        }
        if (braceCount > 0) {
          body.push(trimmed);
        }
        i++;
      }

      const paramList = params.split(',').map((p) => p.trim()).filter((p) => p !== '');

      if (funcName === 'setup') {
        setupBody = body;
      } else if (funcName === 'loop') {
        loopBody = body;
      } else {
        functions.set(funcName, { name: funcName, params: paramList, body, startLine });
      }
      continue;
    }

    // Global variable/constant declarations
    globals.push(rawLines[i]);
    i++;
  }

  return { globals, setupBody, loopBody, functions, rawLines };
}

// ---------------------------------------------------------------------------
// Execution context — holds variables and call stack for one execution scope
// ---------------------------------------------------------------------------

interface ExecContext {
  locals: Map<string, SimVariable>;
  returnValue?: number | string | boolean;
}

// ---------------------------------------------------------------------------
// CodeSimulator — singleton
// ---------------------------------------------------------------------------

export class CodeSimulator {
  // Singleton
  private static _instance: CodeSimulator | null = null;

  // State
  private _status: SimulatorStatus = 'idle';
  private _mcu: McuState;
  private _board: BoardProfile;
  private _sketch: ParsedSketch | null = null;
  private _sketchName = '';
  private _currentLine = 0;
  private _errors: SimulatorError[] = [];
  private _breakpoints: BreakpointInfo[] = [];
  private _executionCount = 0;
  private _elapsedMs = 0;
  private _sensorQueue: SensorInput[] = [];
  private _loopIndex = 0;
  private _setupDone = false;
  private _callStack: ExecContext[] = [];

  // Subscribe
  private _listeners = new Set<Listener>();
  private _version = 0;

  private constructor() {
    this._board = BOARD_PROFILES[DEFAULT_BOARD];
    this._mcu = this._createMcuState();
  }

  static getInstance(): CodeSimulator {
    if (!CodeSimulator._instance) {
      CodeSimulator._instance = new CodeSimulator();
    }
    return CodeSimulator._instance;
  }

  /** Reset singleton — for tests. */
  static resetInstance(): void {
    CodeSimulator._instance = null;
  }

  // ---------------------------------------------------------------------------
  // Subscribe pattern
  // ---------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getSnapshot(): SimulatorSnapshot {
    return {
      status: this._status,
      currentLine: this._currentLine,
      totalLines: this._sketch?.rawLines.length ?? 0,
      mcu: this._mcu,
      errors: [...this._errors],
      executionCount: this._executionCount,
      breakpoints: [...this._breakpoints],
      board: this._board,
      sketchName: this._sketchName,
      elapsedMs: this._elapsedMs,
    };
  }

  private _notify(): void {
    this._version++;
    this._listeners.forEach((l) => l());
  }

  // ---------------------------------------------------------------------------
  // Board management
  // ---------------------------------------------------------------------------

  setBoard(fqbn: string): void {
    const profile = BOARD_PROFILES[fqbn];
    if (!profile) {
      throw new Error(`Unknown board: ${fqbn}`);
    }
    this._board = profile;
    this.reset();
  }

  getBoard(): BoardProfile {
    return this._board;
  }

  // ---------------------------------------------------------------------------
  // MCU state factory
  // ---------------------------------------------------------------------------

  private _createMcuState(): McuState {
    const pins = new Map<number, PinState>();
    const totalPins = this._board.digitalPins + this._board.analogPins;
    for (let i = 0; i < totalPins; i++) {
      pins.set(i, { mode: 'INPUT', digital: 0, analog: 0, pwm: false });
    }
    return {
      pins,
      serial: { baudRate: DEFAULT_BAUD, output: [], input: [], enabled: false },
      serial1: { baudRate: DEFAULT_BAUD, output: [], input: [], enabled: false },
      millis: 0,
      micros: 0,
      variables: new Map(),
      interrupts: new Map(),
      interruptsEnabled: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Sketch loading
  // ---------------------------------------------------------------------------

  loadSketch(source: string, name?: string): void {
    this.reset();
    this._sketch = parseSketch(source);
    this._sketchName = name ?? 'sketch.ino';
    this._status = 'idle';

    // Parse global variable declarations
    for (const line of this._sketch.globals) {
      this._tryParseGlobalDecl(line.trim());
    }

    this._notify();
  }

  private _tryParseGlobalDecl(line: string): void {
    if (line === '' || line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
      return;
    }

    const constMatch = line.match(/^(?:const\s+)?(\w+)\s+(\w+)\s*=\s*(.+?)\s*;?\s*$/);
    if (constMatch) {
      const [, typeName, varName, valueStr] = constMatch;
      const type = this._mapType(typeName);
      if (type) {
        const value = this._parseValue(valueStr, type);
        this._mcu.variables.set(varName, { name: varName, type, value, scope: 'global' });
      }
    }
  }

  private _mapType(typeName: string): SimVariableType | null {
    const map: Record<string, SimVariableType> = {
      int: 'int',
      float: 'float',
      double: 'double',
      bool: 'bool',
      boolean: 'bool',
      String: 'string',
      byte: 'byte',
      long: 'long',
      char: 'char',
      'unsigned int': 'unsigned int',
      'unsigned long': 'unsigned long',
      uint8_t: 'byte',
      uint16_t: 'unsigned int',
      uint32_t: 'unsigned long',
      int8_t: 'byte',
      int16_t: 'int',
      int32_t: 'long',
    };
    return map[typeName] ?? null;
  }

  private _parseValue(valueStr: string, type: SimVariableType): number | string | boolean {
    const trimmed = valueStr.trim().replace(/;$/, '').trim();

    // Arduino constants
    if (trimmed === 'HIGH') { return 1; }
    if (trimmed === 'LOW') { return 0; }
    if (trimmed === 'true') { return true; }
    if (trimmed === 'false') { return false; }
    if (trimmed === 'LED_BUILTIN') { return LED_BUILTIN; }

    if (type === 'bool') {
      return trimmed === 'true' || trimmed === '1';
    }
    if (type === 'string') {
      // Strip quotes
      const strMatch = trimmed.match(/^"(.*)"$/);
      return strMatch ? strMatch[1] : trimmed;
    }
    if (type === 'char') {
      const charMatch = trimmed.match(/^'(.)'$/);
      return charMatch ? charMatch[1].charCodeAt(0) : parseInt(trimmed, 10) || 0;
    }

    // Hex literal
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return parseInt(trimmed, 16);
    }
    // Binary literal
    if (/^0b[01]+$/.test(trimmed)) {
      return parseInt(trimmed.slice(2), 2);
    }

    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? 0 : num;
  }

  // ---------------------------------------------------------------------------
  // Control flow
  // ---------------------------------------------------------------------------

  reset(): void {
    this._mcu = this._createMcuState();
    this._sketch = null;
    this._sketchName = '';
    this._currentLine = 0;
    this._errors = [];
    this._executionCount = 0;
    this._elapsedMs = 0;
    this._sensorQueue = [];
    this._loopIndex = 0;
    this._setupDone = false;
    this._callStack = [];
    this._status = 'idle';
    this._notify();
  }

  start(): void {
    if (!this._sketch) {
      this._addError(0, 'No sketch loaded', 'runtime');
      return;
    }
    this._status = 'running';
    this._setupDone = false;
    this._loopIndex = 0;
    this._executionCount = 0;
    this._elapsedMs = 0;
    this._errors = [];
    this._mcu = this._createMcuState();

    // Re-parse globals
    if (this._sketch) {
      for (const line of this._sketch.globals) {
        this._tryParseGlobalDecl(line.trim());
      }
    }

    // Execute setup
    this._executeBlock(this._sketch.setupBody, 'setup');
    this._setupDone = true;
    this._notify();
  }

  pause(): void {
    if (this._status === 'running') {
      this._status = 'paused';
      this._notify();
    }
  }

  resume(): void {
    if (this._status === 'paused') {
      this._status = 'running';
      this._notify();
    }
  }

  stop(): void {
    this._status = 'stopped';
    this._notify();
  }

  /** Execute one iteration of loop(). */
  stepLoop(): void {
    if (!this._sketch) {
      return;
    }
    if (this._shouldStop()) {
      return;
    }

    if (!this._setupDone) {
      this.start();
      return;
    }

    this._status = 'running';
    this._applySensorInputs();
    this._executeBlock(this._sketch.loopBody, 'loop');
    this._loopIndex++;
    this._notify();
  }

  /** Execute N loop iterations. */
  runLoops(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this._shouldStop()) {
        break;
      }
      if (this._executionCount >= MAX_EXECUTION_STEPS) {
        this._addError(this._currentLine, 'Execution limit reached (100,000 steps)', 'runtime');
        break;
      }
      this.stepLoop();
    }
  }

  // ---------------------------------------------------------------------------
  // Sensor input simulation
  // ---------------------------------------------------------------------------

  injectSensorInput(pin: number, value: number): void {
    this._sensorQueue.push({ pin, value, timestamp: this._mcu.millis });
    const pinState = this._mcu.pins.get(pin);
    if (pinState) {
      pinState.analog = Math.max(0, Math.min(this._board.analogReadMax, Math.round(value)));
      if (value > this._board.analogReadMax / 2) {
        pinState.digital = HIGH as 0 | 1;
      } else {
        pinState.digital = LOW as 0 | 1;
      }
    }
    this._notify();
  }

  private _applySensorInputs(): void {
    // Sensor queue is applied directly via injectSensorInput, no deferred processing needed
    this._sensorQueue = [];
  }

  // ---------------------------------------------------------------------------
  // Breakpoints
  // ---------------------------------------------------------------------------

  addBreakpoint(line: number, condition?: string): void {
    const existing = this._breakpoints.find((bp) => bp.line === line);
    if (existing) {
      existing.enabled = true;
      existing.condition = condition;
    } else {
      this._breakpoints.push({ line, enabled: true, condition });
    }
    this._notify();
  }

  removeBreakpoint(line: number): void {
    this._breakpoints = this._breakpoints.filter((bp) => bp.line !== line);
    this._notify();
  }

  toggleBreakpoint(line: number): void {
    const bp = this._breakpoints.find((b) => b.line === line);
    if (bp) {
      bp.enabled = !bp.enabled;
    } else {
      this._breakpoints.push({ line, enabled: true });
    }
    this._notify();
  }

  clearBreakpoints(): void {
    this._breakpoints = [];
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // Error management
  // ---------------------------------------------------------------------------

  private _addError(line: number, message: string, type: SimulatorError['type']): void {
    this._errors.push({ line, message, type });
    this._status = 'error';
  }

  /** Check if execution should halt (error or stopped). Avoids TS type narrowing issues. */
  private _shouldStop(): boolean {
    return this._status === 'error' || this._status === 'stopped';
  }

  getErrors(): SimulatorError[] {
    return [...this._errors];
  }

  // ---------------------------------------------------------------------------
  // Line execution engine
  // ---------------------------------------------------------------------------

  private _executeBlock(lines: string[], _context: string): void {
    const ctx: ExecContext = { locals: new Map() };
    this._callStack.push(ctx);

    let i = 0;
    while (i < lines.length) {
      if (this._shouldStop()) {
        break;
      }
      if (this._executionCount >= MAX_EXECUTION_STEPS) {
        this._addError(this._currentLine, 'Execution limit reached (100,000 steps)', 'runtime');
        break;
      }

      this._executionCount++;
      this._currentLine = i;

      const line = lines[i].trim();

      // Skip empty and comments
      if (line === '' || line.startsWith('//')) {
        i++;
        continue;
      }

      // if/else
      const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/);
      if (ifMatch) {
        const condition = this._evaluateExpression(ifMatch[1]);
        const block = this._extractBlock(lines, i);
        i = block.endIndex;

        // Check for else
        let elseBlock: { body: string[]; endIndex: number } | null = null;
        if (i < lines.length && lines[i].trim().match(/^}\s*else\s*\{?\s*$/)) {
          elseBlock = this._extractBlock(lines, i);
          i = elseBlock.endIndex;
        } else if (i < lines.length && lines[i].trim().startsWith('else')) {
          elseBlock = this._extractBlock(lines, i);
          i = elseBlock.endIndex;
        }

        if (this._isTruthy(condition)) {
          this._executeBlock(block.body, 'if');
        } else if (elseBlock) {
          this._executeBlock(elseBlock.body, 'else');
        }
        continue;
      }

      // for loop
      const forMatch = line.match(/^for\s*\((.+?);(.+?);(.+?)\)\s*\{?\s*$/);
      if (forMatch) {
        const [, init, cond, incr] = forMatch;
        const block = this._extractBlock(lines, i);
        i = block.endIndex;

        this._executeLine(init.trim());
        let loopGuard = 0;
        while (this._isTruthy(this._evaluateExpression(cond.trim())) && loopGuard < 10_000) {
          if ((this._status as SimulatorStatus) === 'error' || (this._status as SimulatorStatus) === 'stopped') { break; }
          this._executeBlock(block.body, 'for');
          this._executeLine(incr.trim());
          loopGuard++;
          this._executionCount++;
        }
        continue;
      }

      // while loop
      const whileMatch = line.match(/^while\s*\((.+)\)\s*\{?\s*$/);
      if (whileMatch) {
        const block = this._extractBlock(lines, i);
        i = block.endIndex;

        let loopGuard = 0;
        while (this._isTruthy(this._evaluateExpression(whileMatch[1])) && loopGuard < 10_000) {
          if ((this._status as SimulatorStatus) === 'error' || (this._status as SimulatorStatus) === 'stopped') { break; }
          this._executeBlock(block.body, 'while');
          loopGuard++;
          this._executionCount++;
        }
        continue;
      }

      // Closing brace (skip)
      if (line === '}') {
        i++;
        continue;
      }

      // Regular statement
      this._executeLine(line);
      i++;
    }

    this._callStack.pop();
  }

  private _extractBlock(lines: string[], startIndex: number): { body: string[]; endIndex: number } {
    const body: string[] = [];
    let braceCount = 0;
    let i = startIndex;
    const firstLine = lines[i].trim();

    // Find opening brace
    if (firstLine.includes('{')) {
      braceCount = 1;
      i++;
    } else {
      i++;
      if (i < lines.length && lines[i].trim() === '{') {
        braceCount = 1;
        i++;
      } else {
        // Single-line body (no braces)
        if (i < lines.length) {
          body.push(lines[i]);
          i++;
        }
        return { body, endIndex: i };
      }
    }

    while (i < lines.length && braceCount > 0) {
      const trimmed = lines[i].trim();
      for (const ch of trimmed) {
        if (ch === '{') { braceCount++; }
        if (ch === '}') { braceCount--; }
      }
      if (braceCount > 0) {
        body.push(trimmed);
      }
      i++;
    }

    return { body, endIndex: i };
  }

  private _executeLine(line: string): void {
    const trimmed = line.trim().replace(/;$/, '').trim();
    if (trimmed === '' || trimmed === '}') { return; }

    // Advance time per statement (~62.5ns per instruction at 16MHz ≈ 1us per C statement)
    this._mcu.millis += 1;
    this._mcu.micros += 1000;
    this._elapsedMs += 1;

    // ─── Arduino API calls ─────────────────────────────────────────

    // pinMode(pin, mode)
    const pinModeMatch = trimmed.match(/^pinMode\s*\(\s*(.+?)\s*,\s*(\w+)\s*\)$/);
    if (pinModeMatch) {
      const pin = this._resolveInt(pinModeMatch[1]);
      const mode = pinModeMatch[2] as PinMode;
      this._setPinMode(pin, mode);
      return;
    }

    // digitalWrite(pin, value)
    const dwMatch = trimmed.match(/^digitalWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (dwMatch) {
      const pin = this._resolveInt(dwMatch[1]);
      const val = this._resolveInt(dwMatch[2]);
      this._digitalWrite(pin, val);
      return;
    }

    // analogWrite(pin, value)
    const awMatch = trimmed.match(/^analogWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (awMatch) {
      const pin = this._resolveInt(awMatch[1]);
      const val = this._resolveInt(awMatch[2]);
      this._analogWrite(pin, val);
      return;
    }

    // delay(ms)
    const delayMatch = trimmed.match(/^delay\s*\(\s*(.+?)\s*\)$/);
    if (delayMatch) {
      const ms = this._resolveInt(delayMatch[1]);
      this._mcu.millis += ms;
      this._mcu.micros += ms * 1000;
      this._elapsedMs += ms;
      return;
    }

    // delayMicroseconds(us)
    const delayUsMatch = trimmed.match(/^delayMicroseconds\s*\(\s*(.+?)\s*\)$/);
    if (delayUsMatch) {
      const us = this._resolveInt(delayUsMatch[1]);
      this._mcu.micros += us;
      this._mcu.millis += Math.floor(us / 1000);
      this._elapsedMs += us / 1000;
      return;
    }

    // Serial.begin(baud)
    const serialBeginMatch = trimmed.match(/^Serial\.begin\s*\(\s*(\d+)\s*\)$/);
    if (serialBeginMatch) {
      this._mcu.serial.baudRate = parseInt(serialBeginMatch[1], 10);
      this._mcu.serial.enabled = true;
      return;
    }

    // Serial1.begin(baud)
    const serial1BeginMatch = trimmed.match(/^Serial1\.begin\s*\(\s*(\d+)\s*\)$/);
    if (serial1BeginMatch) {
      if (!this._board.hasSerial1) {
        this._addError(this._currentLine, 'Serial1 not available on ' + this._board.name, 'runtime');
        return;
      }
      this._mcu.serial1.baudRate = parseInt(serial1BeginMatch[1], 10);
      this._mcu.serial1.enabled = true;
      return;
    }

    // Serial.println(...)
    const serialPrintlnMatch = trimmed.match(/^Serial\.println\s*\(\s*(.*?)\s*\)$/);
    if (serialPrintlnMatch) {
      const val = this._resolveSerialArg(serialPrintlnMatch[1]);
      this._serialPrint(this._mcu.serial, val + '\n');
      return;
    }

    // Serial.print(...)
    const serialPrintMatch = trimmed.match(/^Serial\.print\s*\(\s*(.*?)\s*\)$/);
    if (serialPrintMatch) {
      const val = this._resolveSerialArg(serialPrintMatch[1]);
      this._serialPrint(this._mcu.serial, val);
      return;
    }

    // Serial1.println(...)
    const serial1PrintlnMatch = trimmed.match(/^Serial1\.println\s*\(\s*(.*?)\s*\)$/);
    if (serial1PrintlnMatch) {
      const val = this._resolveSerialArg(serial1PrintlnMatch[1]);
      this._serialPrint(this._mcu.serial1, val + '\n');
      return;
    }

    // Serial1.print(...)
    const serial1PrintMatch = trimmed.match(/^Serial1\.print\s*\(\s*(.*?)\s*\)$/);
    if (serial1PrintMatch) {
      const val = this._resolveSerialArg(serial1PrintMatch[1]);
      this._serialPrint(this._mcu.serial1, val);
      return;
    }

    // attachInterrupt(digitalPinToInterrupt(pin), func, mode)
    const attachIntMatch = trimmed.match(
      /^attachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*(\d+)\s*\)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)$/,
    );
    if (attachIntMatch) {
      const pin = parseInt(attachIntMatch[1], 10);
      const funcName = attachIntMatch[2];
      const mode = attachIntMatch[3] as InterruptHandler['mode'];
      if (!this._board.interruptPins.includes(pin)) {
        this._addError(this._currentLine, `Pin ${pin} does not support interrupts on ${this._board.name}`, 'runtime');
        return;
      }
      this._mcu.interrupts.set(pin, { pin, mode, functionName: funcName });
      return;
    }

    // detachInterrupt(digitalPinToInterrupt(pin))
    const detachIntMatch = trimmed.match(/^detachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*(\d+)\s*\)\s*\)$/);
    if (detachIntMatch) {
      const pin = parseInt(detachIntMatch[1], 10);
      this._mcu.interrupts.delete(pin);
      return;
    }

    // noInterrupts()
    if (trimmed === 'noInterrupts()') {
      this._mcu.interruptsEnabled = false;
      return;
    }

    // interrupts()
    if (trimmed === 'interrupts()') {
      this._mcu.interruptsEnabled = true;
      return;
    }

    // ─── Variable declarations ────────────────────────────────────

    const declMatch = trimmed.match(/^(\w+)\s+(\w+)\s*=\s*(.+)$/);
    if (declMatch) {
      const [, typeName, varName, valueStr] = declMatch;
      const type = this._mapType(typeName);
      if (type) {
        const value = this._evaluateExpression(valueStr.replace(/;$/, '').trim());
        const scope = this._callStack.length > 1 ? 'local' : 'global';
        const v: SimVariable = { name: varName, type, value, scope };
        if (scope === 'local' && this._callStack.length > 0) {
          this._callStack[this._callStack.length - 1].locals.set(varName, v);
        }
        this._mcu.variables.set(varName, v);
        return;
      }
    }

    // Variable declaration without initialization
    const declNoInitMatch = trimmed.match(/^(\w+)\s+(\w+)$/);
    if (declNoInitMatch) {
      const [, typeName, varName] = declNoInitMatch;
      const type = this._mapType(typeName);
      if (type) {
        const scope = this._callStack.length > 1 ? 'local' : 'global';
        const v: SimVariable = { name: varName, type, value: 0, scope };
        this._mcu.variables.set(varName, v);
        if (scope === 'local' && this._callStack.length > 0) {
          this._callStack[this._callStack.length - 1].locals.set(varName, v);
        }
        return;
      }
    }

    // ─── Assignment ───────────────────────────────────────────────

    // Compound assignments: +=, -=, *=, /=, %=, |=, &=, ^=
    const compoundMatch = trimmed.match(/^(\w+)\s*([+\-*/%|&^])=\s*(.+)$/);
    if (compoundMatch) {
      const [, varName, op, expr] = compoundMatch;
      const v = this._resolveVariable(varName);
      if (v !== undefined) {
        const rhs = this._evaluateExpression(expr);
        const lhs = typeof v === 'number' ? v : 0;
        const rhsNum = typeof rhs === 'number' ? rhs : 0;
        let result: number;
        switch (op) {
          case '+': result = lhs + rhsNum; break;
          case '-': result = lhs - rhsNum; break;
          case '*': result = lhs * rhsNum; break;
          case '/': result = rhsNum === 0 ? 0 : lhs / rhsNum; break;
          case '%': result = rhsNum === 0 ? 0 : lhs % rhsNum; break;
          case '|': result = lhs | rhsNum; break;
          case '&': result = lhs & rhsNum; break;
          case '^': result = lhs ^ rhsNum; break;
          default: result = lhs;
        }
        this._setVariable(varName, result);
      }
      return;
    }

    // Increment/decrement
    const incMatch = trimmed.match(/^(\w+)\+\+$/);
    if (incMatch) {
      const v = this._resolveVariable(incMatch[1]);
      if (typeof v === 'number') {
        this._setVariable(incMatch[1], v + 1);
      }
      return;
    }

    const decMatch = trimmed.match(/^(\w+)--$/);
    if (decMatch) {
      const v = this._resolveVariable(decMatch[1]);
      if (typeof v === 'number') {
        this._setVariable(decMatch[1], v - 1);
      }
      return;
    }

    // Simple assignment
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
      const [, varName, expr] = assignMatch;
      const value = this._evaluateExpression(expr);
      this._setVariable(varName, value);
      return;
    }

    // ─── User function calls ──────────────────────────────────────

    const funcCallMatch = trimmed.match(/^(\w+)\s*\(([^)]*)\)$/);
    if (funcCallMatch) {
      const [, funcName, argsStr] = funcCallMatch;
      this._callUserFunction(funcName, argsStr);
      return;
    }

    // Unknown statement — silently ignore (could be complex C++ we don't interpret)
  }

  // ---------------------------------------------------------------------------
  // Arduino API implementations
  // ---------------------------------------------------------------------------

  private _setPinMode(pin: number, mode: PinMode): void {
    const state = this._mcu.pins.get(pin);
    if (!state) {
      this._addError(this._currentLine, `Invalid pin: ${pin}`, 'runtime');
      return;
    }
    state.mode = mode;
    if (mode === 'INPUT_PULLUP') {
      state.digital = HIGH as 0 | 1;
    }
  }

  private _digitalWrite(pin: number, value: number): void {
    const state = this._mcu.pins.get(pin);
    if (!state) {
      this._addError(this._currentLine, `Invalid pin: ${pin}`, 'runtime');
      return;
    }
    state.digital = (value ? HIGH : LOW) as 0 | 1;
    state.analog = value ? this._board.analogWriteMax : 0;
    state.pwm = false;
  }

  private _analogWrite(pin: number, value: number): void {
    const state = this._mcu.pins.get(pin);
    if (!state) {
      this._addError(this._currentLine, `Invalid pin: ${pin}`, 'runtime');
      return;
    }
    if (!this._board.pwmPins.includes(pin)) {
      this._addError(this._currentLine, `Pin ${pin} does not support PWM on ${this._board.name}`, 'runtime');
      return;
    }
    state.analog = Math.max(0, Math.min(this._board.analogWriteMax, Math.round(value)));
    state.pwm = true;
    state.digital = (value > 0 ? HIGH : LOW) as 0 | 1;
  }

  /** Read digital pin value. */
  digitalRead(pin: number): 0 | 1 {
    const state = this._mcu.pins.get(pin);
    return state ? state.digital : 0;
  }

  /** Read analog pin value. */
  analogRead(pin: number): number {
    const state = this._mcu.pins.get(pin);
    return state ? state.analog : 0;
  }

  private _serialPrint(buffer: SerialBuffer, text: string): void {
    if (!buffer.enabled) {
      this._addError(this._currentLine, 'Serial not initialized (call Serial.begin first)', 'runtime');
      return;
    }
    buffer.output.push(text);
    if (buffer.output.length > MAX_SERIAL_LINES) {
      buffer.output.splice(0, buffer.output.length - MAX_SERIAL_LINES);
    }
  }

  // ---------------------------------------------------------------------------
  // Expression evaluation
  // ---------------------------------------------------------------------------

  private _evaluateExpression(expr: string): number | string | boolean {
    const trimmed = expr.trim();

    // String literal
    const strMatch = trimmed.match(/^"(.*)"$/);
    if (strMatch) { return strMatch[1]; }

    // Boolean literals
    if (trimmed === 'true') { return true; }
    if (trimmed === 'false') { return false; }

    // Arduino constants
    if (trimmed === 'HIGH') { return HIGH; }
    if (trimmed === 'LOW') { return LOW; }
    if (trimmed === 'LED_BUILTIN') { return LED_BUILTIN; }
    if (trimmed === 'INPUT') { return 0; }
    if (trimmed === 'OUTPUT') { return 1; }
    if (trimmed === 'INPUT_PULLUP') { return 2; }

    // Numeric literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    // Hex literal
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return parseInt(trimmed, 16);
    }
    // Binary literal
    if (/^0b[01]+$/.test(trimmed)) {
      return parseInt(trimmed.slice(2), 2);
    }

    // millis() / micros()
    if (trimmed === 'millis()') { return this._mcu.millis; }
    if (trimmed === 'micros()') { return this._mcu.micros; }

    // digitalRead(pin)
    const drMatch = trimmed.match(/^digitalRead\s*\(\s*(.+?)\s*\)$/);
    if (drMatch) {
      const pin = this._resolveInt(drMatch[1]);
      return this.digitalRead(pin);
    }

    // analogRead(pin)
    const arMatch = trimmed.match(/^analogRead\s*\(\s*(.+?)\s*\)$/);
    if (arMatch) {
      const pin = this._resolveInt(arMatch[1]);
      return this.analogRead(pin);
    }

    // map(value, fromLow, fromHigh, toLow, toHigh)
    const mapMatch = trimmed.match(/^map\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (mapMatch) {
      const value = this._resolveFloat(mapMatch[1]);
      const fromLow = this._resolveFloat(mapMatch[2]);
      const fromHigh = this._resolveFloat(mapMatch[3]);
      const toLow = this._resolveFloat(mapMatch[4]);
      const toHigh = this._resolveFloat(mapMatch[5]);
      if (fromHigh === fromLow) { return toLow; }
      return Math.round(toLow + ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow));
    }

    // constrain(x, a, b)
    const constrainMatch = trimmed.match(/^constrain\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (constrainMatch) {
      const x = this._resolveFloat(constrainMatch[1]);
      const a = this._resolveFloat(constrainMatch[2]);
      const b = this._resolveFloat(constrainMatch[3]);
      return Math.max(a, Math.min(b, x));
    }

    // abs(x)
    const absMatch = trimmed.match(/^abs\s*\(\s*(.+?)\s*\)$/);
    if (absMatch) {
      return Math.abs(this._resolveFloat(absMatch[1]));
    }

    // min(a, b) / max(a, b)
    const minMatch = trimmed.match(/^min\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (minMatch) {
      return Math.min(this._resolveFloat(minMatch[1]), this._resolveFloat(minMatch[2]));
    }
    const maxMatch = trimmed.match(/^max\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (maxMatch) {
      return Math.max(this._resolveFloat(maxMatch[1]), this._resolveFloat(maxMatch[2]));
    }

    // pow(base, exp)
    const powMatch = trimmed.match(/^pow\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/);
    if (powMatch) {
      return Math.pow(this._resolveFloat(powMatch[1]), this._resolveFloat(powMatch[2]));
    }

    // sqrt(x)
    const sqrtMatch = trimmed.match(/^sqrt\s*\(\s*(.+?)\s*\)$/);
    if (sqrtMatch) {
      return Math.sqrt(this._resolveFloat(sqrtMatch[1]));
    }

    // String concatenation with +
    if (trimmed.includes('"') && trimmed.includes('+')) {
      return this._resolveStringConcat(trimmed);
    }

    // Comparison operators
    const compMatch = trimmed.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (compMatch) {
      const lhs = this._evaluateExpression(compMatch[1]);
      const rhs = this._evaluateExpression(compMatch[3]);
      const lhsN = typeof lhs === 'number' ? lhs : 0;
      const rhsN = typeof rhs === 'number' ? rhs : 0;
      switch (compMatch[2]) {
        case '==': return lhs === rhs;
        case '!=': return lhs !== rhs;
        case '>': return lhsN > rhsN;
        case '<': return lhsN < rhsN;
        case '>=': return lhsN >= rhsN;
        case '<=': return lhsN <= rhsN;
      }
    }

    // Logical operators
    const andMatch = trimmed.match(/^(.+?)\s*&&\s*(.+)$/);
    if (andMatch) {
      return this._isTruthy(this._evaluateExpression(andMatch[1])) &&
             this._isTruthy(this._evaluateExpression(andMatch[2]));
    }
    const orMatch = trimmed.match(/^(.+?)\s*\|\|\s*(.+)$/);
    if (orMatch) {
      return this._isTruthy(this._evaluateExpression(orMatch[1])) ||
             this._isTruthy(this._evaluateExpression(orMatch[2]));
    }

    // Logical NOT
    const notMatch = trimmed.match(/^!\s*(.+)$/);
    if (notMatch) {
      return !this._isTruthy(this._evaluateExpression(notMatch[1]));
    }

    // Arithmetic with + - * / %
    // Process from lowest precedence (keep rightmost operator for left-to-right)
    const addSubMatch = trimmed.match(/^(.+)\s*([+-])\s*([^+-]+)$/);
    if (addSubMatch) {
      const lhs = this._resolveFloat(addSubMatch[1]);
      const rhs = this._resolveFloat(addSubMatch[3]);
      return addSubMatch[2] === '+' ? lhs + rhs : lhs - rhs;
    }

    const mulDivMatch = trimmed.match(/^(.+)\s*([*/%])\s*([^*/%]+)$/);
    if (mulDivMatch) {
      const lhs = this._resolveFloat(mulDivMatch[1]);
      const rhs = this._resolveFloat(mulDivMatch[3]);
      switch (mulDivMatch[2]) {
        case '*': return lhs * rhs;
        case '/': return rhs === 0 ? 0 : lhs / rhs;
        case '%': return rhs === 0 ? 0 : lhs % rhs;
      }
    }

    // Bitwise operators
    const bitOrMatch = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);
    if (bitOrMatch && !trimmed.includes('||')) {
      return this._resolveInt(bitOrMatch[1]) | this._resolveInt(bitOrMatch[2]);
    }

    const bitAndMatch = trimmed.match(/^(.+?)\s*&\s*(.+)$/);
    if (bitAndMatch && !trimmed.includes('&&')) {
      return this._resolveInt(bitAndMatch[1]) & this._resolveInt(bitAndMatch[2]);
    }

    // Bit shift
    const shiftMatch = trimmed.match(/^(.+?)\s*(<<|>>)\s*(.+)$/);
    if (shiftMatch) {
      const lhs = this._resolveInt(shiftMatch[1]);
      const rhs = this._resolveInt(shiftMatch[3]);
      return shiftMatch[2] === '<<' ? lhs << rhs : lhs >> rhs;
    }

    // Bitwise NOT
    const bitNotMatch = trimmed.match(/^~\s*(.+)$/);
    if (bitNotMatch) {
      return ~this._resolveInt(bitNotMatch[1]);
    }

    // Cast expressions: (int)x, (float)x, (byte)x
    const castMatch = trimmed.match(/^\((\w+)\)\s*(.+)$/);
    if (castMatch) {
      const targetType = castMatch[1];
      const inner = this._evaluateExpression(castMatch[2]);
      const innerNum = typeof inner === 'number' ? inner : 0;
      if (targetType === 'int' || targetType === 'long') { return Math.floor(innerNum); }
      if (targetType === 'byte') { return innerNum & 0xFF; }
      return innerNum;
    }

    // Variable reference
    const varVal = this._resolveVariable(trimmed);
    if (varVal !== undefined) { return varVal; }

    // Function call that returns a value
    const funcMatch = trimmed.match(/^(\w+)\s*\(([^)]*)\)$/);
    if (funcMatch) {
      const result = this._callUserFunction(funcMatch[1], funcMatch[2]);
      if (result !== undefined) { return result; }
    }

    // Fall through — try as number
    const n = parseFloat(trimmed);
    if (!Number.isNaN(n)) { return n; }

    return 0;
  }

  private _isTruthy(val: number | string | boolean): boolean {
    if (typeof val === 'boolean') { return val; }
    if (typeof val === 'number') { return val !== 0; }
    if (typeof val === 'string') { return val.length > 0; }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Variable resolution
  // ---------------------------------------------------------------------------

  private _resolveVariable(name: string): number | string | boolean | undefined {
    // Check local scope first (call stack top)
    for (let i = this._callStack.length - 1; i >= 0; i--) {
      const local = this._callStack[i].locals.get(name);
      if (local) { return local.value; }
    }
    // Check globals
    const global = this._mcu.variables.get(name);
    if (global) { return global.value; }
    return undefined;
  }

  private _setVariable(name: string, value: number | string | boolean): void {
    // Check local scope first
    for (let i = this._callStack.length - 1; i >= 0; i--) {
      const local = this._callStack[i].locals.get(name);
      if (local) {
        local.value = value;
        this._mcu.variables.set(name, local);
        return;
      }
    }
    // Set global
    const existing = this._mcu.variables.get(name);
    if (existing) {
      existing.value = value;
    } else {
      this._mcu.variables.set(name, { name, type: 'int', value, scope: 'global' });
    }
  }

  private _resolveInt(expr: string): number {
    const val = this._evaluateExpression(expr);
    if (typeof val === 'number') { return Math.floor(val); }
    if (typeof val === 'boolean') { return val ? 1 : 0; }
    return parseInt(String(val), 10) || 0;
  }

  private _resolveFloat(expr: string): number {
    const val = this._evaluateExpression(expr);
    if (typeof val === 'number') { return val; }
    if (typeof val === 'boolean') { return val ? 1 : 0; }
    return parseFloat(String(val)) || 0;
  }

  private _resolveSerialArg(arg: string): string {
    const trimmed = arg.trim();
    if (trimmed === '') { return ''; }

    // String literal
    const strMatch = trimmed.match(/^"(.*)"$/);
    if (strMatch) { return strMatch[1]; }

    // String concatenation
    if (trimmed.includes('"') && trimmed.includes('+')) {
      return String(this._resolveStringConcat(trimmed));
    }

    const val = this._evaluateExpression(trimmed);
    return String(val);
  }

  private _resolveStringConcat(expr: string): string {
    // Split on + but respect quoted strings
    const parts: string[] = [];
    let current = '';
    let inStr = false;
    for (const ch of expr) {
      if (ch === '"') {
        inStr = !inStr;
        current += ch;
      } else if (ch === '+' && !inStr) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.map((p) => {
      const sm = p.match(/^"(.*)"$/);
      if (sm) { return sm[1]; }
      const val = this._evaluateExpression(p);
      return String(val);
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // User function calls
  // ---------------------------------------------------------------------------

  private _callUserFunction(name: string, argsStr: string): number | string | boolean | undefined {
    if (!this._sketch) { return undefined; }
    const func = this._sketch.functions.get(name);
    if (!func) { return undefined; }

    const ctx: ExecContext = { locals: new Map() };

    // Parse arguments
    const args = argsStr.split(',').map((a) => a.trim()).filter((a) => a !== '');
    func.params.forEach((param, idx) => {
      const paramName = param.replace(/^\w+\s+/, '').trim(); // strip type
      const value = idx < args.length ? this._evaluateExpression(args[idx]) : 0;
      ctx.locals.set(paramName, { name: paramName, type: 'int', value, scope: 'local' });
    });

    this._callStack.push(ctx);
    // Execute function body
    let i = 0;
    while (i < func.body.length) {
      if (this._shouldStop()) { break; }
      const line = func.body[i].trim();

      // return statement
      const returnMatch = line.match(/^return\s+(.+?)\s*;?\s*$/);
      if (returnMatch) {
        const retVal = this._evaluateExpression(returnMatch[1]);
        this._callStack.pop();
        return retVal;
      }

      this._executeLine(line);
      i++;
    }

    this._callStack.pop();
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Read-only accessors for MCU state
  // ---------------------------------------------------------------------------

  getSerialOutput(): string[] {
    return [...this._mcu.serial.output];
  }

  getSerial1Output(): string[] {
    return [...this._mcu.serial1.output];
  }

  getPinState(pin: number): PinState | undefined {
    const state = this._mcu.pins.get(pin);
    return state ? { ...state } : undefined;
  }

  getVariable(name: string): SimVariable | undefined {
    const v = this._mcu.variables.get(name);
    return v ? { ...v } : undefined;
  }

  getAllVariables(): SimVariable[] {
    return Array.from(this._mcu.variables.values()).map((v) => ({ ...v }));
  }

  getMillis(): number {
    return this._mcu.millis;
  }

  getMicros(): number {
    return this._mcu.micros;
  }

  getStatus(): SimulatorStatus {
    return this._status;
  }

  getExecutionCount(): number {
    return this._executionCount;
  }

  getElapsedMs(): number {
    return this._elapsedMs;
  }

  getLoopIndex(): number {
    return this._loopIndex;
  }

  isSetupDone(): boolean {
    return this._setupDone;
  }

  getSketchName(): string {
    return this._sketchName;
  }
}
