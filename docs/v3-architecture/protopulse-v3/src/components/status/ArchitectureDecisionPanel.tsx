import { architectureViewDecision } from '../../architecture/view-decision';

export function ArchitectureDecisionPanel() {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 16,
        right: 372,
        zIndex: 10,
        width: 340,
        border: '1px solid #463b52',
        background: '#171220',
        color: '#f7efff',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Architecture Decision</strong>
        <span style={{ color: '#d9c2ff', fontSize: 11 }}>{architectureViewDecision.id}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }}>
        {architectureViewDecision.decision}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#cdbfde' }}>
        Current: {architectureViewDecision.currentView}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: '#cdbfde' }}>
        v3: {architectureViewDecision.v3View}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#e8d9ff' }}>
        Next: {architectureViewDecision.nextStep}
      </div>
    </aside>
  );
}
