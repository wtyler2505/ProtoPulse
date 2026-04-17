/**
 * Zod schemas for circuit-design JSON blobs stored in jsonb columns.
 *
 * These mirror the TypeScript interfaces in shared/circuit-types.ts and
 * shared/component-types.ts. They exist to replace the `z.any()` bypasses
 * that previously guarded route handlers for jsonb payloads (security
 * degradation logged as task #45 — arbitrary payloads could reach storage).
 *
 * Design principles:
 * - **`.passthrough()` on every object** — we own the canonical shape today
 *   but jsonb columns evolve without migrations. Forward-compat matters:
 *   a new optional field added on the client should not break the route.
 * - **Discriminated/flexible segment schemas** — the codebase has multiple
 *   legitimate NetSegment shapes in flight (graph-edge `fromInstanceId/fromPin`
 *   from `circuit-types.ts`; line-segment `{x1,y1,x2,y2}` from
 *   `apply-code.ts` schematic layout; DSL `{irId}` from `circuit-dsl/circuit-ir.ts`).
 *   The route layer accepts any of those via `.union()`.
 * - **No `z.any()` anywhere** — every level narrows to either a concrete
 *   shape, `z.unknown()` (must be narrowed before use), or a known literal.
 * - **Runtime-only** — these schemas are pure Zod; they don't import Drizzle
 *   or server code so the browser can use them too.
 *
 * Referenced tasks: #45 (z.any() bypasses), #67 (schema/migration drift).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
}).passthrough();

// ---------------------------------------------------------------------------
// Net types (mirror shared/circuit-types.ts:85-118)
// ---------------------------------------------------------------------------

/**
 * Canonical graph-edge segment — connects two instance pins with optional
 * waypoint routing. Used by the schematic capture layer.
 */
export const netSegmentGraphSchema = z.object({
  fromInstanceId: z.number().int().nonnegative(),
  fromPin: z.string().min(1),
  toInstanceId: z.number().int().nonnegative(),
  toPin: z.string().min(1),
  waypoints: z.array(pointSchema).default([]),
}).passthrough();

/**
 * 2D line segment — x1,y1 → x2,y2. Used by the apply-code layout path.
 * See server/circuit-routes/apply-code.ts for the writer of this shape.
 */
export const netSegmentLineSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
}).passthrough();

/**
 * DSL-generated placeholder segment — only carries the IR id so downstream
 * renderers can resolve geometry later. See client/src/lib/circuit-dsl.
 */
export const netSegmentIrSchema = z.object({
  irId: z.string().min(1),
}).passthrough();

/**
 * Any valid segment shape. Zod's plain `.union()` (not discriminated) because
 * the three shapes don't share a tag — each is identified by which fields are
 * present.
 */
export const netSegmentSchema = z.union([
  netSegmentGraphSchema,
  netSegmentLineSchema,
  netSegmentIrSchema,
]);

export const netLabelViewSchema = z.enum(['schematic', 'breadboard', 'pcb']);

/**
 * Standalone label placed on a net (mirror NetLabel interface).
 */
export const netLabelSchema = z.object({
  x: z.number(),
  y: z.number(),
  text: z.string(),
  view: netLabelViewSchema,
}).passthrough();

/**
 * Net styling hints (mirror NetStyle interface). Both fields optional —
 * defaults are applied by the renderer, not the storage layer.
 */
export const netStyleSchema = z.object({
  color: z.string().optional(),
  lineStyle: z.enum(['solid', 'dashed']).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// CircuitSettings (mirror shared/circuit-types.ts:19-29)
// ---------------------------------------------------------------------------

const powerSymbolTypeSchema = z.enum([
  'VCC', 'VDD', 'V3V3', 'V5V', 'V12V',
  'GND', 'AGND', 'DGND',
  'custom',
]);

const powerSymbolSchema = z.object({
  id: z.string().min(1),
  type: powerSymbolTypeSchema,
  netName: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  customLabel: z.string().optional(),
}).passthrough();

const noConnectMarkerSchema = z.object({
  id: z.string().min(1),
  instanceId: z.number().int().nonnegative(),
  pin: z.string().min(1),
  x: z.number(),
  y: z.number(),
}).passthrough();

const schematicNetLabelSchema = z.object({
  id: z.string().min(1),
  netName: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
}).passthrough();

const schematicAnnotationSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  fontSize: z.number().positive(),
  color: z.string().min(1),
}).passthrough();

/**
 * CircuitSettings payload — jsonb blob on `circuit_designs.settings`.
 * All sub-arrays default to empty and all individual fields have sensible
 * defaults applied by the renderer, so every field here is optional.
 */
export const circuitSettingsSchema = z.object({
  gridSize: z.number().positive().optional(),
  netColors: z.record(z.string()).optional(),
  defaultBusWidth: z.number().int().positive().optional(),
  showPowerNets: z.boolean().optional(),
  showNetLabels: z.boolean().optional(),
  powerSymbols: z.array(powerSymbolSchema).optional(),
  noConnectMarkers: z.array(noConnectMarkerSchema).optional(),
  netLabels: z.array(schematicNetLabelSchema).optional(),
  annotations: z.array(schematicAnnotationSchema).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// PartMeta (mirror shared/component-types.ts:95-167)
// ---------------------------------------------------------------------------
//
// This is the richest of the blobs. It's opaque at the route boundary because
// component editing/AI flows attach a wide range of optional metadata. We
// enforce the core required fields (title, tags, mountingType, properties)
// and accept unknown extras via passthrough.

const partPropertySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  showInLabel: z.boolean().optional(),
}).passthrough();

/**
 * PartMeta — component metadata blob. Accepts the canonical shape from
 * `shared/component-types.ts:95-167` while passthrough-ing extras so new
 * optional fields (e.g. future verification metadata) don't break routes.
 */
export const partMetaSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  mountingType: z.enum(['tht', 'smd', 'other', '']),
  properties: z.array(partPropertySchema),
  // All of the following are optional per the interface.
  aliases: z.array(z.string()).optional(),
  family: z.string().optional(),
  manufacturer: z.string().optional(),
  mpn: z.string().optional(),
  description: z.string().optional(),
  packageType: z.string().optional(),
  datasheetUrl: z.string().optional(),
  version: z.string().optional(),
  breadboardFit: z.enum([
    'native',
    'requires_jumpers',
    'breakout_required',
    'not_breadboard_friendly',
  ]).optional(),
  breadboardModelQuality: z.enum(['verified', 'ai_drafted', 'community', 'basic']).optional(),
  partFamily: z.string().optional(),
  verificationStatus: z.string().optional(),
  verificationLevel: z.string().optional(),
  verificationNotes: z.array(z.string()).optional(),
  verifiedAt: z.string().optional(),
  verifiedBy: z.string().optional(),
  benchCategory: z.string().optional(),
  spiceSubcircuit: z.string().optional(),
  // sourceEvidence, visualAccuracyReport, pinAccuracyReport, inventoryHint are
  // complex nested shapes — accepted via passthrough for now. A future pass
  // can tighten them when their consumers are audited.
}).passthrough();

// ---------------------------------------------------------------------------
// Minimal PartState (for currentPart / existingMeta in AI route bodies)
// ---------------------------------------------------------------------------
//
// The AI modify/extract-pins routes accept an optional existing-part snapshot.
// We only need to know it's structurally shaped like PartState to forward it
// to the AI prompt safely; full validation of every nested sub-shape is out
// of scope for the route boundary (handled deeper in the component-editor
// code path).

// Connector / Bus shapes mirror shared/component-types.ts:73-87 fully —
// under-specifying these was a validation hole (task #45 regression).
const terminalPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
}).passthrough();

const padSpecSchema = z.object({
  type: z.enum(['tht', 'smd']),
  shape: z.enum(['circle', 'rect', 'oblong', 'square']),
  diameter: z.number().optional(),
  drill: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
}).passthrough();

const connectorSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  connectorType: z.enum(['male', 'female', 'pad']),
  shapeIds: z.record(z.array(z.string())),
  terminalPositions: z.record(terminalPositionSchema),
  padSpec: padSpecSchema.optional(),
}).passthrough();

const busSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  connectorIds: z.array(z.string()),
}).passthrough();

const viewDataSchema = z.object({
  shapes: z.array(z.unknown()),
  layerConfig: z.record(z.object({
    visible: z.boolean(),
    locked: z.boolean(),
    color: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

/**
 * PartState — a ComponentPart row as stored, with its nested meta + views.
 * Used as the `currentPart` payload for AI modify routes.
 */
export const partStateSchema = z.object({
  meta: partMetaSchema,
  connectors: z.array(connectorSchema),
  buses: z.array(busSchema),
  views: z.object({
    breadboard: viewDataSchema,
    schematic: viewDataSchema,
    pcb: viewDataSchema,
  }).passthrough(),
  constraints: z.array(z.unknown()).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Exported aliases
// ---------------------------------------------------------------------------

export type CircuitSettingsInput = z.infer<typeof circuitSettingsSchema>;
export type NetSegmentInput = z.infer<typeof netSegmentSchema>;
export type NetLabelInput = z.infer<typeof netLabelSchema>;
export type NetStyleInput = z.infer<typeof netStyleSchema>;
export type PartMetaInput = z.infer<typeof partMetaSchema>;
export type PartStateInput = z.infer<typeof partStateSchema>;
