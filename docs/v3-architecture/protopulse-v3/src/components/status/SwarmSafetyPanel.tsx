interface SwarmSafetyPanelProps {
  status: 'ready' | 'blocked';
  workerCap: number;
  taskCount: number;
  blockedReasons: string[];
}

export function SwarmSafetyPanel({ status, workerCap, taskCount, blockedReasons }: SwarmSafetyPanelProps) {
  const ready = status === 'ready';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 170,
        right: 16,
        zIndex: 10,
        width: 320,
        border: `1px solid ${ready ? '#315a40' : '#6b4b2b'}`,
        background: ready ? '#101812' : '#18130d',
        color: '#f7f2ea',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Swarm Safety</strong>
        <span style={{ color: ready ? '#bdf0cb' : '#ffd7a3', fontSize: 11 }}>{status}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#c9c2b8' }}>
        Workers: {taskCount}/{workerCap}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {(blockedReasons.length > 0 ? blockedReasons : ['No unsafe paths, duplicate claims, or cap issues.']).map((reason) => (
          <div key={reason} style={{ border: '1px solid #3b2b1d', background: '#21170f', padding: 8, fontSize: 11 }}>
            {reason}
          </div>
        ))}
      </div>
    </aside>
  );
}
