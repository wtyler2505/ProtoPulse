import type { PlotType, WaveformTrace } from './WaveformViewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisType = 'dcop' | 'transient' | 'ac' | 'dcsweep';

export interface DCOPParams {
  // DC Operating Point requires no additional parameters.
}

export interface TransientParams {
  startTime: string;
  stopTime: string;
  timeStep: string;
}

export interface ACParams {
  startFrequency: string;
  stopFrequency: string;
  pointsPerDecade: string;
}

export interface DCSweepParams {
  source: string;
  startValue: string;
  stopValue: string;
  stepValue: string;
}

export type AnalysisParams = {
  dcop: DCOPParams;
  transient: TransientParams;
  ac: ACParams;
  dcsweep: DCSweepParams;
};

export interface Probe {
  id: string;
  name: string;
  type: 'voltage' | 'current';
  nodeOrComponent: string;
}

export interface DCOPResult {
  type: 'dcop';
  rows: Array<{ node: string; value: number; unit: string }>;
}

export interface WaveformResult {
  type: 'waveform';
  plotType: PlotType;
  traces: WaveformTrace[];
  xLabel?: string;
  xUnit?: string;
  yLabel?: string;
  y2Label?: string;
  title?: string;
}

export type SimulationResult = DCOPResult | WaveformResult;

export interface SimulationRun {
  id: string;
  analysisType: AnalysisType;
  timestamp: number;
  result: SimulationResult;
  params: AnalysisParams[AnalysisType];
}

export type ApiAnalysisType = 'op' | 'tran' | 'ac' | 'dc';

export interface ApiSimulationTrace {
  name: string;
  unit: string;
  data: number[];
}

export interface ApiSimulationResponse {
  success: boolean;
  analysisType: ApiAnalysisType;
  traces?: ApiSimulationTrace[];
  nodeVoltages?: Record<string, number>;
  branchCurrents?: Record<string, number>;
  error?: string | null;
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
  if (trimmed === '') { return NaN; }

  // Try a plain number first.
  const plainNumber = Number(trimmed);
  if (!Number.isNaN(plainNumber)) { return plainNumber; }

  // Match a number followed by an SI suffix (with optional trailing unit chars like "Hz", "V", "s").
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([TGMkKmunpf])(?:[A-Za-z]*)?$/);
  if (!match) { return NaN; }

  const numeric = Number(match[1]);
  const suffix = match[2];
  const multiplier = SI_SUFFIXES[suffix];
  if (multiplier === undefined) { return NaN; }

  return numeric * multiplier;
}

// ---------------------------------------------------------------------------
// Analysis type metadata
// ---------------------------------------------------------------------------

import {
  Zap,
  Activity,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';

export const ANALYSIS_TYPES: Array<{
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

export const TRACE_COLORS = ['#22d3ee', '#f97316', '#a855f7', '#84cc16', '#f43f5e', '#eab308'];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function mapAnalysisTypeToApi(analysisType: AnalysisType): ApiAnalysisType {
  switch (analysisType) {
    case 'dcop':
      return 'op';
    case 'transient':
      return 'tran';
    case 'ac':
      return 'ac';
    case 'dcsweep':
      return 'dc';
  }
}

export function resolveTransientTimeStepSeconds(params: TransientParams): number {
  const explicitStep = params.timeStep.trim() ? parseValueWithUnit(params.timeStep) : NaN;
  if (!Number.isNaN(explicitStep) && explicitStep > 0) {
    return explicitStep;
  }

  const start = parseValueWithUnit(params.startTime) || 0;
  const stop = parseValueWithUnit(params.stopTime);
  const span = stop - start;
  if (!Number.isNaN(span) && span > 0) {
    return Math.max(span / 1000, 1e-9);
  }

  return 1e-6;
}

export function buildSimulationPayload(
  analysisType: AnalysisType,
  currentParams: AnalysisParams[AnalysisType],
  options?: { cornerMode?: 'random_extreme'; seed?: number },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    analysisType: mapAnalysisTypeToApi(analysisType),
  };

  switch (analysisType) {
    case 'dcop':
      break;
    case 'transient': {
      const params = currentParams as TransientParams;
      payload.transient = {
        startTime: parseValueWithUnit(params.startTime) || 0,
        stopTime: parseValueWithUnit(params.stopTime),
        timeStep: resolveTransientTimeStepSeconds(params),
      };
      break;
    }
    case 'ac': {
      const params = currentParams as ACParams;
      payload.ac = {
        startFreq: parseValueWithUnit(params.startFrequency),
        stopFreq: parseValueWithUnit(params.stopFrequency),
        numPoints: Math.max(1, Math.round(Number(params.pointsPerDecade) || 100)),
        sweepType: 'dec',
      };
      break;
    }
    case 'dcsweep': {
      const params = currentParams as DCSweepParams;
      payload.dcSweep = {
        sourceName: params.source,
        startValue: parseValueWithUnit(params.startValue),
        stopValue: parseValueWithUnit(params.stopValue),
        stepValue: parseValueWithUnit(params.stepValue),
      };
      break;
    }
  }

  if (options?.cornerMode) {
    payload.cornerMode = options.cornerMode;
  }
  if (options?.seed !== undefined) {
    payload.seed = options.seed;
  }

  return payload;
}

export function normalizeSimulationResponse(
  response: ApiSimulationResponse,
  requestedAnalysisType: AnalysisType,
): SimulationResult {
  if (!response.success) {
    throw new Error(response.error || 'Simulation failed');
  }

  if (requestedAnalysisType === 'dcop') {
    const voltageRows = Object.entries(response.nodeVoltages ?? {}).map(([node, value]) => ({
      node,
      value,
      unit: 'V',
    }));
    const currentRows = Object.entries(response.branchCurrents ?? {}).map(([node, value]) => ({
      node,
      value,
      unit: 'A',
    }));

    return {
      type: 'dcop',
      rows: [...voltageRows, ...currentRows],
    };
  }

  const traces = response.traces ?? [];
  const [firstTrace, ...remainingTraces] = traces;
  const xTrace = firstTrace && firstTrace.data.length > 1 ? firstTrace : null;
  const yTraceSources = xTrace ? remainingTraces : traces;
  const xValues = xTrace?.data ?? yTraceSources[0]?.data.map((_, index) => index) ?? [];

  return {
    type: 'waveform',
    plotType:
      requestedAnalysisType === 'ac'
        ? 'bode'
        : requestedAnalysisType === 'dcsweep'
          ? 'dc-sweep'
          : 'time',
    traces: yTraceSources.map((trace, index) => ({
      id: `${trace.name}-${index}`,
      label: trace.name,
      data: trace.data.map((y, pointIndex) => ({
        x: xValues[pointIndex] ?? pointIndex,
        y,
      })),
      color: TRACE_COLORS[index % TRACE_COLORS.length],
      unit: trace.unit || (requestedAnalysisType === 'ac' ? 'dB' : 'V'),
      visible: true,
    })),
    xLabel: xTrace?.name,
    xUnit: xTrace?.unit,
    title: ANALYSIS_TYPES.find((item) => item.id === requestedAnalysisType)?.label,
  };
}

// ---------------------------------------------------------------------------
// Default parameter factories
// ---------------------------------------------------------------------------

export function defaultTransientParams(): TransientParams {
  return { startTime: '0', stopTime: '10ms', timeStep: '' };
}

export function defaultACParams(): ACParams {
  return { startFrequency: '1Hz', stopFrequency: '1MHz', pointsPerDecade: '100' };
}

export function defaultDCSweepParams(): DCSweepParams {
  return { source: '', startValue: '0', stopValue: '5V', stepValue: '0.1V' };
}
