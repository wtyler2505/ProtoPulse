import { getDiffDelta, useSession } from '../state/session.js';

/**
 * Branch management: create / switch / diff-overlay toggle.
 *
 * Diff overlay colors entities present in the CURRENT branch (added =
 * green, changed/moved = amber) on the canvas. Removed-entity ghosts are
 * an accepted M1 cut: instead of rendering red ghost geometry from the
 * other branch's scene, removed entities are listed textually below.
 */

export function BranchPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const branch = useSession((s) => s.branch);
  const diffAgainst = useSession((s) => s.diffAgainst);
  const createBranch = useSession((s) => s.createBranch);
  const switchBranch = useSession((s) => s.switchBranch);
  const setDiffAgainst = useSession((s) => s.setDiffAgainst);
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
              onClick={() => { switchBranch(name); }}
              title={name === branch ? 'current branch' : `switch to ${name}`}
            >
              {name === branch ? `● ${name}` : name}
            </button>
            {name !== branch && (
              <button
                type="button"
                className={`diff-toggle${diffAgainst === name ? ' active' : ''}`}
                onClick={() => { setDiffAgainst(diffAgainst === name ? null : name); }}
              >
                {diffAgainst === name ? 'diff: on' : 'diff vs'}
              </button>
            )}
          </li>
        ))}
      </ul>

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
