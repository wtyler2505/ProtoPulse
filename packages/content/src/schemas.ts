import { z } from 'zod';

/**
 * Content schemas: DRC rule decks, concept-article frontmatter, and
 * curriculum track steps. Everything that ships as data validates at the
 * boundary — bad seed content fails tests, not users.
 */

// ── DRC rule decks ───────────────────────────────────────────────────

const zNmInt = z.number().int().positive();

export const deckRulesSchema = z.object({
  min_trace_nm: zNmInt,
  min_clearance_nm: zNmInt,
  min_drill_nm: zNmInt,
  min_annular_nm: zNmInt,
  copper_to_edge_nm: zNmInt,
  silk_min_width_nm: zNmInt,
});

export const DeckSchema = z.object({
  deck: z.string().min(1),
  rev: z.string().min(1),
  rules: deckRulesSchema,
  /** Per-net-class overrides; each override is a partial rule set. */
  classOverrides: z.record(z.string(), deckRulesSchema.partial()),
});

export type Deck = z.infer<typeof DeckSchema>;
export type DeckRules = z.infer<typeof deckRulesSchema>;

// ── Sourcing catalogs ────────────────────────────────────────────────

/** One vendor offer for a seed part. No prices BY DESIGN — a static
 *  catalog that quoted prices would be lying within a week. */
export const CatalogEntrySchema = z.object({
  partId: z.string().min(1),
  /** Component value this offer covers (e.g. "10k"); absent = any. */
  value: z.string().min(1).optional(),
  /** Vendor part number (LCSC code for jlcpcb). */
  lcsc: z.string().min(1),
  mpn: z.string().min(1),
  mfr: z.string().min(1),
  package: z.string().min(1),
  /** JLC assembly class at the rev date — basic parts have no per-reel
   *  setup fee. Classification drifts; the catalog note says so. */
  class: z.enum(['basic', 'extended']),
  description: z.string().min(1),
});

export const CatalogSchema = z.object({
  catalog: z.string().min(1),
  rev: z.string().min(1),
  vendor: z.string().min(1),
  note: z.string().min(1),
  entries: z.array(CatalogEntrySchema).min(1),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type SourcingCatalog = z.infer<typeof CatalogSchema>;

// ── Concept articles ─────────────────────────────────────────────────

export const ConceptFrontmatterSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  title: z.string().min(1),
  /** ERC codes that link to this article; may be empty. */
  ercCodes: z.array(z.string().min(1)),
  /** DRC codes that link to this article; PCB articles only, optional. */
  drcCodes: z.array(z.string().min(1)).optional(),
});

export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

export interface ConceptArticle {
  frontmatter: ConceptFrontmatter;
  body: string;
}

// ── Track steps ──────────────────────────────────────────────────────

/** A goal is prose, or a single machine-checkable condition like
 *  `erc: clean` / `sim: "..."`. Sim goals are aspirational pre-M2. */
const goalItemSchema = z.union([z.string().min(1), z.record(z.string(), z.string())]);

export const TrackStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  mode: z.string().min(1),
  /** Concept slugs this step unlocks. */
  unlocks: z.array(z.string().min(1)),
  /** Snippet ref ("snippet:…") or null for a blank canvas. */
  given: z.string().nullable(),
  goal: z.array(goalItemSchema).min(1),
  /** Depth-adaptive professor narration, keyed by depth level. */
  professor: z.record(z.string(), z.string().min(1)),
  failure_puzzle: z.string().optional(),
  deliverable: z.string().min(1),
});

export type TrackStep = z.infer<typeof TrackStepSchema>;

// ── Failure puzzles (Vol III §1.4) ───────────────────────────────────
// A broken design + symptom + instruments; solved when the user
// annotates the actual root-cause net/component. The design ships as a
// sibling design.ppx.json; rootCause.anchors are entity ids IN that
// design. The catalog format is public — community puzzles are
// first-class content.

export const PuzzleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** What the user observes — written like a bench complaint. */
  symptom: z.string().min(1),
  /** Which instruments to reach for (suggested, not enforced). */
  instruments: z.array(z.string().min(1)).min(1),
  /** Entity ids (components/nets) that count as the root cause. */
  rootCause: z.object({
    anchors: z.array(z.string().min(1)).min(1),
    /** Shown AFTER the puzzle is solved. */
    explanation: z.string().min(1),
  }),
  /** Progressive hints, mildest first. */
  hints: z.array(z.string().min(1)),
});

export type Puzzle = z.infer<typeof PuzzleSchema>;
