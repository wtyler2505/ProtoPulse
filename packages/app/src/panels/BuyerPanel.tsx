import { useState } from 'react';

import { AnthropicProvider, runBuyer } from '@protopulse/ai';

import { narrateApply } from '../state/narration.js';
import { getGraph, partDb, useSession } from '../state/session.js';

import { loadKey, storeKey } from './apiKey.js';
import { loadDefaultCatalog } from './catalog.js';

/**
 * The Buyer panel — sixth crew member, same live-chat shape as the
 * Analyst. It sources on a WORKING COPY inside the agent loop against
 * the bundled rev-stamped catalog snapshot; when the run finishes,
 * every applied op (fields.lcsc / fields.mpn assignments) lands in the
 * session as ONE batch with meta {agent: 'buyer'} — undoable,
 * blameable, syncable like any edit.
 */

interface ChatEntry {
  who: 'you' | 'buyer' | 'tool' | 'error';
  text: string;
}

export function BuyerPanel() {
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
      const catalog = await loadDefaultCatalog();
      const result = await runBuyer({
        prompt,
        graph: getGraph(s),
        parts: partDb,
        provider,
        catalog,
        onEvent: (ev) => {
          if (ev.kind === 'tool_use') {
            push({ who: 'tool', text: `${ev.name} ${JSON.stringify(ev.input)}` });
          }
        },
      });
      if (result.ops.length > 0) {
        const landed = useSession
          .getState()
          .dispatch(result.ops, `buyer: ${prompt.slice(0, 40)}`, {
            agent: 'buyer',
            rationale: prompt,
          });
        if (landed) {
          narrateApply(`Buyer applied ${String(result.ops.length)} op(s) — sourcing updated.`);
        } else {
          push({ who: 'error', text: 'the session rejected the sourcing ops (did the design change mid-run?)' });
        }
      }
      push({ who: 'buyer', text: result.finalText || '(no reply)' });
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
            The Buyer — the BOM is its ledger. It assigns verified vendor part numbers from a
            rev-stamped catalog snapshot and never invents prices or stock. Try: &quot;source this
            design&quot;. Assignments land as one undoable batch.
          </p>
        )}
        {entries.map((entry, i) => (
          <div key={`${String(i)}-${entry.who}`} className={`analyst-msg analyst-${entry.who === 'buyer' ? 'analyst' : entry.who}`}>
            <span className="analyst-who">
              {entry.who === 'tool' ? '⚙ tool' : entry.who}
            </span>
            <span className="analyst-text">{entry.text}</span>
          </div>
        ))}
        {busy && <p className="muted">Buyer is working — reading the BOM, checking the catalog…</p>}
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
          placeholder="Ask the Buyer…"
          value={input}
          disabled={busy}
          aria-label="Buyer chat input"
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
