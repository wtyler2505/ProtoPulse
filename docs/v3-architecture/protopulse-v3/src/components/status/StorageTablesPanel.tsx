import { v3ArchitectureTableNames } from '../../db/provenance-ddl';

const tableLabels: Record<(typeof v3ArchitectureTableNames)[number], string> = {
  v3_verified_facts: 'Verified facts',
  v3_compile_runs: 'Compile runs',
  v3_swarm_tasks: 'Swarm tasks',
  v3_inspection_reports: 'Inspection reports',
};

export function StorageTablesPanel() {
  return (
    <aside
      style={{
        position: 'fixed',
        right: 16,
        top: 16,
        zIndex: 10,
        width: 320,
        border: '1px solid #39414f',
        background: '#111621',
        color: '#eef4ff',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Storage Tables</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: '#aebbd0' }}>
        Real Drizzle/Postgres tables for v3 architecture state.
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {v3ArchitectureTableNames.map((tableName) => (
          <div
            key={tableName}
            style={{
              border: '1px solid #273141',
              background: '#151d2b',
              padding: 8,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12 }}>{tableLabels[tableName]}</span>
            <span style={{ color: '#9fd1ff', fontSize: 11 }}>ready</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
