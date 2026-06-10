import { resolveConflict } from '@protopulse/graph';

import { describeOp } from '../state/replay.js';
import { getDiffDelta, useSession } from '../state/session.js';

import type { DesignGraph, MergeChoice, MergeConflict } from '@protopulse/graph';

/**
 * Branch management: create / switch / diff-overlay toggle / merge.
 *
 * Diff overlay colors entities present in the CURRENT branch (added =
 * green, changed/moved = amber) on the canvas. Removed-entity ghosts are
 * an accepted M1 cut: instead of rendering red ghost geometry from the
 * other branch's scene, removed entities are listed textually below.
 *
 * Merge is the interactive half of threeWayMerge: auto-mergeable changes
 * are listed, conflicts are presented as data with an ours/theirs pick
 * each, and NOTHING lands until every conflict is decided — the merge
 * then commits as one batch with both parents recorded.
 */

function refOf(g: DesignGraph, id: string): string {
  return g.components.get(id)?.ref ?? id;
}

function netNameOf(g: DesignGraph, id: string | null): string {
  if (id === null) return '(disconnected)';
  return g.nets.get(id)?.name ?? id;
}

/** Property conflict sides are `unknown` — render strings as-is and
 *  everything else as JSON (never '[object Object]'). */
function propLabel(v: unknown): string {
  if (v === undefined || v === null) return '(unset)';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

interface ConflictView {
  what: string;
  oursLabel: string;
  theirsLabel: string;
}

function conflictView(c: MergeConflict, ours: DesignGraph, theirs: DesignGraph): ConflictView {
  switch (c.kind) {
    case 'property': {
      if (c.entityKind === 'component') {
        return {
          what: `${refOf(ours, c.entity)} · ${c.field}`,
          oursLabel: propLabel(c.ours),
          theirsLabel: propLabel(c.theirs),
        };
      }
      if (c.entityKind === 'net') {
        return {
          what: `net ${c.field}`,
          oursLabel: propLabel(c.ours),
          theirsLabel: propLabel(c.theirs),
        };
      }
      return {
        what: `${c.entityKind} ${c.entity} · ${c.field}`,
        oursLabel: 'keep this branch’s version',
        theirsLabel: c.theirs === undefined ? 'remove (deleted there)' : 'take theirs',
      };
    }
    case 'structural':
      return {
        what: `port ${c.port}`,
        oursLabel: netNameOf(ours, c.oursNet),
        theirsLabel: netNameOf(theirs, c.theirsNet),
      };
    case 'remove_vs_modify':
      return c.removedBy === 'theirs'
        ? {
            what: `${refOf(ours, c.entity)} (${c.entityKind})`,
            oursLabel: 'keep — it was modified here',
            theirsLabel: 'remove — it was deleted there',
          }
        : {
            what: `${refOf(theirs, c.entity)} (${c.entityKind})`,
            oursLabel: 'keep removed',
            theirsLabel: 'restore their version (with wiring)',
          };
  }
}

function MergeSection() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const merge = useSession((s) => s.merge);
  const branch = useSession((s) => s.branch);
  const setMergeChoice = useSession((s) => s.setMergeChoice);
  const cancelMerge = useSession((s) => s.cancelMerge);
  const applyMerge = useSession((s) => s.applyMerge);
  const state = useSession.getState();
  if (!merge) return null;

  const ours = state.core.graphFor(branch);
  const theirs = state.core.graphFor(merge.from);
  const undecided = merge.choices.filter((c) => c === null).length;
  const upToDate = merge.autoOps.length === 0 && merge.conflicts.length === 0;

  return (
    <section className="merge-section">
      <h3 className="panel-subtitle">
        merge {merge.from} → {branch}
      </h3>

      {upToDate ? (
        <p className="muted">Already up to date — nothing to merge.</p>
      ) : (
        <>
          <p className="muted">
            {merge.autoOps.length} auto-merged change{merge.autoOps.length === 1 ? '' : 's'},{' '}
            {merge.conflicts.length} conflict{merge.conflicts.length === 1 ? '' : 's'}
          </p>
          {merge.autoOps.length > 0 && (
            <details className="merge-auto">
              <summary>auto-merged changes</summary>
              <ul className="merge-auto-list">
                {merge.autoOps.map((op, i) => (
                  // eslint-disable-next-line react/no-array-index-key -- static computed list
                  <li key={i}>{describeOp(op)}</li>
                ))}
              </ul>
            </details>
          )}

          {merge.conflicts.map((conflict, i) => {
            const view = conflictView(conflict, ours, theirs);
            const theirsPossible =
              resolveConflict(conflict, 'theirs', { ours, theirs }, merge.autoOps) !== null;
            const choice = merge.choices[i] ?? null;
            const pick = (c: MergeChoice) => () => {
              setMergeChoice(i, c);
            };
            return (
              // eslint-disable-next-line react/no-array-index-key -- conflicts are a stable computed list
              <div key={i} className="merge-conflict">
                <div className="merge-conflict-what">{view.what}</div>
                <div className="merge-conflict-choices">
                  <button
                    type="button"
                    className={`merge-choice${choice === 'ours' ? ' active' : ''}`}
                    onClick={pick('ours')}
                  >
                    ours: {view.oursLabel}
                  </button>
                  <button
                    type="button"
                    className={`merge-choice${choice === 'theirs' ? ' active' : ''}`}
                    disabled={!theirsPossible}
                    title={theirsPossible ? undefined : 'not expressible as ops yet — keep ours'}
                    onClick={pick('theirs')}
                  >
                    theirs: {view.theirsLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="merge-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!upToDate && undecided > 0}
          title={undecided > 0 ? `${undecided} conflict(s) still undecided` : undefined}
          onClick={() => {
            applyMerge();
          }}
        >
          {upToDate ? 'Done' : `Apply merge (${merge.autoOps.length + merge.conflicts.length})`}
        </button>
        <button type="button" onClick={cancelMerge}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function BranchPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const branch = useSession((s) => s.branch);
  const diffAgainst = useSession((s) => s.diffAgainst);
  const merge = useSession((s) => s.merge);
  const createBranch = useSession((s) => s.createBranch);
  const switchBranch = useSession((s) => s.switchBranch);
  const setDiffAgainst = useSession((s) => s.setDiffAgainst);
  const startMerge = useSession((s) => s.startMerge);
  const state = useSession.getState();
  const names = state.core.log.names();
  const delta = getDiffDelta(state);
  const otherGraph = diffAgainst !== null ? state.core.graphFor(diffAgainst) : null;

  const onCreate = () => {
    // eslint-disable-next-line no-alert -- M1 branch naming; proper dialog post-M1
    const name = window.prompt('New branch name (forks from the current head):');
    if (name) {
      // eslint-disable-next-line no-alert -- M1 error surface; toast post-M1
      if (!createBranch(name)) window.alert(`Branch "${name}" already exists or is invalid.`);
    }
  };

  return (
    <div className="panel-body">
      <button type="button" className="primary-button" onClick={onCreate}>
        + New branch from {branch}
      </button>
      <ul className="branch-list">
        {names.map((name) => (
          <li key={name} className={`branch-row${name === branch ? ' current' : ''}`}>
            <button
              type="button"
              className="branch-name"
              disabled={name === branch}
              onClick={() => {
                switchBranch(name);
              }}
              title={name === branch ? 'current branch' : `switch to ${name}`}
            >
              {name === branch ? `● ${name}` : name}
            </button>
            {name !== branch && (
              <>
                <button
                  type="button"
                  className={`diff-toggle${diffAgainst === name ? ' active' : ''}`}
                  onClick={() => {
                    setDiffAgainst(diffAgainst === name ? null : name);
                  }}
                >
                  {diffAgainst === name ? 'diff: on' : 'diff vs'}
                </button>
                <button
                  type="button"
                  className={`merge-toggle${merge?.from === name ? ' active' : ''}`}
                  title={`three-way merge ${name} into ${branch}`}
                  onClick={() => {
                    startMerge(name);
                  }}
                >
                  merge
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <MergeSection />

      {delta && otherGraph && diffAgainst !== null && (
        <section className="diff-summary">
          <h3 className="panel-subtitle">
            diff {branch} vs {diffAgainst}
          </h3>
          <p className="muted">
            <span className="diff-chip added">added: green</span>{' '}
            <span className="diff-chip changed">changed: amber</span>{' '}
            <span className="diff-chip removed">removed: listed below</span>
          </p>
          {delta.components.removed.length === 0 && delta.nets.removed.length === 0 ? (
            <p className="muted">Nothing removed relative to {diffAgainst}.</p>
          ) : (
            <ul className="removed-list">
              {delta.components.removed.map((id) => (
                <li key={id} className="removed-entry">
                  − {otherGraph.components.get(id)?.ref ?? id} (component)
                </li>
              ))}
              {delta.nets.removed.map((id) => (
                <li key={id} className="removed-entry">
                  − {otherGraph.nets.get(id)?.name ?? id} (net)
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
