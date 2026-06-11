import { liveEntryDecision } from '../../architecture/live-entry-decision';

export function LiveEntryDecisionPanel() {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 496,
        right: 372,
        zIndex: 10,
        width: 340,
        border: '1px solid #514535',
        background: '#1b160e',
        color: '#fff7ea',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Live Entry Gate</strong>
        <span style={{ color: '#ffdca8', fontSize: 11 }}>{liveEntryDecision.id}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }}>{liveEntryDecision.decision}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#e6d0ad' }}>
        First step: {liveEntryDecision.firstLiveStep}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#ffdca8' }}>
        Not yet: {liveEntryDecision.notYet}
      </div>
    </aside>
  );
}
