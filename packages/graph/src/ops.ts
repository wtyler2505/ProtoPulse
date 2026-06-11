import { z } from 'zod';

import type {
  ActorId,
  ConstraintBody,
  Rot,
  Uuid,
  Vec,
  WireSegment,
} from './types.js';

/**
 * The operation taxonomy — Vol II §A.5.
 *
 * Ops are minimal (a drag emits one final move_symbol), self-contained
 * (payloads carry everything needed to apply without external lookups —
 * including pre-allocated IDs for created entities), and forward-only
 * (undo emits the inverse op; history is honest about what happened).
 */

// ── Primitive schemas ────────────────────────────────────────────────
// Integer-nm validation lives here, at the zod boundary.

const zNm = z.number().int();
const zVec: z.ZodType<Vec> = z.object({ x: zNm, y: zNm });
const zRot: z.ZodType<Rot> = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
const zUuid = z.string().min(1);
const zPortRef = z.string().regex(/^.+:.+$/, 'PortRef must be componentId:pinKey');
const zWireSegment: z.ZodType<WireSegment> = z.object({ a: zVec, b: zVec });

const zNetSelector = z.union([
  z.object({ kind: z.literal('net'), netId: zUuid }),
  z.object({ kind: z.literal('class'), netClass: z.string() }),
]);

const zConstraintBody: z.ZodType<ConstraintBody> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('current_max'), netId: zUuid, amps: z.number().positive() }),
  z.object({
    kind: z.literal('voltage_domain'),
    name: z.string(),
    volts: z.number(),
    netIds: z.array(zUuid),
  }),
  z.object({
    kind: z.literal('diff_pair'),
    p: zUuid,
    n: zUuid,
    targetOhms: z.number().positive(),
    maxSkewNm: zNm,
  }),
  z.object({ kind: z.literal('length_match'), netIds: z.array(zUuid), toleranceNm: zNm }),
  z.object({
    kind: z.literal('keepout'),
    layerId: z.string(),
    polygon: z.array(zVec),
    reason: z.string(),
  }),
  z.object({ kind: z.literal('thermal_limit'), componentId: zUuid, maxC: z.number() }),
  z.object({ kind: z.literal('clearance_override'), a: zNetSelector, b: zNetSelector, nm: zNm }),
]);

// ── Graph ops ────────────────────────────────────────────────────────

// Component IDs are the left half of PortRefs (componentId:pinKey), so
// they must never contain the separator.
const zComponentId = z.string().min(1).regex(/^[^:]+$/, 'component id must not contain ":"');

const zAddComponent = z.object({
  kind: z.literal('add_component'),
  id: zComponentId,
  ref: z.string().min(1),
  partId: zUuid,
  partRev: z.number().int().nonnegative(),
  value: z.string().optional(),
});

const zRemoveComponent = z.object({ kind: z.literal('remove_component'), id: zUuid });

const zSetComponentProps = z.object({
  kind: z.literal('set_component_props'),
  id: zUuid,
  props: z.object({
    ref: z.string().min(1).optional(),
    value: z.string().nullable().optional(),
    dnp: z.boolean().optional(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

/**
 * connect with no netId creates a net — the created net's id is the
 * pre-allocated newNetId so the op stays self-contained and replayable.
 */
const zConnect = z.object({
  kind: z.literal('connect'),
  port: zPortRef,
  netId: zUuid.optional(),
  newNetId: zUuid.optional(),
});

const zDisconnect = z.object({ kind: z.literal('disconnect'), port: zPortRef });

const zMergeNets = z.object({
  kind: z.literal('merge_nets'),
  survivor: zUuid,
  absorbed: zUuid,
});

const zSplitNet = z.object({
  kind: z.literal('split_net'),
  netId: zUuid,
  movedPorts: z.array(zPortRef).min(1),
  newNetId: zUuid,
});

const zRenameNet = z.object({ kind: z.literal('rename_net'), netId: zUuid, name: z.string().min(1) });
const zSetNetClass = z.object({ kind: z.literal('set_net_class'), netId: zUuid, netClass: z.string() });

const zAddConstraint = z.object({
  kind: z.literal('add_constraint'),
  id: zUuid,
  body: zConstraintBody,
  rationale: z.string().optional(),
});
const zRemoveConstraint = z.object({ kind: z.literal('remove_constraint'), id: zUuid });

// ── Schematic view ops ───────────────────────────────────────────────

const zPlaceSymbol = z.object({
  kind: z.literal('place_symbol'),
  componentId: zUuid,
  at: zVec,
  rot: zRot,
  mirror: z.boolean(),
});
const zMoveSymbol = z.object({
  kind: z.literal('move_symbol'),
  componentId: zUuid,
  at: zVec,
  rot: zRot,
  mirror: z.boolean(),
});
/** Inverse of a first placement — keeps the op set closed under inversion. */
const zUnplaceSymbol = z.object({ kind: z.literal('unplace_symbol'), componentId: zUuid });

const zSetWireGeometry = z.object({
  kind: z.literal('set_wire_geometry'),
  netId: zUuid,
  segments: z.array(zWireSegment),
});

// ── PCB view ops ─────────────────────────────────────────────────────

// Trace/via IDs are pre-allocated by the op (self-contained ops rule)
// and colon-free like component IDs, keeping every entity ID grep-safe.
const zPcbGeomId = z.string().min(1).regex(/^[^:]+$/, 'pcb geometry id must not contain ":"');

const zPlaceFootprint = z.object({
  kind: z.literal('place_footprint'),
  componentId: zUuid,
  at: zVec,
  rotMilli: z.number().int().min(0).max(359999),
  side: z.union([z.literal('top'), z.literal('bottom')]),
  locked: z.boolean(),
});
const zMoveFootprint = z.object({
  kind: z.literal('move_footprint'),
  componentId: zUuid,
  at: zVec,
  rotMilli: z.number().int().min(0).max(359999),
  side: z.union([z.literal('top'), z.literal('bottom')]),
  locked: z.boolean(),
});
/** Inverse of a first footprint placement — op set stays closed under inversion. */
const zUnplaceFootprint = z.object({ kind: z.literal('unplace_footprint'), componentId: zUuid });

const zRouteTrace = z.object({
  kind: z.literal('route_trace'),
  id: zPcbGeomId,
  netId: zUuid,
  layerId: z.string(),
  widthNm: zNm,
  path: z.array(zVec).min(2),
});
const zRemoveTrace = z.object({ kind: z.literal('remove_trace'), id: zUuid });
const zPlaceVia = z.object({
  kind: z.literal('place_via'),
  id: zPcbGeomId,
  netId: zUuid,
  at: zVec,
  drillNm: zNm,
  padNm: zNm,
  span: z.tuple([z.string(), z.string()]),
});
const zRemoveVia = z.object({ kind: z.literal('remove_via'), id: zUuid });

const zPlaceZone = z.object({
  kind: z.literal('place_zone'),
  id: zPcbGeomId,
  netId: zUuid,
  layerId: z.string().min(1),
  outline: z.array(zVec).min(3),
  clearanceNm: zNm.optional(),
});
const zRemoveZone = z.object({ kind: z.literal('remove_zone'), id: zUuid });

// ── Buses & sheets (Vol II A.5; remove ops added for inverse closure) ─

const zBusKind = z.enum(['SPI', 'I2C', 'UART', 'USB', 'CAN', 'PWR', 'GPIO', 'custom']);
const zCreateBus = z.object({
  kind: z.literal('create_bus'),
  id: zUuid,
  name: z.string().min(1),
  busKind: zBusKind,
});
const zRemoveBus = z.object({ kind: z.literal('remove_bus'), id: zUuid });
const zAssignToBus = z.object({
  kind: z.literal('assign_to_bus'),
  netId: zUuid,
  /** null detaches the net from its bus. */
  busId: zUuid.nullable(),
});

const zSheetPort = z.object({
  name: z.string().min(1),
  direction: z.enum(['in', 'out', 'inout']),
  netId: zUuid,
});
const zAddSheet = z.object({
  kind: z.literal('add_sheet'),
  id: zUuid,
  name: z.string().min(1),
  parentId: zUuid.nullable(),
});
const zRemoveSheet = z.object({ kind: z.literal('remove_sheet'), id: zUuid });
const zSetSheetInterface = z.object({
  kind: z.literal('set_sheet_interface'),
  sheetId: zUuid,
  interface: z.array(zSheetPort),
});
const zMoveToSheet = z.object({
  kind: z.literal('move_to_sheet'),
  componentId: zUuid,
  /** null moves the component back to the root sheet. */
  sheetId: zUuid.nullable(),
});

// ── Meta ops ─────────────────────────────────────────────────────────

const zCheckpoint = z.object({ kind: z.literal('checkpoint'), label: z.string() });
const zAnnotate = z.object({
  kind: z.literal('annotate'),
  anchor: z.string(),
  text: z.string(),
});
const zSetDesignMeta = z.object({
  kind: z.literal('set_design_meta'),
  patch: z.record(z.string(), z.string()),
});

export type OpBody =
  | z.infer<typeof zAddComponent>
  | z.infer<typeof zRemoveComponent>
  | z.infer<typeof zSetComponentProps>
  | z.infer<typeof zConnect>
  | z.infer<typeof zDisconnect>
  | z.infer<typeof zMergeNets>
  | z.infer<typeof zSplitNet>
  | z.infer<typeof zRenameNet>
  | z.infer<typeof zSetNetClass>
  | z.infer<typeof zAddConstraint>
  | z.infer<typeof zRemoveConstraint>
  | z.infer<typeof zPlaceSymbol>
  | z.infer<typeof zMoveSymbol>
  | z.infer<typeof zUnplaceSymbol>
  | z.infer<typeof zSetWireGeometry>
  | z.infer<typeof zPlaceFootprint>
  | z.infer<typeof zMoveFootprint>
  | z.infer<typeof zUnplaceFootprint>
  | z.infer<typeof zRouteTrace>
  | z.infer<typeof zRemoveTrace>
  | z.infer<typeof zPlaceVia>
  | z.infer<typeof zRemoveVia>
  | z.infer<typeof zPlaceZone>
  | z.infer<typeof zRemoveZone>
  | z.infer<typeof zCreateBus>
  | z.infer<typeof zRemoveBus>
  | z.infer<typeof zAssignToBus>
  | z.infer<typeof zAddSheet>
  | z.infer<typeof zRemoveSheet>
  | z.infer<typeof zSetSheetInterface>
  | z.infer<typeof zMoveToSheet>
  | z.infer<typeof zCheckpoint>
  | z.infer<typeof zAnnotate>
  | z.infer<typeof zSetDesignMeta>
  | { kind: 'batch'; ops: OpBody[]; label: string; parents?: [string, string] };

/** Atomic compound — one undo unit. "AI placed decoupling network" is one batch. */
const zBatch: z.ZodType<{ kind: 'batch'; ops: OpBody[]; label: string; parents?: [string, string] }> =
  z.object({
    kind: z.literal('batch'),
    ops: z.array(z.lazy(() => opBodySchema)),
    label: z.string(),
    /** Merge commits carry both parent pointers — the DAG is real. */
    parents: z.tuple([z.string(), z.string()]).optional(),
  });

export const opBodySchema: z.ZodType<OpBody> = z.union([
  z.discriminatedUnion('kind', [
    zAddComponent,
    zRemoveComponent,
    zSetComponentProps,
    zConnect,
    zDisconnect,
    zMergeNets,
    zSplitNet,
    zRenameNet,
    zSetNetClass,
    zAddConstraint,
    zRemoveConstraint,
    zPlaceSymbol,
    zMoveSymbol,
    zUnplaceSymbol,
    zSetWireGeometry,
    zPlaceFootprint,
    zMoveFootprint,
    zUnplaceFootprint,
    zRouteTrace,
    zRemoveTrace,
    zPlaceVia,
    zRemoveVia,
    zPlaceZone,
    zRemoveZone,
    zCreateBus,
    zRemoveBus,
    zAssignToBus,
    zAddSheet,
    zRemoveSheet,
    zSetSheetInterface,
    zMoveToSheet,
    zCheckpoint,
    zAnnotate,
    zSetDesignMeta,
  ]),
  zBatch,
]);

export interface OpMeta {
  rationale?: string;
  agent?: string;
  reviewFindingId?: Uuid;
}

/**
 * Operations are identified by (actor, lamport): actor = device/agent
 * UUID, lamport = per-actor monotonic counter. Total order for
 * materialization is (lamport, actorId) lexicographic — deterministic on
 * every replica, no wall clocks involved. `ts` is advisory only.
 */
export interface OpEnvelope {
  actor: ActorId;
  lamport: number;
  ts: number;
  op: OpBody;
  meta?: OpMeta;
}

export const opEnvelopeSchema: z.ZodType<OpEnvelope> = z.object({
  actor: z.string().min(1),
  lamport: z.number().int().nonnegative(),
  ts: z.number(),
  op: opBodySchema,
  meta: z
    .object({
      rationale: z.string().optional(),
      agent: z.string().optional(),
      reviewFindingId: zUuid.optional(),
    })
    .optional(),
});

export type OpId = `${ActorId}@${number}`;

export function opId(env: Pick<OpEnvelope, 'actor' | 'lamport'>): OpId {
  return `${env.actor}@${env.lamport}`;
}

/** Total materialization order: (lamport asc, actorId lexicographic). */
export function compareEnvelopes(a: OpEnvelope, b: OpEnvelope): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  return a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0;
}
