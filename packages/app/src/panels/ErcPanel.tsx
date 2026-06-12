import { conceptFor    } from '@protopulse/erc';

import { anchorIds, anchorPosition } from '../editor/anchors.js';
import { narrateApply } from '../state/narration.js';
import { getFindings, getGraph, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type {Finding, Severity} from '@protopulse/erc';
import type {DesignGraph} from '@protopulse/graph';

/**
 * ERC findings grouped by severity. Clicking selects the anchors and
 * centers the camera on the first one; fixes dispatch as ops; every code
 * links its concepts-wiki article. Anchor focusing lives in the shared
 * editor/anchors module (the Review panel uses the same helpers).
 */

const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];

function FindingRow({ finding, graph }: { finding: Finding; graph: DesignGraph }) {
  const setSelection = useSession((s) => s.setSelection);
  const dispatch = useSession((s) => s.dispatch);
  const requestCenter = useUi((s) => s.requestCenter);
  const openConcept = useUi((s) => s.openConcept);
  const setHighlight = useUi((s) => s.setHighlight);
  const concept = conceptFor(finding.code);

  const focus = () => {
    const ids = finding.anchors.flatMap(anchorIds);
    setSelection(ids);
    const first = finding.anchors[0];
    if (first) {
      const at = anchorPosition(graph, first);
      if (at) requestCenter(at);
    }
  };

  return (
    <li
      className={`finding finding-${finding.severity}`}
      onMouseEnter={() => { setHighlight(finding.anchors.flatMap(anchorIds)); }}
      onMouseLeave={() => { setHighlight([]); }}
    >
      <button type="button" className="finding-main" onClick={focus}>
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
                narrateApply(`Applied fix for ${finding.code}: ${finding.message}`, concept?.conceptSlug);
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
      </span>
    </li>
  );
}

export function ErcPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;
  void branch;
  const state = useSession.getState();
  const findings = getFindings(state);
  const graph = getGraph(state);

  if (findings.length === 0) {
    return (
      <div className="panel-body">
        <p className="muted">No findings. The schematic passes ERC.</p>
      </div>
    );
  }

  return (
    <div className="panel-body">
      {SEVERITY_ORDER.map((severity) => {
        const group = findings.filter((f) => f.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity}>
            <h3 className={`panel-subtitle severity-${severity}`}>
              {severity} ({group.length})
            </h3>
            <ul className="finding-list">
              {group.map((finding, i) => (
                <FindingRow key={`${finding.code}-${String(i)}`} finding={finding} graph={graph} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
