// =============================================================================
// KiCad Exporter — Net index + legacy KiCad netlist emitter
// =============================================================================

import {
  type CircuitInstanceData,
  type CircuitNetData,
  type ComponentPartData,
  type ExportResult,
  metaStr,
} from '../types';
import { escapeKicad } from './sexpr';
import type { KicadInput } from './types';

/** Composite key for a pin on an instance: "instanceId:pinIdentifier". */
export type PinKey = string;

export interface NetInfo {
  name: string;
  /** 1-based net code (0 = unconnected) */
  code: number;
}

export function makePinKey(instanceId: number, pin: string): PinKey {
  return `${instanceId}:${pin}`;
}

/**
 * Builds a global index of net names -> net codes, and a pin-to-net lookup.
 *
 * Net code 0 is reserved for the unconnected net (KiCad convention).
 * Real nets start at code 1.
 */
export function buildNetIndex(input: KicadInput): {
  netList: Array<{ name: string; code: number }>;
  pinToNet: Map<PinKey, NetInfo>;
} {
  // Deduplicate net names while preserving order of first appearance
  const netNameOrder: string[] = [];
  const netNameSet = new Set<string>();

  input.nets.forEach(function collectUniqueNetNames(net) {
    if (!netNameSet.has(net.name)) {
      netNameSet.add(net.name);
      netNameOrder.push(net.name);
    }
  });

  // Assign 1-based net codes
  const netCodeMap = new Map<string, number>();
  const netList: Array<{ name: string; code: number }> = [];
  netNameOrder.forEach(function assignNetCode(name, idx) {
    const code = idx + 1;
    netCodeMap.set(name, code);
    netList.push({ name, code });
  });

  // Build per-instance connector alias maps for bidirectional pin resolution
  const instanceAliases = new Map<number, Map<string, string>>();
  input.instances.forEach(function buildInstanceAliases(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    const aliases = new Map<string, string>();
    part.connectors.forEach(function mapConnectorAlias(conn) {
      aliases.set(conn.name, conn.id);
      aliases.set(conn.id, conn.name);
    });
    instanceAliases.set(inst.id, aliases);
  });

  // Build pin -> net lookup
  const pinToNet = new Map<PinKey, NetInfo>();

  function registerPin(instanceId: number, pin: string, netName: string): void {
    const code = netCodeMap.get(netName);
    if (code === undefined) return;
    const info: NetInfo = { name: netName, code };

    const primaryKey = makePinKey(instanceId, pin);
    if (!pinToNet.has(primaryKey)) {
      pinToNet.set(primaryKey, info);
    }

    // Also register the alias
    const aliases = instanceAliases.get(instanceId);
    if (aliases) {
      const alias = aliases.get(pin);
      if (alias) {
        const aliasKey = makePinKey(instanceId, alias);
        if (!pinToNet.has(aliasKey)) {
          pinToNet.set(aliasKey, info);
        }
      }
    }
  }

  input.nets.forEach(function registerNetPins(net) {
    net.segments.forEach(function registerSegmentPins(seg) {
      registerPin(seg.fromInstanceId, seg.fromPin, net.name);
      registerPin(seg.toInstanceId, seg.toPin, net.name);
    });
  });

  return { netList, pinToNet };
}

// ---------------------------------------------------------------------------
// Legacy KiCad netlist (.net) emitter — consumed by ai-tools and snapshots
// ---------------------------------------------------------------------------

/** Extract pin-to-component connections from a net's segments. */
function extractNetPinNodes(
  net: CircuitNetData,
  instances: CircuitInstanceData[],
): Array<{ ref: string; pin: string }> {
  const results: Array<{ ref: string; pin: string }> = [];

  if (Array.isArray(net.segments)) {
    for (const seg of net.segments) {
      if (seg && typeof seg === 'object') {
        const s = seg as Record<string, unknown>;
        if (typeof s.instanceId === 'number' && typeof s.pinId === 'string') {
          const inst = instances.find((i) => i.id === s.instanceId);
          if (inst) {
            results.push({ ref: inst.referenceDesignator, pin: s.pinId as string });
          }
        }
      }
    }
  }

  return results;
}

export function generateKicadNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
): ExportResult {
  // Build partId → part lookup
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // --- components ---
  const components = instances.map((inst) => {
    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const meta = part?.meta ?? {};
    const value = metaStr(meta, 'title', inst.referenceDesignator);
    const footprint = metaStr(meta, 'footprint', 'Unknown:Unknown');
    const datasheet = metaStr(meta, 'datasheet', '~');

    return `    (comp (ref "${escapeKicad(inst.referenceDesignator)}")
      (value "${escapeKicad(value)}")
      (footprint "${escapeKicad(footprint)}")
      (datasheet "${escapeKicad(datasheet)}")
    )`;
  });

  // --- nets ---
  const netEntries = nets.map((net, i) => {
    const code = i + 1;
    const pinNodes = extractNetPinNodes(net, instances);

    const nodeLines = pinNodes.map(
      (pn) => `      (node (ref "${escapeKicad(pn.ref)}") (pin "${pn.pin}"))`,
    );

    return `    (net (code ${code}) (name "${escapeKicad(net.name)}")
${nodeLines.join('\n')}
    )`;
  });

  const content = `(export (version "E")
  (design
    (source "ProtoPulse")
    (date "${new Date().toISOString()}")
    (tool "ProtoPulse Export")
  )
  (components
${components.join('\n')}
  )
  (nets
    (net (code 0) (name ""))
${netEntries.join('\n')}
  )
)
`;

  return {
    content,
    encoding: 'utf8',
    mimeType: 'application/x-kicad-netlist',
    filename: 'netlist.net',
  };
}
