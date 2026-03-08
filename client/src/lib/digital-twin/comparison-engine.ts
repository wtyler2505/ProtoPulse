/**
 * Comparison Engine — Sim vs Actual deviation detection
 *
 * Compares simulated values (from DC/AC analysis) against actual measured
 * values (from device shadow telemetry). Detects deviations exceeding
 * configurable thresholds and produces per-channel comparison results.
 *
 * Thresholds:
 *   - match: deviation < warnThresholdPercent
 *   - warn:  deviation >= warnThresholdPercent && < failThresholdPercent
 *   - fail:  deviation >= failThresholdPercent
 *   - no_data: either simulated or measured value is missing
 *
 * For very small values (below absoluteMinThreshold), absolute comparison
 * is used instead of percentage to avoid divide-by-zero / extreme ratios.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComparisonStatus = 'match' | 'warn' | 'fail' | 'no_data';

export interface ComparisonResult {
  channelId: string;
  channelName: string;
  simulated: number | null;
  measured: number | null;
  deviation: number | null;
  deviationPercent: number | null;
  status: ComparisonStatus;
  message: string;
}

export interface ComparisonConfig {
  warnThresholdPercent: number;
  failThresholdPercent: number;
  absoluteMinThreshold: number;
}

export interface HealthSummary {
  status: ComparisonStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
  noDataCount: number;
}

// ---------------------------------------------------------------------------
// Minimal ShadowState shape (avoids circular import with device-shadow)
// ---------------------------------------------------------------------------

export interface ComparisonShadowState {
  reported: Map<string, { value: number | boolean | string }>;
  manifest: { channels: Array<{ id: string; name: string }> } | null;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export function defaultComparisonConfig(): ComparisonConfig {
  return {
    warnThresholdPercent: 5,
    failThresholdPercent: 20,
    absoluteMinThreshold: 0.1,
  };
}

// ---------------------------------------------------------------------------
// Core comparison functions
// ---------------------------------------------------------------------------

/**
 * Compare a single pair of simulated vs measured values.
 * For small reference values (below absoluteMinThreshold), uses absolute deviation.
 */
export function compareValues(
  simulated: number,
  measured: number,
  config: ComparisonConfig = defaultComparisonConfig(),
): ComparisonStatus {
  const reference = Math.abs(simulated);
  const absDev = Math.abs(measured - simulated);

  // For very small values, use absolute comparison
  if (reference < config.absoluteMinThreshold) {
    // Use absolute deviation against the threshold directly
    if (absDev >= config.failThresholdPercent * config.absoluteMinThreshold / 100) {
      return 'fail';
    }
    if (absDev >= config.warnThresholdPercent * config.absoluteMinThreshold / 100) {
      return 'warn';
    }
    return 'match';
  }

  const percentDev = (absDev / reference) * 100;

  if (percentDev >= config.failThresholdPercent) {
    return 'fail';
  }
  if (percentDev >= config.warnThresholdPercent) {
    return 'warn';
  }
  return 'match';
}

/**
 * Compare all channels from the device shadow against simulation results.
 * Produces a ComparisonResult for each channel in the simulation results map.
 */
export function compareCircuit(
  shadow: ComparisonShadowState,
  simulationResults: Map<string, number>,
  config: ComparisonConfig = defaultComparisonConfig(),
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  // Build a name lookup from the manifest
  const nameMap = new Map<string, string>();
  if (shadow.manifest) {
    for (const ch of shadow.manifest.channels) {
      nameMap.set(ch.id, ch.name);
    }
  }

  // Get all channel IDs from both sources
  const allChannelIds = new Set<string>();
  for (const key of Array.from(simulationResults.keys())) {
    allChannelIds.add(key);
  }
  for (const key of Array.from(shadow.reported.keys())) {
    allChannelIds.add(key);
  }

  for (const channelId of Array.from(allChannelIds)) {
    const channelName = nameMap.get(channelId) ?? channelId;
    const simValue = simulationResults.get(channelId) ?? null;
    const reportedState = shadow.reported.get(channelId);

    // Extract numeric measured value
    let measuredValue: number | null = null;
    if (reportedState !== undefined) {
      const raw = reportedState.value;
      if (typeof raw === 'number') {
        measuredValue = raw;
      } else if (typeof raw === 'boolean') {
        measuredValue = raw ? 1 : 0;
      }
      // string values cannot be compared numerically
    }

    if (simValue === null && measuredValue === null) {
      results.push({
        channelId,
        channelName,
        simulated: null,
        measured: null,
        deviation: null,
        deviationPercent: null,
        status: 'no_data',
        message: 'No simulated or measured data available',
      });
      continue;
    }

    if (simValue === null) {
      results.push({
        channelId,
        channelName,
        simulated: null,
        measured: measuredValue,
        deviation: null,
        deviationPercent: null,
        status: 'no_data',
        message: 'No simulation data for this channel',
      });
      continue;
    }

    if (measuredValue === null) {
      results.push({
        channelId,
        channelName,
        simulated: simValue,
        measured: null,
        deviation: null,
        deviationPercent: null,
        status: 'no_data',
        message: 'No measured data for this channel',
      });
      continue;
    }

    const absDev = Math.abs(measuredValue - simValue);
    const reference = Math.abs(simValue);
    const percentDev = reference >= config.absoluteMinThreshold
      ? (absDev / reference) * 100
      : null;
    const status = compareValues(simValue, measuredValue, config);

    let message: string;
    if (status === 'match') {
      message = percentDev !== null
        ? `Within tolerance (${percentDev.toFixed(1)}% deviation)`
        : `Within tolerance (${absDev.toFixed(4)} absolute deviation)`;
    } else if (status === 'warn') {
      message = percentDev !== null
        ? `Warning: ${percentDev.toFixed(1)}% deviation exceeds ${config.warnThresholdPercent}% threshold`
        : `Warning: ${absDev.toFixed(4)} absolute deviation`;
    } else {
      message = percentDev !== null
        ? `FAIL: ${percentDev.toFixed(1)}% deviation exceeds ${config.failThresholdPercent}% threshold`
        : `FAIL: ${absDev.toFixed(4)} absolute deviation`;
    }

    results.push({
      channelId,
      channelName,
      simulated: simValue,
      measured: measuredValue,
      deviation: absDev,
      deviationPercent: percentDev,
      status,
      message,
    });
  }

  return results;
}

/**
 * Compute overall health from a set of comparison results.
 * Overall status is the worst status found (fail > warn > no_data > match).
 */
export function overallHealth(results: ComparisonResult[]): HealthSummary {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let noDataCount = 0;

  for (const r of results) {
    switch (r.status) {
      case 'match':
        passCount++;
        break;
      case 'warn':
        warnCount++;
        break;
      case 'fail':
        failCount++;
        break;
      case 'no_data':
        noDataCount++;
        break;
    }
  }

  let status: ComparisonStatus = 'match';
  if (failCount > 0) {
    status = 'fail';
  } else if (warnCount > 0) {
    status = 'warn';
  } else if (noDataCount > 0 && passCount === 0) {
    status = 'no_data';
  }

  return { status, passCount, warnCount, failCount, noDataCount };
}
