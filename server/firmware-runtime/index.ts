// Barrel — firmware runtime simulation
export { SimavrRunner } from './simavr-runner';
export type { SimRunOptions, SimStatus } from './simavr-runner';

export { SimulatorProcessManager } from './process-manager';
export type { ProcessStatus, SpawnOptions, SimulatorProcessManagerEvents } from './process-manager';

export {
  RuntimeEventBuffer,
  parseUartLine,
  parseVcd,
  parseVcdHeader,
  parseVcdTimestamp,
  parseVcdValueChange,
} from './runtime-events';
export type {
  RuntimeEvent,
  PinChangeEvent,
  UartDataEvent,
  TimerTickEvent,
  CycleCountEvent,
  ErrorEvent,
  VcdSignal,
  VcdSignalMap,
} from './runtime-events';
