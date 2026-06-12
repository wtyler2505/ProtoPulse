import { useEffect, useState } from 'react';

import { anchorIds, anchorPosition } from '../editor/anchors.js';
import { asErcAnchors } from '../review/anchors.js';
import { reviewConceptFor } from '../review/concepts.js';
import { loadReviewDecks } from '../review/decks.js';
import { runDesignReview } from '../review/runner.js';
import { narrateApply } from '../state/narration.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { ReviewOutcome } from '../review/runner.js';
import type { ReviewDeckLike, ReviewFinding } from '../review/types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * The Review panel — the v0.3 design-review board. A deck picker
 * (builtin defaults + every versioned deck bundled from
 * content/review-decks) feeds one button that runs the review (lazy
 * @protopulse/review); findings rank by severity with check-id and
 * code chips, focus their anchors on the canvas like ERC findings,
 * carry executable fixes, deep-link the concepts wiki, and hand
 * themselves to the Professor for a depth-matched explanation.
 * Re-runs show the opened/closed delta against the previous report
 * on the SAME deck — switching decks starts its own history.
 */

/** The no-deck choice: every built-in check at its native severity. */
const BUILTIN = 'builtin';

const SEVERITY_ORDER: ReviewFinding['severity'][] = ['error', 'warn', 'info'];

/** The Review → Professor handoff prompt. */
export function professorPromptFor(finding: ReviewFinding): string {
  return (
    `Explain this design-review finding in my current design: ` +
    `[${finding.severity}] ${finding.code} — ${finding.message} (check: ${finding.check}). ` +
    `Why does it matter here, and what should I do about it?`
  );
}

function FindingRow({ finding, graph }: { finding: ReviewFinding; graph: DesignGraph }) {
  const setSelection = useSession((s) => s.setSelection);
  const dispatch = useSession((s) => s.dispatch);
  const requestCenter = useUi((s) => s.requestCenter);
  const openConcept = useUi((s) => s.openConcept);
  const setHighlight = useUi((s) => s.setHighlight);
  const askProfessor = useUi((s) => s.askProfessor);
  const concept = reviewConceptFor(finding.code);
  const anchors = asErcAnchors(finding.anchors);

  const focus = () => {
    setSelection(anchors.flatMap(anchorIds));
    const first = anchors[0];
    if (first) {
      const at = anchorPosition(graph, first);
      if (at) requestCenter(at);
    }
  };

  return (
    <li
      className={`finding finding-${finding.severity}`}
      onMouseEnter={() => { setHighlight(anchors.flatMap(anchorIds)); }}
      onMouseLeave={() => { setHighlight([]); }}
    >
      <button type="button" className="finding-main" onClick={focus}>
        <span className="check-chip" title={`check: ${finding.check}`}>
          {finding.check}
        </span>
        <span className="code-chip">{finding.code}</span>
        <span className="finding-message">{finding.message}</span>
      </button>
      <span className="finding-actions">
        {finding.fix && finding.fix.length > 0 && (
          <button
            type="button"
            className="fix-button"
            onClick={() => {
              if (dispatch(finding.fix ?? [], `fix ${finding.code}`)) {
                narrateApply(
                  `Applied fix for ${finding.code}: ${finding.message}`,
                  concept?.conceptSlug,
                );
              }
            }}
          >
            Apply fix
          </button>
        )}
        {concept && (
          <button
            type="button"
            className="concept-chip"
            title={concept.title}
            onClick={() => { openConcept(concept.conceptSlug); }}
          >
            learn: {concept.title}
          </button>
        )}
        <button
          type="button"
          className="professor-chip"
          title="Hand this finding to the Professor at the current depth"
          onClick={() => { askProfessor(professorPromptFor(finding)); }}
        >
          Ask the Professor
        </button>
      </span>
    </li>
  );
}

export function ReviewPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [decks, setDecks] = useState<ReviewDeckLike[]>([]);
  const [deckId, setDeckId] = useState(BUILTIN);
  const state = useSession.getState();
  const graph = getGraph(state);

  useEffect(() => {
    let alive = true;
    loadReviewDecks().then(
      (loaded) => {
        if (alive) setDecks(loaded);
      },
      (err: unknown) => {
        // A malformed bundled deck is a build defect — surface it loudly.
        console.error('review decks failed to load:', err);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const onRun = async () => {
    setBusy(true);
    const s = useSession.getState();
    const deck = decks.find((d) => d.deck === deckId);
    const result = await runDesignReview(
      getGraph(s),
      partDb,
      {
        date: new Date().toISOString().slice(0, 10),
        designId: s.designId,
        branch: s.branch,
        ...(deck ? { deck } : {}),
      },
      { branch: s.branch, opsVersion: s.opsVersion },
    );
    setOutcome(result);
    setBusy(false);
  };

  return (
    <div className="panel-body review-panel">
      <label className="sim-field">
        <span className="sim-field-label">deck</span>
        <select
          value={deckId}
          disabled={busy}
          onChange={(e) => {
            setDeckId(e.target.value);
          }}
        >
          <option value={BUILTIN}>builtin (all checks, native severities)</option>
          {decks.map((d) => (
            <option key={d.deck} value={d.deck}>
              {d.deck} (rev {d.rev})
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="primary-button review-run"
        disabled={busy}
        onClick={() => {
          void onRun();
        }}
      >
        {busy ? 'Reviewing…' : 'Run design review'}
      </button>

      {outcome && !outcome.ok && <p className="sim-error">{outcome.error}</p>}

      {outcome?.ok && (
        <>
          <p className="muted review-meta">
            {outcome.report.counts.error} error(s), {outcome.report.counts.warn} warning(s),{' '}
            {outcome.report.counts.info} info — deck {outcome.report.deck ?? BUILTIN} rev{' '}
            {outcome.report.deckRev}, {outcome.report.date}, branch {branch}.
          </p>
          {outcome.delta && (
            <p className="review-delta">
              {outcome.delta.opened.length} opened, {outcome.delta.closed.length} closed since
              last run.
            </p>
          )}
          {outcome.report.findings.length === 0 ? (
            <p className="muted">No findings. The design passes review.</p>
          ) : (
            SEVERITY_ORDER.map((severity) => {
              const group = outcome.report.findings.filter((f) => f.severity === severity);
              if (group.length === 0) return null;
              return (
                <section key={severity}>
                  <h3 className={`panel-subtitle severity-${severity}`}>
                    {severity} ({group.length})
                  </h3>
                  <ul className="finding-list">
                    {group.map((finding, i) => (
                      <FindingRow
                        key={`${finding.check}-${finding.code}-${String(i)}`}
                        finding={finding}
                        graph={graph}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}

      {!outcome && !busy && (
        <p className="muted">
          The review deck reads the whole design — topology, values, budgets — and reports
          ranked findings with executable fixes. Run it before you call a revision done.
        </p>
      )}
    </div>
  );
}
