import { conceptFor, type Anchor, type Finding, type Severity } from '@protopulse/erc';
import { parsePortRef, type DesignGraph, type Vec } from '@protopulse/graph';
import { pinWorldPosition } from '@protopulse/renderer';
import { getFindings, getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

/**
 * ERC findings grouped by severity. Clicking selects the anchors and
 * centers the camera on the first one; fixes dispatch as ops; every code
 * links its concepts-wiki article.
 */

function anchorIds(anchor: Anchor): string[] {
  switch (anchor.kind) {
    case 'net':
      return [anchor.netId];
    case 'component':
      return [anchor.componentId];
    case 'port':
      return [parsePortRef(anchor.port).componentId];
  }
}

function anchorPosition(graph: DesignGraph, anchor: Anchor): Vec | null {
  switch (anchor.kind) {
    case 'component':
      return graph.schematic.placements.get(anchor.componentId)?.at ?? null;
    case 'port': {
      const { componentId, pinKey } = parsePortRef(anchor.port);
      const placement = graph.schematic.placements.get(componentId);
      const comp = graph.components.get(componentId);
      if (!placement || !comp) return null;
      const part = partDb.get(comp.partId, comp.partRev);
      if (!part) return placement.at;
      try {
        return pinWorldPosition(part, placement, pinKey);
      } catch {
        return placement.at;
      }
    }
    case 'net': {
      const net = graph.nets.get(anchor.netId);
      const firstPort = net?.ports[0];
      if (firstPort) return anchorPosition(graph, { kind: 'port', port: firstPort });
      return null;
    }
  }
}

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
      onMouseEnter={() => setHighlight(finding.anchors.flatMap(anchorIds))}
      onMouseLeave={() => setHighlight([])}
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
            onClick={() => dispatch(finding.fix ?? [], `fix ${finding.code}`)}
          >
            Apply fix
          </button>
        )}
        {concept && (
          <button
            type="button"
            className="concept-chip"
            title={concept.title}
            onClick={() => openConcept(concept.conceptSlug)}
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
