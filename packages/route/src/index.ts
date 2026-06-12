/**
 * @protopulse/route — interactive routing for the board editor.
 *
 * Milestone slice: walkaround head routing (Vol II §E.1 step 1).
 * Full push-and-shove is deliberately deferred; this package owns the
 * obstacle model and the pure routing math, the app owns the tool UX.
 */
export {
  BOTTOM_LAYER,
  buildObstacleSet,
  makeObstacle,
  makeObstacleSet,
  queryObstacles,
  segObstacleDistance,
  segmentViolates,
  TOP_LAYER,
  type BuildObstaclesOpts,
  type FootprintLike,
  type FootprintPadLike,
  type FootprintSource,
  type Obstacle,
  type ObstacleSet,
  type ObstacleShape,
} from './obstacles.js';
export {
  DEFAULT_DEPTH_CAP,
  firstHit,
  pathIsClear,
  routeHead,
  type RouteHeadOpts,
  type RouteHeadResult,
} from './walkaround.js';
export {
  pathIsLegal,
  planShove,
  type ShoveOpts,
  type ShoveReroute,
  type ShoveResult,
} from './shove.js';
export { computePour, pourArea, DEFAULT_SPOKE_WIDTH_NM, type PourPolygon, type PourResult } from './pour.js';
export type { Aabb, Rect } from './geom.js';
