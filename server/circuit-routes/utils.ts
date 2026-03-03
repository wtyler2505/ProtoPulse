import type { IStorage } from '../storage';
import { z } from 'zod';

// Re-export shared utilities from routes/utils
export { HttpError, asyncHandler, parseIdParam, payloadLimit } from '../routes/utils';

export const circuitPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

// Reference designator prefix map (subset for common architecture block types)
export const TYPE_PREFIX: Record<string, string> = {
  microcontroller: 'U', mcu: 'U', ic: 'U', processor: 'U', fpga: 'U',
  sensor: 'U', module: 'U', opamp: 'U', amplifier: 'U',
  resistor: 'R', capacitor: 'C', inductor: 'L',
  diode: 'D', led: 'D', transistor: 'Q', mosfet: 'Q',
  connector: 'J', header: 'J', switch: 'SW', relay: 'K',
  regulator: 'U', converter: 'U', driver: 'U',
  crystal: 'Y', oscillator: 'Y', transformer: 'T',
  fuse: 'F', battery: 'BT', motor: 'M', speaker: 'SP',
};

export interface NetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

export const DEFAULT_BOARD_WIDTH = 50;
export const DEFAULT_BOARD_HEIGHT = 40;
export const MAX_BOARD_DIMENSION = 1000;

export const boardDimensionsSchema = z.object({
  boardWidth: z.coerce.number().positive().max(MAX_BOARD_DIMENSION).optional(),
  boardHeight: z.coerce.number().positive().max(MAX_BOARD_DIMENSION).optional(),
});

export const exportFormatSchema = z.object({
  format: z.string().optional(),
  paperSize: z.enum(['A4', 'A3', 'letter', 'tabloid']).optional(),
  scale: z.enum(['fit', '1:1']).optional(),
  bomFormat: z.enum(['jlcpcb', 'mouser', 'digikey', 'generic']).optional(),
  netlistFormat: z.enum(['spice', 'kicad', 'csv']).optional(),
  origin: z.enum(['board-center', 'bottom-left']).optional(),
  includeHeader: z.boolean().optional(),
  groupByPartNumber: z.boolean().optional(),
  boardWidth: z.coerce.number().positive().max(MAX_BOARD_DIMENSION).optional(),
  boardHeight: z.coerce.number().positive().max(MAX_BOARD_DIMENSION).optional(),
});

/**
 * Gather full circuit data for export/simulation endpoints.
 * Returns null if the circuit does not exist.
 */
export async function gatherCircuitData(storage: IStorage, circuitId: number) {
  const circuit = await storage.getCircuitDesign(circuitId);
  if (!circuit) { return null; }
  const instances = await storage.getCircuitInstances(circuitId);
  const nets = await storage.getCircuitNets(circuitId);
  const wires = await storage.getCircuitWires(circuitId);
  const parts = await storage.getComponentParts(circuit.projectId);
  const partsMap = new Map<number, typeof parts[0]>();
  for (const p of parts) { partsMap.set(p.id, p); }
  return { circuit, instances, nets, wires, parts, partsMap };
}

/**
 * Generate the next reference designator for a given node type.
 * Uses the provided counters map to track prefix usage across calls.
 */
export function nextRefDes(
  nodeType: string,
  refDesCounters: Map<string, number>,
): string {
  const type = nodeType.toLowerCase();
  const prefix = TYPE_PREFIX[type] || 'X';
  const count = (refDesCounters.get(prefix) || 0) + 1;
  refDesCounters.set(prefix, count);
  return `${prefix}${count}`;
}

/**
 * Get the first connector ID for an instance's part, falling back to "pin1".
 */
export function firstPinId<T extends { connectors?: unknown }>(
  instancePartMap: Map<number, T>,
  instanceId: number,
): string {
  const part = instancePartMap.get(instanceId);
  const connectors = ((part?.connectors ?? []) as Array<{ id: string }>);
  return connectors[0]?.id ?? 'pin1';
}
