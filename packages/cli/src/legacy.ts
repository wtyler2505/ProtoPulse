import { materialize, SCHEMATIC_GRID, PPX_FORMAT_VERSION } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { z } from 'zod';

import type { DesignBundle, OpBody, OpEnvelope, Rot } from '@protopulse/graph';

/**
 * Legacy → .ppx importer — the migration milestone's first gate.
 *
 * Input: a JSON snapshot of one legacy project's circuit tables, raw
 * rows WITH their ids (the legacy app's own project-export format
 * drops instance ids and part links, which severs net connectivity —
 * so the importer reads a table dump instead; the exact SQL is in the
 * command help). Output: a .ppx.json DesignBundle whose op-log
 * recreates the design — components, values, placements, and nets —
 * under actor 'legacy-import', plus a report that says exactly what
 * was imported, what was skipped, and why.
 *
 * Honest scope:
 * - One legacy circuit design per bundle (pick with --design; the
 *   report lists the others). Hierarchy (sub-designs) is not imported.
 * - Parts map onto the engine's seed library by mpn/title/category
 *   heuristics; anything unmappable is skipped WITH ITS REASON — no
 *   guessed pinouts, per the hardware verification protocol.
 * - Schematic positions rescale (25 legacy px = one 1.27 mm grid step,
 *   so the legacy 50 px grid lands on 0.1 in) and snap to grid;
 *   breadboard/bench/pcb views don't carry over.
 */

// ── Snapshot schema (raw legacy rows, ids included) ──────────────────

const legacyConnectorSchema = z.object({ id: z.string(), name: z.string() }).passthrough();

const legacySnapshotSchema = z.object({
  project: z.object({ name: z.string().min(1) }),
  parts: z
    .array(
      z.object({
        id: z.number().int(),
        meta: z.record(z.string(), z.unknown()).default({}),
        connectors: z.array(legacyConnectorSchema).default([]),
      }),
    )
    .default([]),
  designs: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string().min(1),
        instances: z
          .array(
            z.object({
              id: z.number().int(),
              referenceDesignator: z.string().min(1),
              partId: z.number().int().nullable().default(null),
              schematicX: z.number().default(0),
              schematicY: z.number().default(0),
              schematicRotation: z.number().default(0),
              properties: z.record(z.string(), z.unknown()).default({}),
            }),
          )
          .default([]),
        nets: z
          .array(
            z.object({
              id: z.number().int(),
              name: z.string().min(1),
              segments: z.array(z.unknown()).default([]),
            }),
          )
          .default([]),
      }),
    )
    .min(1, 'the snapshot has no circuit designs'),
});

export type LegacySnapshot = z.infer<typeof legacySnapshotSchema>;

export interface ImportReport {
  designName: string;
  components: number;
  nets: number;
  connections: number;
  /** Skipped items with the reason, one line each. */
  skipped: string[];
  /** Non-fatal observations (generic-part substitutions, other designs). */
  notes: string[];
  /** Materialize warnings + invariant violations on the produced bundle. */
  problems: string[];
}

export interface ImportOutcome {
  bundle: DesignBundle;
  report: ImportReport;
}

// ── Part mapping: legacy meta → engine seed ──────────────────────────

interface PartMatch {
  partId: string;
  note?: string;
}

/** Ordered first-match rules over the part's combined meta text. */
const PART_RULES: [RegExp, string, string?][] = [
  [/bat54s/, 'core:bat54s'],
  [/1n4148/, 'core:1n4148'],
  [/1n5819/, 'core:1n5819'],
  [/\btvs\b/, 'core:tvs-unidirectional'],
  [/\b(ne)?555\b/, 'core:ne555'],
  [/2n3904/, 'core:2n3904'],
  [/\bnpn\b/, 'core:2n3904', 'generic NPN mapped to the 2N3904 seed'],
  [/ao3400/, 'core:nmos-ao3400'],
  [/n-?mosfet|\bnmos\b/, 'core:nmos-ao3400', 'generic N-MOSFET mapped to the AO3400-class seed'],
  [/\bledr?\b|light.emitting/, 'core:led'],
  [/electrolytic/, 'core:capacitor-electrolytic'],
  [/capacitor/, 'core:capacitor'],
  [/photoresistor|\bldr\b/, ''], // light-dependent: NOT a fixed resistor — refuse before the resistor rule
  [/resistor/, 'core:resistor'],
  [/push\s?button|tactile|momentary/, 'core:pushbutton'],
  [/battery/, 'core:battery'],
  [/usb-?c/, 'core:usbc-power-stub'],
  [/header/, 'core:header-2x10'],
];

function metaText(meta: Record<string, unknown>): string {
  const fields = ['title', 'mpn', 'category', 'manufacturer', 'description'];
  const parts: string[] = [];
  for (const f of fields) {
    const v = meta[f];
    if (typeof v === 'string') parts.push(v);
  }
  const tags = meta.tags;
  if (Array.isArray(tags)) for (const t of tags) if (typeof t === 'string') parts.push(t);
  return parts.join(' ').toLowerCase();
}

/** Map one legacy part to an engine seed id; null = unmappable. */
export function mapLegacyPart(meta: Record<string, unknown>): PartMatch | null {
  const text = metaText(meta);
  for (const [re, partId, note] of PART_RULES) {
    if (re.test(text)) {
      if (partId === '') return null; // explicit refusal rule
      return note !== undefined ? { partId, note } : { partId };
    }
  }
  return null;
}

// ── Geometry ─────────────────────────────────────────────────────────

/** 25 legacy px = one engine grid step (1.27 mm) — the legacy 50 px
 *  grid lands on 0.1 in. A convention, stated, not a measurement. */
const NM_PER_LEGACY_PX = SCHEMATIC_GRID / 25;

function snapNm(px: number): number {
  return Math.round((px * NM_PER_LEGACY_PX) / SCHEMATIC_GRID) * SCHEMATIC_GRID;
}

function snapRot(degrees: number): Rot {
  const r = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  return r as Rot;
}

// ── Segment shapes (two generations exist in legacy data) ────────────

interface PinUse {
  instanceId: number;
  pin: string;
}

function segmentPins(seg: unknown): PinUse[] {
  if (seg === null || typeof seg !== 'object') return [];
  const s = seg as Record<string, unknown>;
  const out: PinUse[] = [];
  if (typeof s.instanceId === 'number' && typeof s.pinId === 'string') {
    out.push({ instanceId: s.instanceId, pin: s.pinId });
  }
  if (typeof s.fromInstanceId === 'number' && typeof s.fromPin === 'string') {
    out.push({ instanceId: s.fromInstanceId, pin: s.fromPin });
  }
  if (typeof s.toInstanceId === 'number' && typeof s.toPin === 'string') {
    out.push({ instanceId: s.toInstanceId, pin: s.toPin });
  }
  return out;
}

// ── The importer ─────────────────────────────────────────────────────

export function importLegacy(input: unknown, designName?: string): ImportOutcome {
  const snapshot = legacySnapshotSchema.parse(input);
  const design =
    designName === undefined
      ? snapshot.designs[0]
      : snapshot.designs.find((d) => d.name === designName);
  if (!design) {
    throw new Error(
      `design "${designName ?? ''}" not found — snapshot has: ${snapshot.designs.map((d) => d.name).join(', ')}`,
    );
  }

  const partDb = seedPartDb();
  const legacyParts = new Map(snapshot.parts.map((p) => [p.id, p]));
  const report: ImportReport = {
    designName: design.name,
    components: 0,
    nets: 0,
    connections: 0,
    skipped: [],
    notes: [],
    problems: [],
  };
  for (const other of snapshot.designs) {
    if (other.id !== design.id) {
      report.notes.push(`design "${other.name}" not imported — one design per bundle (use --design)`);
    }
  }

  const ops: OpBody[] = [];
  /** legacy instance id → { componentId, engine pin keys, legacy connectors } */
  const imported = new Map<
    number,
    { componentId: string; pinKeys: string[]; connectors: { id: string; name: string }[] }
  >();
  const noteOnce = new Set<string>();

  // Components, values, placements — refdes order keeps output stable.
  const instances = [...design.instances].sort((a, b) =>
    a.referenceDesignator.localeCompare(b.referenceDesignator, undefined, { numeric: true }),
  );
  for (const inst of instances) {
    const legacyPart = inst.partId !== null ? legacyParts.get(inst.partId) : undefined;
    if (!legacyPart) {
      report.skipped.push(`${inst.referenceDesignator}: no part row in the snapshot — cannot identify it`);
      continue;
    }
    const match = mapLegacyPart(legacyPart.meta);
    if (!match) {
      const title = typeof legacyPart.meta.title === 'string' ? legacyPart.meta.title : '?';
      report.skipped.push(
        `${inst.referenceDesignator} ("${title}"): no engine seed part matches — pinouts are never guessed`,
      );
      continue;
    }
    if (match.note !== undefined && !noteOnce.has(match.note)) {
      noteOnce.add(match.note);
      report.notes.push(match.note);
    }
    const part = partDb.get(match.partId, 1);
    if (!part) {
      report.skipped.push(`${inst.referenceDesignator}: seed ${match.partId} missing from the part db`);
      continue;
    }
    const componentId = `legacy-${String(inst.id)}`;
    ops.push({
      kind: 'add_component',
      id: componentId,
      ref: inst.referenceDesignator,
      partId: match.partId,
      partRev: 1,
    });
    const value = inst.properties.value ?? inst.properties.Value;
    if (typeof value === 'string' && value.trim() !== '') {
      ops.push({ kind: 'set_component_props', id: componentId, props: { value } });
    }
    ops.push({
      kind: 'place_symbol',
      componentId,
      at: { x: snapNm(inst.schematicX), y: snapNm(inst.schematicY) },
      rot: snapRot(inst.schematicRotation),
      mirror: false,
    });
    imported.set(inst.id, {
      componentId,
      pinKeys: part.pins.map((p) => p.key),
      connectors: legacyPart.connectors.map((c) => ({ id: c.id, name: c.name })),
    });
    report.components += 1;
  }

  /** Resolve a legacy pin token (connector id OR name) to an engine pin key. */
  const resolvePin = (entry: NonNullable<ReturnType<typeof imported.get>>, token: string): string | null => {
    const idx = entry.connectors.findIndex((c) => c.id === token || c.name === token);
    const name = idx >= 0 ? entry.connectors[idx]?.name ?? token : token;
    // Exact (case-insensitive) name match against engine keys; legacy
    // writes '-' where the electrolytic seed uses '−'.
    const norm = (s: string) => s.toLowerCase().replace('-', '−');
    const byName = entry.pinKeys.find((k) => norm(k) === norm(name) || k.toLowerCase() === name.toLowerCase());
    if (byName !== undefined) return byName;
    // Ordinal fallback only when the pin counts agree — same shape,
    // different naming convention.
    if (idx >= 0 && entry.connectors.length === entry.pinKeys.length) {
      return entry.pinKeys[idx] ?? null;
    }
    return null;
  };

  // Nets — legacy id order (creation order), so "first net wins" on
  // dirty data means the net that existed first keeps the port.
  const usedPorts = new Set<string>();
  const nets = [...design.nets].sort((a, b) => a.id - b.id);
  for (const net of nets) {
    const ports: string[] = [];
    for (const seg of net.segments) {
      for (const use of segmentPins(seg)) {
        const entry = imported.get(use.instanceId);
        if (!entry) {
          report.skipped.push(`net ${net.name}: a connection references instance ${String(use.instanceId)}, which was not imported`);
          continue;
        }
        const key = resolvePin(entry, use.pin);
        if (key === null) {
          report.skipped.push(`net ${net.name}: pin "${use.pin}" has no match on the mapped seed part (${entry.componentId})`);
          continue;
        }
        const port = `${entry.componentId}:${key}`;
        if (usedPorts.has(port)) {
          if (!ports.includes(port)) {
            report.skipped.push(`net ${net.name}: ${port} is already on another net — first net wins`);
          }
          continue;
        }
        if (!ports.includes(port)) ports.push(port);
      }
    }
    if (ports.length === 0) {
      report.skipped.push(`net ${net.name}: no importable connections`);
      continue;
    }
    const netId = `legacy-net-${String(net.id)}`;
    ops.push({ kind: 'connect', port: ports[0] ?? '', newNetId: netId });
    for (const port of ports.slice(1)) ops.push({ kind: 'connect', port, netId });
    ops.push({ kind: 'rename_net', netId, name: net.name });
    for (const port of ports) usedPorts.add(port);
    report.nets += 1;
    report.connections += ports.length;
  }

  const envelopes: OpEnvelope[] = ops.map((op, i) => ({
    actor: 'legacy-import',
    lamport: i + 1,
    ts: 0,
    op,
  }));

  // Prove the bundle is sound before handing it over.
  const result = materialize(envelopes);
  for (const w of result.warnings) report.problems.push(`${w.opId}: ${w.message}`);
  for (const v of result.violations) report.problems.push(v.message);

  const designId = snapshot.project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'legacy-import';

  const bundle: DesignBundle = {
    format: 'ppx-bundle',
    version: PPX_FORMAT_VERSION,
    designId,
    head: 'main',
    branches: [{ name: 'main', base: { branch: null, opCount: 0 }, ops: envelopes }],
  };
  return { bundle, report };
}
