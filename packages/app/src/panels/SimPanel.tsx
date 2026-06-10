import { useState } from 'react';

import { Plot, traceColor } from '../sim/Plot.js';
import { runSimulation } from '../sim/runner.js';
import { engNotation, vectorDb } from '../sim/scales.js';
import { sweepVectorName } from '../sim/types.js';
import { getGraph, partDb, useSession } from '../state/session.js';

import type { PlotTrace } from '../sim/Plot.js';
import type { SimOutcome } from '../sim/runner.js';
import type { Analysis, FidelityEntry, SimResultWithManifest } from '../sim/types.js';

/**
 * The Lab panel — honest v0.2 cut: pick an analysis, Run (to completion,
 * no streaming), read the FIDELITY BAR before believing anything, then
 * plot the vectors you care about. Simulations never lie about what they
 * are: stub-tier models are highlighted with their notes.
 */

type AnalysisKind = Analysis['kind'];

const KINDS: { id: AnalysisKind; label: string }[] = [
  { id: 'op', label: 'Operating point' },
  { id: 'tran', label: 'Transient' },
  { id: 'dc', label: 'DC sweep' },
  { id: 'ac', label: 'AC sweep' },
];

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="sim-field">
      <span className="sim-field-label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </label>
  );
}

function num(label: string, raw: string): number | string {
  const v = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(v)) return `${label} must be a number (got "${raw}")`;
  return v;
}

function FidelityBar({ fidelity, manifest }: { fidelity: string; manifest: FidelityEntry[] }) {
  return (
    <div className="fidelity-bar">
      <p className="fidelity-summary">{fidelity}</p>
      <div className="fidelity-chips">
        {manifest.map((entry) => (
          <span
            key={entry.ref}
            className={`tier-chip tier-${entry.tier}`}
            title={`${entry.partId}${entry.note ? ` — ${entry.note}` : ''}`}
          >
            {entry.ref}: {entry.tier}
            {entry.tier === 'stub' && entry.note ? ` — ${entry.note}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function OpTable({ result }: { result: SimResultWithManifest }) {
  return (
    <ul className="op-values">
      {result.vectors.map((vec) => (
        <li key={vec.name} className="op-value-row">
          <span className="op-value-name">{vec.name}</span>
          <span className="op-value-num">{engNotation(vec.values[0] ?? NaN, 5)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SimPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;

  const [kind, setKind] = useState<AnalysisKind>('tran');
  // Sensible defaults: tran 1µs step / 1ms stop; ac dec 20pt 1Hz–1MHz.
  const [tranStep, setTranStep] = useState('1e-6');
  const [tranStop, setTranStop] = useState('1e-3');
  const [dcSource, setDcSource] = useState('');
  const [dcStart, setDcStart] = useState('0');
  const [dcStop, setDcStop] = useState('5');
  const [dcStep, setDcStep] = useState('0.1');
  const [acVariation, setAcVariation] = useState<'dec' | 'oct' | 'lin'>('dec');
  const [acPoints, setAcPoints] = useState('20');
  const [acFStart, setAcFStart] = useState('1');
  const [acFStop, setAcFStop] = useState('1e6');

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SimOutcome | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<string>>(new Set());

  // Sweepable sources: battery / power-rail components in the design.
  const graph = getGraph(useSession.getState());
  const sources = [...graph.components.values()]
    .filter((c) => {
      const cls = partDb.get(c.partId, c.partRev)?.class;
      return cls === 'battery' || cls === 'power';
    })
    .map((c) => c.ref)
    .sort();
  const effectiveDcSource = dcSource !== '' ? dcSource : (sources[0] ?? '');

  const buildAnalysis = (): Analysis | string => {
    switch (kind) {
      case 'op':
        return { kind: 'op' };
      case 'tran': {
        const stepS = num('step (s)', tranStep);
        const stopS = num('stop (s)', tranStop);
        if (typeof stepS === 'string') return stepS;
        if (typeof stopS === 'string') return stopS;
        if (stepS <= 0 || stopS <= 0) return 'tran step and stop must be > 0';
        return { kind: 'tran', stepS, stopS };
      }
      case 'dc': {
        if (effectiveDcSource === '') return 'no battery/power source in the design to sweep';
        const start = num('start (V)', dcStart);
        const stop = num('stop (V)', dcStop);
        const step = num('step (V)', dcStep);
        if (typeof start === 'string') return start;
        if (typeof stop === 'string') return stop;
        if (typeof step === 'string') return step;
        return { kind: 'dc', source: effectiveDcSource, start, stop, step };
      }
      case 'ac': {
        const points = num('points', acPoints);
        const fStart = num('f start (Hz)', acFStart);
        const fStop = num('f stop (Hz)', acFStop);
        if (typeof points === 'string') return points;
        if (typeof fStart === 'string') return fStart;
        if (typeof fStop === 'string') return fStop;
        if (fStart <= 0 || fStop <= 0) return 'ac frequencies must be > 0';
        return { kind: 'ac', variation: acVariation, points, fStart, fStop };
      }
    }
  };

  const onRun = async () => {
    const built = buildAnalysis();
    if (typeof built === 'string') {
      setFormError(built);
      return;
    }
    setFormError(null);
    setBusy(true);
    const s = useSession.getState();
    const out = await runSimulation(getGraph(s), partDb, built, {
      branch: s.branch,
      opsVersion: s.opsVersion,
    });
    setOutcome(out);
    if (out.ok) {
      const sweep = sweepVectorName(out.result);
      const names = out.result.vectors.filter((v) => v.name !== sweep).map((v) => v.name);
      setVisible(new Set(names.slice(0, 2)));
    }
    setBusy(false);
  };

  const toggleTrace = (name: string) => {
    const next = new Set(visible);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setVisible(next);
  };

  // ── Plot data derivation ──
  let plot: { traces: PlotTrace[]; logX: boolean; xLabel: string; yLabel: string } | null = null;
  let traceNames: string[] = [];
  if (outcome?.ok && outcome.result.analysis.kind !== 'op') {
    const result = outcome.result;
    const isAc = result.analysis.kind === 'ac';
    const sweep = sweepVectorName(result);
    const sweepVec = sweep ? result.vectors.find((v) => v.name === sweep) : undefined;
    const candidates = result.vectors.filter((v) => v.name !== sweep);
    traceNames = candidates.map((v) => v.name);
    const traces: PlotTrace[] = candidates
      .map((vec, i) => ({ vec, i }))
      .filter(({ vec }) => visible.has(vec.name))
      .map(({ vec, i }) => ({
        name: vec.name,
        xs: sweepVec ? sweepVec.values : vec.values.map((_, j) => j),
        ys: isAc ? vectorDb(vec.values, vec.imag) : vec.values,
        color: traceColor(i),
      }));
    plot = {
      traces,
      logX: isAc,
      xLabel: sweep ?? 'sample',
      yLabel: isAc ? 'magnitude (dB)' : 'value',
    };
  }

  return (
    <div className="panel-body sim-panel">
      <h3 className="panel-subtitle">Analysis</h3>
      <label className="sim-field">
        <span className="sim-field-label">kind</span>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as AnalysisKind);
          }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {kind === 'tran' && (
        <>
          <Field label="step (s)" value={tranStep} onChange={setTranStep} />
          <Field label="stop (s)" value={tranStop} onChange={setTranStop} />
        </>
      )}
      {kind === 'dc' && (
        <>
          <label className="sim-field">
            <span className="sim-field-label">source</span>
            <select
              value={effectiveDcSource}
              onChange={(e) => {
                setDcSource(e.target.value);
              }}
            >
              {sources.length === 0 && <option value="">(no battery/rail in design)</option>}
              {sources.map((ref) => (
                <option key={ref} value={ref}>
                  {ref}
                </option>
              ))}
            </select>
          </label>
          <Field label="start (V)" value={dcStart} onChange={setDcStart} />
          <Field label="stop (V)" value={dcStop} onChange={setDcStop} />
          <Field label="step (V)" value={dcStep} onChange={setDcStep} />
        </>
      )}
      {kind === 'ac' && (
        <>
          <label className="sim-field">
            <span className="sim-field-label">variation</span>
            <select
              value={acVariation}
              onChange={(e) => {
                setAcVariation(e.target.value as 'dec' | 'oct' | 'lin');
              }}
            >
              <option value="dec">dec</option>
              <option value="oct">oct</option>
              <option value="lin">lin</option>
            </select>
          </label>
          <Field label="points" value={acPoints} onChange={setAcPoints} />
          <Field label="f start (Hz)" value={acFStart} onChange={setAcFStart} />
          <Field label="f stop (Hz)" value={acFStop} onChange={setAcFStop} />
        </>
      )}

      <button
        type="button"
        className="primary-button sim-run"
        disabled={busy}
        onClick={() => {
          void onRun();
        }}
      >
        {busy ? 'Running…' : 'Run'}
      </button>
      {busy && <p className="muted">First run boots the simulation engine — a few seconds.</p>}
      {formError && <p className="sim-error">{formError}</p>}

      {outcome && !outcome.ok && <p className="sim-error">{outcome.error}</p>}

      {outcome?.ok && (
        <>
          <FidelityBar fidelity={outcome.fidelity} manifest={outcome.result.manifest} />
          <p className="muted">
            {outcome.result.points} point(s) on branch {branch}.
          </p>
          {outcome.result.analysis.kind === 'op' ? (
            <OpTable result={outcome.result} />
          ) : (
            <>
              <h3 className="panel-subtitle">Traces</h3>
              <ul className="trace-list">
                {traceNames.map((name, i) => (
                  <li key={name} className="trace-row">
                    <label className="trace-toggle">
                      <input
                        type="checkbox"
                        checked={visible.has(name)}
                        onChange={() => {
                          toggleTrace(name);
                        }}
                      />
                      <span className="trace-swatch" style={{ background: traceColor(i) }} />
                      <span className="trace-name">{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {plot && (
                <div className="plot-wrap">
                  <Plot
                    traces={plot.traces}
                    logX={plot.logX}
                    xLabel={plot.xLabel}
                    yLabel={plot.yLabel}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
