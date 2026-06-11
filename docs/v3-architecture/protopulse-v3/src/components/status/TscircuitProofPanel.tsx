import type { TscircuitRenderProof } from '../circuits/tscircuit-render-proof';

interface TscircuitProofPanelProps {
  proof: TscircuitRenderProof;
}

export function TscircuitProofPanel({ proof }: TscircuitProofPanelProps) {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 16,
        left: 708,
        zIndex: 10,
        width: 320,
        border: '1px solid #32464b',
        background: '#10191b',
        color: '#eefbff',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>tscircuit Proof</strong>
        <span style={{ color: '#bdf0ef', fontSize: 11 }}>{proof.status}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#b9d0d6' }}>
        Circuit JSON entries: {proof.circuitJsonCount}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#b9d0d6' }}>
        Types: {proof.circuitJsonTypes.slice(0, 4).join(', ')}
      </div>
    </aside>
  );
}
