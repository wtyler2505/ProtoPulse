/**
 * @protopulse/graph — the canonical design graph.
 *
 * One graph, many projections: schematic, breadboard, PCB, BOM, and
 * simulation are views of this model. The design IS its operation log;
 * the graph is a materialized view. (Vision Vol I §1, Vol II §A.)
 */
export * from './types.js';
export * from './ids.js';
export * from './ops.js';
export { applyOp, type ApplyResult, type ApplyWarning } from './apply.js';
export {
  materialize,
  type MaterializeOpts,
  type MaterializeResult,
  type MaterializeWarning,
} from './materialize.js';
export { validateGraph, type InvariantOpts, type InvariantViolation } from './invariants.js';
export { invertOp } from './inverse.js';
export { BranchLog, MAIN_BRANCH, type BranchRef, type BranchState } from './branch.js';
export {
  diff,
  isEmptyDelta,
  netFingerprint,
  type GraphDelta,
  type NetMembershipDelta,
  type PropDelta,
} from './diff.js';
export { threeWayMerge, type MergeConflict, type MergeResult } from './merge.js';
export {
  parseValue,
  type ComponentClass,
  type ParsedValue,
  type ParseError,
  type Unit,
} from './value-parser.js';
export {
  decodeBundle,
  decodeOpl,
  designBundleSchema,
  encodeBundle,
  encodeOpl,
  graphFromJson,
  graphToJson,
  PPX_FORMAT_VERSION,
  type DesignBundle,
  type GraphSnapshotJson,
} from './store/serialize.js';
