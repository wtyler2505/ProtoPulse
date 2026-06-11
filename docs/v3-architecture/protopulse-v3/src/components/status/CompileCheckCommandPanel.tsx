export function CompileCheckCommandPanel() {
  const command = 'npm run compile:check -- examples/sample-architecture.json';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 332,
        left: 16,
        zIndex: 10,
        width: 280,
        border: '1px solid #3a3448',
        background: '#15121d',
        color: '#f3eefc',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>CLI Compile Check</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: '#cbbfe0' }}>
        One JSON file in, compile gate report out.
      </div>
      <code
        style={{
          display: 'block',
          marginTop: 10,
          border: '1px solid #2d263c',
          background: '#1d1829',
          padding: 8,
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          color: '#e6d7ff',
        }}
      >
        {command}
      </code>
    </aside>
  );
}
