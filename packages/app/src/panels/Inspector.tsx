import { useState } from 'react';
import type { Component, Net } from '@protopulse/graph';
import { getGraph, partDb, useSession } from '../state/session.js';

/** Selection details: ref, part, value, DNP, and the nets it touches. */

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
        onChange={(e) => setName(e.target.value)}
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
  const graph = getGraph(useSession.getState());
  const part = partDb.get(component.partId, component.partRev);
  const [value, setValue] = useState(component.value ?? '');

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
            onChange={(e) => setValue(e.target.value)}
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
