/**
 * Knowledge Vault Routes — HTTP surface for the Ars Contexta vault.
 *
 * Exposes search + lookup endpoints so the client can query Tyler's
 * authoritative electronics inventory knowledge directly (e.g., for a
 * vault-browser panel, component-detail "why" tooltips, or AI response
 * citations that link back to source vault notes).
 *
 * Read-only; no authentication gate on GETs. Rate-limited to prevent abuse.
 */

import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { getVaultIndex } from '../lib/vault-context';
import { setCacheHeaders } from '../lib/cache-headers';

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 1 per second average — generous for UI autocomplete
  standardHeaders: true,
  legacyHeaders: false,
});

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(240),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 10))
    .refine((n) => Number.isInteger(n) && n > 0 && n <= 25, {
      message: 'limit must be an integer between 1 and 25',
    }),
});

export function registerKnowledgeVaultRoutes(app: Express): void {
  app.get(
    '/api/vault/search',
    searchLimiter,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const parsed = SearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      try {
        const index = await getVaultIndex();
        const results = index.search(parsed.data.q, parsed.data.limit);
        res.json({
          query: parsed.data.q,
          count: results.length,
          results: results.map((r) => ({
            slug: r.note.slug,
            title: r.note.title,
            description: r.note.description,
            type: r.note.type,
            topics: r.note.topics,
            score: Number(r.score.toFixed(3)),
            snippets: r.matchedSnippets,
          })),
        });
      } catch (err) {
        res.status(500).json({
          error: 'Vault search failed',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.get(
    '/api/vault/note/:slug',
    searchLimiter,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const slug = req.params.slug;
      if (!slug || slug.length > 240) {
        return res.status(400).json({ error: 'Invalid slug' });
      }
      try {
        const index = await getVaultIndex();
        const note = index.getNote(slug);
        if (!note) {
          return res.status(404).json({ error: 'Note not found', slug });
        }
        res.json({
          slug: note.slug,
          title: note.title,
          description: note.description,
          type: note.type,
          topics: note.topics,
          links: note.links,
          body: note.body,
        });
      } catch (err) {
        res.status(500).json({
          error: 'Vault lookup failed',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.get(
    '/api/vault/mocs',
    searchLimiter,
    setCacheHeaders('project_data'),
    async (_req, res) => {
      try {
        const index = await getVaultIndex();
        const mocs = index.getMOCNotes();
        res.json({
          count: mocs.length,
          mocs: mocs.map((n) => ({
            slug: n.slug,
            title: n.title,
            description: n.description,
            linkCount: n.links.length,
          })),
        });
      } catch (err) {
        res.status(500).json({
          error: 'Vault MOC listing failed',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
