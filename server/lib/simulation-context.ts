/**
 * BL-0576: Build a human-readable simulation context string for the AI prompt.
 *
 * Summarizes simulation results by analysis type so the AI can answer
 * questions about simulation output (DC voltages, transient peaks,
 * Monte Carlo yield, frequency bandwidth).
 *
 * @module lib/simulation-context
 */

import type { SimulationResultRow } from '@shared/schema';

/**
 * Summarize a DC operating-point result.
 * Expects `results.nodeVoltages` as Record<string, number> or array of {node, voltage}.
 */
function summarizeDC(results: Record<string, unknown>): string {
  const nodeVoltages = results.nodeVoltages as Record<string, number> | Array<{ node: string; voltage: number }> | undefined;
  if (!nodeVoltages) {
    return '  DC operating point: completed (no voltage data)';
  }
  const entries = Array.isArray(nodeVoltages)
    ? nodeVoltages.map((nv) => `${nv.node}=${typeof nv.voltage === 'number' ? nv.voltage.toFixed(3) : nv.voltage}V`)
    : Object.entries(nodeVoltages).map(([node, v]) => `${node}=${typeof v === 'number' ? v.toFixed(3) : v}V`);
  const display = entries.slice(0, 10).join(', ');
  const more = entries.length > 10 ? ` ... and ${entries.length - 10} more` : '';
  return `  DC operating point: ${display}${more}`;
}

/**
 * Summarize a transient analysis result.
 * Expects `results.timeRange` {start, end} and optional `results.peakValues`.
 */
function summarizeTransient(results: Record<string, unknown>): string {
  const timeRange = results.timeRange as { start?: number; end?: number } | undefined;
  const peakValues = results.peakValues as Record<string, number> | undefined;
  const parts: string[] = [];
  if (timeRange) {
    parts.push(`time range: ${timeRange.start ?? 0}s – ${timeRange.end ?? '?'}s`);
  }
  if (results.numSteps) {
    parts.push(`${results.numSteps} steps`);
  }
  if (peakValues) {
    const peaks = Object.entries(peakValues)
      .slice(0, 5)
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`)
      .join(', ');
    parts.push(`peaks: ${peaks}`);
  }
  return `  Transient analysis: ${parts.join(' | ') || 'completed'}`;
}

/**
 * Summarize a Monte Carlo analysis result.
 * Expects `results.yield` (0-1 or 0-100) and optional `results.failingParams`.
 */
function summarizeMonteCarlo(results: Record<string, unknown>): string {
  const yieldVal = results.yield as number | undefined;
  const iterations = results.iterations as number | undefined;
  const failingParams = results.failingParams as string[] | undefined;
  const parts: string[] = [];
  if (yieldVal !== undefined) {
    // Normalize to percentage
    const pct = yieldVal > 1 ? yieldVal : yieldVal * 100;
    parts.push(`yield: ${pct.toFixed(1)}%`);
  }
  if (iterations !== undefined) {
    parts.push(`${iterations} iterations`);
  }
  if (failingParams && failingParams.length > 0) {
    parts.push(`failing: ${failingParams.slice(0, 5).join(', ')}`);
  }
  return `  Monte Carlo: ${parts.join(' | ') || 'completed'}`;
}

/**
 * Summarize an AC/frequency analysis result.
 * Expects `results.bandwidth`, `results.gainDb`, `results.phaseMargin`.
 */
function summarizeAC(results: Record<string, unknown>): string {
  const parts: string[] = [];
  if (results.bandwidth !== undefined) {
    parts.push(`bandwidth: ${results.bandwidth}Hz`);
  }
  if (results.gainDb !== undefined) {
    parts.push(`gain: ${results.gainDb}dB`);
  }
  if (results.phaseMargin !== undefined) {
    parts.push(`phase margin: ${results.phaseMargin}°`);
  }
  if (results.frequencyRange) {
    const fr = results.frequencyRange as { start?: number; end?: number };
    parts.push(`freq: ${fr.start ?? '?'}Hz – ${fr.end ?? '?'}Hz`);
  }
  return `  AC/Frequency analysis: ${parts.join(' | ') || 'completed'}`;
}

/**
 * Build a simulation context summary from simulation result rows.
 * Groups by analysis type, shows only the latest result per type (up to 5 types),
 * and includes the timestamp so the AI knows data freshness.
 */
export function buildSimulationContext(
  simResults: SimulationResultRow[],
  circuitName?: string,
): string {
  if (simResults.length === 0) {
    return '';
  }

  // Group by analysisType, keep only the latest (first in each group since results are sorted desc by createdAt)
  const latestByType = new Map<string, SimulationResultRow>();
  for (const r of simResults) {
    if (r.status !== 'completed') {
      continue;
    }
    if (!latestByType.has(r.analysisType)) {
      latestByType.set(r.analysisType, r);
    }
  }

  if (latestByType.size === 0) {
    return '';
  }

  const lines: string[] = [];
  if (circuitName) {
    lines.push(`  Circuit: "${circuitName}"`);
  }

  for (const [type, row] of Array.from(latestByType.entries())) {
    const results = (row.results ?? {}) as Record<string, unknown>;
    const age = row.createdAt ? ` (${row.createdAt.toISOString()})` : '';

    const normalizedType = type.toLowerCase().replace(/[_-]/g, '');
    if (normalizedType === 'dc' || normalizedType === 'dcop' || normalizedType === 'dcoperatingpoint') {
      lines.push(summarizeDC(results) + age);
    } else if (normalizedType === 'transient' || normalizedType === 'tran') {
      lines.push(summarizeTransient(results) + age);
    } else if (normalizedType === 'montecarlo' || normalizedType === 'mc') {
      lines.push(summarizeMonteCarlo(results) + age);
    } else if (normalizedType === 'ac' || normalizedType === 'frequency' || normalizedType === 'frequencyanalysis') {
      lines.push(summarizeAC(results) + age);
    } else {
      // Generic fallback for unknown analysis types
      const status = row.error ? `error: ${row.error}` : 'completed';
      lines.push(`  ${type}: ${status}${age}`);
    }
  }

  return lines.join('\n');
}
