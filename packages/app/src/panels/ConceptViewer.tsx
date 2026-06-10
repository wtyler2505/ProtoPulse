import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUi } from '../state/ui.js';

/**
 * Concepts-wiki viewer. Articles live at <repo>/content/concepts/** and
 * are bundled as lazy raw imports via import.meta.glob — no dev-server
 * filesystem tricks. The content phase lands later; until an article
 * exists the viewer degrades to a friendly "not yet written" notice.
 */

const articles = import.meta.glob('../../../../content/concepts/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function loaderFor(slug: string): (() => Promise<string>) | null {
  for (const [path, load] of Object.entries(articles)) {
    if (path.endsWith(`/${slug}.md`)) return load;
  }
  return null;
}

export function ConceptViewer() {
  const slug = useUi((s) => s.conceptSlug);
  const closeConcept = useUi((s) => s.closeConcept);
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    setMarkdown(null);
    if (!slug) return;
    const load = loaderFor(slug);
    if (!load) {
      setMarkdown(`# ${slug}\n\n_This article hasn't been written yet._`);
      return;
    }
    let alive = true;
    load()
      .then((text) => {
        if (alive) setMarkdown(text);
      })
      .catch(() => {
        if (alive) setMarkdown(`# ${slug}\n\n_Failed to load this article._`);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!slug) return null;

  return (
    <div className="concept-overlay" role="dialog" aria-label={`concept: ${slug}`}>
      <div className="concept-card">
        <header className="concept-header">
          <span className="code-chip">{slug}</span>
          <button type="button" className="close-button" onClick={closeConcept}>
            close
          </button>
        </header>
        <div className="concept-body">
          {markdown === null ? <p className="muted">Loading…</p> : <ReactMarkdown>{markdown}</ReactMarkdown>}
        </div>
      </div>
    </div>
  );
}
