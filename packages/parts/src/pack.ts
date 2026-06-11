import { z } from 'zod';

import { partSchema } from './types.js';

import type { PartDb } from './db.js';
import type { Part } from './types.js';

/**
 * Part packs — the community library's interchange format (Vol I §6,
 * first slice). A pack is a versioned JSON file of full Part records
 * that loads into any PartDb at runtime. There is no registry or
 * hosting here — that's a product decision; the FORMAT is engineering,
 * and a file you can email, commit, or post is already a community.
 *
 * Trust rules, enforced structurally:
 * - Every part lives in the pack's own namespace (`<pack>:…`) — the
 *   `core:` namespace belongs to the seed library and cannot be
 *   shadowed or extended by a pack.
 * - Provenance is declared per part, exactly like seeds: 'unverified'
 *   | 'community-tested' | 'verified', with the note saying who
 *   verified what against which datasheet. The format carries the
 *   claim; the tier chip in the UI is the reader's warning label.
 */

export const PART_PACK_FORMAT = 'pp-part-pack';

export interface PartPack {
  format: typeof PART_PACK_FORMAT;
  version: 1;
  /** Pack id — also the namespace every part id must live in. */
  pack: string;
  rev: string;
  author?: string;
  note?: string;
  parts: Part[];
}

const packIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'pack id must be lowercase letters/digits/hyphens')
  .refine((id) => id !== 'core', { message: "the 'core' namespace belongs to the seed library" });

export const partPackSchema: z.ZodType<PartPack> = z
  .object({
    format: z.literal(PART_PACK_FORMAT),
    version: z.literal(1),
    pack: packIdSchema,
    rev: z.string().min(1),
    author: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    parts: z.array(partSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    for (const part of pack.parts) {
      if (!part.id.startsWith(`${pack.pack}:`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `part ${part.id} is outside the pack's namespace — ids must start with "${pack.pack}:"`,
        });
      }
      const key = `${part.id}@${String(part.rev)}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate part ${key} in the pack` });
      }
      seen.add(key);
    }
  });

export function parsePartPack(text: string): PartPack {
  return partPackSchema.parse(JSON.parse(text));
}

/** Load a pack into a db. All-or-nothing: collisions with already
 *  registered (id, rev) pairs refuse the whole pack with the reason. */
export function loadPackInto(db: PartDb, pack: PartPack): number {
  for (const part of pack.parts) {
    if (db.get(part.id, part.rev)) {
      throw new Error(
        `pack ${pack.pack}@${pack.rev}: ${part.id} rev ${String(part.rev)} is already registered — nothing was loaded`,
      );
    }
  }
  for (const part of pack.parts) db.add(part);
  return pack.parts.length;
}
