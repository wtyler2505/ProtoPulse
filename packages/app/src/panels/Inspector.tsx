import { useState } from 'react';

import { pcbViewOf } from '@protopulse/renderer';

import { pcbFlipSelectionOps } from '../pcb/tools.js';
import { asOpBodies } from '../pcb/types.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { Component, Net } from '@protopulse/graph';

/**
 * Selection details: ref, part, value, DNP, and the nets it touches.
 * In PCB mode a placed footprint also shows its board side with a flip
 * button (the F key does the same on canvas).
 */

function NetRow({ net }: { net: Net }) {
  const dispatch = useSession((s) => s.dispatch);
  const [name, setName] = useState(net.name);

  const rename = () => {
    const trimmed = name.trim();
    if (trimmed.length > 0 && trimmed !== net.name) {
      dispatch([{ kind: 'rename_net', netId: net.id, name: trimmed }], 'rename net');
    }
  };

  return (
    <li className="net-row">
      <input
        className="net-name-input"
        value={name}
        onChange={(e) => { setName(e.target.value); }}
        onBlur={rename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') rename();
        }}
        aria-label={`net ${net.name} name`}
      />
      <span className="net-ports">{net.ports.length} pins</span>
    </li>
  );
}

function ComponentInspector({ component }: { component: Component }) {
  const dispatch = useSession((s) => s.dispatch);
  const opsVersion = useSession((s) => s.opsVersion);
  const viewMode = useUi((s) => s.viewMode);
  const graph = getGraph(useSession.getState());
  const part = partDb.get(component.partId, component.partRev);
  const [value, setValue] = useState(component.value ?? '');

  const placement =
    viewMode === 'pcb' ? pcbViewOf(graph).placements.get(component.id) : undefined;

  const flipSide = () => {
    const flip = pcbFlipSelectionOps(graph, pcbViewOf(graph), new Set([component.id]));
    if (flip.ops.length === 0) {
      if (flip.status !== null) useUi.getState().flashStatus(flip.status);
      return;
    }
    if (dispatch(asOpBodies(flip.ops), 'flip footprint side')) {
      if (flip.status !== null) useUi.getState().flashStatus(flip.status);
    } else {
      useUi.getState().flashStatus('The graph engine rejected that flip.');
    }
  };

  const commitValue = () => {
    const next = value.trim();
    if (next === (component.value ?? '')) return;
    dispatch(
      [{ kind: 'set_component_props', id: component.id, props: { value: next.length > 0 ? next : null } }],
      'edit value',
    );
  };

  const nets = [...graph.nets.values()].filter((net) =>
    net.ports.some((p) => p.startsWith(`${component.id}:`)),
  );

  return (
    <div key={`${component.id}@${String(opsVersion)}`}>
      <dl className="inspector-grid">
        <dt>Ref</dt>
        <dd>{component.ref}</dd>
        <dt>Part</dt>
        <dd>{part ? part.name : `${component.partId} (unknown)`}</dd>
        <dt>Value</dt>
        <dd>
          <input
            className="value-input"
            value={value}
            placeholder="e.g. 10k"
            onChange={(e) => { setValue(e.target.value); }}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitValue();
            }}
          />
        </dd>
        <dt>DNP</dt>
        <dd>
          <label className="dnp-label">
            <input
              type="checkbox"
              checked={component.dnp}
              onChange={(e) =>
                dispatch(
                  [{ kind: 'set_component_props', id: component.id, props: { dnp: e.target.checked } }],
                  'toggle DNP',
                )
              }
            />
            do not populate
          </label>
        </dd>
        {placement && (
          <>
            <dt>Side</dt>
            <dd className="side-cell">
              <span
                className={`layer-chip ${placement.side === 'top' ? 'layer-f' : 'layer-b'}`}
                title="board side this footprint sits on"
              >
                {placement.side === 'top' ? 'top (F.Cu)' : 'bottom (B.Cu)'}
              </span>
              <button
                type="button"
                className="flip-button"
                title="flip the footprint to the other board side (F)"
                onClick={flipSide}
              >
                Flip to {placement.side === 'top' ? 'bottom' : 'top'}
              </button>
            </dd>
          </>
        )}
      </dl>
      <h3 className="panel-subtitle">Nets</h3>
      {nets.length === 0 ? (
        <p className="muted">No connections yet — use the Wire tool.</p>
      ) : (
        <ul className="net-list">
          {nets.map((net) => (
            <NetRow key={net.id} net={net} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function Inspector() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  const selection = useSession((s) => s.selection);
  const graph = getGraph(useSession.getState());
  void opsVersion;
  void branch;

  const componentId = [...selection].find((id) => graph.components.has(id));
  const component = componentId ? graph.components.get(componentId) : undefined;
  const selectedNet = [...selection].map((id) => graph.nets.get(id)).find((n) => n !== undefined);

  return (
    <div className="panel-body">
      {component ? (
        <ComponentInspector component={component} />
      ) : selectedNet ? (
        <div>
          <h3 className="panel-subtitle">Net</h3>
          <ul className="net-list">
            <NetRow key={selectedNet.id} net={selectedNet} />
          </ul>
        </div>
      ) : (
        <p className="muted">Select a symbol or wire to inspect it.</p>
      )}
    </div>
  );
}
