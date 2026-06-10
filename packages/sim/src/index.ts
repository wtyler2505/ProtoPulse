/**
 * @protopulse/sim — "The Lab" core (Vol II §D, honest v0.2 cut).
 *
 * Design graph → SPICE netlist → ngspice-WASM, with a fidelity manifest
 * on every run. Simulations never lie about what they are: every
 * component declares its model tier (spice / behavioral / stub), and
 * excluded parts are named, not silently dropped.
 */
export { analysisCard, analysisSchema, spiceNum, type Analysis } from './analyses.js';
export {
  elementName,
  emitComponent,
  isGroundPart,
  type EmitCtx,
  type Emission,
  type FidelityEntry,
  type ModelTier,
} from './models.js';
export {
  compareRefs,
  generateSpiceNetlist,
  type NetlistOpts,
  type NetlistResult,
} from './netlist.js';
export { SpiceEngine, vectorByName, type SimResult, type SimVector } from './engine.js';
export { fidelitySummary, simulate, type SimulateOpts, type SimulateResult } from './run.js';
