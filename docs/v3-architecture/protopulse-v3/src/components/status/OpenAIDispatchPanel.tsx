import type { OpenAIAgentDispatchResult } from '../../ai/swarms/openai-agents-dispatch';

interface OpenAIDispatchPanelProps {
  result: OpenAIAgentDispatchResult;
}

export function OpenAIDispatchPanel({ result }: OpenAIDispatchPanelProps) {
  const blocked = result.status === 'blocked';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 332,
        right: 16,
        zIndex: 10,
        width: 320,
        border: `1px solid ${blocked ? '#6b4b2b' : '#315a40'}`,
        background: blocked ? '#18130d' : '#101812',
        color: '#f7f2ea',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>OpenAI Dispatch</strong>
        <span style={{ color: blocked ? '#ffd7a3' : '#bdf0cb', fontSize: 11 }}>{result.status}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#c9c2b8' }}>
        Mode: {result.mode}. Dispatch only opens after swarm safety is ready.
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {(result.dispatches.length > 0 ? result.dispatches : result.blockedReasons.map((reason) => ({
          taskId: reason,
          agentName: 'blocked',
          prompt: reason,
          claimedFiles: [],
        }))).map((dispatch) => (
          <div key={`${dispatch.agentName}-${dispatch.taskId}`} style={{ border: '1px solid #3b2b1d', background: '#21170f', padding: 8 }}>
            <div style={{ fontSize: 12 }}>{dispatch.agentName}</div>
            <div style={{ marginTop: 3, fontSize: 11, color: '#c9c2b8' }}>{dispatch.taskId}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
