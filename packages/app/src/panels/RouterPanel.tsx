import { useState } from 'react';

import { AnthropicProvider, runRouter } from '@protopulse/ai';

import { createRouterHooks } from '../pcb/router-host.js';
import { ensureRoutingClearance } from '../pcb/routing.js';
import { narrateApply } from '../state/narration.js';
import { getGraph, partDb, useSession } from '../state/session.js';

import { loadKey, storeKey } from './apiKey.js';

/**
 * The Router panel — fourth crew member, same live-chat shape as the
 * Analyst. It routes on a WORKING COPY inside the agent loop; when the
 * run finishes, every applied op lands in the session as ONE batch with
 * meta {agent: 'router'} — undoable, blameable, syncable like any edit.
 */

interface ChatEntry {
  who: 'you' | 'router' | 'tool' | 'error';
  text: string;
}

export function RouterPanel() {
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
    ensureRoutingClearance();
    try {
      const s = useSession.getState();
      const provider = new AnthropicProvider({ apiKey });
      const result = await runRouter({
        prompt,
        graph: getGraph(s),
        parts: partDb,
        provider,
        hooks: createRouterHooks(),
        onEvent: (ev) => {
          if (ev.kind === 'tool_use') {
            push({ who: 'tool', text: `${ev.name} ${JSON.stringify(ev.input)}` });
          }
        },
      });
      if (result.ops.length > 0) {
        const landed = useSession
          .getState()
          .dispatch(result.ops, `router: ${prompt.slice(0, 40)}`, {
            agent: 'router',
            rationale: prompt,
          });
        if (landed) {
          narrateApply(`Router applied ${String(result.ops.length)} op(s) — check the board.`);
        } else {
          push({ who: 'error', text: 'the session rejected the routed ops (did the design change mid-run?)' });
        }
      }
      push({ who: 'router', text: result.finalText || '(no reply)' });
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
            The Router — copper is geometry, clearance is law, the ratsnest is a to-do list. Try:
            &quot;route the board&quot;. Routes land as one undoable batch.
          </p>
        )}
        {entries.map((entry, i) => (
          <div key={`${String(i)}-${entry.who}`} className={`analyst-msg analyst-${entry.who === 'router' ? 'analyst' : entry.who}`}>
            <span className="analyst-who">
              {entry.who === 'tool' ? '⚙ tool' : entry.who}
            </span>
            <span className="analyst-text">{entry.text}</span>
          </div>
        ))}
        {busy && <p className="muted">Router is working — walk first, shove when cornered…</p>}
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
          placeholder="Ask the Router…"
          value={input}
          disabled={busy}
          aria-label="Router chat input"
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
