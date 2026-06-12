import { z } from 'zod';

import type { CatalogLike } from '@protopulse/ai';

/**
 * The sourcing catalog for the Buyer: a rev-stamped JSON snapshot in
 * content/catalog, bundled by glob like the rule decks. Validated here
 * (mirror of @protopulse/content's CatalogSchema — that package is a
 * node loader; the browser bundle validates its own copy).
 */

const catalogSchema = z.object({
  catalog: z.string().min(1),
  rev: z.string().min(1),
  vendor: z.string().min(1),
  note: z.string().min(1),
  entries: z
    .array(
      z.object({
        partId: z.string().min(1),
        value: z.string().min(1).optional(),
        lcsc: z.string().min(1),
        mpn: z.string().min(1),
        mfr: z.string().min(1),
        package: z.string().min(1),
        class: z.enum(['basic', 'extended']),
        description: z.string().min(1),
      }),
    )
    .min(1),
});

const catalogFiles = import.meta.glob('../../../../content/catalog/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

export const DEFAULT_CATALOG_FILE = 'jlc-assembly-seed.json';

export async function loadDefaultCatalog(): Promise<CatalogLike> {
  for (const [path, load] of Object.entries(catalogFiles)) {
    if (path.endsWith(`/${DEFAULT_CATALOG_FILE}`)) {
      return catalogSchema.parse(JSON.parse(await load()));
    }
  }
  throw new Error(`sourcing catalog ${DEFAULT_CATALOG_FILE} is missing from content/catalog`);
}
