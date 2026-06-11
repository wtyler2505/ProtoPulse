import type { CanvasBoundary } from '../canvas/CanvasBindings';
import type { BoundaryRuleResult } from '../canvas/BoundaryRules';

interface BoundaryPreviewPanelProps {
  boundaries: CanvasBoundary[];
  ruleResults: BoundaryRuleResult[];
}

export function BoundaryPreviewPanel({ boundaries, ruleResults }: BoundaryPreviewPanelProps) {
  const resultsById = new Map(ruleResults.map((result) => [result.boundaryId, result]));

  return (
    <aside
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 10,
        width: 300,
        border: '1px solid #303a35',
        background: '#111714',
        color: '#edf5ef',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Boundaries</strong>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {boundaries.map((boundary) => (
          <div key={boundary.id} style={{ border: '1px solid #26312d', background: '#151d1a', padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12 }}>{boundary.label}</span>
              <span style={{ color: '#b8d8ca', fontSize: 11 }}>{boundary.kind}</span>
            </div>
            <div style={{ color: '#97aaa2', fontSize: 11, marginTop: 4 }}>
              {Math.round(boundary.position.x)}, {Math.round(boundary.position.y)}
            </div>
            <RuleStatus result={resultsById.get(boundary.id)} />
          </div>
        ))}
      </div>
    </aside>
  );
}

function RuleStatus({ result }: { result?: BoundaryRuleResult }) {
  if (!result) {
    return null;
  }
  const ready = result.status === 'ready';
  return (
    <div style={{ marginTop: 6, fontSize: 11, color: ready ? '#a8f0c6' : '#ffd29b' }}>
      {ready ? 'ready' : `missing ${result.missingMetadata.join(', ')}`}
    </div>
  );
}
