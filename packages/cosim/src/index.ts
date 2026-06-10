/**
 * @protopulse/cosim — the co-sim bus (Vol II §D.3), first slice.
 *
 * One-directional MCU→SPICE: real firmware runs on an emulated core
 * for one window, its GPIO edges become PWL voltage sources behind a
 * series Rout (the behavioral GPIO output boundary), and the analog
 * netlist is solved over the same window. The reverse direction
 * (analog → ADC/pins) is a later slice and deliberately absent.
 */
export { pinEventsToPwl, pwlCard, type PwlPoint, type PwlSpec } from './pwl.js';
export { runCosimWindow, type RunCosimWindowArgs } from './run.js';
export {
  cosimPinSchema,
  cosimWindowSpecSchema,
  pinBindingSchema,
  DEFAULT_RISE_S,
  DEFAULT_ROUT_OHMS,
  DEFAULT_VOLTS_HIGH,
  DEFAULT_VOLTS_LOW,
  type CosimResult,
  type CosimWindowSpec,
  type PinBinding,
} from './types.js';
