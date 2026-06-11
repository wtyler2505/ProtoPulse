import type { ArchitectureMigrationResult } from '../../architecture/xyflow-to-tldraw';

interface MigrationPlanPanelProps {
  result: ArchitectureMigrationResult;
}

export function MigrationPlanPanel({ result }: MigrationPlanPanelProps) {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 176,
        right: 372,
        zIndex: 10,
        width: 340,
        border: '1px solid #30423b',
        background: '#101813',
        color: '#effaf3',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Migration Plan</strong>
      <div style={{ marginTop: 8, fontSize: 11, color: '#bfd2c7' }}>
        xyflow nodes/edges become tldraw shapes with `meta.protopulse`.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
        <Metric label="Nodes" value={result.migratedNodeCount} />
        <Metric label="Edges" value={result.migratedEdgeCount} />
        <Metric label="Shapes" value={result.tldrawShapes.length} />
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #26362f', background: '#152018', padding: 8 }}>
      <div style={{ color: '#a8baaf', fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 16 }}>{value}</div>
    </div>
  );
}
