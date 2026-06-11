export function RealSampleValidationPanel() {
  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 336,
        right: 372,
        zIndex: 10,
        width: 340,
        border: '1px solid #37513d',
        background: '#111a13',
        color: '#effaf0',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Real Sample E2E</strong>
      <div style={{ marginTop: 8, fontSize: 11, color: '#bfd5c4' }}>
        Ready sample checks facts, metadata, pins, swarm, Codex templates, OpenAI dry-run, emitted TSX, and tscircuit render proof.
      </div>
      <code style={{ display: 'block', marginTop: 10, fontSize: 10, color: '#d7f7dc', whiteSpace: 'pre-wrap' }}>
        npm run validate:real-sample
      </code>
    </aside>
  );
}
