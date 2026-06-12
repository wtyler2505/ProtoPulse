import type { ConceptLookup } from '@protopulse/ai';

/**
 * ConceptLookup adapter: the Professor's tools want a synchronous
 * slug → {title, body} lookup, so the articles are bundled EAGERLY as
 * raw markdown (unlike the viewer's lazy overlay loaders — the agent
 * cannot await mid-dispatch). Frontmatter supplies the title; articles
 * without parseable frontmatter degrade to the slug as title and the
 * raw text as body.
 *
 * The frontmatter split is hand-rolled (mirroring @protopulse/content's
 * parseConceptFrontmatter) because that package's index drags node:fs
 * loaders into the browser bundle.
 */

const articles = import.meta.glob('../../../../content/concepts/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Split a leading --- frontmatter block; extract `title:` without YAML. */
function parseArticle(raw: string): { title: string | null; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '');
  if (!/^---\r?\n/.test(normalized)) return { title: null, body: normalized };
  const afterOpen = normalized.replace(/^---\r?\n/, '');
  const close = /\r?\n---[ \t]*(\r?\n|$)/.exec(afterOpen);
  if (close?.index === undefined) return { title: null, body: normalized };
  const yamlText = afterOpen.slice(0, close.index);
  const body = afterOpen.slice(close.index + close[0].length);
  const titleLine = /^title:[ \t]*(.+)[ \t]*$/m.exec(yamlText);
  const title = titleLine?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
  return { title: title !== null && title !== '' ? title : null, body };
}

/** Build a ConceptLookup over a path → raw-markdown map (DI for tests).
 *  Values are typed unknown because vite's eager glob is — non-string
 *  entries are skipped rather than trusted. */
export function createConceptLookup(map: Record<string, unknown> = articles): ConceptLookup {
  return (slug) => {
    for (const [path, raw] of Object.entries(map)) {
      if (!path.endsWith(`/${slug}.md`) || typeof raw !== 'string') continue;
      const { title, body } = parseArticle(raw);
      return { title: title ?? slug, body };
    }
    return undefined;
  };
}

/** The app-wide lookup over the bundled concepts wiki. */
export const conceptLookup: ConceptLookup = createConceptLookup();
