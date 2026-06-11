interface NoEmitProofPanelProps {
  compileStatus: 'ready' | 'blocked';
  noEmitReasons: string[];
}

export function NoEmitProofPanel({ compileStatus, noEmitReasons }: NoEmitProofPanelProps) {
  const blocked = compileStatus === 'blocked';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 170,
        left: 16,
        zIndex: 10,
        width: 280,
        border: `1px solid ${blocked ? '#6b4b2b' : '#315a40'}`,
        background: blocked ? '#18130d' : '#101812',
        color: '#f4efe8',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>No-Emit Gate</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: blocked ? '#ffd7a3' : '#bdf0cb' }}>
        {blocked ? 'Final TSX is locked until verification passes.' : 'Verified output can be emitted.'}
      </div>
      {noEmitReasons.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {noEmitReasons.map((reason) => (
            <div key={reason} style={{ border: '1px solid #3b2b1d', background: '#21170f', padding: 8, fontSize: 11 }}>
              {reason}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
