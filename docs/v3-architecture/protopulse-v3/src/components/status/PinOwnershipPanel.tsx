import type { PinOwnershipGate } from '../../ai/swarms/firmware-writer';

interface PinOwnershipPanelProps {
  gate: PinOwnershipGate;
}

export function PinOwnershipPanel({ gate }: PinOwnershipPanelProps) {
  const ready = gate.status === 'ready';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 656,
        left: 16,
        zIndex: 10,
        width: 280,
        border: `1px solid ${ready ? '#315a40' : '#6b4b2b'}`,
        background: ready ? '#101812' : '#18130d',
        color: '#f7f2ea',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Pin Ownership</strong>
        <span style={{ color: ready ? '#bdf0cb' : '#ffd7a3', fontSize: 11 }}>{gate.status}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#c9c2b8' }}>
        Board: {gate.board}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#c9c2b8' }}>
        Pins: {gate.ownedPins.length > 0 ? gate.ownedPins.join(', ') : 'none claimed'}
      </div>
      {gate.blockedReasons.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {gate.blockedReasons.map((reason) => (
            <div key={reason} style={{ border: '1px solid #3b2b1d', background: '#21170f', padding: 8, fontSize: 11 }}>
              {reason}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
