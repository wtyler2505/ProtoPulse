import { parseValue } from '@protopulse/graph';
import { z } from 'zod';

import { ToolRegistry } from '../registry.js';

import type { ToolResult } from '../registry.js';
import type { Component, DesignGraph, OpBody } from '@protopulse/graph';

/**
 * The Buyer's 4 tools — sourcing over a rev-stamped catalog SNAPSHOT.
 * The catalog is injected data, not a hook: no live APIs, no prices,
 * no stock counts, because a static catalog that quoted those would be
 * lying within a week. What it does know: verified vendor part numbers
 * and the basic/extended assembly class at the rev date. Assignments
 * are reviewable ops (set_component_props on fields.lcsc/mpn) — the
 * vision's "Buyer-proposed substitutions, each one a reviewable op".
 */

export const BUYER_TOOLS = ['read_bom', 'find_offers', 'assign_sourcing', 'sourcing_report'] as const;

export interface CatalogOfferLike {
  partId: string;
  value?: string;
  lcsc: string;
  mpn: string;
  mfr: string;
  package: string;
  class: 'basic' | 'extended';
  description: string;
}

export interface CatalogLike {
  rev: string;
  vendor: string;
  note: string;
  entries: CatalogOfferLike[];
}

/** Same electrical value? "10k" vs "10K" vs "10000" all agree. */
function sameValue(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const pa = parseValue(a);
  const pb = parseValue(b);
  if ('value' in pa && 'value' in pb) return pa.value === pb.value;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function offersFor(catalog: CatalogLike, partId: string, value?: string): CatalogOfferLike[] {
  return catalog.entries.filter(
    (e) => e.partId === partId && (e.value === undefined || sameValue(e.value, value)),
  );
}

interface BomLine {
  partId: string;
  value: string | null;
  refs: string[];
  qty: number;
  /** fields.lcsc when every member agrees; 'mixed' when they don't. */
  lcsc: string | null;
}

/** Canonical grouping key for a value: parsed magnitude when parseable
 *  (so "10k" ≡ "10K" ≡ "10000"), lowercased text otherwise. */
function canonicalValue(value: string | undefined): string {
  if (value === undefined) return '';
  const parsed = parseValue(value);
  return 'value' in parsed ? String(parsed.value) : value.trim().toLowerCase();
}

function bomLines(graph: DesignGraph): BomLine[] {
  const byKey = new Map<string, BomLine & { lcscSet: Set<string> }>();
  for (const comp of graph.components.values()) {
    if (comp.dnp) continue;
    const key = `${comp.partId}|${canonicalValue(comp.value ?? undefined)}`;
    let line = byKey.get(key);
    if (!line) {
      line = { partId: comp.partId, value: comp.value ?? null, refs: [], qty: 0, lcsc: null, lcscSet: new Set() };
      byKey.set(key, line);
    }
    line.refs.push(comp.ref);
    line.qty += 1;
    line.lcscSet.add(comp.fields.lcsc ?? '');
  }
  return [...byKey.values()]
    .map(({ lcscSet, ...line }) => ({
      ...line,
      refs: line.refs.sort(),
      lcsc: lcscSet.size === 1 ? ([...lcscSet][0] ?? '') || null : 'mixed',
    }))
    .sort((a, b) => (a.refs[0] ?? '') < (b.refs[0] ?? '') ? -1 : 1);
}

function componentByRef(graph: DesignGraph, ref: string): Component | undefined {
  return [...graph.components.values()].find((c) => c.ref === ref);
}

export function createBuyerRegistry(catalog: CatalogLike): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'read_bom',
    description:
      'Read the bill of materials: one line per (part, value) with refs, quantity, and any LCSC number already assigned. DNP parts are excluded. Call this first.',
    schema: z.object({}),
    destructive: false,
    costClass: 'cheap',
    execute: (_input, ctx): ToolResult => {
      const lines = bomLines(ctx.graph);
      const sourced = lines.filter((l) => l.lcsc !== null && l.lcsc !== 'mixed').length;
      return {
        ops: [],
        data: { lines, catalogRev: catalog.rev, catalogNote: catalog.note },
        summary: `${String(lines.length)} BOM line(s), ${String(sourced)} sourced`,
      };
    },
    explain: () => 'read the bill of materials',
  });

  registry.register({
    name: 'find_offers',
    description:
      "Find catalog offers for a BOM line — by component ref OR by partId+value. Offers carry the vendor part number, package, and basic/extended class; NO prices or stock (the catalog is a rev-stamped snapshot and says so). An offer's package may differ from the design's footprint — surface that to the user, never hide it.",
    schema: z.object({
      ref: z.string().min(1).optional().describe('Component ref, e.g. "R1"'),
      partId: z.string().min(1).optional(),
      value: z.string().min(1).optional(),
    }),
    destructive: false,
    costClass: 'cheap',
    execute: (input, ctx): ToolResult => {
      let partId = input.partId;
      let value = input.value;
      if (input.ref !== undefined) {
        const comp = componentByRef(ctx.graph, input.ref);
        if (!comp) throw new Error(`no component "${input.ref}" — read_bom lists refs`);
        partId = comp.partId;
        value = comp.value ?? undefined;
      }
      if (partId === undefined) throw new Error('give a ref, or a partId (+ value)');
      const offers = offersFor(catalog, partId, value);
      return {
        ops: [],
        data: { offers, catalogRev: catalog.rev },
        summary:
          offers.length === 0
            ? `no ${catalog.vendor} offer for ${partId}${value ? ` @ ${value}` : ''} in the ${catalog.rev} snapshot — say so honestly`
            : `${String(offers.length)} offer(s) for ${partId}${value ? ` @ ${value}` : ''}`,
      };
    },
    explain: (input) => `look up offers for ${input.ref ?? input.partId ?? '?'}`,
  });

  registry.register({
    name: 'assign_sourcing',
    description:
      'Assign a catalog offer to components (by ref): writes fields.lcsc and fields.mpn as reviewable ops. The LCSC number must exist in the catalog and match each component part (and value, when the offer is value-specific).',
    schema: z.object({
      refs: z.array(z.string().min(1)).min(1),
      lcsc: z.string().min(1).describe('Catalog LCSC number, e.g. "C25804"'),
    }),
    destructive: true,
    costClass: 'cheap',
    execute: (input, ctx): ToolResult => {
      const offer = catalog.entries.find((e) => e.lcsc === input.lcsc);
      if (!offer) throw new Error(`no catalog entry ${input.lcsc} — find_offers lists them`);
      const ops: OpBody[] = [];
      for (const ref of input.refs) {
        const comp = componentByRef(ctx.graph, ref);
        if (!comp) throw new Error(`no component "${ref}"`);
        if (comp.partId !== offer.partId) {
          throw new Error(`${ref} is ${comp.partId}, but ${input.lcsc} is for ${offer.partId}`);
        }
        if (offer.value !== undefined && !sameValue(offer.value, comp.value ?? undefined)) {
          throw new Error(
            `${ref} is ${comp.value ?? '(no value)'}, but ${input.lcsc} is a ${offer.value} part`,
          );
        }
        ops.push({
          kind: 'set_component_props',
          id: comp.id,
          // fields replace wholesale — preserve what's already there.
          props: { fields: { ...comp.fields, lcsc: offer.lcsc, mpn: offer.mpn } },
        });
      }
      return {
        ops,
        summary: `${input.lcsc} (${offer.mpn}, ${offer.class}) → ${input.refs.join(', ')}`,
      };
    },
    explain: (input) => `assign ${input.lcsc} to ${input.refs.join(', ')}`,
  });

  registry.register({
    name: 'sourcing_report',
    description:
      'Summarize sourcing state: sourced vs unsourced lines, basic vs extended counts (each extended part adds a per-reel setup fee at assembly time), and the unsourced refs. Numbers about classes, never about money.',
    schema: z.object({}),
    destructive: false,
    costClass: 'cheap',
    execute: (_input, ctx): ToolResult => {
      const lines = bomLines(ctx.graph);
      const byLcsc = new Map(catalog.entries.map((e) => [e.lcsc, e]));
      let basic = 0;
      let extended = 0;
      let unknown = 0;
      const unsourced: string[] = [];
      for (const line of lines) {
        if (line.lcsc === null || line.lcsc === 'mixed') {
          unsourced.push(...line.refs);
          continue;
        }
        const offer = byLcsc.get(line.lcsc);
        if (!offer) unknown += 1;
        else if (offer.class === 'basic') basic += 1;
        else extended += 1;
      }
      return {
        ops: [],
        data: { lines: lines.length, basic, extended, unknownToCatalog: unknown, unsourced, catalogRev: catalog.rev },
        summary: `${String(lines.length)} line(s): ${String(basic)} basic, ${String(extended)} extended, ${String(unknown)} off-catalog, ${String(unsourced.length)} ref(s) unsourced`,
      };
    },
    explain: () => 'summarize sourcing state',
  });

  return registry;
}
