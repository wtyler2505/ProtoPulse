import { useState } from 'react';

import { pcbViewOf } from '@protopulse/renderer';

import { runDrcCheck } from '../drc/runner.js';
import { pcbAnchorIds, pcbAnchorPosition } from '../pcb/anchors.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { DrcOutcome } from '../drc/runner.js';
import type { PadSource } from '../pcb/tools.js';
import type { Finding, Severity } from '@protopulse/erc';
import type { DesignGraph } from '@protopulse/graph';

/**
 * The DRC panel (v0.4): one button runs the rule deck against the board
 * via the lazily-imported @protopulse/drc (errors render as values until
 * the package lands). Findings follow the ErcPanel pattern — grouped by
 * severity, hover highlights, click focuses the anchors on the PCB
 * canvas. No executable fixes yet (honest cut: DRC violations need
 * spatial edits the engine can't synthesize at v0.4).
 */

const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];

function FindingRow({ finding, graph }: { finding: Finding; graph: DesignGraph }) {
  const setSelection = useSession((s) => s.setSelection);
  const requestCenter = useUi((s) => s.requestCenter);
  const setHighlight = useUi((s) => s.setHighlight);
  const view = pcbViewOf(graph);
  const parts = partDb as unknown as PadSource;

  const ids = finding.anchors.flatMap((a) => pcbAnchorIds(view, a));

  const focus = () => {
    setSelection(ids);
    const first = finding.anchors[0];
    if (first) {
      const at = pcbAnchorPosition(graph, view, parts, first);
      if (at) requestCenter(at);
    }
  };

  return (
    <li
      className={`finding finding-${finding.severity}`}
      onMouseEnter={() => { setHighlight(ids); }}
      onMouseLeave={() => { setHighlight([]); }}
    >
      <button type="button" className="finding-main" onClick={focus}>
        <span className="code-chip">{finding.code}</span>
        <span className="finding-message">{finding.message}</span>
      </button>
    </li>
  );
}

export function DrcPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<DrcOutcome | null>(null);
  const graph = getGraph(useSession.getState());

  const onRun = async () => {
    setBusy(true);
    const s = useSession.getState();
    const result = await runDrcCheck(getGraph(s), partDb, {
      branch: s.branch,
      opsVersion: s.opsVersion,
    });
    setOutcome(result);
    setBusy(false);
  };

  return (
    <div className="panel-body">
      <button
        type="button"
        className="primary-button"
        disabled={busy}
        onClick={() => {
          void onRun();
        }}
      >
        {busy ? 'Checking…' : 'Run DRC'}
      </button>

      {outcome && !outcome.ok && <p className="sim-error">{outcome.error}</p>}

      {outcome?.ok && (
        <>
          <p className="muted">
            deck {outcome.deck} rev {outcome.deckRev} — branch {branch}
          </p>
          {outcome.findings.length === 0 ? (
            <p className="muted">No findings. The board passes DRC.</p>
          ) : (
            SEVERITY_ORDER.map((severity) => {
              const group = outcome.findings.filter((f) => f.severity === severity);
              if (group.length === 0) return null;
              return (
                <section key={severity}>
                  <h3 className={`panel-subtitle severity-${severity}`}>
                    {severity} ({group.length})
                  </h3>
                  <ul className="finding-list">
                    {group.map((finding, i) => (
                      <FindingRow
                        key={`${finding.code}-${String(i)}`}
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
          DRC checks the board against the fab&apos;s rule deck — trace widths,
          clearances, drill sizes, annular rings. Run it before you order.
        </p>
      )}
    </div>
  );
}
