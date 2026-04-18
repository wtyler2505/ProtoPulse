/**
 * Barrel re-exports for the code-simulator module.
 *
 * Created during the oversized-file split (T2).
 */

export type {
  Listener,
  PinMode,
  PinState,
  SerialBuffer,
  McuState,
  SimVariableType,
  SimVariable,
  InterruptHandler,
  SimulatorStatus,
  BreakpointInfo,
  SimulatorError,
  SensorInput,
  BoardProfile,
  SimulatorSnapshot,
  ParsedSketch,
  ParsedFunction,
  ExecContext,
} from './types';

export {
  BOARD_PROFILES,
  DEFAULT_BOARD,
  MAX_SERIAL_LINES,
  MAX_EXECUTION_STEPS,
  DEFAULT_BAUD,
  HIGH,
  LOW,
  LED_BUILTIN,
} from './board-profiles';

export { parseSketch } from './parser';
