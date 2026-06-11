import { useMemo, useRef } from 'react';

import { addPack, forgetPack, usePacks } from '../state/packs.js';
import { partDb } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { Part } from '@protopulse/parts';

/** Part palette: seeds + loaded part packs, grouped by class; click
 *  arms PlaceTool. Packs (community library, first slice) load from
 *  JSON files, persist in localStorage, and carry their declared
 *  provenance tier — the title shows it before you place anything. */

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
  const flashStatus = useUi((s) => s.flashStatus);
  const packs = usePacks((s) => s.packs);
  const packVersion = usePacks((s) => s.version);
  const startupErrors = usePacks((s) => s.startupErrors);
  const fileInput = useRef<HTMLInputElement | null>(null);

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
    // packVersion is the db's change signal — the db itself is not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packVersion]);

  const onLoadPack = async (file: File) => {
    try {
      const pack = addPack(partDb, await file.text());
      flashStatus(`Pack ${pack.pack}@${pack.rev} loaded: ${String(pack.parts.length)} part(s). It will be back next session.`);
    } catch (err) {
      flashStatus(`Pack refused: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
                    title={`${part.name} (${part.refPrefix}) — ${part.provenance}${part.id.startsWith('core:') ? '' : ` · from pack ${part.id.split(':')[0] ?? ''}`}`}
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
      <section className="palette-group">
        <h3 className="palette-class">part packs</h3>
        {packs.length === 0 && <p className="muted">None loaded. A pack is a JSON file of parts with declared provenance tiers — load one and it joins the palette, this session and the next.</p>}
        {packs.length > 0 && (
          <ul className="palette-list">
            {packs.map((p) => (
              <li key={p.pack} className="pack-row">
                <span className="palette-name" title={p.author !== undefined ? `by ${p.author}` : undefined}>
                  {p.pack}@{p.rev} · {p.parts} part{p.parts === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="binding-remove"
                  title="forget this pack (its parts stay until you reload)"
                  onClick={() => {
                    forgetPack(p.pack);
                    flashStatus(`Pack ${p.pack} forgotten — its parts disappear on the next reload.`);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {startupErrors.map((e) => (
          <p key={e} className="sim-error">stored pack failed to load: {e}</p>
        ))}
        <button type="button" onClick={() => fileInput.current?.click()}>
          Load part pack…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onLoadPack(file);
            e.target.value = '';
          }}
        />
      </section>
    </aside>
  );
}
