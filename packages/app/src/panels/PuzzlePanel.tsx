import { useEffect, useState } from 'react';

import { decodeBundle } from '@protopulse/graph';

import { loadPuzzles, puzzleSolved } from '../puzzle/puzzles.js';
import { getGraph, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { PuzzleEntry } from '../puzzle/puzzles.js';

/**
 * Failure puzzles: load a broken design, chase the symptom with the
 * real instruments (Sim, ERC, Inspector), then mark the root cause ON
 * THE SCHEMATIC — select the guilty component or net and annotate it.
 * Solved-ness is a property of the design's own op-log.
 */

export function PuzzlePanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const designId = useSession((s) => s.designId);
  const selection = useSession((s) => s.selection);
  const dispatch = useSession((s) => s.dispatch);
  const replaceWithBundle = useSession((s) => s.replaceWithBundle);
  const [entries, setEntries] = useState<PuzzleEntry[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);

  useEffect(() => {
    void loadPuzzles().then(setEntries);
  }, []);

  if (entries === null) return <div className="panel-body">loading puzzles…</div>;
  if (entries.length === 0) return <div className="panel-body muted">No puzzles shipped yet.</div>;

  const entry = entries.find((e) => e.puzzle.id === active) ?? null;
  const graph = getGraph(useSession.getState());
  const onPuzzleDesign = entry !== null && designId === `puzzle-${entry.puzzle.id}`;
  const solved = entry !== null && onPuzzleDesign && puzzleSolved(graph, entry.puzzle);

  const loadDesign = (e: PuzzleEntry) => {
    // eslint-disable-next-line no-alert -- M1 guard; same pattern as share links
    const go = window.confirm(
      'Load the puzzle design? Your current design will be replaced — Export → Save design first if you want to keep it.',
    );
    if (!go) return;
    replaceWithBundle(decodeBundle(e.designJson));
    setHintsShown(0);
    useUi.getState().flashStatus(`Puzzle loaded: ${e.puzzle.title}. Chase the symptom.`);
  };

  const markRootCause = () => {
    if (!entry) return;
    const id = [...selection][0];
    if (id === undefined) return;
    dispatch(
      [{ kind: 'annotate', anchor: id, text: `root cause (puzzle ${entry.puzzle.id})` }],
      'mark root cause',
    );
  };

  return (
    <div className="panel-body puzzle-panel">
      <label className="sim-field">
        <span className="sim-field-label">puzzle</span>
        <select
          value={active ?? ''}
          onChange={(e) => {
            setActive(e.target.value === '' ? null : e.target.value);
            setHintsShown(0);
          }}
        >
          <option value="">— pick a failure —</option>
          {entries.map((e) => (
            <option key={e.puzzle.id} value={e.puzzle.id}>
              {e.puzzle.id} — {e.puzzle.title}
            </option>
          ))}
        </select>
      </label>

      {entry && (
        <>
          <h3 className="panel-subtitle">{entry.puzzle.title}</h3>
          <p className="puzzle-symptom">{entry.puzzle.symptom}</p>
          <p className="muted">
            Instruments: {entry.puzzle.instruments.join(' · ')}
          </p>

          {!onPuzzleDesign && (
            <button type="button" className="primary-button" onClick={() => { loadDesign(entry); }}>
              Load the broken design
            </button>
          )}

          {onPuzzleDesign && !solved && (
            <>
              <button
                type="button"
                className="primary-button"
                disabled={selection.size === 0}
                title={
                  selection.size === 0
                    ? 'select the guilty component or wire on the canvas first'
                    : 'annotate the selection as the root cause'
                }
                onClick={markRootCause}
              >
                Mark selection as root cause
              </button>
              {hintsShown < entry.puzzle.hints.length && (
                <button
                  type="button"
                  onClick={() => {
                    setHintsShown((n) => n + 1);
                  }}
                >
                  Hint ({hintsShown + 1}/{entry.puzzle.hints.length})
                </button>
              )}
              {entry.puzzle.hints.slice(0, hintsShown).map((hint) => (
                <p key={hint} className="puzzle-hint">
                  💡 {hint}
                </p>
              ))}
              <p className="muted">
                Wrong marks stay in the design history — debugging leaves tracks, and that&apos;s
                fine.
              </p>
            </>
          )}

          {solved && (
            <div className="puzzle-solved">
              <p className="puzzle-solved-banner">✔ Root cause found.</p>
              <p>{entry.puzzle.rootCause.explanation}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
