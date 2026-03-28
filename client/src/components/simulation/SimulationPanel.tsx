import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCircuitDesigns, useCircuitInstances } from '@/lib/circuit-editor/hooks';
import { cn } from '@/lib/utils';
import SimulationScenarioPanel from '@/components/circuit-editor/SimulationScenarioPanel';
import SensorSliderPanel from '@/components/simulation/SensorSliderPanel';
import { useSimulation } from '@/lib/contexts/simulation-context';
import { autoDetectAnalysisType, detectSimulationType } from '@/lib/simulation/auto-detect';
import { checkCircuitComplexity } from '@/lib/simulation/complexity-check';
import SimPlayButton from '@/components/simulation/SimPlayButton';
import ShareSimulationButton from '@/components/simulation/ShareSimulationButton';
import {
  Play,
  Square,
  Activity,
  Loader2,
  Download,
  AlertCircle,
  Crosshair,
  Trash2,
  Plus,
} from 'lucide-react';

import {
  CollapsibleSection,
  ParamField,
  TransientParamsForm,
  ACParamsForm,
  DCSweepParamsForm,
  DCOPResultTable,
} from './AnalysisParamsForms';
import SpiceImportSection from './SpiceImportSection';
import ResultHistorySection from './ResultHistorySection';
import ComplexityWarningDialog from './ComplexityWarningDialog';
import {
  ANALYSIS_TYPES,
  parseValueWithUnit,
  buildSimulationPayload,
  normalizeSimulationResponse,
  defaultTransientParams,
  defaultACParams,
  defaultDCSweepParams,
} from './simulation-types';

import type { CircuitInstanceForDetection, AnalysisType as AutoDetectAnalysisType } from '@/lib/simulation/auto-detect';
import type { CircuitInstanceForComplexity } from '@/lib/simulation/complexity-check';
import type { WaveformTrace } from './WaveformViewer';
import type {
  AnalysisType,
  AnalysisParams,
  DCOPParams,
  TransientParams,
  ACParams,
  DCSweepParams,
  Probe,
  SimulationResult,
  SimulationRun,
  ApiSimulationResponse,
} from './simulation-types';

// Re-export for consumers that import parseValueWithUnit from this file
export { parseValueWithUnit } from './simulation-types';

// ---------------------------------------------------------------------------
// Lazy-loaded WaveformViewer — only pulled in when results need graphing
// ---------------------------------------------------------------------------
const WaveformViewer = lazy(() => import('./WaveformViewer'));

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

  // Corner Analysis (BL-0120)
  const [cornerAnalysis, setCornerAnalysis] = useState(false);
  const [cornerIterations, setCornerIterations] = useState(5);

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [resultHistory, setResultHistory] = useState<SimulationRun[]>([]);

  // Resolve current full config for saving as preset
  const currentFullConfig = useMemo(() => ({
    analysisType,
    transientParams,
    acParams,
    dcsweepParams,
    probes,
  }), [analysisType, transientParams, acParams, dcsweepParams, probes]);

  // BL-0213: Flatten current params for simulation sharing link
  const shareParameters = useMemo((): Record<string, string> => {
    switch (analysisType) {
      case 'transient':
        return { ...transientParams };
      case 'ac':
        return { ...acParams };
      case 'dcsweep':
        return { ...dcsweepParams };
      case 'dcop':
      default:
        return {};
    }
  }, [analysisType, transientParams, acParams, dcsweepParams]);

  const handleLoadPreset = useCallback((config: Record<string, unknown>) => {
    if (!config) { return; }
    if (config.analysisType) { setAnalysisType(config.analysisType as AnalysisType); }
    if (config.transientParams) { setTransientParams(config.transientParams as TransientParams); }
    if (config.acParams) { setACParams(config.acParams as ACParams); }
    if (config.dcsweepParams) { setDCSweepParams(config.dcsweepParams as DCSweepParams); }
    if (config.probes) { setProbes(config.probes as Probe[]); }

    toast({
      title: 'Preset loaded',
      description: 'Restored simulation configuration.',
    });
  }, [toast]);

  // AbortController for cancelling in-flight simulation requests
  const abortRef = useRef<AbortController | null>(null);
  const { isLive, setIsSimRunning, setActiveAnalysisType } = useSimulation();

  // Complexity warning dialog state
  const [showComplexityWarning, setShowComplexityWarning] = useState(false);
  const [complexityWarnings, setComplexityWarnings] = useState<string[]>([]);
  const [complexityEstimate, setComplexityEstimate] = useState('');
  const pendingRunRef = useRef(false);

  // Populate DC sweep source list from actual circuit instances
  const { data: circuits } = useCircuitDesigns(projectId);
  const firstCircuitId = circuits?.[0]?.id ?? 0;
  const {
    data: circuitInstances,
    isLoading: isCircuitInstancesLoading,
  } = useCircuitInstances(firstCircuitId);
  const { updateComponentState } = useSimulation();
  const hasPlacedCircuitInstances = (circuitInstances?.length ?? 0) > 0;
  const emptyCircuitMessage = 'Place at least one component in the schematic before running a simulation.';

  // Auto-detect analysis type from circuit topology
  const autoDetected = useMemo(() => {
    if (!circuitInstances || circuitInstances.length === 0) {
      return null;
    }
    const forDetection: CircuitInstanceForDetection[] = circuitInstances.map((inst) => {
      const props = (inst.properties && typeof inst.properties === 'object' ? inst.properties : {}) as Record<string, unknown>;
      return {
        referenceDesignator: inst.referenceDesignator,
        componentType: String(props.componentType ?? ''),
        properties: inst.properties as Record<string, unknown> | null,
      };
    });
    return autoDetectAnalysisType(forDetection);
  }, [circuitInstances]);

  // BL-0620: Enriched simulation type detection with confidence scoring
  const simTypeDetection = useMemo(() => {
    if (!circuitInstances || circuitInstances.length === 0) {
      return null;
    }
    const forDetection: CircuitInstanceForDetection[] = circuitInstances.map((inst) => {
      const props = (inst.properties && typeof inst.properties === 'object' ? inst.properties : {}) as Record<string, unknown>;
      return {
        referenceDesignator: inst.referenceDesignator,
        componentType: String(props.componentType ?? ''),
        properties: inst.properties as Record<string, unknown> | null,
      };
    });
    return detectSimulationType(forDetection);
  }, [circuitInstances]);

  const circuitSources = useMemo<string[]>(() => {
    if (!circuitInstances || circuitInstances.length === 0) { return []; }
    // Voltage and current sources use SPICE convention: refDes starts with V or I
    const props = (inst: typeof circuitInstances[number]) =>
      (inst.properties && typeof inst.properties === 'object' ? inst.properties : {}) as Record<string, unknown>;
    return circuitInstances
      .filter((inst) => {
        const refDes = inst.referenceDesignator;
        const compType = String(props(inst).componentType ?? '');
        return /^[VI]/i.test(refDes) || /voltage.source|current.source|dc.source|ac.source/i.test(compType);
      })
      .map((inst) => inst.referenceDesignator);
  }, [circuitInstances]);

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
      if (Number.isNaN(stop) || stop <= 0) { return 'Stop time must be a positive value'; }
    }
    if (analysisType === 'ac') {
      const start = parseValueWithUnit(acParams.startFrequency);
      const stop = parseValueWithUnit(acParams.stopFrequency);
      if (Number.isNaN(start) || start <= 0) { return 'Start frequency must be a positive value'; }
      if (Number.isNaN(stop) || stop <= 0) { return 'Stop frequency must be a positive value'; }
      if (start >= stop) { return 'Start frequency must be less than stop frequency'; }
    }
    if (analysisType === 'dcsweep') {
      if (!dcsweepParams.source) { return 'Select a source for DC Sweep'; }
      const start = parseValueWithUnit(dcsweepParams.startValue);
      const stop = parseValueWithUnit(dcsweepParams.stopValue);
      const step = parseValueWithUnit(dcsweepParams.stepValue);
      if (Number.isNaN(start)) { return 'Start value is invalid'; }
      if (Number.isNaN(stop)) { return 'Stop value is invalid'; }
      if (Number.isNaN(step) || step <= 0) { return 'Step value must be a positive number'; }
    }
    return null;
  }, [analysisType, transientParams, acParams, dcsweepParams]);

  // ---------------------------
  // Run simulation
  // ---------------------------
  const handleRun = useCallback(async (isSilent = false) => {
    if (!firstCircuitId) {
      const message = 'No circuit design is available to simulate yet.';
      setError(message);
      if (!isSilent) {
        toast({ variant: 'destructive', title: 'Simulation Failed', description: message });
      }
      return;
    }
    if (isCircuitInstancesLoading) {
      const message = 'Circuit data is still loading. Try running the simulation again in a moment.';
      setError(message);
      if (!isSilent) {
        toast({ variant: 'destructive', title: 'Simulation Failed', description: message });
      }
      return;
    }
    if (!hasPlacedCircuitInstances) {
      setError(emptyCircuitMessage);
      if (!isSilent) {
        toast({ variant: 'destructive', title: 'Simulation Failed', description: emptyCircuitMessage });
      }
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      if (!isSilent) { toast({ variant: 'destructive', title: 'Validation Error', description: validationError }); }
      return;
    }

    // Create a new AbortController for this run
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setIsSimRunning(true);
    setActiveAnalysisType(analysisType);
    setIsStopping(false);
    setError(null);
    setResults(null);

    try {
      const response = await apiRequest(
        'POST',
        `/api/projects/${projectId}/circuits/${firstCircuitId}/simulate`,
        buildSimulationPayload(analysisType, currentParams),
        controller.signal,
      );

      const responseJson = (await response.json()) as ApiSimulationResponse;
      let data = normalizeSimulationResponse(responseJson, analysisType);

      // BL-0120: Worst-case corner analysis
      if (cornerAnalysis && data.type === 'waveform' && cornerIterations > 0) {
        const cornerRuns = Math.min(cornerIterations, 10); // Safety limit
        const combinedTraces: WaveformTrace[] = [...data.traces.map(t => ({ ...t, label: `${t.label} (Nominal)` }))];

        for (let i = 0; i < cornerRuns; i++) {
          if (controller.signal.aborted) { break; }

          // Request a corner variation from the backend
          const cornerResponse = await apiRequest(
            'POST',
            `/api/projects/${projectId}/circuits/${firstCircuitId}/simulate`,
            buildSimulationPayload(analysisType, currentParams, {
              cornerMode: 'random_extreme',
              seed: i + 100,
            }),
            controller.signal,
          );

          const cornerJson = (await cornerResponse.json()) as ApiSimulationResponse;
          const cornerData = normalizeSimulationResponse(cornerJson, analysisType);
          if (cornerData.type === 'waveform') {
            cornerData.traces.forEach(t => {
              combinedTraces.push({
                ...t,
                label: `${t.label} (Corner ${i + 1})`,
              });
            });
          }
        }
        data = { ...data, traces: combinedTraces };
      }

      setResults(data);

      // BL-0151: Reflect results in component live states
      if (data.type === 'waveform' && circuitInstances) {
        circuitInstances.forEach(inst => {
          const relevantTraces = data.traces.filter(t => t.label.includes(inst.referenceDesignator));
          if (relevantTraces.length > 0) {
            const lastTrace = relevantTraces[0];
            const lastVal = lastTrace.data[lastTrace.data.length - 1]?.y || 0;

            updateComponentState(inst.referenceDesignator, {
              isActive: lastVal > 1.0,
              brightness: Math.min(1, Math.max(0, lastVal / 5.0)),
            });
          }
        });
      }

      const run: SimulationRun = {
        id: crypto.randomUUID(),
        analysisType,
        timestamp: Date.now(),
        result: data,
        params: currentParams,
      };
      setResultHistory((prev) => [run, ...prev]);

      if (!isSilent) {
        toast({ title: 'Simulation Complete', description: `${ANALYSIS_TYPES.find((a) => a.id === analysisType)?.label} finished successfully.` });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!isSilent) { toast({ title: 'Simulation Stopped', description: 'The running simulation was cancelled.' }); }
      } else {
        const message = err instanceof Error ? err.message : 'Simulation failed';
        setError(message);
        if (!isSilent) { toast({ variant: 'destructive', title: 'Simulation Failed', description: message }); }
      }
    } finally {
      setIsRunning(false);
      setIsSimRunning(false);
      setActiveAnalysisType(null);
      setIsStopping(false);
      abortRef.current = null;
    }
  }, [
    validate,
    firstCircuitId,
    isCircuitInstancesLoading,
    hasPlacedCircuitInstances,
    emptyCircuitMessage,
    projectId,
    analysisType,
    currentParams,
    toast,
    cornerAnalysis,
    cornerIterations,
    circuitInstances,
    updateComponentState,
    setIsSimRunning,
    setActiveAnalysisType,
  ]);

  // BL-0150: Live simulation loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLive && !isRunning) {
      void handleRun(true);
      timer = setInterval(() => {
        if (!isRunning) { void handleRun(true); }
      }, 500);
    }
    return () => {
      if (timer) { clearInterval(timer); }
    };
  }, [isLive, isRunning, handleRun]);

  // ---------------------------
  // Stop (abort) via AbortController
  // ---------------------------
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      setIsStopping(true);
      abortRef.current.abort();
    }
  }, []);

  // ---------------------------
  // BL-0514: Complexity check before running
  // ---------------------------
  const handleRunWithComplexityCheck = useCallback(() => {
    if (isRunning) {
      return;
    }

    // Build complexity instances from circuit data
    if (circuitInstances && circuitInstances.length > 0) {
      const forComplexity: CircuitInstanceForComplexity[] = circuitInstances.map((inst) => {
        const props = (inst.properties && typeof inst.properties === 'object' ? inst.properties : {}) as Record<string, unknown>;
        return {
          referenceDesignator: inst.referenceDesignator,
          componentType: String(props.componentType ?? ''),
          properties: inst.properties as Record<string, unknown> | null,
        };
      });

      // For transient, compute estimated time steps
      let transientComplexityParams = null;
      if (analysisType === 'transient') {
        const startT = parseValueWithUnit(transientParams.startTime) || 0;
        const stopT = parseValueWithUnit(transientParams.stopTime);
        const stepT = transientParams.timeStep ? parseValueWithUnit(transientParams.timeStep) : 0;
        if (!Number.isNaN(stopT) && stopT > startT) {
          transientComplexityParams = {
            spanSeconds: stopT - startT,
            timeStepSeconds: Number.isNaN(stepT) ? 0 : stepT,
          };
        }
      }

      const result = checkCircuitComplexity(forComplexity, transientComplexityParams);

      if (result.shouldWarn) {
        setComplexityWarnings(result.warnings);
        setComplexityEstimate(result.metrics.estimatedRuntime);
        setShowComplexityWarning(true);
        pendingRunRef.current = true;
        return;
      }
    }

    void handleRun();
  }, [isRunning, circuitInstances, analysisType, transientParams, handleRun]);

  // Confirm run after complexity warning
  const handleConfirmComplexityRun = useCallback(() => {
    setShowComplexityWarning(false);
    pendingRunRef.current = false;
    void handleRun();
  }, [handleRun]);

  const handleCancelComplexityRun = useCallback(() => {
    setShowComplexityWarning(false);
    pendingRunRef.current = false;
  }, []);

  // ---------------------------
  // BL-0620: SimPlayButton start handler — sets type then runs
  // ---------------------------
  const handleSimPlayStart = useCallback((type: AutoDetectAnalysisType) => {
    setAnalysisType(type);
    // Use setTimeout(0) to ensure state is flushed before running
    setTimeout(() => {
      handleRunWithComplexityCheck();
    }, 0);
  }, [handleRunWithComplexityCheck]);

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
          {/* BL-0620: SimPlayButton — hero CTA with auto-detection */}
          <SimPlayButton
            isRunning={isRunning}
            isStopping={isStopping}
            disabled={!firstCircuitId || isCircuitInstancesLoading || !hasPlacedCircuitInstances}
            detection={simTypeDetection}
            onStart={handleSimPlayStart}
            onStop={handleStop}
          />
          <button
            type="button"
            data-testid="export-spice"
            onClick={handleExportSpice}
            className="h-8 px-3 flex items-center gap-1.5 text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export SPICE
          </button>
          {/* BL-0213: Share simulation link */}
          <ShareSimulationButton
            projectId={projectId}
            circuitId={firstCircuitId}
            analysisType={analysisType}
            parameters={shareParameters}
            probes={probes}
            disabled={!firstCircuitId}
          />
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
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Probe
            </button>
          </CollapsibleSection>

          {/* ------- Corner Analysis (BL-0120) ------- */}
          <CollapsibleSection title="Corner Analysis" testId="section-corners" defaultOpen={false}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-tight">Enable Corner Analysis</span>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Runs multiple simulations varying component tolerances to find worst-case performance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cornerAnalysis}
                  onChange={(e) => setCornerAnalysis(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/20"
                  data-testid="corner-analysis-toggle"
                />
              </div>

              {cornerAnalysis && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <ParamField
                    label="Iterations (Worst-case samples)"
                    value={String(cornerIterations)}
                    onChange={(v) => setCornerIterations(Math.max(1, Math.min(10, parseInt(v) || 1)))}
                    placeholder="5"
                    testId="corner-iterations-input"
                    disabled={isRunning}
                  />
                  <p className="text-[9px] text-amber-500/80 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Note: Corner analysis performs sequential requests and may take longer.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ------- Run Button ------- */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
            {isRunning ? (
              <button
                type="button"
                data-testid="stop-simulation"
                onClick={handleStop}
                disabled={isStopping}
                className={cn(
                  'h-9 px-6 flex items-center gap-2 text-sm font-medium transition-all',
                  isStopping
                    ? 'bg-muted text-muted-foreground cursor-wait'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                )}
              >
                {isStopping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    Stop
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRunWithComplexityCheck}
                disabled={isRunning || isCircuitInstancesLoading || !hasPlacedCircuitInstances}
                className={runButtonClasses}
                data-testid="button-run-simulation"
              >
                <Play className="w-4 h-4" />
                Run {ANALYSIS_TYPES.find((a) => a.id === analysisType)?.label}
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
              {!isRunning && !isCircuitInstancesLoading && firstCircuitId > 0 && !hasPlacedCircuitInstances && (
                <p className="text-xs text-muted-foreground italic">
                  Nothing to simulate yet. Place at least one component in the schematic before running a simulation.
                </p>
              )}
              {results === null && !isRunning && (
                hasPlacedCircuitInstances ? (
                  <p className="text-xs text-muted-foreground italic">
                    No results yet. Configure analysis and press Run.
                  </p>
                ) : null
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

          {/* ------- Import SPICE Netlist ------- */}
          <SpiceImportSection />

          {/* ------- Result History ------- */}
          <ResultHistorySection
            resultHistory={resultHistory}
            onLoadEntry={loadHistoryEntry}
            onClear={clearHistory}
          />

          {/* ------- Simulation Presets (BL-0124) ------- */}
          <CollapsibleSection title="Presets" defaultOpen={true} testId="section-simulation-presets">
            <SimulationScenarioPanel
              circuitId={firstCircuitId}
              currentConfig={currentFullConfig}
              onLoadConfig={handleLoadPreset}
            />
          </CollapsibleSection>

          {/* ------- Sensor Environmental Inputs (BL-0622) ------- */}
          {circuitInstances && circuitInstances.length > 0 && isLive && (
            <SensorSliderPanel
              instances={circuitInstances.map((inst) => ({
                referenceDesignator: inst.referenceDesignator,
                properties: inst.properties as Record<string, unknown> | null,
              }))}
            />
          )}
        </div>
      </div>

      {/* BL-0514: Complexity Warning Dialog */}
      {showComplexityWarning && (
        <ComplexityWarningDialog
          warnings={complexityWarnings}
          estimate={complexityEstimate}
          onConfirm={handleConfirmComplexityRun}
          onCancel={handleCancelComplexityRun}
        />
      )}
    </div>
  );
}
