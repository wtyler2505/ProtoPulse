import { pcbViewOf } from '@protopulse/renderer';

import { unplacedPcbComponents } from '../pcb/selectors.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { NamedPadSource } from '../pcb/selectors.js';

/**
 * The PCB-mode left rail: components that exist on the schematic but
 * not on the board yet. Click one, then click the canvas to place its
 * footprint (R rotates the ghost in 90° steps). Parts without footprint
 * geometry are listed but disabled — honest about the seed library's
 * coverage while @protopulse/parts grows footprints.
 */

export function PcbTray() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;
  void branch;
  const pcbTool = useUi((s) => s.pcbTool);
  const pcbPlaceComponentId = useUi((s) => s.pcbPlaceComponentId);
  const startPcbPlace = useUi((s) => s.startPcbPlace);

  const graph = getGraph(useSession.getState());
  // Part.footprint is a pinned in-flight contract — bridge structurally.
  const entries = unplacedPcbComponents(
    graph,
    pcbViewOf(graph),
    partDb as unknown as NamedPadSource,
  );

  return (
    <aside className="palette panel">
      <h2 className="panel-title">Unplaced</h2>
      {entries.length === 0 ? (
        <p className="muted tray-empty">
          Every schematic component is on the board. Route traces, drop
          vias, then run DRC.
        </p>
      ) : (
        <ul className="palette-list">
          {entries.map((entry) => {
            const active = pcbTool === 'place' && pcbPlaceComponentId === entry.componentId;
            return (
              <li key={entry.componentId}>
                <button
                  type="button"
                  className={`palette-part${active ? ' active' : ''}`}
                  disabled={!entry.hasFootprint}
                  title={
                    entry.hasFootprint
                      ? `${entry.partName} — click, then click the board (R rotates)`
                      : `${entry.partName} has no footprint yet`
                  }
                  onClick={() => { startPcbPlace(entry.componentId); }}
                >
                  <span className="palette-prefix">{entry.ref}</span>
                  <span className="palette-name">{entry.partName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
