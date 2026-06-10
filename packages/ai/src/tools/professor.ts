import { z } from 'zod';

import { ToolRegistry } from '../registry.js';

import { designDigest, digestSummary } from './digest.js';

import type { AiTool, ToolResult } from '../registry.js';

/**
 * The Professor's 3 tools — v0.3 teaching milestone. All pure DATA tools
 * (zero ops, zero mutation): they fetch the design digest, the concept
 * article, and the finding→concept mapping; the MODEL does the actual
 * explaining in prose. Both lookups are DEPENDENCY-INJECTED — the app
 * wires its import.meta.glob article loader and the ERC/REV code maps;
 * tests pass plain records. This package never loads content itself.
 */

/** Resolve a concepts-wiki slug to its article, or undefined. */
export type ConceptLookup = (slug: string) => { title: string; body: string } | undefined;

/** Map a finding code (ERC-… or REV-…) to a concept slug, or undefined. */
export type CodeToConcept = (code: string) => string | undefined;

export interface ConceptArticleData {
  slug: string;
  title: string;
  body: string;
}

export const PROFESSOR_TOOL_NAMES = ['read_design', 'lookup_concept', 'explain_finding'] as const;

export function createProfessorRegistry(
  concepts: ConceptLookup,
  codeToConcept: CodeToConcept,
): ToolRegistry {
  const articleFor = (slug: string): ConceptArticleData | null => {
    const hit = concepts(slug);
    return hit ? { slug, title: hit.title, body: hit.body } : null;
  };

  const readDesignSchema = z.object({});

  const readDesign: AiTool<typeof readDesignSchema> = {
    name: 'read_design',
    description:
      'Cheap digest of the current design: components with values, net connectivity, and ' +
      'constraints. Read this FIRST so every explanation cites the actual refs and nets of ' +
      'THIS design, never a hypothetical one.',
    schema: readDesignSchema,
    destructive: false,
    costClass: 'cheap',
    execute(_input, ctx): ToolResult {
      const digest = designDigest(ctx);
      return {
        ops: [],
        data: digest,
        summary: digestSummary(digest),
      };
    },
    explain(): string {
      return 'Read the design digest';
    },
  };

  const lookupConceptSchema = z.object({
    slug: z.string().min(1).describe('Concepts-wiki slug, e.g. "pull-up-pull-down"'),
  });

  const lookupConcept: AiTool<typeof lookupConceptSchema> = {
    name: 'lookup_concept',
    description:
      'Fetch a concepts-wiki article by slug. Returns its title and full markdown body. ' +
      'Consult the article BEFORE explaining a concept, and cite it by title in your answer. ' +
      'Errors if no article exists for the slug.',
    schema: lookupConceptSchema,
    destructive: false,
    costClass: 'cheap',
    execute(input): ToolResult {
      const article = articleFor(input.slug);
      if (!article) {
        throw new Error(`unknown concept "${input.slug}" — no such article in the concepts wiki`);
      }
      return {
        ops: [],
        data: article,
        summary: `Concept article "${article.title}" (${article.slug}), ${String(article.body.length)} chars`,
      };
    },
    explain(input): string {
      return `Look up concept article "${input.slug}"`;
    },
  };

  const explainFindingSchema = z.object({
    code: z.string().min(1).describe('Finding code, e.g. "ERC-FLOATING-INPUT" or "REV-NO-DECOUPLING"'),
    message: z.string().min(1).describe('The finding message as reported'),
    context: z
      .string()
      .optional()
      .describe('Optional extra context: the check id, anchored refs/nets, user notes'),
  });

  const explainFinding: AiTool<typeof explainFindingSchema> = {
    name: 'explain_finding',
    description:
      'Resolve a finding code to its mapped concepts-wiki article. Returns PURE DATA — the ' +
      'mapped concept slug (or null when the code has no mapping) plus the article when it ' +
      'exists. YOU do the explaining in prose, grounded in this design and citing the article.',
    schema: explainFindingSchema,
    destructive: false,
    costClass: 'cheap',
    execute(input): ToolResult {
      const conceptSlug = codeToConcept(input.code) ?? null;
      const article = conceptSlug !== null ? articleFor(conceptSlug) : null;
      const articleNote =
        conceptSlug === null
          ? 'no concept mapping for this code'
          : article
            ? `concept "${article.title}" (${conceptSlug})`
            : `concept "${conceptSlug}" mapped but the article is not written yet`;
      return {
        ops: [],
        data: {
          code: input.code,
          message: input.message,
          ...(input.context !== undefined ? { context: input.context } : {}),
          conceptSlug,
          article,
        },
        summary: `Finding ${input.code}: ${articleNote}`,
      };
    },
    explain(input): string {
      return `Map finding ${input.code} to its concept article`;
    },
  };

  const registry = new ToolRegistry();
  registry.register(readDesign as AiTool);
  registry.register(lookupConcept as AiTool);
  registry.register(explainFinding as AiTool);
  return registry;
}
