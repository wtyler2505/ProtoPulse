import { useMemo } from 'react';

import { partDb } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { Part } from '@protopulse/parts';

/** Seed-library palette: parts grouped by class; click arms PlaceTool. */

const CLASS_ORDER: Part['class'][] = [
  'resistor',
  'capacitor',
  'inductor',
  'diode',
  'led',
  'transistor',
  'ic',
  'connector',
  'switch',
  'power',
  'battery',
  'other',
];

function latestParts(): Part[] {
  const byId = new Map<string, Part>();
  for (const part of partDb.all()) {
    const existing = byId.get(part.id);
    if (!existing || part.rev > existing.rev) byId.set(part.id, part);
  }
  return [...byId.values()];
}

export function Palette() {
  const tool = useUi((s) => s.tool);
  const placePartId = useUi((s) => s.placePartId);
  const startPlace = useUi((s) => s.startPlace);

  const groups = useMemo(() => {
    const parts = latestParts();
    const grouped = new Map<Part['class'], Part[]>();
    for (const cls of CLASS_ORDER) grouped.set(cls, []);
    for (const part of parts) {
      const bucket = grouped.get(part.class);
      if (bucket) bucket.push(part);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => (a.name < b.name ? -1 : 1));
    }
    return [...grouped.entries()].filter(([, parts2]) => parts2.length > 0);
  }, []);

  return (
    <aside className="palette panel">
      <h2 className="panel-title">Parts</h2>
      {groups.map(([cls, parts]) => (
        <section key={cls} className="palette-group">
          <h3 className="palette-class">{cls}</h3>
          <ul className="palette-list">
            {parts.map((part) => {
              const active = tool === 'place' && placePartId === part.id;
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    className={`palette-part${active ? ' active' : ''}`}
                    onClick={() => { startPlace(part.id); }}
                    title={`${part.name} (${part.refPrefix})`}
                  >
                    <span className="palette-prefix">{part.refPrefix}</span>
                    <span className="palette-name">{part.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}
