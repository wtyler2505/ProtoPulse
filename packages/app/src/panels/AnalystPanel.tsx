import { useState } from 'react';

import { AnthropicProvider, runAnalyst } from '@protopulse/ai';

import { simulateViaEngine } from '../sim/runner.js';
import { getGraph, partDb, useSession } from '../state/session.js';

/**
 * The Analyst panel — the first LIVE agent chat in the editor (the
 * Draftsman panel is still a stub). The user's own Anthropic API key is
 * read from localStorage 'pp-anthropic-key' and sent ONLY to Anthropic;
 * the Analyst runs simulations via the app's lazy sim runner and reports
 * with the fidelity manifest. Run-to-completion, no streaming (v0.2).
 */

const KEY_STORAGE = 'pp-anthropic-key';

function loadKey(): string {
  try {
    return globalThis.localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function storeKey(key: string): void {
  try {
    if (key === '') {
      globalThis.localStorage.removeItem(KEY_STORAGE);
    } else {
      globalThis.localStorage.setItem(KEY_STORAGE, key);
    }
  } catch {
    // privacy mode — key stays in-memory for this session only
  }
}

interface ChatEntry {
  who: 'you' | 'analyst' | 'tool' | 'error';
  text: string;
}

export function AnalystPanel() {
  const [apiKey, setApiKey] = useState(loadKey);
  const [keyDraft, setKeyDraft] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const push = (entry: ChatEntry) => {
    setEntries((prev) => [...prev, entry]);
  };

  const onSend = async () => {
    const prompt = input.trim();
    if (prompt === '' || busy || apiKey === '') return;
    setInput('');
    push({ who: 'you', text: prompt });
    setBusy(true);
    try {
      const s = useSession.getState();
      const provider = new AnthropicProvider({ apiKey });
      const result = await runAnalyst({
        prompt,
        graph: getGraph(s),
        parts: partDb,
        provider,
        simulate: simulateViaEngine,
        onEvent: (ev) => {
          if (ev.kind === 'tool_use') {
            push({ who: 'tool', text: `${ev.name} ${JSON.stringify(ev.input)}` });
          }
        },
      });
      push({ who: 'analyst', text: result.finalText || '(no reply)' });
    } catch (err) {
      push({ who: 'error', text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  };

  if (apiKey === '') {
    return (
      <div className="panel-body analyst">
        <h3 className="panel-subtitle">Anthropic API key</h3>
        <p className="analyst-warning">
          ⚠ The key is stored in this browser&apos;s localStorage in plain text and sent directly
          from your browser to Anthropic — never to a ProtoPulse server. Use a scoped, revocable
          key, and do not enter it on a shared machine.
        </p>
        <form
          className="analyst-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = keyDraft.trim();
            if (trimmed === '') return;
            storeKey(trimmed);
            setApiKey(trimmed);
            setKeyDraft('');
          }}
        >
          <input
            type="password"
            className="analyst-input"
            placeholder="sk-ant-…"
            value={keyDraft}
            aria-label="Anthropic API key"
            onChange={(e) => {
              setKeyDraft(e.target.value);
            }}
          />
          <button type="submit" disabled={keyDraft.trim() === ''}>
            Save
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="panel-body analyst">
      <div className="analyst-feed">
        {entries.length === 0 && (
          <p className="muted">
            The Analyst — skeptical of everything until it&apos;s plotted. Ask it to verify your
            circuit: &quot;what does the output do at power-on?&quot;
          </p>
        )}
        {entries.map((entry, i) => (
          <div key={`${String(i)}-${entry.who}`} className={`analyst-msg analyst-${entry.who}`}>
            <span className="analyst-who">
              {entry.who === 'you'
                ? 'you'
                : entry.who === 'tool'
                  ? '⚙ tool'
                  : entry.who === 'error'
                    ? 'error'
                    : 'analyst'}
            </span>
            <span className="analyst-text">{entry.text}</span>
          </div>
        ))}
        {busy && <p className="muted">Analyst is working — simulations run to completion…</p>}
      </div>
      <form
        className="analyst-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
      >
        <input
          type="text"
          className="analyst-input"
          placeholder="Ask the Analyst…"
          value={input}
          disabled={busy}
          aria-label="Analyst chat input"
          onChange={(e) => {
            setInput(e.target.value);
          }}
        />
        <button type="submit" disabled={busy || input.trim() === ''}>
          Send
        </button>
      </form>
      <button
        type="button"
        className="analyst-forget"
        onClick={() => {
          storeKey('');
          setApiKey('');
        }}
      >
        Forget API key
      </button>
    </div>
  );
}
