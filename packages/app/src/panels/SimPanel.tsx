import { useState } from 'react';

import { fftSpectrum } from '../sim/fft.js';
import { computeGhost, ghostLegendGradient } from '../sim/ghost.js';
import { evaluate } from '../sim/math-channels.js';
import { flattenMcTrials, flattenStepRuns, traceKeys } from '../sim/multi.js';
import { combineRuns } from '../sim/overlay.js';
import { Plot, traceColor } from '../sim/Plot.js';
import { runMonteCarlo, runSimulation, runStep } from '../sim/runner.js';
import { engNotation, vectorDb } from '../sim/scales.js';
import { sweepVectorName } from '../sim/types.js';
import { getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import type { PlotTrace } from '../sim/Plot.js';
import type { McOutcome, SimOutcome, StepOutcome } from '../sim/runner.js';
import type {
  Analysis,
  FidelityEntry,
  MonteCarloSpec,
  SimResult,
  SimResultWithManifest,
  StepSpec,
} from '../sim/types.js';

/**
 * The Lab panel — honest v0.2 cut: pick an analysis, Run (to completion,
 * no streaming), read the FIDELITY BAR before believing anything, then
 * plot the vectors you care about. Simulations never lie about what they
 * are: stub-tier models are highlighted with their notes.
 *
 * v0.2 extensions: noise analysis, Monte Carlo + parameter stepping
 * (wrapping a base analysis), math channels over result vectors, and the
 * Vol I branch overlay — the same node on two design branches, dashed.
 */

type BaseKind = Analysis['kind'];
type PickerKind = BaseKind | 'mc' | 'step';

const BASE_KINDS: { id: BaseKind; label: string }[] = [
  { id: 'op', label: 'Operating point' },
  { id: 'tran', label: 'Transient' },
  { id: 'dc', label: 'DC sweep' },
  { id: 'ac', label: 'AC sweep' },
  { id: 'noise', label: 'Noise' },
];

const KINDS: { id: PickerKind; label: string }[] = [
  ...BASE_KINDS,
  { id: 'mc', label: 'Monte Carlo' },
  { id: 'step', label: 'Step' },
];

const MC_MAX_RUNS = 200;

/** One labelled text field, house style (shared with the Co-sim panel). */
export function Field({
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

/** One labelled select, house style (shared with the Co-sim panel). */
export function SelectField({
  label,
  value,
  options,
  emptyHint,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  emptyHint: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="sim-field">
      <span className="sim-field-label">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {options.length === 0 && <option value="">{emptyHint}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function num(label: string, raw: string): number | string {
  const v = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(v)) return `${label} must be a number (got "${raw}")`;
  return v;
}

/** The read-this-before-believing-anything bar (shared with Co-sim). */
export function FidelityBar({ fidelity, manifest }: { fidelity: string; manifest: FidelityEntry[] }) {
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

type RunData =
  | { mode: 'single'; outcome: SimOutcome; overlay: { branch: string; outcome: SimOutcome } | null }
  | { mode: 'mc'; outcome: McOutcome }
  | { mode: 'step'; outcome: StepOutcome };

export function SimPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  const simGhost = useUi((s) => s.simGhost);

  const [kind, setKind] = useState<PickerKind>('tran');
  /** Base analysis when kind is mc/step (they WRAP a base analysis). */
  const [baseKind, setBaseKind] = useState<BaseKind>('tran');
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
  const [noiseOutput, setNoiseOutput] = useState('');
  const [noiseSource, setNoiseSource] = useState('');
  // Monte Carlo: 50 runs default, hard max 200; tolerances in percent.
  const [mcRuns, setMcRuns] = useState('50');
  const [mcSeed, setMcSeed] = useState('');
  const [mcTolR, setMcTolR] = useState('5');
  const [mcTolC, setMcTolC] = useState('10');
  const [stepRef, setStepRef] = useState('');
  const [stepValues, setStepValues] = useState('');
  const [compareBranch, setCompareBranch] = useState('');

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [data, setData] = useState<RunData | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<string>>(new Set());
  /** Trace keys whose FFT renders in the second (spectrum) plot. */
  const [fftKeys, setFftKeys] = useState<ReadonlySet<string>>(new Set());
  const [mathInput, setMathInput] = useState('');
  const [mathExprs, setMathExprs] = useState<string[]>([]);

  // Sweepable sources: battery / power-rail components in the design.
  const graph = getGraph(useSession.getState());
  const sources = [...graph.components.values()]
    .filter((c) => {
      const cls = partDb.get(c.partId, c.partRev)?.class;
      return cls === 'battery' || cls === 'power';
    })
    .map((c) => c.ref)
    .sort();
  const netNames = [...graph.nets.values()].map((n) => n.name).sort();
  const componentRefs = [...graph.components.values()].map((c) => c.ref).sort();
  const otherBranches = useSession
    .getState()
    .core.log.names()
    .filter((n) => n !== branch)
    .sort();

  const effectiveDcSource = dcSource !== '' ? dcSource : (sources[0] ?? '');
  const effectiveNoiseOutput = noiseOutput !== '' ? noiseOutput : (netNames[0] ?? '');
  const effectiveNoiseSource = noiseSource !== '' ? noiseSource : (sources[0] ?? '');
  const effectiveStepRef = stepRef !== '' ? stepRef : (componentRefs[0] ?? '');
  const effectiveCompare = otherBranches.includes(compareBranch) ? compareBranch : '';
  const wrapped = kind === 'mc' || kind === 'step';
  const effectiveBase: BaseKind = wrapped ? baseKind : kind;

  const buildBaseAnalysis = (): Analysis | string => {
    switch (effectiveBase) {
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
      case 'ac':
      case 'noise': {
        const points = num('points', acPoints);
        const fStart = num('f start (Hz)', acFStart);
        const fStop = num('f stop (Hz)', acFStop);
        if (typeof points === 'string') return points;
        if (typeof fStart === 'string') return fStart;
        if (typeof fStop === 'string') return fStop;
        if (fStart <= 0 || fStop <= 0) return 'frequencies must be > 0';
        if (effectiveBase === 'ac') {
          return { kind: 'ac', variation: acVariation, points, fStart, fStop };
        }
        if (effectiveNoiseOutput === '') return 'no nets in the design to measure noise at';
        if (effectiveNoiseSource === '') return 'no battery/power source for the noise reference';
        return {
          kind: 'noise',
          output: effectiveNoiseOutput,
          source: effectiveNoiseSource,
          variation: acVariation,
          points,
          fStart,
          fStop,
        };
      }
    }
  };

  const buildMcSpec = (base: Analysis): MonteCarloSpec | string => {
    const runs = num('runs', mcRuns);
    if (typeof runs === 'string') return runs;
    if (!Number.isInteger(runs) || runs < 1 || runs > MC_MAX_RUNS) {
      return `runs must be an integer between 1 and ${String(MC_MAX_RUNS)}`;
    }
    const spec: MonteCarloSpec = { base, runs };
    if (mcSeed.trim() !== '') {
      const seed = num('seed', mcSeed);
      if (typeof seed === 'string') return seed;
      spec.seed = seed;
    }
    const tolerances: NonNullable<MonteCarloSpec['tolerances']> = {};
    if (mcTolR.trim() !== '') {
      const tol = num('R tolerance (%)', mcTolR);
      if (typeof tol === 'string') return tol;
      if (tol < 0) return 'R tolerance must be ≥ 0';
      tolerances.resistor = tol / 100;
    }
    if (mcTolC.trim() !== '') {
      const tol = num('C tolerance (%)', mcTolC);
      if (typeof tol === 'string') return tol;
      if (tol < 0) return 'C tolerance must be ≥ 0';
      tolerances.capacitor = tol / 100;
    }
    if (Object.keys(tolerances).length > 0) spec.tolerances = tolerances;
    return spec;
  };

  const buildStepSpec = (base: Analysis): StepSpec | string => {
    if (effectiveStepRef === '') return 'no components in the design to step';
    const values = stepValues
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '');
    if (values.length === 0) return 'step values must be a comma-separated list (e.g. "220, 330, 1k")';
    return { base, componentRef: effectiveStepRef, values };
  };

  const onRun = async () => {
    const base = buildBaseAnalysis();
    if (typeof base === 'string') {
      setFormError(base);
      return;
    }
    setFormError(null);
    setBusy(true);
    const s = useSession.getState();
    const g = getGraph(s);
    const key = { branch: s.branch, opsVersion: s.opsVersion };

    let next: RunData;
    let keys: string[] = [];
    if (kind === 'mc') {
      const spec = buildMcSpec(base);
      if (typeof spec === 'string') {
        setFormError(spec);
        setBusy(false);
        return;
      }
      const outcome = await runMonteCarlo(g, partDb, spec, key);
      next = { mode: 'mc', outcome };
      if (outcome.ok) keys = traceKeys(outcome.result.trials);
    } else if (kind === 'step') {
      const spec = buildStepSpec(base);
      if (typeof spec === 'string') {
        setFormError(spec);
        setBusy(false);
        return;
      }
      const outcome = await runStep(g, partDb, spec, key);
      next = { mode: 'step', outcome };
      if (outcome.ok) keys = traceKeys(outcome.result.runs);
    } else {
      const outcome = await runSimulation(g, partDb, base, key);
      let overlay: { branch: string; outcome: SimOutcome } | null = null;
      if (effectiveCompare !== '' && s.core.log.has(effectiveCompare)) {
        // Same analysis against the other branch's materialized head; the
        // runner caches per (branch, opsVersion, analysis) so flipping back
        // and forth between branches stays cheap.
        const otherGraph = s.core.graphFor(effectiveCompare);
        const otherOutcome = await runSimulation(otherGraph, partDb, base, {
          branch: effectiveCompare,
          opsVersion: s.opsVersion,
        });
        overlay = { branch: effectiveCompare, outcome: otherOutcome };
      }
      next = { mode: 'single', outcome, overlay };
      if (outcome.ok) {
        keys = combineRuns(
          outcome.result,
          overlay?.outcome.ok ? overlay.outcome.result : null,
          overlay?.branch ?? '',
        )
          .map((t) => t.key)
          .filter((k, i, arr) => arr.indexOf(k) === i);
        // Ghost overlay: paint the solved net voltages on the canvas.
        useUi
          .getState()
          .setSimGhost(
            await computeGhost(g, partDb, outcome.result.analysis.kind, outcome.result.vectors, key),
          );
      }
    }
    setData(next);
    if (keys.length > 0) setVisible(new Set(keys.slice(0, 2)));
    setFftKeys(new Set());
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

  const toggleFft = (name: string) => {
    const next = new Set(fftKeys);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setFftKeys(next);
  };

  const addMathExpr = () => {
    const expr = mathInput.trim();
    if (expr === '' || mathExprs.includes(expr)) return;
    setMathExprs([...mathExprs, expr]);
    setMathInput('');
  };

  // ── Result digestion ──
  const outcome = data?.outcome ?? null;
  const errorText = outcome && !outcome.ok ? outcome.error : null;
  const fidelityBars: { label: string | null; fidelity: string; manifest: FidelityEntry[] }[] = [];
  let pointsLine: string | null = null;
  let opResult: SimResultWithManifest | null = null;
  /** The result math channels evaluate against (nominal / first run). */
  let referenceResult: SimResult | null = null;
  let baseTraces: {
    name: string;
    key: string;
    xs: number[];
    ys: number[];
    imag?: number[];
    dash?: number[];
    alpha?: number;
    colorIndex: number;
    legend?: boolean;
  }[] = [];
  let traceNames: string[] = [];

  if (data?.mode === 'single' && data.outcome.ok) {
    const result = data.outcome.result;
    fidelityBars.push({ label: null, fidelity: data.outcome.fidelity, manifest: result.manifest });
    if (data.overlay) {
      if (data.overlay.outcome.ok) {
        fidelityBars.push({
          label: `@${data.overlay.branch}`,
          fidelity: data.overlay.outcome.fidelity,
          manifest: data.overlay.outcome.result.manifest,
        });
      }
    }
    pointsLine = `${String(result.points)} point(s) on branch ${branch}${
      data.overlay ? ` vs ${data.overlay.branch}` : ''
    }.`;
    if (result.analysis.kind === 'op' && !data.overlay) {
      opResult = result;
    } else {
      referenceResult = result;
      baseTraces = combineRuns(
        result,
        data.overlay?.outcome.ok ? data.overlay.outcome.result : null,
        data.overlay?.branch ?? '',
      );
    }
  } else if (data?.mode === 'mc' && data.outcome.ok) {
    const { trials, manifest, seed } = data.outcome.result;
    fidelityBars.push({ label: null, fidelity: data.outcome.fidelity, manifest });
    pointsLine = `${String(trials.length)} trial(s), seed ${String(seed)}, on branch ${branch}.`;
    referenceResult = trials[0] ?? null;
    baseTraces = flattenMcTrials(trials);
  } else if (data?.mode === 'step' && data.outcome.ok) {
    const { runs, manifest } = data.outcome.result;
    fidelityBars.push({ label: null, fidelity: data.outcome.fidelity, manifest });
    pointsLine = `${String(runs.length)} run(s) on branch ${branch}.`;
    referenceResult = runs[0] ?? null;
    baseTraces = flattenStepRuns(runs);
  }

  // ── Plot data derivation ──
  let plot: { traces: PlotTrace[]; logX: boolean; xLabel: string; yLabel: string } | null = null;
  const mathErrors: { expr: string; error: string }[] = [];
  if (referenceResult) {
    const ref = referenceResult;
    const refKind = ref.analysis.kind;
    const isAc = refKind === 'ac';
    const isFreq = isAc || refKind === 'noise';
    const sweep = sweepVectorName(ref);
    traceNames = baseTraces.map((t) => t.key).filter((k, i, arr) => arr.indexOf(k) === i);

    const traces: PlotTrace[] = baseTraces
      .filter((t) => visible.has(t.key))
      .map((t) => ({
        name: t.name,
        xs: t.xs,
        ys: isAc ? vectorDb(t.ys, t.imag) : t.ys,
        color: traceColor(t.colorIndex),
        ...(t.dash !== undefined ? { dash: t.dash } : {}),
        ...(t.alpha !== undefined ? { alpha: t.alpha } : {}),
        ...(t.legend !== undefined ? { legend: t.legend } : {}),
      }));

    // Math channels evaluate over the reference result's raw vectors and
    // render as ordinary traces named by their expression.
    const sweepVec = sweep !== null ? ref.vectors.find((v) => v.name === sweep) : undefined;
    const colorBase = traceNames.length;
    mathExprs.forEach((expr, i) => {
      const out = evaluate(expr, ref.vectors);
      if (out.error !== undefined) {
        mathErrors.push({ expr, error: out.error });
        return;
      }
      const ys = out.values;
      const xs = sweepVec ? sweepVec.values.slice(0, ys.length) : ys.map((_, j) => j);
      traces.push({ name: expr, xs, ys, color: traceColor(colorBase + i) });
    });

    plot = {
      traces,
      logX: isFreq,
      xLabel: sweep ?? 'sample',
      yLabel: isAc ? 'magnitude (dB)' : refKind === 'noise' ? 'noise' : 'value',
    };
  }

  // ── FFT (transient only): per-trace toggled spectra, log-x dB ──
  const canFft = data?.mode === 'single' && referenceResult?.analysis.kind === 'tran';
  let fftTraces: PlotTrace[] | null = null;
  if (canFft && fftKeys.size > 0) {
    const traces: PlotTrace[] = [];
    for (const t of baseTraces) {
      if (!fftKeys.has(t.key)) continue;
      const spectrum = fftSpectrum(t.xs, t.ys);
      if (!spectrum) continue;
      traces.push({
        name: `fft ${t.name}`,
        xs: spectrum.freqs,
        ys: spectrum.db,
        color: traceColor(t.colorIndex),
        ...(t.dash !== undefined ? { dash: t.dash } : {}),
      });
    }
    if (traces.length > 0) fftTraces = traces;
  }

  return (
    <div className="panel-body sim-panel">
      <h3 className="panel-subtitle">Analysis</h3>
      <label className="sim-field">
        <span className="sim-field-label">kind</span>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as PickerKind);
          }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {wrapped && (
        <label className="sim-field">
          <span className="sim-field-label">base analysis</span>
          <select
            value={baseKind}
            onChange={(e) => {
              setBaseKind(e.target.value as BaseKind);
            }}
          >
            {BASE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {effectiveBase === 'tran' && (
        <>
          <Field label="step (s)" value={tranStep} onChange={setTranStep} />
          <Field label="stop (s)" value={tranStop} onChange={setTranStop} />
        </>
      )}
      {effectiveBase === 'dc' && (
        <>
          <SelectField
            label="source"
            value={effectiveDcSource}
            options={sources}
            emptyHint="(no battery/rail in design)"
            onChange={setDcSource}
          />
          <Field label="start (V)" value={dcStart} onChange={setDcStart} />
          <Field label="stop (V)" value={dcStop} onChange={setDcStop} />
          <Field label="step (V)" value={dcStep} onChange={setDcStep} />
        </>
      )}
      {(effectiveBase === 'ac' || effectiveBase === 'noise') && (
        <>
          {effectiveBase === 'noise' && (
            <>
              <SelectField
                label="output net"
                value={effectiveNoiseOutput}
                options={netNames}
                emptyHint="(no nets in design)"
                onChange={setNoiseOutput}
              />
              <SelectField
                label="source"
                value={effectiveNoiseSource}
                options={sources}
                emptyHint="(no battery/rail in design)"
                onChange={setNoiseSource}
              />
            </>
          )}
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

      {kind === 'mc' && (
        <>
          <Field label={`runs (max ${String(MC_MAX_RUNS)})`} value={mcRuns} onChange={setMcRuns} />
          <Field label="seed" value={mcSeed} onChange={setMcSeed} />
          <Field label="R tol (%)" value={mcTolR} onChange={setMcTolR} />
          <Field label="C tol (%)" value={mcTolC} onChange={setMcTolC} />
        </>
      )}
      {kind === 'step' && (
        <>
          <SelectField
            label="component"
            value={effectiveStepRef}
            options={componentRefs}
            emptyHint="(no components in design)"
            onChange={setStepRef}
          />
          <Field label="values" value={stepValues} onChange={setStepValues} />
          <p className="muted">Comma-separated component values, e.g. “220, 330, 1k”.</p>
        </>
      )}

      {!wrapped && (
        <label className="sim-field">
          <span className="sim-field-label">compare with</span>
          <select
            value={effectiveCompare}
            onChange={(e) => {
              setCompareBranch(e.target.value);
            }}
          >
            <option value="">none</option>
            {otherBranches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
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

      {errorText !== null && <p className="sim-error">{errorText}</p>}
      {data?.mode === 'single' && data.overlay && !data.overlay.outcome.ok && (
        <p className="sim-error">
          @{data.overlay.branch}: {data.overlay.outcome.error}
        </p>
      )}

      {outcome?.ok && (
        <>
          {fidelityBars.map((bar) => (
            <div key={bar.label ?? 'primary'}>
              {bar.label !== null && <p className="muted overlay-fidelity-label">{bar.label}</p>}
              <FidelityBar fidelity={bar.fidelity} manifest={bar.manifest} />
            </div>
          ))}
          {simGhost !== null &&
            simGhost.branch === branch &&
            simGhost.opsVersion === opsVersion && (
              <div className="ghost-legend" title="net voltages painted on the schematic wires">
                <span className="ghost-legend-label">canvas ghost · {simGhost.label}</span>
                <span className="ghost-legend-min">{engNotation(simGhost.min)}V</span>
                <span className="ghost-legend-bar" style={{ background: ghostLegendGradient() }} />
                <span className="ghost-legend-max">{engNotation(simGhost.max)}V</span>
                <button
                  type="button"
                  onClick={() => {
                    useUi.getState().setSimGhost(null);
                  }}
                >
                  hide
                </button>
              </div>
            )}
          {pointsLine !== null && <p className="muted">{pointsLine}</p>}
          {opResult ? (
            <OpTable result={opResult} />
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
                    {canFft && (
                      <button
                        type="button"
                        className={`fft-toggle${fftKeys.has(name) ? ' fft-toggle-on' : ''}`}
                        aria-pressed={fftKeys.has(name)}
                        title="toggle the FFT of this trace in the spectrum plot"
                        onClick={() => {
                          toggleFft(name);
                        }}
                      >
                        FFT
                      </button>
                    )}
                  </li>
                ))}
                {mathExprs.map((expr, i) => (
                  <li key={expr} className="trace-row">
                    <span className="trace-toggle math-channel-row">
                      <span
                        className="trace-swatch"
                        style={{ background: traceColor(traceNames.length + i) }}
                      />
                      <span className="trace-name">{expr}</span>
                      <button
                        type="button"
                        className="math-channel-remove"
                        title="remove math channel"
                        onClick={() => {
                          setMathExprs(mathExprs.filter((e) => e !== expr));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="math-channel-add">
                <input
                  type="text"
                  placeholder="Add math channel — e.g. db(v(out)/v(in))"
                  value={mathInput}
                  onChange={(e) => {
                    setMathInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addMathExpr();
                    }
                  }}
                />
                <button type="button" onClick={addMathExpr}>
                  Add
                </button>
              </div>
              {mathErrors.map(({ expr, error }) => (
                <p key={expr} className="sim-error">
                  {expr}: {error}
                </p>
              ))}
              {plot && (
                <div className="plot-wrap">
                  <Plot
                    traces={plot.traces}
                    logX={plot.logX}
                    xLabel={plot.xLabel}
                    yLabel={plot.yLabel}
                  />
                  {fftTraces && (
                    <Plot
                      traces={fftTraces}
                      logX
                      xLabel="frequency"
                      yLabel="dB"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
