import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

export interface BreadboardLayoutQualityInput {
  expectedBridgeCount: number;
  expectedHookupCount: number;
  expectedSupportCount: number;
  model: BreadboardSelectedPartModel;
  nearbyForeignPartCount: number;
  nearbyWireCount: number;
  stagedBridgeCount: number;
  stagedHookupCount: number;
  stagedSupportCount: number;
}

export interface BreadboardLayoutQualityMetric {
  detail: string;
  id: 'pin-trust' | 'rail-readiness' | 'support-coverage' | 'probe-space';
  label: string;
  score: number;
  tone: 'good' | 'watch' | 'risk';
}

export interface BreadboardLayoutQualityResult {
  band: 'fragile' | 'developing' | 'solid' | 'dialed_in';
  headline: string;
  label: string;
  metrics: BreadboardLayoutQualityMetric[];
  risks: string[];
  score: number;
  strengths: string[];
  summary: string;
}

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function metricTone(score: number): BreadboardLayoutQualityMetric['tone'] {
  if (score >= 85) {
    return 'good';
  }
  if (score >= 65) {
    return 'watch';
  }
  return 'risk';
}

function bandLabel(band: BreadboardLayoutQualityResult['band']): string {
  switch (band) {
    case 'dialed_in':
      return 'Dialed in';
    case 'solid':
      return 'Solid';
    case 'developing':
      return 'Developing';
    case 'fragile':
    default:
      return 'Fragile';
  }
}

function getWeakestMetric(metrics: BreadboardLayoutQualityMetric[]): BreadboardLayoutQualityMetric {
  return metrics.reduce((lowest, metric) => (metric.score < lowest.score ? metric : lowest), metrics[0]);
}

export function calculateBreadboardLayoutQuality(
  input: BreadboardLayoutQualityInput,
): BreadboardLayoutQualityResult {
  const criticalHeuristicCount = input.model.pins.filter((pin) => pin.isCritical && pin.confidence === 'heuristic').length;
  const pinTrustBase =
    input.model.pinMapConfidence === 'exact'
      ? 96
      : input.model.pinMapConfidence === 'mixed'
        ? 80
        : 62;
  const modelQualityModifier =
    input.model.modelQuality === 'verified'
      ? 4
      : input.model.modelQuality === 'basic'
        ? 2
        : input.model.modelQuality === 'community'
          ? 0
          : -4;
  const pinTrustScore = clampScore(pinTrustBase + modelQualityModifier - criticalHeuristicCount * 10, 24);

  const totalRailMoves = input.expectedHookupCount + input.expectedBridgeCount;
  const completedRailMoves = input.stagedHookupCount + input.stagedBridgeCount;
  const railScore = totalRailMoves === 0
    ? 100
    : clampScore(
        Math.round((completedRailMoves / totalRailMoves) * 100)
          + (input.stagedHookupCount === input.expectedHookupCount && input.expectedHookupCount > 0 ? 6 : 0)
          + (input.stagedBridgeCount === input.expectedBridgeCount && input.expectedBridgeCount > 0 ? 4 : 0),
        20,
      );

  const supportScore = input.expectedSupportCount === 0
    ? 100
    : clampScore(
        Math.round((input.stagedSupportCount / input.expectedSupportCount) * 100)
          + (input.stagedSupportCount === input.expectedSupportCount ? 6 : 0),
        18,
      );

  const probeBase = 100 - input.nearbyForeignPartCount * 18 - input.nearbyWireCount * 7;
  const probeFitModifier =
    input.model.fit === 'native'
      ? 4
      : input.model.fit === 'requires_jumpers'
        ? -2
        : input.model.fit === 'breakout_required'
          ? -8
          : -12;
  const probeSpaceScore = clampScore(probeBase + probeFitModifier, 20);

  const stashModifier = input.model.readyNow ? 3 : -5;
  const score = clampScore(
    Math.round(
      pinTrustScore * 0.32
      + railScore * 0.3
      + supportScore * 0.22
      + probeSpaceScore * 0.16
      + stashModifier,
    ),
  );

  const band: BreadboardLayoutQualityResult['band'] =
    score >= 85 ? 'dialed_in' : score >= 68 ? 'solid' : score >= 48 ? 'developing' : 'fragile';

  const metrics: BreadboardLayoutQualityMetric[] = [
    {
      id: 'pin-trust',
      label: 'Pin trust',
      score: pinTrustScore,
      tone: metricTone(pinTrustScore),
      detail:
        criticalHeuristicCount > 0
          ? `${String(criticalHeuristicCount)} critical pin${criticalHeuristicCount === 1 ? '' : 's'} still rely on heuristics.`
          : input.model.pinMapConfidence === 'exact'
            ? 'Connector-defined anchors are driving the pin map.'
            : 'The current pin map is usable, but still needs caution.',
    },
    {
      id: 'rail-readiness',
      label: 'Rail readiness',
      score: railScore,
      tone: metricTone(railScore),
      detail:
        totalRailMoves === 0
          ? 'This part does not currently need a dedicated rail plan.'
          : `${String(completedRailMoves)} of ${String(totalRailMoves)} coach rail moves are already staged.`,
    },
    {
      id: 'support-coverage',
      label: 'Support coverage',
      score: supportScore,
      tone: metricTone(supportScore),
      detail:
        input.expectedSupportCount === 0
          ? 'No extra support parts are recommended for this part.'
          : `${String(input.stagedSupportCount)} of ${String(input.expectedSupportCount)} support parts are already nearby.`,
    },
    {
      id: 'probe-space',
      label: 'Probe space',
      score: probeSpaceScore,
      tone: metricTone(probeSpaceScore),
      detail: `${String(input.nearbyForeignPartCount)} nearby foreign parts and ${String(input.nearbyWireCount)} nearby wires are crowding this zone.`,
    },
  ];

  const strengths: string[] = [];
  const risks: string[] = [];

  if (railScore >= 85 && totalRailMoves > 0) {
    strengths.push('Power and ground have a staged path that should stay easy to read on the bench.');
  }
  if (supportScore >= 85 && input.expectedSupportCount > 0) {
    strengths.push('Support parts are already sitting close to the critical pins they protect.');
  }
  if (pinTrustScore >= 85) {
    strengths.push('Pin anchors are trustworthy enough for confident bench moves without constant re-checking.');
  }
  if (probeSpaceScore >= 78) {
    strengths.push('There is still enough breathing room for clip leads, probes, and last-minute jumper fixes.');
  }
  if (input.model.readyNow) {
    strengths.push('The stash is build-ready, so this bench plan is anchored in real available parts.');
  }

  if (pinTrustScore < 70) {
    risks.push(
      criticalHeuristicCount > 0
        ? 'Critical pins still depend on heuristic anchors, so power-up mistakes are easier to make.'
        : 'Pin trust is still soft enough that the layout deserves a datasheet cross-check before power-up.',
    );
  }
  if (railScore < 70 && totalRailMoves > 0) {
    risks.push('The rail story is still incomplete, which makes the board harder to debug and easier to misread.');
  }
  if (supportScore < 70 && input.expectedSupportCount > 0) {
    risks.push('Recommended support parts are not fully staged yet, so the bench setup is still electrically fragile.');
  }
  if (probeSpaceScore < 70) {
    risks.push('This part is getting crowded enough that probing and rework will start feeling clumsy.');
  }
  if (!input.model.readyNow) {
    risks.push('The stash is still short, so the final bench build cannot be trusted as a real-world path yet.');
  }

  const weakestMetric = getWeakestMetric(metrics);
  const summary =
    band === 'dialed_in'
      ? 'This part sits in a deliberate, debug-friendly bench zone with the boring essentials already handled.'
      : band === 'solid'
        ? `This layout is healthy enough to keep building on, but ${weakestMetric.label.toLowerCase()} is still the main place to tighten it up.`
        : band === 'developing'
          ? `This layout works, but ${weakestMetric.label.toLowerCase()} is still keeping it from feeling calm and trustworthy.`
          : `This bench zone is still fragile. ${weakestMetric.label} is the first thing to stabilize before adding more wiring.`;

  const headline =
    band === 'dialed_in'
      ? 'Bench layout is behaving like a deliberate setup.'
      : band === 'solid'
        ? 'Bench layout is stable, with a few cleanup opportunities left.'
        : band === 'developing'
          ? 'Bench layout is workable, but still fragile in the wrong places.'
          : 'Bench layout needs cleanup before it feels trustworthy.';

  return {
    band,
    headline,
    label: bandLabel(band),
    metrics,
    risks: risks.slice(0, 3),
    score,
    strengths: strengths.slice(0, 3),
    summary,
  };
}
