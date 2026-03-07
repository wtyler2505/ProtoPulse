/**
 * Circuit IR — JSON Intermediate Representation for code-authored circuits.
 *
 * Bridges the DSL builder API with the existing visual editor data model
 * (InsertCircuitInstance, InsertCircuitNet, InsertCircuitWire from shared/schema).
 */

import { z } from 'zod';
import type {
  CircuitInstanceRow,
  CircuitNetRow,
  CircuitWireRow,
  ComponentPart,
  InsertCircuitInstance,
  InsertCircuitNet,
  InsertCircuitWire,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const IRComponentSchema = z.object({
  id: z.string().min(1),
  refdes: z.string().min(1),
  partId: z.string().min(1),
  value: z.string().optional(),
  footprint: z.string().optional(),
  pins: z.record(z.string(), z.string()).refine((pins) => Object.keys(pins).length > 0, {
    message: 'Component must have at least one pin',
  }),
});

const IRNetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['signal', 'power', 'ground']),
});

const IRWireSchema = z.object({
  id: z.string().min(1),
  netId: z.string().min(1),
  points: z.array(PointSchema).min(2),
});

const IRMetaSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/**
 * Full Circuit IR schema with cross-reference validation:
 * - No duplicate component IDs or refdes
 * - No duplicate net IDs or names
 * - All pin net references must match a declared net name
 * - All wire netId references must match a declared net ID
 */
export const CircuitIRSchema = z
  .object({
    meta: IRMetaSchema,
    components: z.array(IRComponentSchema),
    nets: z.array(IRNetSchema),
    wires: z.array(IRWireSchema),
  })
  .superRefine((data, ctx) => {
    // Unique component IDs
    const compIds = new Set<string>();
    for (const comp of data.components) {
      if (compIds.has(comp.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate component id: ${comp.id}`,
          path: ['components'],
        });
      }
      compIds.add(comp.id);
    }

    // Unique refdes
    const refdesSet = new Set<string>();
    for (const comp of data.components) {
      if (refdesSet.has(comp.refdes)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate refdes: ${comp.refdes}`,
          path: ['components'],
        });
      }
      refdesSet.add(comp.refdes);
    }

    // Unique net IDs
    const netIds = new Set<string>();
    for (const net of data.nets) {
      if (netIds.has(net.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate net id: ${net.id}`,
          path: ['nets'],
        });
      }
      netIds.add(net.id);
    }

    // Unique net names
    const netNames = new Set<string>();
    for (const net of data.nets) {
      if (netNames.has(net.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate net name: ${net.name}`,
          path: ['nets'],
        });
      }
      netNames.add(net.name);
    }

    // All pin references must resolve to a declared net name
    for (let ci = 0; ci < data.components.length; ci++) {
      const comp = data.components[ci];
      for (const [pin, netName] of Object.entries(comp.pins)) {
        if (!netNames.has(netName)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Component ${comp.refdes} pin "${pin}" references unknown net "${netName}"`,
            path: ['components', ci, 'pins', pin],
          });
        }
      }
    }

    // All wire netId references must resolve to a declared net ID
    for (let wi = 0; wi < data.wires.length; wi++) {
      const wire = data.wires[wi];
      if (!netIds.has(wire.netId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Wire ${wire.id} references unknown net id "${wire.netId}"`,
          path: ['wires', wi, 'netId'],
        });
      }
    }
  });

export type CircuitIR = z.infer<typeof CircuitIRSchema>;
export type IRComponent = z.infer<typeof IRComponentSchema>;
export type IRNet = z.infer<typeof IRNetSchema>;
export type IRWire = z.infer<typeof IRWireSchema>;

// Also re-export the interface-style types for backward compatibility
export type CircuitIRMeta = CircuitIR['meta'];
export type CircuitIRComponent = IRComponent;
export type CircuitIRNet = IRNet;
export type CircuitIRWire = IRWire;

// ---------------------------------------------------------------------------
// irToInsertSchemas — convert IR to database insert shapes
// ---------------------------------------------------------------------------

export interface InsertSchemasResult {
  instances: InsertCircuitInstance[];
  nets: InsertCircuitNet[];
  wires: InsertCircuitWire[];
}

/**
 * Convert a validated CircuitIR to arrays of database insert schemas.
 *
 * Wire `netId` values are set to the 0-based index of the corresponding net
 * in the returned `nets` array. The caller is responsible for resolving these
 * indices to real database IDs after inserting the nets.
 */
export function irToInsertSchemas(ir: CircuitIR, circuitId: number): InsertSchemasResult {
  // Build net ID -> index map for wire resolution
  const netIdToIndex = new Map<string, number>();
  ir.nets.forEach((net, i) => {
    netIdToIndex.set(net.id, i);
  });

  const instances: InsertCircuitInstance[] = ir.components.map((comp) => ({
    circuitId,
    partId: null,
    referenceDesignator: comp.refdes,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    properties: {
      irId: comp.id,
      irPartId: comp.partId,
      value: comp.value,
      footprint: comp.footprint,
      pins: comp.pins,
    },
  }));

  const nets: InsertCircuitNet[] = ir.nets.map((net) => ({
    circuitId,
    name: net.name,
    netType: net.type === 'ground' ? 'ground' : net.type,
    segments: [{ irId: net.id }],
    labels: [],
    style: {},
  }));

  const wires: InsertCircuitWire[] = ir.wires.map((wire) => ({
    circuitId,
    netId: netIdToIndex.get(wire.netId) ?? 0,
    view: 'schematic' as const,
    points: wire.points,
    width: 1.0,
  }));

  return { instances, nets, wires };
}

// ---------------------------------------------------------------------------
// circuitToIR — reverse: database rows → IR
// ---------------------------------------------------------------------------

/**
 * Convert existing circuit database rows back to a CircuitIR.
 *
 * The `parts` parameter is optional — when provided, footprint metadata
 * is extracted from the part's `meta` field.
 */
export function circuitToIR(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  wires: CircuitWireRow[],
  parts?: ComponentPart[],
): CircuitIR {
  // Build a map of database net ID -> IR net id (stable, derived from DB id)
  const dbNetIdToIrId = new Map<number, string>();
  const irNets: CircuitIR['nets'] = nets.map((net) => {
    // Prefer stored irId from segments metadata, otherwise generate from DB id
    const segments = net.segments as Array<{ irId?: string }> | null;
    const irId = segments?.[0]?.irId ?? `net-db-${String(net.id)}`;
    dbNetIdToIrId.set(net.id, irId);
    return {
      id: irId,
      name: net.name,
      type: (net.netType === 'ground' ? 'ground' : net.netType === 'power' ? 'power' : 'signal') as
        | 'signal'
        | 'power'
        | 'ground',
    };
  });

  // Build part lookup
  const partMap = new Map<number, ComponentPart>();
  if (parts) {
    for (const p of parts) {
      partMap.set(p.id, p);
    }
  }

  const irComponents: CircuitIR['components'] = instances.map((inst) => {
    const props = inst.properties as Record<string, unknown> | null;
    const irId = (props?.irId as string) ?? `inst-db-${String(inst.id)}`;
    const irPartId = (props?.irPartId as string) ?? String(inst.partId ?? 'unknown');
    const value = props?.value as string | undefined;
    const pins = (props?.pins as Record<string, string>) ?? {};

    // Extract footprint from properties or part meta
    let footprint = props?.footprint as string | undefined;
    if (!footprint && inst.partId !== null) {
      const part = partMap.get(inst.partId);
      if (part) {
        const meta = part.meta as Record<string, unknown> | null;
        footprint = meta?.footprint as string | undefined;
      }
    }

    const comp: IRComponent = {
      id: irId,
      refdes: inst.referenceDesignator,
      partId: irPartId,
      pins,
    };
    if (value !== undefined) {
      comp.value = value;
    }
    if (footprint !== undefined) {
      comp.footprint = footprint;
    }
    return comp;
  });

  const irWires: CircuitIR['wires'] = wires.map((wire, i) => {
    const irNetId = dbNetIdToIrId.get(wire.netId) ?? '';
    return {
      id: `wire-db-${String(wire.id ?? i)}`,
      netId: irNetId,
      points: wire.points as Array<{ x: number; y: number }>,
    };
  });

  return {
    meta: { name: 'Circuit', version: '1.0.0' },
    components: irComponents,
    nets: irNets,
    wires: irWires,
  };
}
