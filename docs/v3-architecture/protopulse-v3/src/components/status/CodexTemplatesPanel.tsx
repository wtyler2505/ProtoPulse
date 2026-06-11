import type { CodexCommandTemplateResult } from '../../ai/swarms/codex-command-templates';

interface CodexTemplatesPanelProps {
  result: CodexCommandTemplateResult;
}

export function CodexTemplatesPanel({ result }: CodexTemplatesPanelProps) {
  return (
    <aside
      style={{
        position: 'fixed',
        top: 494,
        right: 16,
        zIndex: 10,
        width: 320,
        border: '1px solid #34404d',
        background: '#101722',
        color: '#eef6ff',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Codex Templates</strong>
        <span style={{ color: result.status === 'ready' ? '#bdf0cb' : '#ffd7a3', fontSize: 11 }}>{result.status}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#b9c7d6' }}>
        `codex exec` commands are generated only for ready swarm plans.
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {(result.templates.length > 0 ? result.templates : result.blockedReasons.map((reason) => ({
          taskId: reason,
          command: reason,
          argv: [],
          claimedFiles: [],
        }))).map((template) => (
          <div key={template.taskId} style={{ border: '1px solid #273141', background: '#151d2b', padding: 8 }}>
            <div style={{ fontSize: 12 }}>{template.taskId}</div>
            <code style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#cfe6ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {template.command}
            </code>
          </div>
        ))}
      </div>
    </aside>
  );
}
