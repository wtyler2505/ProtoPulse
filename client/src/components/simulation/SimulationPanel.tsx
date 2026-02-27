import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { WaveformTrace, PlotType } from './WaveformViewer';
import {
  Play,
  Square,
  Zap,
  Activity,
  TrendingUp,
  ArrowUpDown,
  Trash2,
  Clock,
  Loader2,
  Download,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Plus,
  RotateCcw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Lazy-loaded WaveformViewer — only pulled in when results need graphing
// ---------------------------------------------------------------------------
const WaveformViewer = lazy(() => import('./WaveformViewer'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnalysisType = 'dcop' | 'transient' | 'ac' | 'dcsweep';

interface DCOPParams {
  // DC Operating Point requires no additional parameters.
}

interface TransientParams {
  startTime: string;
  stopTime: string;
  timeStep: string;
}

interface ACParams {
  startFrequency: string;
  stopFrequency: string;
  pointsPerDecade: string;
}

interface DCSweepParams {
  source: string;
  startValue: string;
  stopValue: string;
  stepValue: string;
}

type AnalysisParams = {
  dcop: DCOPParams;
  transient: TransientParams;
  ac: ACParams;
  dcsweep: DCSweepParams;
};

interface Probe {
  id: string;
  name: string;
  type: 'voltage' | 'current';
  nodeOrComponent: string;
}

interface DCOPResult {
  type: 'dcop';
  rows: Array<{ node: string; value: number; unit: string }>;
}

interface WaveformResult {
  type: 'waveform';
  plotType: PlotType;
  traces: WaveformTrace[];
  xLabel?: string;
  xUnit?: string;
  yLabel?: string;
  y2Label?: string;
  title?: string;
}

type SimulationResult = DCOPResult | WaveformResult;

interface SimulationRun {
  id: string;
  analysisType: AnalysisType;
  timestamp: number;
  result: SimulationResult;
  params: AnalysisParams[AnalysisType];
}

// ---------------------------------------------------------------------------
// Value parser: "10k" -> 10000, "100u" -> 0.0001, etc.
// ---------------------------------------------------------------------------

const SI_SUFFIXES: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  K: 1e3,
  m: 1e-3,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

export function parseValueWithUnit(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') return NaN;

  // Try a plain number first.
  const plainNumber = Number(trimmed);
  if (!Number.isNaN(plainNumber)) return plainNumber;

  // Match a number followed by an SI suffix (with optional trailing unit chars like "Hz", "V", "s").
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([TGMkKmunpf])(?:[A-Za-z]*)?$/);
  if (!match) return NaN;

  const numeric = Number(match[1]);
  const suffix = match[2];
  const multiplier = SI_SUFFIXES[suffix];
  if (multiplier === undefined) return NaN;

  return numeric * multiplier;
}

// ---------------------------------------------------------------------------
// Analysis type metadata
// ---------------------------------------------------------------------------

const ANALYSIS_TYPES: Array<{
  id: AnalysisType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dcop', label: 'DC Operating Point', description: 'Compute node voltages and branch currents', icon: Zap },
  { id: 'transient', label: 'Transient', description: 'Time-domain waveform analysis', icon: Activity },
  { id: 'ac', label: 'AC Analysis', description: 'Frequency-domain Bode plot', icon: TrendingUp },
  { id: 'dcsweep', label: 'DC Sweep', description: 'Sweep a source and measure responses', icon: ArrowUpDown },
];

// ---------------------------------------------------------------------------
// Default parameter factories
// ---------------------------------------------------------------------------

function defaultTransientParams(): TransientParams {
  return { startTime: '0', stopTime: '10ms', timeStep: '' };
}

function defaultACParams(): ACParams {
  return { startFrequency: '1Hz', stopFrequency: '1MHz', pointsPerDecade: '100' };
}

function defaultDCSweepParams(): DCSweepParams {
  return { source: '', startValue: '0', stopValue: '5V', stepValue: '0.1V' };
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
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
// Reusable form field
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
// Parameter forms per analysis type
// ---------------------------------------------------------------------------

function TransientParamsForm({
  params,
  onChange,
  disabled,
}: {
  params: TransientParams;
  onChange: (p: TransientParams) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ParamField
        label="Start Time"
        value={params.startTime}
        onChange={(v) => onChange({ ...params, startTime: v })}
        placeholder="0"
        unit="s"
        testId="param-transient-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Time"
        value={params.stopTime}
        onChange={(v) => onChange({ ...params, stopTime: v })}
        placeholder="10ms"
        unit="s"
        testId="param-transient-stop"
        disabled={disabled}
      />
      <ParamField
        label="Time Step"
        value={params.timeStep}
        onChange={(v) => onChange({ ...params, timeStep: v })}
        placeholder="auto"
        unit="s"
        testId="param-transient-step"
        disabled={disabled}
      />
    </div>
  );
}

function ACParamsForm({
  params,
  onChange,
  disabled,
}: {
  params: ACParams;
  onChange: (p: ACParams) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ParamField
        label="Start Frequency"
        value={params.startFrequency}
        onChange={(v) => onChange({ ...params, startFrequency: v })}
        placeholder="1Hz"
        unit="Hz"
        testId="param-ac-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Frequency"
        value={params.stopFrequency}
        onChange={(v) => onChange({ ...params, stopFrequency: v })}
        placeholder="1MHz"
        unit="Hz"
        testId="param-ac-stop"
        disabled={disabled}
      />
      <ParamField
        label="Points/Decade"
        value={params.pointsPerDecade}
        onChange={(v) => onChange({ ...params, pointsPerDecade: v })}
        placeholder="100"
        testId="param-ac-points"
        disabled={disabled}
      />
    </div>
  );
}

function DCSweepParamsForm({
  params,
  onChange,
  disabled,
  sources,
}: {
  params: DCSweepParams;
  onChange: (p: DCSweepParams) => void;
  disabled: boolean;
  sources: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[11px] text-muted-foreground font-medium">Source</span>
        <select
          value={params.source}
          onChange={(e) => onChange({ ...params, source: e.target.value })}
          disabled={disabled || sources.length === 0}
          data-testid="param-dcsweep-source"
          className={cn(
            'h-8 px-2 text-xs bg-background border border-border text-foreground',
            'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors appearance-none',
          )}
        >
          <option value="">
            {sources.length === 0 ? 'No sources in circuit' : 'Select a source...'}
          </option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <ParamField
        label="Start Value"
        value={params.startValue}
        onChange={(v) => onChange({ ...params, startValue: v })}
        placeholder="0"
        unit="V"
        testId="param-dcsweep-start"
        disabled={disabled}
      />
      <ParamField
        label="Stop Value"
        value={params.stopValue}
        onChange={(v) => onChange({ ...params, stopValue: v })}
        placeholder="5V"
        unit="V"
        testId="param-dcsweep-stop"
        disabled={disabled}
      />
      <ParamField
        label="Step Value"
        value={params.stepValue}
        onChange={(v) => onChange({ ...params, stepValue: v })}
        placeholder="0.1V"
        unit="V"
        testId="param-dcsweep-step"
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DC Operating Point results table
// ---------------------------------------------------------------------------

function DCOPResultTable({ rows }: { rows: DCOPResult['rows'] }) {
  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full text-xs" data-testid="dcop-results-table">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 px-3 font-semibold">Node / Component</th>
            <th className="text-right py-2 px-3 font-semibold">Value</th>
            <th className="text-left py-2 px-3 font-semibold">Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.node}-${i}`}
              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
            >
              <td className="py-1.5 px-3 font-mono text-foreground">{row.node}</td>
              <td className="py-1.5 px-3 text-right font-mono text-primary">
                {row.value.toFixed(6)}
              </td>
              <td className="py-1.5 px-3 text-muted-foreground">{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SimulationPanel() {
  const projectId = useProjectId();
  const { toast } = useToast();

  // Analysis type selection
  const [analysisType, setAnalysisType] = useState<AnalysisType>('dcop');

  // Per-type parameters
  const [transientParams, setTransientParams] = useState<TransientParams>(defaultTransientParams);
  const [acParams, setACParams] = useState<ACParams>(defaultACParams);
  const [dcsweepParams, setDCSweepParams] = useState<DCSweepParams>(defaultDCSweepParams);

  // Probes
  const [probes, setProbes] = useState<Probe[]>([]);

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [resultHistory, setResultHistory] = useState<SimulationRun[]>([]);

  // Placeholder: in a real circuit these would come from the circuit netlist.
  // For now, use an empty array. Future integration will populate from circuit context.
  const circuitSources = useMemo<string[]>(() => [], []);

  // ---------------------------
  // Resolve current params
  // ---------------------------
  const currentParams = useMemo((): AnalysisParams[AnalysisType] => {
    switch (analysisType) {
      case 'dcop':
        return {} as DCOPParams;
      case 'transient':
        return transientParams;
      case 'ac':
        return acParams;
      case 'dcsweep':
        return dcsweepParams;
    }
  }, [analysisType, transientParams, acParams, dcsweepParams]);

  // ---------------------------
  // Validate before running
  // ---------------------------
  const validate = useCallback((): string | null => {
    if (analysisType === 'transient') {
      const stop = parseValueWithUnit(transientParams.stopTime);
      if (Number.isNaN(stop) || stop <= 0) return 'Stop time must be a positive value';
    }
    if (analysisType === 'ac') {
      const start = parseValueWithUnit(acParams.startFrequency);
      const stop = parseValueWithUnit(acParams.stopFrequency);
      if (Number.isNaN(start) || start <= 0) return 'Start frequency must be a positive value';
      if (Number.isNaN(stop) || stop <= 0) return 'Stop frequency must be a positive value';
      if (start >= stop) return 'Start frequency must be less than stop frequency';
    }
    if (analysisType === 'dcsweep') {
      if (!dcsweepParams.source) return 'Select a source for DC Sweep';
      const start = parseValueWithUnit(dcsweepParams.startValue);
      const stop = parseValueWithUnit(dcsweepParams.stopValue);
      const step = parseValueWithUnit(dcsweepParams.stepValue);
      if (Number.isNaN(start)) return 'Start value is invalid';
      if (Number.isNaN(stop)) return 'Stop value is invalid';
      if (Number.isNaN(step) || step <= 0) return 'Step value must be a positive number';
    }
    return null;
  }, [analysisType, transientParams, acParams, dcsweepParams]);

  // ---------------------------
  // Run simulation
  // ---------------------------
  const handleRun = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast({ variant: 'destructive', title: 'Validation Error', description: validationError });
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/simulate`, {
        analysisType,
        params: currentParams,
        probes: probes.map((p) => ({ name: p.name, type: p.type, nodeOrComponent: p.nodeOrComponent })),
      });

      const data: SimulationResult = await response.json();
      setResults(data);

      const run: SimulationRun = {
        id: crypto.randomUUID(),
        analysisType,
        timestamp: Date.now(),
        result: data,
        params: currentParams,
      };
      setResultHistory((prev) => [run, ...prev]);

      toast({ title: 'Simulation Complete', description: `${ANALYSIS_TYPES.find((a) => a.id === analysisType)?.label} finished successfully.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setError(message);
      toast({ variant: 'destructive', title: 'Simulation Failed', description: message });
    } finally {
      setIsRunning(false);
    }
  }, [validate, projectId, analysisType, currentParams, probes, toast]);

  // ---------------------------
  // Stop (abort) — placeholder for future AbortController integration
  // ---------------------------
  const handleStop = useCallback(() => {
    // In the future this will abort the in-flight request via AbortController.
    setIsRunning(false);
    toast({ title: 'Simulation Stopped', description: 'The running simulation was cancelled.' });
  }, [toast]);

  // ---------------------------
  // Export SPICE netlist
  // ---------------------------
  const handleExportSpice = useCallback(async () => {
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/export/spice`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}.spice`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export Complete', description: 'SPICE netlist downloaded.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast({ variant: 'destructive', title: 'Export Failed', description: message });
    }
  }, [projectId, toast]);

  // ---------------------------
  // Probe management
  // ---------------------------
  const addProbe = useCallback(() => {
    const newProbe: Probe = {
      id: crypto.randomUUID(),
      name: `Probe ${probes.length + 1}`,
      type: 'voltage',
      nodeOrComponent: '',
    };
    setProbes((prev) => [...prev, newProbe]);
  }, [probes.length]);

  const removeProbe = useCallback((probeId: string) => {
    setProbes((prev) => prev.filter((p) => p.id !== probeId));
  }, []);

  const updateProbe = useCallback((probeId: string, updates: Partial<Omit<Probe, 'id'>>) => {
    setProbes((prev) =>
      prev.map((p) => (p.id === probeId ? { ...p, ...updates } : p)),
    );
  }, []);

  // ---------------------------
  // Load a historical result
  // ---------------------------
  const loadHistoryEntry = useCallback((run: SimulationRun) => {
    setAnalysisType(run.analysisType);
    setResults(run.result);
    setError(null);

    // Restore parameters based on the analysis type.
    switch (run.analysisType) {
      case 'transient':
        setTransientParams(run.params as TransientParams);
        break;
      case 'ac':
        setACParams(run.params as ACParams);
        break;
      case 'dcsweep':
        setDCSweepParams(run.params as DCSweepParams);
        break;
      default:
        break;
    }
  }, []);

  const clearHistory = useCallback(() => {
    setResultHistory([]);
    toast({ title: 'History Cleared', description: 'All simulation results have been removed.' });
  }, [toast]);

  // ---------------------------
  // Run button color
  // ---------------------------
  const runButtonClasses = cn(
    'h-9 px-6 flex items-center gap-2 text-sm font-medium transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      : isRunning
        ? 'bg-muted text-muted-foreground cursor-wait'
        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]',
  );

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <div className="h-full flex flex-col bg-background/50 overflow-hidden" data-testid="simulation-panel">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-3">
            <Activity className="w-7 h-7 text-primary" />
            Circuit Simulation
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure and run SPICE-based circuit analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="export-spice"
            onClick={handleExportSpice}
            className="h-8 px-3 flex items-center gap-1.5 text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export SPICE
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-0 bg-card/40 border border-border backdrop-blur-xl shadow-xl">
          {/* ------- Analysis Type Selector ------- */}
          <CollapsibleSection title="Analysis Type" testId="section-analysis-type">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ANALYSIS_TYPES.map((at) => {
                const Icon = at.icon;
                const active = analysisType === at.id;
                return (
                  <button
                    key={at.id}
                    type="button"
                    data-testid={`analysis-type-${at.id}`}
                    onClick={() => {
                      setAnalysisType(at.id);
                      setError(null);
                    }}
                    disabled={isRunning}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 border transition-all text-center',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      active
                        ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                        : 'border-border bg-background hover:bg-muted/30 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{at.label}</span>
                    <span className="text-[10px] leading-tight opacity-70 hidden sm:block">
                      {at.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* ------- Parameters ------- */}
          <CollapsibleSection title="Parameters" testId="section-parameters">
            {analysisType === 'dcop' && (
              <p className="text-xs text-muted-foreground italic">
                DC Operating Point analysis requires no additional parameters. Press Run to compute node voltages and branch currents.
              </p>
            )}
            {analysisType === 'transient' && (
              <TransientParamsForm
                params={transientParams}
                onChange={setTransientParams}
                disabled={isRunning}
              />
            )}
            {analysisType === 'ac' && (
              <ACParamsForm params={acParams} onChange={setACParams} disabled={isRunning} />
            )}
            {analysisType === 'dcsweep' && (
              <DCSweepParamsForm
                params={dcsweepParams}
                onChange={setDCSweepParams}
                disabled={isRunning}
                sources={circuitSources}
              />
            )}
          </CollapsibleSection>

          {/* ------- Probe Setup ------- */}
          <CollapsibleSection title="Probes" testId="section-probes">
            {probes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic mb-3">
                No probes placed. Add probes to monitor specific nodes or component currents.
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {probes.map((probe) => (
                  <div
                    key={probe.id}
                    className="flex items-center gap-2 p-2 bg-background border border-border"
                    data-testid={`probe-${probe.id}`}
                  >
                    <Crosshair className="w-3.5 h-3.5 text-primary shrink-0" />
                    <input
                      type="text"
                      value={probe.name}
                      onChange={(e) => updateProbe(probe.id, { name: e.target.value })}
                      className="flex-1 h-6 px-2 text-xs bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground/50"
                      placeholder="Probe name"
                      data-testid={`probe-name-${probe.id}`}
                    />
                    <select
                      value={probe.type}
                      onChange={(e) =>
                        updateProbe(probe.id, { type: e.target.value as 'voltage' | 'current' })
                      }
                      className="h-6 px-1 text-[10px] bg-muted/30 border border-border text-muted-foreground appearance-none"
                      data-testid={`probe-type-${probe.id}`}
                    >
                      <option value="voltage">Voltage</option>
                      <option value="current">Current</option>
                    </select>
                    <input
                      type="text"
                      value={probe.nodeOrComponent}
                      onChange={(e) => updateProbe(probe.id, { nodeOrComponent: e.target.value })}
                      className="w-28 h-6 px-2 text-xs bg-transparent border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/50 font-mono"
                      placeholder="Node/Comp"
                      data-testid={`probe-node-${probe.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeProbe(probe.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`probe-remove-${probe.id}`}
                      title="Remove probe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addProbe}
              disabled={isRunning}
              data-testid="add-probe"
              className={cn(
                'flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Probe
            </button>
          </CollapsibleSection>

          {/* ------- Run Button ------- */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
            {isRunning ? (
              <button
                type="button"
                data-testid="stop-simulation"
                onClick={handleStop}
                className="h-9 px-6 flex items-center gap-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                data-testid="run-simulation"
                onClick={handleRun}
                disabled={isRunning}
                className={runButtonClasses}
              >
                <Play className="w-4 h-4" />
                Run Simulation
              </button>
            )}
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Running {ANALYSIS_TYPES.find((a) => a.id === analysisType)?.label}...</span>
              </div>
            )}
            {error && !isRunning && (
              <span className="text-xs text-destructive">{error}</span>
            )}
          </div>

          {/* ------- Results ------- */}
          <CollapsibleSection title="Results" defaultOpen={results !== null} testId="section-results">
            <div data-testid="simulation-results">
              {results === null && !isRunning && (
                <p className="text-xs text-muted-foreground italic">
                  No results yet. Configure analysis and press Run.
                </p>
              )}
              {isRunning && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {results !== null && !isRunning && results.type === 'dcop' && (
                <DCOPResultTable rows={results.rows} />
              )}
              {results !== null && !isRunning && results.type === 'waveform' && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  }
                >
                  <WaveformViewer
                    traces={results.traces}
                    plotType={results.plotType}
                    xLabel={results.xLabel}
                    title={results.title}
                  />
                </Suspense>
              )}
            </div>
          </CollapsibleSection>

          {/* ------- Result History ------- */}
          <CollapsibleSection title="Result History" defaultOpen={false} testId="section-result-history">
            <div data-testid="result-history">
              {resultHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No previous runs. Results will appear here after each simulation.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground">
                      {resultHistory.length} run{resultHistory.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={clearHistory}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                      data-testid="clear-result-history"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {resultHistory.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => loadHistoryEntry(run)}
                        className="flex items-center gap-3 px-3 py-2 text-xs bg-background border border-border hover:bg-muted/30 hover:border-primary/30 transition-colors text-left group"
                        data-testid={`history-entry-${run.id}`}
                      >
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground">
                            {ANALYSIS_TYPES.find((a) => a.id === run.analysisType)?.label}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {new Date(run.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <RotateCcw className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
