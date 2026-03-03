import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { parseValueWithUnit } from './SimulationPanel';
import {
  analyzeFrequencyResponse,
  formatFrequency,
  TOPOLOGY_METADATA,
} from '@/lib/simulation/frequency-analysis';
import type {
  FilterTopology,
  FilterComponents,
  FrequencyAnalysisResult,
  FrequencySweepConfig,
} from '@/lib/simulation/frequency-analysis';
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Activity,
  RotateCcw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Lazy-loaded BodePlot — only pulled in when results need rendering
// ---------------------------------------------------------------------------
const BodePlot = lazy(() => import('./BodePlot'));

// ---------------------------------------------------------------------------
// Topology list for the selector
// ---------------------------------------------------------------------------

const TOPOLOGIES: FilterTopology[] = [
  'rc-lowpass',
  'rc-highpass',
  'rlc-bandpass',
  'rlc-lowpass',
  'generic-2nd-order',
];

// ---------------------------------------------------------------------------
// Collapsible section (mirrors SimulationPanel's pattern)
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  testId,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50" data-testid={testId}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable form field (mirrors SimulationPanel's pattern)
// ---------------------------------------------------------------------------

function ParamField({
  label,
  value,
  onChange,
  placeholder,
  unit,
  testId,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  unit?: string;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'flex-1 h-8 px-2.5 text-xs bg-background border border-border text-foreground',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors',
            unit ? 'rounded-l' : '',
          )}
        />
        {unit && (
          <span className="h-8 px-2 flex items-center text-[10px] font-mono text-muted-foreground bg-muted/30 border border-l-0 border-border rounded-r select-none">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Summary display
// ---------------------------------------------------------------------------

function AnalysisSummary({ result }: { result: FrequencyAnalysisResult }) {
  const { summary } = result;

  const items: Array<{ label: string; value: string; testId: string }> = [];

  items.push({
    label: 'DC Gain',
    value: `${summary.dcGainDb.toFixed(2)} dB`,
    testId: 'summary-dc-gain',
  });

  if (summary.cutoffFrequencyHz !== null) {
    items.push({
      label: '-3 dB Frequency',
      value: formatFrequency(summary.cutoffFrequencyHz),
      testId: 'summary-cutoff-freq',
    });
  }

  if (summary.resonantFrequencyHz !== null) {
    items.push({
      label: 'Resonant Frequency',
      value: formatFrequency(summary.resonantFrequencyHz),
      testId: 'summary-resonant-freq',
    });
  }

  if (summary.phaseMarginDegrees !== null) {
    items.push({
      label: 'Phase Margin',
      value: `${summary.phaseMarginDegrees.toFixed(1)}\u00B0`,
      testId: 'summary-phase-margin',
    });
  }

  if (summary.gainMarginDb !== null) {
    items.push({
      label: 'Gain Margin',
      value: `${summary.gainMarginDb.toFixed(2)} dB`,
      testId: 'summary-gain-margin',
    });
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      data-testid="frequency-analysis-summary"
    >
      {items.map((item) => (
        <div
          key={item.testId}
          className="flex flex-col gap-0.5 p-2.5 bg-background border border-border"
          data-testid={item.testId}
        >
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {item.label}
          </span>
          <span className="text-sm font-mono text-primary font-medium">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FrequencyAnalysisPanel() {
  // Topology
  const [topology, setTopology] = useState<FilterTopology>('rc-lowpass');

  // Component values as strings (parsed on submit)
  const [resistance, setResistance] = useState('1k');
  const [capacitance, setCapacitance] = useState('100n');
  const [inductance, setInductance] = useState('1m');
  const [naturalFrequency, setNaturalFrequency] = useState('6283');
  const [dampingRatio, setDampingRatio] = useState('0.707');

  // Frequency range
  const [fMin, setFMin] = useState('1');
  const [fMax, setFMax] = useState('10M');

  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FrequencyAnalysisResult | null>(null);

  // Determine which fields to show based on topology
  const meta = TOPOLOGY_METADATA[topology];
  const showR = meta.requiredComponents.includes('resistance');
  const showC = meta.requiredComponents.includes('capacitance');
  const showL = meta.requiredComponents.includes('inductance');
  const showW0 = meta.requiredComponents.includes('naturalFrequency');
  const showZeta = meta.requiredComponents.includes('dampingRatio');

  // Parse and validate
  const validate = useCallback((): {
    components: FilterComponents;
    sweep: FrequencySweepConfig;
  } | string => {
    const components: FilterComponents = {};

    if (showR) {
      const r = parseValueWithUnit(resistance);
      if (Number.isNaN(r) || r <= 0) {
        return 'Resistance must be a positive value (e.g., 1k, 10k)';
      }
      components.resistance = r;
    }

    if (showC) {
      const c = parseValueWithUnit(capacitance);
      if (Number.isNaN(c) || c <= 0) {
        return 'Capacitance must be a positive value (e.g., 100n, 1u)';
      }
      components.capacitance = c;
    }

    if (showL) {
      const l = parseValueWithUnit(inductance);
      if (Number.isNaN(l) || l <= 0) {
        return 'Inductance must be a positive value (e.g., 1m, 10u)';
      }
      components.inductance = l;
    }

    if (showW0) {
      const w0 = parseValueWithUnit(naturalFrequency);
      if (Number.isNaN(w0) || w0 <= 0) {
        return 'Natural frequency must be a positive value (rad/s)';
      }
      components.naturalFrequency = w0;
    }

    if (showZeta) {
      const z = parseFloat(dampingRatio);
      if (Number.isNaN(z) || z <= 0) {
        return 'Damping ratio must be a positive number';
      }
      components.dampingRatio = z;
    }

    const fMinVal = parseValueWithUnit(fMin);
    const fMaxVal = parseValueWithUnit(fMax);

    if (Number.isNaN(fMinVal) || fMinVal <= 0) {
      return 'Minimum frequency must be a positive value';
    }
    if (Number.isNaN(fMaxVal) || fMaxVal <= 0) {
      return 'Maximum frequency must be a positive value';
    }
    if (fMinVal >= fMaxVal) {
      return 'Minimum frequency must be less than maximum frequency';
    }

    return {
      components,
      sweep: { fMin: fMinVal, fMax: fMaxVal, pointsPerDecade: 50 },
    };
  }, [topology, resistance, capacitance, inductance, naturalFrequency, dampingRatio, fMin, fMax, showR, showC, showL, showW0, showZeta]);

  // Run analysis
  const handleAnalyze = useCallback(() => {
    const validated = validate();
    if (typeof validated === 'string') {
      setError(validated);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    // Use requestAnimationFrame to allow the UI to update before computation
    requestAnimationFrame(() => {
      try {
        const analysisResult = analyzeFrequencyResponse({
          topology,
          components: validated.components,
          sweep: validated.sweep,
        });
        setResult(analysisResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setError(message);
      } finally {
        setIsAnalyzing(false);
      }
    });
  }, [validate, topology]);

  // Reset
  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Run button styling
  const runButtonClasses = cn(
    'h-9 px-6 flex items-center gap-2 text-sm font-medium transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      : isAnalyzing
        ? 'bg-muted text-muted-foreground cursor-wait'
        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]',
  );

  return (
    <div
      className="h-full flex flex-col bg-background/50 overflow-hidden"
      data-testid="frequency-analysis-panel"
    >
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-3">
            <Activity className="w-7 h-7 text-primary" />
            Frequency Analysis
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Bode plot visualization for passive filter circuits
          </p>
        </div>
        {result && (
          <button
            type="button"
            onClick={handleReset}
            data-testid="reset-analysis"
            className="h-8 px-3 flex items-center gap-1.5 text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-0 bg-card/40 border border-border backdrop-blur-xl shadow-xl">
          {/* Topology selector */}
          <CollapsibleSection title="Filter Topology" testId="section-topology">
            <div className="flex flex-col gap-3">
              <select
                value={topology}
                onChange={(e) => {
                  setTopology(e.target.value as FilterTopology);
                  setError(null);
                  setResult(null);
                }}
                disabled={isAnalyzing}
                data-testid="topology-selector"
                className={cn(
                  'h-9 px-3 text-xs bg-background border border-border text-foreground',
                  'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors appearance-none',
                )}
              >
                {TOPOLOGIES.map((t) => (
                  <option key={t} value={t}>
                    {TOPOLOGY_METADATA[t].label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted-foreground font-mono">
                {meta.description}
              </div>
            </div>
          </CollapsibleSection>

          {/* Component values */}
          <CollapsibleSection title="Component Values" testId="section-component-values">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {showR && (
                <ParamField
                  label="Resistance (R)"
                  value={resistance}
                  onChange={setResistance}
                  placeholder="1k"
                  unit="\u03A9"
                  testId="param-resistance"
                  disabled={isAnalyzing}
                />
              )}
              {showC && (
                <ParamField
                  label="Capacitance (C)"
                  value={capacitance}
                  onChange={setCapacitance}
                  placeholder="100n"
                  unit="F"
                  testId="param-capacitance"
                  disabled={isAnalyzing}
                />
              )}
              {showL && (
                <ParamField
                  label="Inductance (L)"
                  value={inductance}
                  onChange={setInductance}
                  placeholder="1m"
                  unit="H"
                  testId="param-inductance"
                  disabled={isAnalyzing}
                />
              )}
              {showW0 && (
                <ParamField
                  label="Natural Frequency (\u03C9\u2080)"
                  value={naturalFrequency}
                  onChange={setNaturalFrequency}
                  placeholder="6283"
                  unit="rad/s"
                  testId="param-natural-frequency"
                  disabled={isAnalyzing}
                />
              )}
              {showZeta && (
                <ParamField
                  label="Damping Ratio (\u03B6)"
                  value={dampingRatio}
                  onChange={setDampingRatio}
                  placeholder="0.707"
                  testId="param-damping-ratio"
                  disabled={isAnalyzing}
                />
              )}
            </div>
          </CollapsibleSection>

          {/* Frequency range */}
          <CollapsibleSection title="Frequency Range" testId="section-frequency-range">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ParamField
                label="Minimum Frequency"
                value={fMin}
                onChange={setFMin}
                placeholder="1"
                unit="Hz"
                testId="param-fmin"
                disabled={isAnalyzing}
              />
              <ParamField
                label="Maximum Frequency"
                value={fMax}
                onChange={setFMax}
                placeholder="10M"
                unit="Hz"
                testId="param-fmax"
                disabled={isAnalyzing}
              />
            </div>
          </CollapsibleSection>

          {/* Analyze button */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
            <button
              type="button"
              data-testid="run-frequency-analysis"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={runButtonClasses}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
            {error && !isAnalyzing && (
              <span className="text-xs text-destructive" data-testid="frequency-analysis-error">
                {error}
              </span>
            )}
          </div>

          {/* Results */}
          <CollapsibleSection
            title="Bode Plot"
            defaultOpen={result !== null}
            testId="section-bode-plot"
          >
            <div data-testid="frequency-analysis-results">
              {result === null && !isAnalyzing && (
                <p className="text-xs text-muted-foreground italic">
                  No results yet. Select a topology, enter component values, and press Analyze.
                </p>
              )}
              {isAnalyzing && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {result !== null && !isAnalyzing && (
                <div className="flex flex-col gap-4">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    }
                  >
                    <BodePlot
                      data={result.data}
                      title={`${TOPOLOGY_METADATA[result.topology].label} Response`}
                      cutoffFrequencyHz={result.summary.cutoffFrequencyHz}
                    />
                  </Suspense>
                  <AnalysisSummary result={result} />
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
