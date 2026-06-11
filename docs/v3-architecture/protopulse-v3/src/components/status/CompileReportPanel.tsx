import type { V3CompileReport } from '../../reports/v3-compile-report';

interface CompileReportPanelProps {
  report: V3CompileReport;
}

export function CompileReportPanel({ report }: CompileReportPanelProps) {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 16,
        left: 332,
        zIndex: 10,
        width: 360,
        border: '1px solid #493838',
        background: '#1b1212',
        color: '#fff2ee',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Compile Report</strong>
        <span style={{ color: report.status === 'ready' ? '#bdf0cb' : '#ffd7a3', fontSize: 11 }}>
          {report.status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
        <Metric label="Facts" value={Object.keys(report.acceptedFacts).length} />
        <Metric label="Missing" value={report.missingFacts.length} />
        <Metric label="Blocked" value={report.blockedTasks.length} />
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#e2c7c0' }}>
        TSX: {report.emittedTsx ? 'emitted' : 'not emitted'}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #3b2828', background: '#231717', padding: 8 }}>
      <div style={{ color: '#c9aaa2', fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 16 }}>{value}</div>
    </div>
  );
}
