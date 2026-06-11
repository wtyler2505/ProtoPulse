interface CompileStatusPanelProps {
  blockedCount: number;
  readyCount: number;
  missingFacts: string[];
  compileStatus?: 'ready' | 'blocked';
  blockedReasons?: string[];
  preview?: string;
  elementKinds?: string[];
}

export function CompileStatusPanel({
  blockedCount,
  readyCount,
  missingFacts,
  compileStatus = 'blocked',
  blockedReasons = [],
  preview = '',
  elementKinds = [],
}: CompileStatusPanelProps) {
  const ready = compileStatus === 'ready';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 10,
        width: 280,
        border: '1px solid #2f3b35',
        background: '#101614',
        color: '#e8f1ec',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13, letterSpacing: 0 }}>v3 Compile</strong>
        <span
          style={{
            border: `1px solid ${ready ? '#5c916f' : '#8a5f2d'}`,
            color: ready ? '#bff0cc' : '#ffdca8',
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          {compileStatus}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <Metric label="Ready" value={readyCount} />
        <Metric label="Blocked" value={blockedCount} />
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#b9c8c0' }}>
        Missing: {missingFacts.length > 0 ? missingFacts.join(', ') : 'none'}
      </div>
      {blockedReasons.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#ffd29b' }}>
          {blockedReasons[0]}
        </div>
      )}
      {elementKinds.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#b9c8c0' }}>
          Elements: {elementKinds.join(', ')}
        </div>
      )}
      {preview && (
        <pre style={{
          marginTop: 8,
          maxHeight: 92,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          border: '1px solid #26312d',
          padding: 8,
          fontSize: 11,
          color: '#cfe3d8',
        }}>
          {preview}
        </pre>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #26312d', padding: 8, background: '#151d1a' }}>
      <div style={{ fontSize: 11, color: '#9cadA5' }}>{label}</div>
      <div style={{ fontSize: 18, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}
