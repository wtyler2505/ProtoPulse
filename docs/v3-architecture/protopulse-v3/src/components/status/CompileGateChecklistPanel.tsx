interface CompileGateChecklistPanelProps {
  compileReady: boolean;
  factsReady: boolean;
  pinsReady: boolean;
  emitted: boolean;
}

export function CompileGateChecklistPanel({ compileReady, factsReady, pinsReady, emitted }: CompileGateChecklistPanelProps) {
  const rows = [
    { label: 'Boundary metadata', ready: compileReady },
    { label: 'Hardware facts', ready: factsReady },
    { label: 'Pin ownership', ready: pinsReady },
    { label: 'Final TSX emitted', ready: emitted },
  ];
  const allReady = rows.every((row) => row.ready);

  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 176,
        left: 708,
        zIndex: 10,
        width: 320,
        border: `1px solid ${allReady ? '#315a40' : '#6b4b2b'}`,
        background: allReady ? '#101812' : '#18130d',
        color: '#f7f2ea',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Compile Gate</strong>
        <span style={{ color: allReady ? '#bdf0cb' : '#ffd7a3', fontSize: 11 }}>{allReady ? 'ready' : 'blocked'}</span>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ border: '1px solid #3b2b1d', background: '#21170f', padding: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11 }}>{row.label}</span>
            <span style={{ fontSize: 11, color: row.ready ? '#bdf0cb' : '#ffd7a3' }}>{row.ready ? 'ready' : 'blocked'}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
