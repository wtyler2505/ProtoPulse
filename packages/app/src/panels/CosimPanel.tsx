import { useState } from 'react';

import {
  ADC_CHANNEL_CANDIDATES,
  addAdcBinding,
  addBinding,
  addInputBinding,
  candidateNets,
  candidatePins,
  removeAdcBinding,
  removeBinding,
  removeInputBinding,
  validateClosedLoopSpec,
  validateSpec,
} from '../cosim/bindings.js';
import { runCosim, runCosimClosed } from '../cosim/runner.js';
import { assembleCosimTraces, slowdownFactor } from '../cosim/traces.js';
import { sharedEmuSession } from '../emu/runner.js';
import { Plot, traceColor } from '../sim/Plot.js';
import { engNotation } from '../sim/scales.js';
import { sweepVectorName } from '../sim/types.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import { FidelityBar, Field, SelectField } from './SimPanel.js';

import type { CosimClosedOutcome, CosimOutcome } from '../cosim/runner.js';
import type {
  AdcBinding,
  ClosedLoopSpec,
  CosimWindowSpec,
  InputBinding,
  PinBinding,
} from '../cosim/types.js';
import type { PlotTrace } from '../sim/Plot.js';
import type { FidelityEntry } from '../sim/types.js';

/**
 * The Co-sim panel — the MCU and the analog solver on ONE axis. Bind
 * firmware pins to design nets, run a bounded virtual-time window
 * (default 500 µs at 1 µs steps), and read the money plot: the bound
 * pins' square waves stacked above the smoothed analog node voltages.
 *
 * Two modes. OPEN-LOOP replays firmware edges into the solver, nothing
 * flows back. CLOSED-LOOP cuts the window into conservative quanta and
 * feeds solved voltages back into the MCU — digital input pins through
 * a Schmitt comparator, ADC channels through the sampler — at the cost
 * of one full from-zero re-solve per quantum (the batch engine cannot
 * pause/resume); the honesty readout prints that re-solve count.
 *
 * The MCU core is BORROWED from the Firmware tab's shared session: a run
 * pauses that tab's loop and restarts the core from power-on (see
 * src/cosim/runner.ts for the full borrow protocol). The slowdown
 * readout is the Vol II D.3 performance honesty — co-sim is never
 * real-time, so we print exactly how much slower it ran.
 */

/** Defaults: a 500 µs window solved at 1 µs steps, 50 µs quanta. */
const DEFAULT_WINDOW_US = '500';
const DEFAULT_STEP_US = '1';
const DEFAULT_QUANTUM_US = '50';

/** Auto-selected analog vectors before the user touches the checkboxes. */
const AUTO_VISIBLE_VECTORS = 2;

type CosimMode = 'open-loop' | 'closed-loop';

interface RunRecord {
  outcome: CosimOutcome | CosimClosedOutcome;
  /** The spec the run used — bindings may be edited afterwards. */
  spec: CosimWindowSpec;
  /** Core clock at run time, to map the window onto cycles. */
  clockHz: number;
}

function parseOptional(label: string, raw: string): number | undefined | string {
  if (raw.trim() === '') return undefined;
  const v = Number(raw);
  if (!Number.isFinite(v)) return `${label} must be a number (got "${raw}")`;
  return v;
}

function parseRequired(label: string, raw: string): number | string {
  const v = parseOptional(label, raw);
  if (v === undefined) return `${label} must be a number (got "${raw}")`;
  return v;
}

export function CosimPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const setTab = useUi((s) => s.setTab);

  const [mode, setMode] = useState<CosimMode>('open-loop');
  const [bindings, setBindings] = useState<PinBinding[]>([]);
  const [newPin, setNewPin] = useState('');
  const [newNet, setNewNet] = useState('');
  const [vHigh, setVHigh] = useState('');
  const [rOut, setROut] = useState('');
  const [rise, setRise] = useState('');
  const [inputs, setInputs] = useState<InputBinding[]>([]);
  const [newInputPin, setNewInputPin] = useState('');
  const [newInputNet, setNewInputNet] = useState('');
  const [adc, setAdc] = useState<AdcBinding[]>([]);
  const [newAdcChannel, setNewAdcChannel] = useState('');
  const [newAdcNet, setNewAdcNet] = useState('');
  const [windowUs, setWindowUs] = useState(DEFAULT_WINDOW_US);
  const [stepUs, setStepUs] = useState(DEFAULT_STEP_US);
  const [quantumUs, setQuantumUs] = useState(DEFAULT_QUANTUM_US);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  /** null until the user toggles a checkbox — first vectors auto-select. */
  const [visible, setVisible] = useState<ReadonlySet<string> | null>(null);

  const session = sharedEmuSession;
  const graph = getGraph(useSession.getState());
  const nets = candidateNets(graph);
  const netName = (id: string): string => nets.find((n) => n.id === id)?.name ?? id;

  // ── Firmware gate: the co-sim borrows the Firmware tab's core. ──
  if (!session.loaded) {
    return (
      <div className="panel-body cosim-panel">
        <h3 className="panel-subtitle">Co-simulation</h3>
        <p className="muted">
          Co-simulation steps the firmware’s MCU core and the analog solver together, then
          plots the digital edges over the analog response — one picture. It needs firmware
          first.
        </p>
        <button
          type="button"
          onClick={() => {
            setTab('firmware');
          }}
        >
          Load a .hex in the Firmware tab →
        </button>
      </div>
    );
  }

  const availablePins = candidatePins(session.pins()).filter(
    (p) => !bindings.some((b) => b.pin === p),
  );
  const effectivePin = availablePins.includes(newPin) ? newPin : (availablePins[0] ?? '');
  const effectiveNet = nets.some((n) => n.id === newNet) ? newNet : (nets[0]?.id ?? '');

  // ── Closed-loop feedback candidates: a pin is one direction only. ──
  const availableInputPins = candidatePins(session.pins()).filter(
    (p) => !bindings.some((b) => b.pin === p) && !inputs.some((i) => i.pin === p),
  );
  const effectiveInputPin = availableInputPins.includes(newInputPin)
    ? newInputPin
    : (availableInputPins[0] ?? '');
  const effectiveInputNet = nets.some((n) => n.id === newInputNet)
    ? newInputNet
    : (nets[0]?.id ?? '');
  const availableChannels = ADC_CHANNEL_CANDIDATES.filter(
    (ch) => !adc.some((a) => a.channel === ch),
  ).map(String);
  const effectiveChannel = availableChannels.includes(newAdcChannel)
    ? newAdcChannel
    : (availableChannels[0] ?? '');
  const effectiveAdcNet = nets.some((n) => n.id === newAdcNet) ? newAdcNet : (nets[0]?.id ?? '');

  const onAdd = () => {
    const vh = parseOptional('Vhigh (V)', vHigh);
    const ro = parseOptional('Rout (Ω)', rOut);
    const rs = parseOptional('rise (s)', rise);
    for (const v of [vh, ro, rs]) {
      if (typeof v === 'string') {
        setFormError(v);
        return;
      }
    }
    const next: PinBinding = {
      pin: effectivePin,
      netId: effectiveNet,
      ...(typeof vh === 'number' ? { voltsHigh: vh } : {}),
      ...(typeof ro === 'number' ? { routOhms: ro } : {}),
      ...(typeof rs === 'number' ? { riseS: rs } : {}),
    };
    const out = addBinding(bindings, next);
    if (!out.ok) {
      setFormError(out.error);
      return;
    }
    setFormError(null);
    setBindings(out.bindings);
    setNewPin('');
  };

  const onAddInput = () => {
    const out = addInputBinding(inputs, { pin: effectiveInputPin, netId: effectiveInputNet });
    if (!out.ok) {
      setFormError(out.error);
      return;
    }
    setFormError(null);
    setInputs(out.inputs);
    setNewInputPin('');
  };

  const onAddAdc = () => {
    const out = addAdcBinding(adc, { channel: Number(effectiveChannel), netId: effectiveAdcNet });
    if (!out.ok) {
      setFormError(out.error);
      return;
    }
    setFormError(null);
    setAdc(out.adc);
    setNewAdcChannel('');
  };

  const onRun = async () => {
    const windowV = parseRequired('window (µs)', windowUs);
    const stepV = parseRequired('step (µs)', stepUs);
    if (typeof windowV === 'string') {
      setFormError(windowV);
      return;
    }
    if (typeof stepV === 'string') {
      setFormError(stepV);
      return;
    }
    const base: CosimWindowSpec = {
      windowS: windowV * 1e-6,
      stepS: stepV * 1e-6,
      bindings,
    };

    if (mode === 'closed-loop') {
      const quantumV = parseRequired('quantum (µs)', quantumUs);
      if (typeof quantumV === 'string') {
        setFormError(quantumV);
        return;
      }
      const spec: ClosedLoopSpec = {
        ...base,
        quantumS: quantumV * 1e-6,
        inputs,
        adc,
      };
      const invalid = validateClosedLoopSpec(spec);
      if (invalid !== null) {
        setFormError(invalid);
        return;
      }
      setFormError(null);
      setBusy(true);
      const outcome = await runCosimClosed(getGraph(useSession.getState()), partDb, spec);
      setRun({ outcome, spec, clockHz: session.clockHz ?? 0 });
      setVisible(null);
      setBusy(false);
      return;
    }

    const invalid = validateSpec(base);
    if (invalid !== null) {
      setFormError(invalid);
      return;
    }
    setFormError(null);
    setBusy(true);
    const outcome = await runCosim(getGraph(useSession.getState()), partDb, base);
    setRun({ outcome, spec: base, clockHz: session.clockHz ?? 0 });
    setVisible(null);
    setBusy(false);
  };

  const advSummary = (b: PinBinding): string => {
    const parts: string[] = [];
    if (b.voltsHigh !== undefined) parts.push(`Vh ${engNotation(b.voltsHigh)}V`);
    if (b.voltsLow !== undefined) parts.push(`Vl ${engNotation(b.voltsLow)}V`);
    if (b.routOhms !== undefined) parts.push(`Rout ${engNotation(b.routOhms)}Ω`);
    if (b.riseS !== undefined) parts.push(`rise ${engNotation(b.riseS)}s`);
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  // ── Result digestion (pure assembly lives in src/cosim/traces.ts). ──
  const errorText = run !== null && !run.outcome.ok ? run.outcome.error : null;
  let results: {
    virtualTimeS: number;
    mcuCycles: number;
    wallMs: number;
    factor: number | null;
    fidelity: string;
    manifest: FidelityEntry[];
    pwlNets: string[];
    boundPins: string[];
    analogNames: string[];
    effectiveVisible: ReadonlySet<string>;
    plotTraces: PlotTrace[];
    /** Closed-loop honesty numbers; null for an open-loop run. */
    closed: { quanta: number; rerunSolves: number; adcReads: number; inputEdges: number } | null;
  } | null = null;

  if (run?.outcome.ok) {
    const { result, fidelity, wallMs } = run.outcome;
    const sweep = sweepVectorName(result.sim) ?? 'time';
    const timeVec = result.sim.vectors.find((v) => v.name === sweep);
    const analogVectors = result.sim.vectors.filter((v) => v.name !== sweep);
    const analogNames = analogVectors.map((v) => v.name);
    const effectiveVisible: ReadonlySet<string> =
      visible ?? new Set(analogNames.slice(0, AUTO_VISIBLE_VECTORS));
    const boundPins = run.spec.bindings.map((b) => b.pin);
    const clockHz =
      run.clockHz > 0
        ? run.clockHz
        : result.virtualTimeS > 0
          ? result.mcuCycles / result.virtualTimeS
          : 1;

    const traces = assembleCosimTraces({
      pinEvents: result.pinEvents,
      pins: boundPins,
      clockHz,
      windowS: run.spec.windowS,
      analog: analogVectors
        .filter((v) => effectiveVisible.has(v.name))
        .map((v) => ({ name: v.name, xs: timeVec?.values ?? [], ys: v.values })),
    });
    // Stable colors: digital by binding order, analog continuing the cycle.
    const plotTraces: PlotTrace[] = traces.map((t) => ({
      name: t.name,
      xs: t.xs,
      ys: t.ys,
      color:
        t.kind === 'digital'
          ? traceColor(boundPins.indexOf(t.name))
          : traceColor(boundPins.length + analogNames.indexOf(t.name)),
    }));

    results = {
      virtualTimeS: result.virtualTimeS,
      mcuCycles: result.mcuCycles,
      wallMs,
      factor: slowdownFactor(wallMs, result.virtualTimeS),
      fidelity,
      manifest: result.sim.manifest,
      pwlNets: Object.keys(result.pwlSources),
      boundPins,
      analogNames,
      effectiveVisible,
      plotTraces,
      closed:
        'rerunSolves' in result
          ? {
              quanta: result.quanta,
              rerunSolves: result.rerunSolves,
              adcReads: result.adcReads.length,
              inputEdges: result.inputEdges.length,
            }
          : null,
    };
  }

  const toggleVector = (name: string, effective: ReadonlySet<string>) => {
    const next = new Set(effective);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setVisible(next);
  };

  return (
    <div className="panel-body cosim-panel">
      <h3 className="panel-subtitle">Mode</h3>
      <SelectField
        label="loop"
        value={mode}
        options={['open-loop', 'closed-loop']}
        emptyHint=""
        onChange={(v) => {
          setMode(v === 'closed-loop' ? 'closed-loop' : 'open-loop');
        }}
      />
      <p className="muted">
        {mode === 'open-loop'
          ? 'Open loop: firmware edges drive the analog solver; nothing flows back.'
          : 'Closed loop: solved voltages feed back into the MCU each quantum — digital pins through a comparator, ADC channels through the sampler. Each quantum re-solves the transient from zero.'}
      </p>

      <h3 className="panel-subtitle">Pin → net bindings (outputs)</h3>
      {bindings.length === 0 ? (
        <p className="muted">No bindings yet — pick which MCU pins drive which nets.</p>
      ) : (
        <ul className="trace-list">
          {bindings.map((b, i) => (
            <li key={b.pin} className="trace-row">
              <span className="trace-toggle binding-row">
                <span className="trace-swatch" style={{ background: traceColor(i) }} />
                <span className="trace-name">
                  {b.pin} → {netName(b.netId)}
                  {advSummary(b)}
                </span>
                <button
                  type="button"
                  className="binding-remove"
                  title="remove binding"
                  onClick={() => {
                    setBindings(removeBinding(bindings, b.pin));
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <SelectField
        label="pin"
        value={effectivePin}
        options={availablePins}
        emptyHint="(every pin is bound)"
        onChange={setNewPin}
      />
      <label className="sim-field">
        <span className="sim-field-label">net</span>
        <select
          value={effectiveNet}
          onChange={(e) => {
            setNewNet(e.target.value);
          }}
        >
          {nets.length === 0 && <option value="">(no nets in design)</option>}
          {nets.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <details className="cosim-advanced">
        <summary>advanced — drive strength &amp; edge</summary>
        <Field label="Vhigh (V)" value={vHigh} onChange={setVHigh} />
        <Field label="Rout (Ω)" value={rOut} onChange={setROut} />
        <Field label="rise (s)" value={rise} onChange={setRise} />
      </details>
      <button type="button" disabled={effectivePin === '' || effectiveNet === ''} onClick={onAdd}>
        Add binding
      </button>

      {mode === 'closed-loop' && (
        <>
          <h3 className="panel-subtitle">Net → pin inputs (comparator)</h3>
          {inputs.length === 0 ? (
            <p className="muted">
              No inputs yet — pick which net voltages drive which digital input pins.
            </p>
          ) : (
            <ul className="trace-list">
              {inputs.map((i) => (
                <li key={i.pin} className="trace-row">
                  <span className="trace-toggle binding-row">
                    <span className="trace-name">
                      {netName(i.netId)} → {i.pin}
                    </span>
                    <button
                      type="button"
                      className="binding-remove"
                      title="remove input"
                      onClick={() => {
                        setInputs(removeInputBinding(inputs, i.pin));
                      }}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SelectField
            label="pin"
            value={effectiveInputPin}
            options={availableInputPins}
            emptyHint="(every pin is taken)"
            onChange={setNewInputPin}
          />
          <label className="sim-field">
            <span className="sim-field-label">net</span>
            <select
              value={effectiveInputNet}
              onChange={(e) => {
                setNewInputNet(e.target.value);
              }}
            >
              {nets.length === 0 && <option value="">(no nets in design)</option>}
              {nets.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={effectiveInputPin === '' || effectiveInputNet === ''}
            onClick={onAddInput}
          >
            Add input
          </button>

          <h3 className="panel-subtitle">Net → ADC channels (sampler)</h3>
          {adc.length === 0 ? (
            <p className="muted">No ADC channels yet — pick which nets the firmware converts.</p>
          ) : (
            <ul className="trace-list">
              {adc.map((a) => (
                <li key={a.channel} className="trace-row">
                  <span className="trace-toggle binding-row">
                    <span className="trace-name">
                      {netName(a.netId)} → ADC{a.channel}
                    </span>
                    <button
                      type="button"
                      className="binding-remove"
                      title="remove ADC channel"
                      onClick={() => {
                        setAdc(removeAdcBinding(adc, a.channel));
                      }}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SelectField
            label="channel"
            value={effectiveChannel}
            options={availableChannels}
            emptyHint="(every channel is bound)"
            onChange={setNewAdcChannel}
          />
          <label className="sim-field">
            <span className="sim-field-label">net</span>
            <select
              value={effectiveAdcNet}
              onChange={(e) => {
                setNewAdcNet(e.target.value);
              }}
            >
              {nets.length === 0 && <option value="">(no nets in design)</option>}
              {nets.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={effectiveChannel === '' || effectiveAdcNet === ''}
            onClick={onAddAdc}
          >
            Add ADC channel
          </button>
        </>
      )}

      <h3 className="panel-subtitle">Window</h3>
      <Field label="window (µs)" value={windowUs} onChange={setWindowUs} />
      <Field label="step (µs)" value={stepUs} onChange={setStepUs} />
      {mode === 'closed-loop' && (
        <Field label="quantum (µs)" value={quantumUs} onChange={setQuantumUs} />
      )}

      <button
        type="button"
        className="primary-button sim-run"
        disabled={busy || bindings.length === 0}
        onClick={() => {
          void onRun();
        }}
      >
        {busy ? 'stepping MCU + solving analog…' : 'Run co-sim'}
      </button>
      <p className="muted">
        Each run pauses the Firmware tab and restarts its core from power-on, so the window
        is reproducible.
      </p>
      {formError !== null && <p className="sim-error">{formError}</p>}
      {errorText !== null && <p className="sim-error">{errorText}</p>}

      {results !== null && (
        <>
          <p className="firmware-readout">
            <span title="virtual time the window covered">
              t = {engNotation(results.virtualTimeS, 4)}s virtual
            </span>
            <span title="MCU cycles stepped inside the window">
              {results.mcuCycles.toLocaleString()} cycles
            </span>
            <span title="wall clock / virtual time — co-sim is never real-time">
              {results.factor !== null
                ? `slowdown ×${engNotation(results.factor, 3)}`
                : 'slowdown — (no virtual time elapsed)'}{' '}
              ({results.wallMs.toFixed(1)} ms wall / {engNotation(results.virtualTimeS * 1e6, 4)}{' '}
              µs virtual)
            </span>
            {results.closed !== null && (
              <span title="the batch SPICE engine cannot pause/resume, so every quantum re-runs the transient FROM ZERO — solver work grows quadratically with quanta">
                {results.closed.quanta} quanta, {results.closed.rerunSolves} full re-solves
                (from t=0 each — no solver state continuity)
              </span>
            )}
            {results.closed !== null && (
              <span title="firmware ADC conversions answered from the previous quantum's solve (one quantum stale), and comparator edges driven onto digital input pins">
                {results.closed.adcReads} ADC reads, {results.closed.inputEdges} input edges fed
                back
              </span>
            )}
          </p>
          <FidelityBar fidelity={results.fidelity} manifest={results.manifest} />
          {results.pwlNets.length > 0 && (
            <p className="muted">PWL sources injected: {results.pwlNets.join(', ')}</p>
          )}

          <h3 className="panel-subtitle">Traces</h3>
          <ul className="trace-list">
            {results.boundPins.map((pin, i) => (
              <li key={pin} className="trace-row">
                <span className="trace-toggle">
                  <span className="trace-swatch" style={{ background: traceColor(i) }} />
                  <span className="trace-name">{pin} (pin, stacked above)</span>
                </span>
              </li>
            ))}
            {results.analogNames.map((name, i) => (
              <li key={name} className="trace-row">
                <label className="trace-toggle">
                  <input
                    type="checkbox"
                    checked={results.effectiveVisible.has(name)}
                    onChange={() => {
                      toggleVector(name, results.effectiveVisible);
                    }}
                  />
                  <span
                    className="trace-swatch"
                    style={{ background: traceColor(results.boundPins.length + i) }}
                  />
                  <span className="trace-name">{name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="plot-wrap">
            <Plot traces={results.plotTraces} xLabel="t (s)" yLabel="V — pins stacked above" />
          </div>
        </>
      )}
    </div>
  );
}
