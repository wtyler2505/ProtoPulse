import { useEffect, useState } from 'react';

import { AnthropicProvider, runProfessor, TEACHING_DEPTHS } from '@protopulse/ai';

import { conceptLookup } from '../professor/concepts.js';
import { codeToConceptSlug } from '../review/concepts.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import { loadKey, storeKey } from './apiKey.js';

import type { TeachingDepth } from '@protopulse/ai';

/**
 * The Professor panel — never tired, never condescending, depth-
 * adjustable. Mirrors the Analyst panel (same key handling, same
 * run-to-completion chat), but runs the Professor persona with the
 * app's concepts wiki wired in and the shared teaching-depth dial on
 * top. The Review panel hands findings over via ui.professorSeed.
 */

const DEPTH_LABELS: Record<TeachingDepth, string> = {
  'do-it': 'Do it',
  'show-me': 'Show me',
  'teach-me': 'Teach me',
};

interface ChatEntry {
  who: 'you' | 'professor' | 'tool' | 'error';
  text: string;
}

function DepthDial() {
  const depth = useUi((s) => s.teachingDepth);
  const setTeachingDepth = useUi((s) => s.setTeachingDepth);
  return (
    <div className="depth-dial" role="radiogroup" aria-label="Teaching depth">
      <span className="depth-dial-label">depth</span>
      {TEACHING_DEPTHS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={depth === d}
          className={`depth-stop${depth === d ? ' active' : ''}`}
          onClick={() => { setTeachingDepth(d); }}
        >
          {DEPTH_LABELS[d]}
        </button>
      ))}
    </div>
  );
}

export function ProfessorPanel() {
  const [apiKey, setApiKey] = useState(loadKey);
  const [keyDraft, setKeyDraft] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const seed = useUi((s) => s.professorSeed);

  // Review → Professor handoff: take the seeded prompt exactly once and
  // put it in the input so the user can edit before sending.
  useEffect(() => {
    if (seed === null) return;
    setInput(useUi.getState().consumeProfessorSeed() ?? '');
  }, [seed]);

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
      const result = await runProfessor({
        prompt,
        graph: getGraph(s),
        parts: partDb,
        provider,
        concepts: conceptLookup,
        codeToConcept: codeToConceptSlug,
        depth: useUi.getState().teachingDepth,
        onEvent: (ev) => {
          if (ev.kind === 'tool_use') {
            push({ who: 'tool', text: `${ev.name} ${JSON.stringify(ev.input)}` });
          }
        },
      });
      push({ who: 'professor', text: result.finalText || '(no reply)' });
    } catch (err) {
      push({ who: 'error', text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  };

  if (apiKey === '') {
    return (
      <div className="panel-body analyst professor">
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
    <div className="panel-body analyst professor">
      <DepthDial />
      <div className="analyst-feed">
        {entries.length === 0 && (
          <p className="muted">
            The Professor — never tired, never condescending, depth-adjustable. Ask why your
            circuit works the way it does, or hand a finding over from the Review tab.
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
                    : 'professor'}
            </span>
            <span className="analyst-text">{entry.text}</span>
          </div>
        ))}
        {busy && <p className="muted">The Professor is consulting the concepts wiki…</p>}
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
          placeholder="Ask the Professor…"
          value={input}
          disabled={busy}
          aria-label="Professor chat input"
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
