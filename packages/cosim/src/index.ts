/**
 * @protopulse/cosim — the co-sim bus (Vol II §D.3), both directions.
 *
 * Open loop (first slice): one-directional MCU→SPICE. Real firmware
 * runs on an emulated core for one window, its GPIO edges become PWL
 * voltage sources behind a series Rout (the behavioral GPIO output
 * boundary), and the analog netlist is solved over the same window.
 *
 * Closed loop (FEEDBACK slice): MCU↔SPICE, lock-stepped on a
 * conservative quantum — solved voltages feed back into the core's
 * digital inputs (Schmitt comparator) and ADC (sampler), one quantum
 * stale, with a full from-zero re-solve per quantum because the batch
 * engine cannot pause/resume. See quantum.ts for the loop's honesty.
 */
export { pinEventsToPwl, pwlCard, type PwlPoint, type PwlSpec } from './pwl.js';
export {
  bindingCard,
  inferInitialLevel,
  runCosimWindow,
  STEP_CHUNK_CYCLES,
  type RunCosimWindowArgs,
} from './run.js';
export {
  comparatorStep,
  DEFAULT_COMPARATOR,
  interpolateAt,
  runCosimClosedLoop,
  type ComparatorThresholds,
  type RunCosimClosedLoopArgs,
} from './quantum.js';
export { i2cDevicesFromGraph } from './i2c-graph.js';
export { spiDevicesFromGraph } from './spi-graph.js';
export {
  adcBindingSchema,
  closedLoopSpecSchema,
  COMPARATOR_HYST_V,
  cosimPinSchema,
  cosimWindowSpecSchema,
  DEFAULT_QUANTUM_S,
  DEFAULT_RISE_S,
  DEFAULT_ROUT_OHMS,
  DEFAULT_VIH_V,
  DEFAULT_VIL_V,
  DEFAULT_VOLTS_HIGH,
  DEFAULT_VOLTS_LOW,
  hasAdcSupport,
  inputBindingSchema,
  pinBindingSchema,
  type AdcBinding,
  type AdcCapableCore,
  type AdcReadRequest,
  type AdcSampler,
  type ClosedLoopResult,
  type ClosedLoopSpec,
  type CosimResult,
  type CosimWindowSpec,
  type InputBinding,
  type PinBinding,
} from './types.js';
