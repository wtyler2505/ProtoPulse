/**
 * @protopulse/drc — geometric design rules against a fab rule deck.
 * Findings share ERC's shape: anchored to real entities, every code
 * indexing the concepts wiki.
 */
export { runDrc, TOP_LAYER, BOTTOM_LAYER } from './run.js';
export { conceptFor, DRC_CODES } from './codes.js';
export {
  inflateAabb,
  pointSegDistance,
  rectAabb,
  rectRectDistance,
  segAabb,
  segRectDistance,
  segSegDistance,
  segmentsIntersect,
  type Aabb,
  type Rect,
} from './geom.js';
