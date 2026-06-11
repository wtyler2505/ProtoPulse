import { useState } from 'react';
import { runLayoutAnalysisApi, runVisualInspectionApi } from '../../api/hardware-inspection-client';
import { MarkdownResponse } from './MarkdownResponse';

const sampleImage = 'data:image/png;base64,AAAA';
type DockMode = 'visual' | 'layout';
interface StoredInspectionReport {
  id: string;
  reportType: DockMode;
  query: string;
  markdown: string;
}

export function VisualInspectionDock() {
  const [mode, setMode] = useState<DockMode>('visual');
  const [projectId, setProjectId] = useState(1);
  const [imageUrl, setImageUrl] = useState(sampleImage);
  const [query, setQuery] = useState('Compare this hardware photo against the schematic and list wiring risks.');
  const [chassisDescription, setChassisDescription] = useState('Compact rover chassis with battery bay under the main controller plate.');
  const [result, setResult] = useState('');
  const [reports, setReports] = useState<StoredInspectionReport[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitInspection() {
    setLoading(true);
    setError('');
    try {
      const response = mode === 'visual'
        ? await runVisualInspectionApi({ projectId, imageUrl, query })
        : await runLayoutAnalysisApi({ projectId, imageUrl, query, chassisDescription });
      setResult(response.result);
      setReports((current) => [{
        id: `${mode}-${Date.now()}`,
        reportType: mode,
        query,
        markdown: response.result,
      }, ...current].slice(0, 3));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Visual inspection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      style={{
        position: 'fixed',
        right: 16,
        top: 16,
        zIndex: 10,
        width: 340,
        border: '1px solid #2e3a40',
        background: '#101519',
        color: '#edf5f7',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Physical Analysis</strong>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
        <ModeButton active={mode === 'visual'} onClick={() => setMode('visual')}>Visual</ModeButton>
        <ModeButton active={mode === 'layout'} onClick={() => setMode('layout')}>Layout</ModeButton>
      </div>
      <label style={labelStyle}>
        Project
        <input
          value={projectId}
          min={1}
          type="number"
          onChange={(event) => setProjectId(Number(event.target.value))}
          style={inputStyle}
        />
      </label>
      {mode === 'layout' && (
        <label style={labelStyle}>
          Chassis
          <textarea
            value={chassisDescription}
            onChange={(event) => setChassisDescription(event.target.value)}
            rows={3}
            style={inputStyle}
          />
        </label>
      )}
      <label style={labelStyle}>
        Image data URL
        <textarea
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          rows={3}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        Query
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          style={inputStyle}
        />
      </label>
      <button
        type="button"
        onClick={() => void submitInspection()}
        disabled={loading}
        style={{
          width: '100%',
          border: '1px solid #5d7d8a',
          background: loading ? '#243138' : '#1f3e49',
          color: '#f3fbff',
          padding: '8px 10px',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Running...' : mode === 'visual' ? 'Run inspection' : 'Run layout'}
      </button>
      {error && <p style={{ color: '#ffb3a6', fontSize: 12 }}>{error}</p>}
      {result && (
        <div
          style={{
            marginTop: 10,
            maxHeight: 180,
            overflow: 'auto',
            border: '1px solid #26343a',
            padding: 8,
            background: '#121b20',
          }}
        >
          <MarkdownResponse markdown={result} />
        </div>
      )}
      {reports.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #26343a', paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: '#bbccd2' }}>Stored reports: {reports.length}/3</div>
          {reports.map((report) => (
            <div key={report.id} style={{ marginTop: 6, fontSize: 11, color: '#d9e7ec' }}>
              {report.reportType}: {report.query.slice(0, 42)}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? '#79a7b8' : '#2e3a40'}`,
        background: active ? '#1f3e49' : '#151d22',
        color: '#edf5f7',
        padding: '7px 8px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const labelStyle = {
  display: 'grid',
  gap: 4,
  marginTop: 10,
  fontSize: 12,
  color: '#bbccd2',
} satisfies React.CSSProperties;

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #2e3a40',
  background: '#151d22',
  color: '#edf5f7',
  padding: 8,
  font: 'inherit',
} satisfies React.CSSProperties;
