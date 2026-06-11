import type { VerifiedFact } from '../../db/schema';

interface KnowledgeFactsPanelProps {
  sourcePath?: string;
  facts: Record<string, VerifiedFact>;
  missingFacts: string[];
  storage?: string;
}

export function KnowledgeFactsPanel({ sourcePath, facts, missingFacts, storage = 'Drizzle/Postgres' }: KnowledgeFactsPanelProps) {
  const factEntries = Object.entries(facts);
  return (
    <aside
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 10,
        width: 340,
        border: '1px solid #3b3f2b',
        background: '#16170f',
        color: '#f2f4df',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Verified Facts</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: '#c9cda7' }}>
        {sourcePath ?? 'No source loaded'}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: '#d6dab4' }}>
        Storage: {storage}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {factEntries.map(([key, fact]) => (
          <div key={key} style={{ border: '1px solid #30331f', background: '#1d1f13', padding: 8 }}>
            <div style={{ fontSize: 12 }}>{key}</div>
            <div style={{ color: '#aeb58b', fontSize: 11 }}>{fact.status}</div>
          </div>
        ))}
      </div>
      {missingFacts.length > 0 && (
        <div style={{ color: '#ffd29b', fontSize: 11, marginTop: 8 }}>
          Missing: {missingFacts.join(', ')}
        </div>
      )}
    </aside>
  );
}
