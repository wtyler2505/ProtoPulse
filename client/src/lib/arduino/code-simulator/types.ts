/**
 * Type definitions for the Arduino code simulator.
 *
 * Extracted from code-simulator.ts during the oversized-file split (T2).
 * Pure types — no runtime behavior, no dependencies on other simulator modules.
 */

export type Listener = () => void;

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

export interface ExecContext {
  locals: Map<string, SimVariable>;
  returnValue?: number | string | boolean;
}
