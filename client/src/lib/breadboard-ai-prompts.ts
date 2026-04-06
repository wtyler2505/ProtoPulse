import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import { buildBreadboardInventoryDigest } from '@/lib/breadboard-bench';

export type BreadboardChatActionId =
  | 'explain_breadboard'
  | 'diagnose_wiring'
  | 'suggest_substitutes';

export type BreadboardPlannerActionId =
  | 'build_from_stash'
  | 'plan_cleaner_layout'
  | 'reconcile_inventory';

export type BreadboardSelectionActionId =
  | 'explain_selected_part'
  | 'audit_selected_pinout'
  | 'plan_layout_around_selected_part';

interface BreadboardPromptContext {
  projectName: string;
  insights: BreadboardBenchInsight[];
}

interface BreadboardSelectionPromptContext {
  authoritativeWiringAllowed: boolean;
  benchLayoutHeadline: string;
  benchLayoutLabel: string;
  benchLayoutRisks: string[];
  benchLayoutScore: number;
  benchLayoutStrengths: string[];
  benchLayoutSummary: string;
  coachCautions: string[];
  coachNextMoves: string[];
  coachPlanSteps: string[];
  exactPinCount: number;
  heuristicPinCount: number;
  orientationSummary: string;
  projectName: string;
  partTitle: string;
  refDes: string;
  fit: string;
  pinMapConfidence: 'exact' | 'mixed' | 'heuristic';
  railStrategy: string;
  requiresVerification: boolean;
  modelQuality: string;
  stashSummary: string;
  trustSummary: string;
  verificationLevel: string;
  verificationStatus: string;
  pins: Array<{
    label: string;
    coordLabel: string;
    description?: string | null;
    confidence: 'exact' | 'heuristic';
  }>;
  // Verified board intelligence (optional — only present for verified board pack matches)
  verifiedBoard?: boolean;
  boardWarnings?: string[];
  bootPinWarnings?: string[];
  adcWifiConflict?: boolean;
  adcWifiConflictPinIds?: string[];
}

function buildSharedContext({ projectName, insights }: BreadboardPromptContext): string {
  const inventoryDigest = buildBreadboardInventoryDigest(insights);
  return [
    `Project: ${projectName}`,
    'This request is coming from ProtoPulse Breadboard Lab.',
    'Prioritize real breadboard ergonomics: 0.1-inch friendly fit, clean jumper routing, minimal crossings, easy-to-follow placement, and beginner-safe explanations.',
    'Call out parts that need jumpers, breakouts, or should stay off a breadboard.',
    'Prefer using parts already owned when possible, and say when a missing part or better substitute is needed.',
    inventoryDigest,
  ].join('\n');
}

export function buildBreadboardChatPrompt(
  actionId: BreadboardChatActionId,
  context: BreadboardPromptContext,
): string {
  const shared = buildSharedContext(context);

  switch (actionId) {
    case 'diagnose_wiring':
      return `${shared}\n\nDiagnose the current breadboard setup like an embedded electronics coach. Look for likely polarity mistakes, floating inputs, rail misuse, missing resistors, suspicious jumper choices, or parts that are physically awkward for a breadboard. Explain the most likely problems in plain language and give the shortest repair plan first.`;
    case 'suggest_substitutes':
      return `${shared}\n\nSuggest breadboard-friendly substitutes from the owned inventory first. For each substitution, explain the tradeoff, whether the pinout changes, and whether the substitute is still beginner-safe to wire on a breadboard.`;
    case 'explain_breadboard':
    default:
      return `${shared}\n\nExplain the current Breadboard Lab setup in plain English for a maker. Focus on what each major part is doing, why it is placed the way it is, which rails and rows matter, and what the next wiring steps should be.`;
  }
}

export function buildBreadboardPlannerPrompt(
  actionId: BreadboardPlannerActionId,
  context: BreadboardPromptContext,
): string {
  const shared = buildSharedContext(context);
  const geminiErFraming =
    'Use embedded-reasoning style planning: think spatially about the physical bench, group related parts, reduce wire crossings, and produce a build plan that could be followed on a real breadboard.';

  switch (actionId) {
    case 'reconcile_inventory':
      return `${shared}\n\n${geminiErFraming}\n\nAudit the current owned stash for this breadboard project. Normalize likely duplicate parts, suggest missing quantities to reach a build-ready state, recommend better storage labels or bins for fast bench retrieval, and identify the smallest shopping gap. Keep the advice practical for a real maker bench, not an abstract BOM spreadsheet.`;
    case 'plan_cleaner_layout':
      return `${shared}\n\n${geminiErFraming}\n\nCreate a cleaner breadboard layout plan for this project. Recommend better physical grouping, rail usage, and jumper routing. Prefer layouts that are easy to inspect, teach from, and debug in the real world.`;
    case 'build_from_stash':
    default:
      return `${shared}\n\n${geminiErFraming}\n\nPlan a breadboard implementation using only the owned stash where possible. Be strict about real breadboard fit, point out where a breakout is required, and suggest the smallest shopping gap if the current stash is not enough.`;
  }
}

export function buildBreadboardSelectionPrompt(
  actionId: BreadboardSelectionActionId,
  context: BreadboardSelectionPromptContext,
): string {
  const pinDigest = context.pins
    .slice(0, 20)
    .map((pin) => `- ${pin.label} -> ${pin.coordLabel} (${pin.confidence}${pin.description ? `; ${pin.description}` : ''})`)
    .join('\n');

  const lines = [
    `Project: ${context.projectName}`,
    'This request is coming from ProtoPulse Breadboard Lab.',
    `Selected part: ${context.partTitle} (${context.refDes})`,
    `Breadboard fit: ${context.fit}`,
    `Pin-map confidence: ${context.pinMapConfidence}`,
    `Exact pins: ${String(context.exactPinCount)}`,
    `Heuristic pins: ${String(context.heuristicPinCount)}`,
    `Model quality: ${context.modelQuality}`,
    `Verification status: ${context.verificationStatus}`,
    `Verification level: ${context.verificationLevel}`,
    `Authoritative wiring allowed: ${context.authoritativeWiringAllowed ? 'yes' : 'no'}`,
    `Stash status: ${context.stashSummary}`,
    `Orientation guidance: ${context.orientationSummary}`,
    `Rail strategy: ${context.railStrategy}`,
    `Trust summary: ${context.trustSummary}`,
    `Bench layout quality: ${context.benchLayoutLabel} (${String(context.benchLayoutScore)}/100)`,
    `Bench layout summary: ${context.benchLayoutHeadline} ${context.benchLayoutSummary}`,
    `Bench layout strengths: ${context.benchLayoutStrengths.join(' | ') || 'None captured yet'}`,
    `Bench layout risks: ${context.benchLayoutRisks.join(' | ') || 'None captured yet'}`,
    `Bench plan: ${context.coachPlanSteps.join(' | ') || 'No staged plan captured yet'}`,
    `Bench next moves: ${context.coachNextMoves.join(' | ') || 'None captured yet'}`,
    `Bench cautions: ${context.coachCautions.join(' | ') || 'None captured yet'}`,
    'Current pin map:',
    pinDigest,
  ];

  // Inject verified board intelligence when available
  if (context.verifiedBoard) {
    lines.push('');
    lines.push('VERIFIED BOARD INTELLIGENCE (from ProtoPulse Board Pack):');
    if (context.boardWarnings && context.boardWarnings.length > 0) {
      lines.push(`Board safety warnings: ${context.boardWarnings.join(' | ')}`);
    }
    if (context.bootPinWarnings && context.bootPinWarnings.length > 0) {
      lines.push(`Boot/strapping pin rules: ${context.bootPinWarnings.join(' | ')}`);
    }
    if (context.adcWifiConflict && context.adcWifiConflictPinIds && context.adcWifiConflictPinIds.length > 0) {
      lines.push(`ADC2 WiFi conflict: YES — pins ${context.adcWifiConflictPinIds.join(', ')} are UNAVAILABLE when WiFi is active. Use ADC1 channels instead.`);
    }
    lines.push('These warnings come from verified datasheet research. Treat them as authoritative safety guidance.');
  }

  const shared = lines.join('\n');

  switch (actionId) {
    case 'audit_selected_pinout':
      return `${shared}\n\nAudit this selected part like a bench engineer. Focus on whether the current pin map is believable, which pins deserve extra caution, what the most mistake-prone connections will be on a real breadboard, and how a beginner should verify the pinout before powering anything.`;
    case 'plan_layout_around_selected_part':
      return `${shared}\n\nUse embedded-reasoning style planning: think spatially about the real bench, keep jumper runs short, reduce crossings, and plan the surrounding layout around this selected part first. Recommend where power, supporting passives, and I/O neighbors should sit relative to the selected part.${context.authoritativeWiringAllowed ? '' : ' This exact board/module is still a candidate, so do not present hookup steps as authoritative. Call out assumptions, keep the guidance provisional, and tell the user verification is required before exact wiring or power-up.'}`;
    case 'explain_selected_part':
    default:
      return `${shared}\n\nExplain this selected part in plain language for a maker. Tell the user what the part does, how to orient it on the breadboard, what the important pins are, and the safest next wiring moves from this exact starting point.${context.requiresVerification ? ' Be explicit about whether the current exact-part model is verified enough for authoritative wiring.' : ''}`;
  }
}
