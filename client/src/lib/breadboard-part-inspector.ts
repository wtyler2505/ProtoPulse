import { resolveHolePositions, type LegComponentType } from '@/lib/circuit-editor/bendable-legs';
import { pixelToCoord, type BreadboardCoord, type PixelPos } from '@/lib/circuit-editor/breadboard-model';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import {
  canUseAuthoritativeWiring,
  getVerificationLevel,
  getVerificationStatus,
  requiresVerifiedExactness,
  summarizePartTrust,
  type PartVerificationLevel,
  type PartVerificationStatus,
} from '@shared/component-trust';
import type { Connector, PartMeta } from '@shared/component-types';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import { findVerifiedBoardByAlias } from '@shared/verified-boards';
import type { VerifiedBoardDefinition, VerifiedPin as VBPin } from '@shared/verified-boards';

export type BreadboardPinMapConfidence = 'exact' | 'mixed' | 'heuristic';
export type BreadboardPinRole =
  | 'power'
  | 'ground'
  | 'clock'
  | 'control'
  | 'communication'
  | 'analog'
  | 'passive'
  | 'signal';

export interface BreadboardBenchCoach {
  headline: string;
  orientationSummary: string;
  railStrategy: string;
  supportParts: string[];
  cautions: string[];
  nextMoves: string[];
}

export interface BreadboardPinMapEntry {
  id: string;
  label: string;
  description: string | null;
  coord: BreadboardCoord | null;
  coordLabel: string;
  pixel: PixelPos;
  confidence: 'exact' | 'heuristic';
  source: 'connector' | 'layout';
  side: 'left' | 'right' | 'center' | 'rail';
  role: BreadboardPinRole;
  isCritical: boolean;
  /** Verified board pin warnings (e.g. 'Strapping pin', 'Input only'). */
  verifiedWarnings?: string[];
  /** Whether the verified board marks this pin as restricted (e.g. flash-connected). */
  verifiedRestricted?: boolean;
  /** Human-readable reason for restriction. */
  verifiedRestrictionReason?: string;
}

export interface BreadboardSelectedPartModel {
  authoritativeWiringAllowed: boolean;
  instanceId: number;
  refDes: string;
  title: string;
  family: string;
  type: string;
  manufacturer: string | null;
  mpn: string | null;
  pinCount: number;
  partFamily: string;
  fit: BreadboardBenchInsight['fit'] | 'native';
  modelQuality: BreadboardBenchInsight['modelQuality'] | 'ai_drafted';
  storageLocation: string | null;
  ownedQuantity: number;
  requiredQuantity: number;
  missingQuantity: number;
  readyNow: boolean;
  starterFriendly: boolean;
  pinMapConfidence: BreadboardPinMapConfidence;
  exactPinCount: number;
  heuristicPinCount: number;
  criticalPinCount: number;
  requiresVerification: boolean;
  roleCounts: Record<BreadboardPinRole, number>;
  pinTrustSummary: string;
  fitSummary: string;
  inventorySummary: string;
  trustSummary: string;
  verificationLevel: PartVerificationLevel;
  verificationStatus: PartVerificationStatus;
  coach: BreadboardBenchCoach;
  pins: BreadboardPinMapEntry[];

  // --- Verified board intelligence (populated when a verified board pack match is found) ---
  /** Whether this part matched a verified board definition in the board pack. */
  verifiedBoard?: boolean;
  /** Board-level safety warnings from the verified board definition. */
  boardWarnings?: string[];
  /** Boot/strapping pin design rules from the verified board definition. */
  bootPinWarnings?: string[];
  /** Whether any pin on this board has an ADC2 WiFi conflict note. */
  adcWifiConflict?: boolean;
  /** Pin IDs on ADC2 channels that conflict with WiFi. */
  adcWifiConflictPinIds?: string[];
}

type LoosePartMeta = Partial<PartMeta> & Record<string, unknown>;
type CoachContext = {
  family: string;
  fit: BreadboardSelectedPartModel['fit'];
  insight?: BreadboardBenchInsight;
  modelQuality: BreadboardSelectedPartModel['modelQuality'];
  pinCount: number;
  pinMapConfidence: BreadboardPinMapConfidence;
  roleCounts: Record<BreadboardPinRole, number>;
  type: string;
};

const EMPTY_ROLE_COUNTS: Record<BreadboardPinRole, number> = {
  power: 0,
  ground: 0,
  clock: 0,
  control: 0,
  communication: 0,
  analog: 0,
  passive: 0,
  signal: 0,
};

// ---------------------------------------------------------------------------
// Verified board intelligence helpers
// ---------------------------------------------------------------------------

/** Index of verified board pins keyed by pin name (silkscreen label). */
type VerifiedPinIndex = Map<string, VBPin>;

const ADC2_WIFI_PATTERN = /\bunavailable when wifi\b/i;

/**
 * Attempt to match a part's meta against the verified board pack.
 * Returns the board definition if the part is verified and belongs to a
 * board-module or driver family, otherwise undefined.
 */
function resolveVerifiedBoard(meta: LoosePartMeta): VerifiedBoardDefinition | undefined {
  const status = typeof meta.verificationStatus === 'string' ? meta.verificationStatus : '';
  const partFamily = typeof meta.partFamily === 'string' ? meta.partFamily : '';
  if (status !== 'verified') {
    return undefined;
  }
  if (partFamily !== 'board-module' && partFamily !== 'driver') {
    return undefined;
  }
  const mpn = typeof meta.mpn === 'string' ? meta.mpn : '';
  const title = typeof meta.title === 'string' ? meta.title : '';
  return findVerifiedBoardByAlias(mpn) ?? findVerifiedBoardByAlias(title) ?? undefined;
}

/** Build a name-keyed index from a verified board's pin array. */
function buildVerifiedPinIndex(board: VerifiedBoardDefinition): VerifiedPinIndex {
  const index: VerifiedPinIndex = new Map();
  for (const pin of board.pins) {
    // Index by pin name (silkscreen) and pin id for broad matching
    index.set(pin.name.toLowerCase(), pin);
    index.set(pin.id.toLowerCase(), pin);
  }
  return index;
}

/** Look up a verified pin that corresponds to a connector label. */
function matchVerifiedPin(
  connector: Connector,
  index: VerifiedPinIndex,
): VBPin | undefined {
  const name = (connector.name ?? '').toLowerCase().trim();
  if (name.length === 0) {
    return undefined;
  }
  return index.get(name);
}

/** Collect ADC2 WiFi conflict pin IDs from a verified board definition. */
function collectAdcWifiConflictPinIds(board: VerifiedBoardDefinition): string[] {
  const ids: string[] = [];
  for (const pin of board.pins) {
    for (const fn of pin.functions) {
      if (fn.notes && ADC2_WIFI_PATTERN.test(fn.notes)) {
        ids.push(pin.id);
        break;
      }
    }
  }
  return ids;
}

/** Collect boot pin design rules as human-readable warnings. */
function collectBootPinWarnings(board: VerifiedBoardDefinition): string[] {
  if (!board.bootPins || board.bootPins.length === 0) {
    return [];
  }
  return board.bootPins.map((bp) => {
    const pin = board.pins.find((p) => p.id === bp.pinId);
    const pinLabel = pin ? pin.name : bp.pinId;
    return `${pinLabel} (${bp.pinId}): ${bp.designRule}`;
  });
}

/** Build the optional verified board intelligence fields for the part model. */
function buildVerifiedBoardFields(board: VerifiedBoardDefinition): Pick<
  BreadboardSelectedPartModel,
  'verifiedBoard' | 'boardWarnings' | 'bootPinWarnings' | 'adcWifiConflict' | 'adcWifiConflictPinIds'
> {
  const adcWifiConflictPinIds = collectAdcWifiConflictPinIds(board);
  return {
    verifiedBoard: true,
    boardWarnings: [...board.warnings],
    bootPinWarnings: collectBootPinWarnings(board),
    adcWifiConflict: adcWifiConflictPinIds.length > 0,
    adcWifiConflictPinIds,
  };
}

function normalizePartMeta(part?: ComponentPart): LoosePartMeta {
  return (part?.meta as LoosePartMeta | null) ?? {};
}

function inferComponentType(instance: CircuitInstanceRow, part?: ComponentPart): string {
  const meta = normalizePartMeta(part);
  const properties = (instance.properties as Record<string, unknown> | null) ?? null;
  const typeCandidate = meta.type ?? meta.family ?? properties?.type;
  return typeof typeCandidate === 'string' && typeCandidate.trim().length > 0 ? typeCandidate : 'generic';
}

function inferLegComponentType(type: string): LegComponentType {
  const lower = type.toLowerCase();
  if (lower === 'resistor' || lower === 'res' || lower === 'r') {
    return 'resistor';
  }
  if (lower === 'capacitor' || lower === 'cap' || lower === 'c') {
    return 'capacitor';
  }
  if (lower === 'led') {
    return 'led';
  }
  if (lower === 'diode' || lower === 'd') {
    return 'diode';
  }
  if (lower === 'transistor' || lower === 'bjt' || lower === 'mosfet' || lower === 'q') {
    return 'transistor';
  }
  if (lower === 'ic' || lower === 'mcu' || lower === 'microcontroller') {
    return 'ic';
  }
  return 'generic';
}

function inferPinCount(instance: CircuitInstanceRow, part?: ComponentPart): number {
  const connectors = ((part?.connectors ?? []) as Connector[]).length;
  if (connectors > 0) {
    return connectors;
  }
  return inferLegComponentType(inferComponentType(instance, part)) === 'ic' ? 8 : 2;
}

function formatCoordLabel(coord: BreadboardCoord | null): string {
  if (!coord) {
    return 'Unmapped';
  }
  if (coord.type === 'terminal') {
    return `${coord.col}${String(coord.row)}`;
  }
  const railName = coord.rail.replace('_', ' ');
  return `${railName} ${String(coord.index + 1)}`;
}

function getCoordSide(coord: BreadboardCoord | null): BreadboardPinMapEntry['side'] {
  if (!coord) {
    return 'center';
  }
  if (coord.type === 'rail') {
    return 'rail';
  }
  if (['a', 'b', 'c', 'd', 'e'].includes(coord.col)) {
    return 'left';
  }
  if (['f', 'g', 'h', 'i', 'j'].includes(coord.col)) {
    return 'right';
  }
  return 'center';
}

function buildSyntheticConnectors(pinCount: number): Connector[] {
  return Array.from({ length: pinCount }, (_, index) => ({
    id: `pin-${String(index + 1)}`,
    name: `Pin ${String(index + 1)}`,
    connectorType: 'pad',
    shapeIds: {},
    terminalPositions: {},
  }));
}

function buildPinTrustSummary(confidence: BreadboardPinMapConfidence): string {
  switch (confidence) {
    case 'exact':
      return 'Connector-defined bench coordinates are available for this part, so the pin map is trustworthy enough for pin-accurate layout work.';
    case 'mixed':
      return 'Some pins come from the part definition, but the rest still fall back to bench heuristics. Double-check before treating the whole layout as exact.';
    case 'heuristic':
    default:
      return 'This pin map is still heuristic. ProtoPulse is inferring breadboard hole positions from package shape and placement, so treat it as planning guidance until the part gets a verified bench model.';
  }
}

function buildFitSummary(fit: BreadboardSelectedPartModel['fit']): string {
  switch (fit) {
    case 'native':
      return 'This part is a natural breadboard fit and can be placed directly with very little ceremony.';
    case 'requires_jumpers':
      return 'This part works well on a breadboard, but it usually wants more deliberate jumper routing and bench space.';
    case 'breakout_required':
      return 'This part should ride on a breakout or carrier first instead of dropping straight onto the breadboard.';
    case 'not_breadboard_friendly':
      return 'This part is bench-hostile in its current package and should stay off the breadboard unless you adapt it first.';
    default:
      return 'ProtoPulse has not classified the bench fit for this part yet.';
  }
}

function buildInventorySummary(
  insight: BreadboardBenchInsight | undefined,
  title: string,
): string {
  if (!insight) {
    return `${title} is not tracked in the project stash yet.`;
  }
  if (insight.readyNow) {
    const storage = insight.storageLocation ? ` in ${insight.storageLocation}` : '';
    return `You have ${String(insight.ownedQuantity)} on hand${storage}, so this part is build-ready right now.`;
  }
  if (insight.ownedQuantity > 0) {
    return `You have ${String(insight.ownedQuantity)} on hand, but this build still needs ${String(insight.missingQuantity)} more to be ready.`;
  }
  return `This build is missing ${String(insight.missingQuantity || insight.requiredQuantity)} ${title} part${insight.requiredQuantity === 1 ? '' : 's'} from the current stash.`;
}

function matchesRolePattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyPinRole(
  connector: Connector,
  family: string,
): BreadboardPinRole {
  const lowerFamily = family.toLowerCase();
  const text = `${connector.name ?? ''} ${connector.description ?? ''}`.toLowerCase();

  if (lowerFamily === 'resistor' || lowerFamily === 'capacitor' || lowerFamily === 'inductor') {
    return 'passive';
  }

  if (
    matchesRolePattern(text, [
      /\bgnd\b/,
      /\bground\b/,
      /\bvss\b/,
      /\bagnd\b/,
      /\bpgnd\b/,
      /\bcathode\b/,
    ])
  ) {
    return 'ground';
  }

  if (
    matchesRolePattern(text, [
      /\bvcc\b/,
      /\bvdd\b/,
      /\bvin\b/,
      /\bvbat\b/,
      /\b5v\b/,
      /\b3v3\b/,
      /\b3\.3v\b/,
      /\bavcc\b/,
      /\bvref\b/,
      /\banode\b/,
    ])
  ) {
    return 'power';
  }

  if (matchesRolePattern(text, [/\brst\b/, /\breset\b/, /\ben\b/, /\benable\b/, /\bboot\b/, /\bcs\b/, /\bce\b/])) {
    return 'control';
  }

  if (matchesRolePattern(text, [/\bxtal\b/, /\bosc\b/, /\bclk\b/, /\bclock\b/])) {
    return 'clock';
  }

  if (
    matchesRolePattern(text, [
      /\bsda\b/,
      /\bscl\b/,
      /\bmiso\b/,
      /\bmosi\b/,
      /\bsck\b/,
      /\btx\b/,
      /\brx\b/,
      /\buart\b/,
      /\bspi\b/,
      /\bi2c\b/,
      /\bcan\b/,
    ])
  ) {
    return 'communication';
  }

  if (matchesRolePattern(text, [/\banalog\b/, /\badc\b/, /\ba\d+\b/])) {
    return 'analog';
  }

  if (lowerFamily === 'led' || lowerFamily === 'diode') {
    return 'signal';
  }

  return 'signal';
}

function isCriticalRole(role: BreadboardPinRole): boolean {
  return role === 'power' || role === 'ground' || role === 'clock' || role === 'control';
}

function buildCoachHeadline(type: string, family: string): string {
  const lowerType = type.toLowerCase();
  const lowerFamily = family.toLowerCase();

  if (lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || lowerFamily === 'mcu') {
    return 'Straddle the trench, then make power boring before you touch signal pins.';
  }

  if (lowerType === 'led' || lowerType === 'diode' || lowerFamily === 'led') {
    return 'Polarity first, current limiting second, then route the signal.';
  }

  if (lowerType === 'transistor') {
    return 'Leg order matters more than body position on transistor parts.';
  }

  if (lowerFamily === 'sensor' || lowerFamily === 'comm' || lowerFamily === 'display') {
    return 'Leave breathing room around modules so rails and buses stay readable.';
  }

  return 'Anchor the part first, then let the rest of the bench route around it.';
}

function buildOrientationSummary(type: string, family: string, pinCount: number): string {
  const lowerType = type.toLowerCase();
  const lowerFamily = family.toLowerCase();

  if (lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || lowerFamily === 'mcu') {
    return `This ${String(pinCount)}-pin package wants to straddle the center trench so both pin banks land on separate row fields. Keep the pin-1 edge consistent before wiring anything else.`;
  }

  if (lowerType === 'led' || lowerType === 'diode' || lowerFamily === 'led') {
    return 'Keep the polarity marker obvious on the board so the current path can be read without squinting. Give the resistor its own straight shot in the same lane.';
  }

  if (lowerType === 'transistor') {
    return 'Keep the flat face or body marking oriented deliberately and verify emitter/base/collector or source/gate/drain order before you energize the row.';
  }

  if (lowerType === 'capacitor') {
    return 'If this is polarized, point the marked negative lead toward the intended low side and keep the body clear of neighboring jumper runs.';
  }

  return 'Place the body so its leads or pins leave at least one clean routing lane for follow-on jumpers and supporting parts.';
}

function buildRailStrategy({ family, roleCounts, type }: CoachContext): string {
  const lowerType = type.toLowerCase();
  const lowerFamily = family.toLowerCase();

  if (roleCounts.power > 0 || roleCounts.ground > 0) {
    return 'Reserve a clean rail pair for power first, then bridge into the identified power and ground pins with the shortest jumpers you can get away with.';
  }

  if (lowerType === 'led' || lowerType === 'diode' || lowerFamily === 'led') {
    return 'Keep the low side pointed toward your ground rail and place the current-limiting part inline so the polarity story stays obvious.';
  }

  if (lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || lowerFamily === 'mcu') {
    return 'Dedicate one side lane to power distribution and the opposite side to logic runs so later debug jumpers do not have to cross the package.';
  }

  if (lowerFamily === 'sensor' || lowerFamily === 'comm' || lowerFamily === 'display') {
    return 'Park modules near the rail edge and let bus wires fan outward instead of forcing them through the densest part of the board.';
  }

  return 'Leave one clean side lane for shared power and keep the opposite side open for signal routing and clip-on debug probes.';
}

function buildSupportParts({ family, roleCounts, type }: CoachContext): string[] {
  const lowerType = type.toLowerCase();
  const lowerFamily = family.toLowerCase();
  const supportParts = new Set<string>();

  if (lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || lowerFamily === 'mcu') {
    supportParts.add('100 nF decoupling capacitor');
    if (roleCounts.control > 0) {
      supportParts.add('10 kΩ pull resistor for reset or enable lines');
    }
  }

  if (lowerType === 'led' || lowerType === 'diode' || lowerFamily === 'led') {
    supportParts.add('220 Ω to 1 kΩ series resistor');
  }

  if (lowerType === 'transistor') {
    supportParts.add('Gate or base resistor');
    supportParts.add('Flyback diode if the load is inductive');
  }

  if (lowerFamily === 'sensor' || lowerFamily === 'comm' || lowerFamily === 'display') {
    supportParts.add('Short female-female jumper set');
  }

  return Array.from(supportParts);
}

function buildCoachCautions(context: CoachContext): string[] {
  const cautions: string[] = [];
  const lowerType = context.type.toLowerCase();
  const icLike =
    lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || context.family.toLowerCase() === 'mcu';

  if (context.pinMapConfidence !== 'exact') {
    cautions.push('Some pin locations are still inferred from layout heuristics. Confirm the real datasheet pinout before you trust every anchor.');
  }

  if (context.fit === 'breakout_required') {
    cautions.push('This package should ride on a breakout or carrier before it earns a place on the breadboard.');
  } else if (context.fit === 'not_breadboard_friendly') {
    cautions.push('This package is bench-hostile as-is. Treat Breadboard Lab as planning guidance until you adapt the hardware.');
  }

  if (context.modelQuality === 'ai_drafted') {
    cautions.push('The current bench model is still draft quality, so body art and pin spacing may look better than they deserve.');
  }

  if (context.insight && !context.insight.readyNow) {
    cautions.push(`The current stash is still short by ${String(context.insight.missingQuantity)} part${context.insight.missingQuantity === 1 ? '' : 's'} for this build.`);
  }

  if (icLike && context.roleCounts.power === 0 && context.roleCounts.ground === 0) {
    cautions.push('The part definition does not clearly identify power pins yet. Mark VCC and GND from the datasheet before touching the rails.');
  }

  return cautions.slice(0, 4);
}

function buildCoachNextMoves(context: CoachContext, supportParts: string[]): string[] {
  const nextMoves: string[] = [];
  const lowerType = context.type.toLowerCase();
  const icLike =
    lowerType === 'mcu' || lowerType === 'microcontroller' || lowerType === 'ic' || context.family.toLowerCase() === 'mcu';

  if (context.fit === 'breakout_required') {
    nextMoves.push('Mount or choose a breakout first, then return to the breadboard for wiring.');
  } else if (icLike) {
    nextMoves.push('Seat the package across the center trench and lock the pin-1 corner before routing.');
  } else {
    nextMoves.push('Place the part so at least one side lane stays open for clean jumper access.');
  }

  if (context.roleCounts.power > 0 || context.roleCounts.ground > 0) {
    nextMoves.push('Wire the power and ground pins first so every later connection has a stable reference.');
  } else {
    nextMoves.push('Tag the real power pins from the datasheet before committing any rail wiring.');
  }

  if (supportParts.length > 0) {
    nextMoves.push(`Stage ${supportParts[0]} next so the part can be wired in a bench-safe way.`);
  }

  if (context.insight && !context.insight.readyNow) {
    nextMoves.push('Use the stash manager to close the missing-parts gap before you wire the final version.');
  }

  return nextMoves.slice(0, 4);
}

function buildBenchCoach(context: CoachContext): BreadboardBenchCoach {
  const supportParts = buildSupportParts(context);
  return {
    headline: buildCoachHeadline(context.type, context.family),
    orientationSummary: buildOrientationSummary(context.type, context.family, context.pinCount),
    railStrategy: buildRailStrategy(context),
    supportParts,
    cautions: buildCoachCautions(context),
    nextMoves: buildCoachNextMoves(context, supportParts),
  };
}

function resolveExactPinPixel(
  connector: Connector,
  instance: CircuitInstanceRow,
): PixelPos | null {
  const terminal = connector.terminalPositions?.breadboard;
  if (!terminal || instance.breadboardX == null || instance.breadboardY == null) {
    return null;
  }
  return {
    x: instance.breadboardX + terminal.x,
    y: instance.breadboardY + terminal.y,
  };
}

export function buildBreadboardSelectedPartModel(
  instance: CircuitInstanceRow | null | undefined,
  part: ComponentPart | undefined,
  insight: BreadboardBenchInsight | undefined,
): BreadboardSelectedPartModel | null {
  if (!instance || instance.breadboardX == null || instance.breadboardY == null) {
    return null;
  }

  const anchorCoord = pixelToCoord({ x: instance.breadboardX, y: instance.breadboardY });
  if (!anchorCoord || anchorCoord.type !== 'terminal') {
    return null;
  }

  const meta = normalizePartMeta(part);
  const type = inferComponentType(instance, part);
  const legType = inferLegComponentType(type);
  const pinCount = inferPinCount(instance, part);
  const connectors = ((part?.connectors ?? []) as Connector[]).length > 0
    ? (part?.connectors as Connector[])
    : buildSyntheticConnectors(pinCount);
  const heuristicPixels = resolveHolePositions(anchorCoord.col, anchorCoord.row, legType, Math.max(pinCount, connectors.length));
  const family = meta.family ?? type;
  const trust = summarizePartTrust(meta);
  const verificationStatus = getVerificationStatus(meta);
  const verificationLevel = getVerificationLevel(meta);
  const requiresVerification = requiresVerifiedExactness(meta);

  // --- Verified board intelligence lookup ---
  const verifiedBoardDef = resolveVerifiedBoard(meta);
  const vbPinIndex = verifiedBoardDef
    ? buildVerifiedPinIndex(verifiedBoardDef)
    : undefined;

  let exactCount = 0;
  const pins = connectors.map((connector, index) => {
    const exactPixel = resolveExactPinPixel(connector, instance);
    const exactCoord = exactPixel ? pixelToCoord(exactPixel) : null;
    const fallbackPixel = heuristicPixels[index] ?? heuristicPixels.at(-1) ?? { x: instance.breadboardX!, y: instance.breadboardY! };
    const fallbackCoord = pixelToCoord(fallbackPixel);
    const useExactPin = exactCoord?.type === 'terminal';
    const pixel = useExactPin && exactPixel ? exactPixel : fallbackPixel;
    const coord = useExactPin ? exactCoord : fallbackCoord;
    const role = classifyPinRole(connector, family);
    if (useExactPin) {
      exactCount += 1;
    }
    // Annotate with verified board pin data when available
    const vbPin = vbPinIndex ? matchVerifiedPin(connector, vbPinIndex) : undefined;

    return {
      id: connector.id || `pin-${String(index + 1)}`,
      label: connector.name || `Pin ${String(index + 1)}`,
      description: connector.description ?? null,
      coord,
      coordLabel: formatCoordLabel(coord),
      pixel,
      confidence: useExactPin ? 'exact' : 'heuristic',
      source: useExactPin ? 'connector' : 'layout',
      side: getCoordSide(coord),
      role,
      isCritical: isCriticalRole(role),
      ...(vbPin?.warnings && vbPin.warnings.length > 0 ? { verifiedWarnings: vbPin.warnings } : {}),
      ...(vbPin?.restricted === true ? { verifiedRestricted: true } : {}),
      ...(vbPin?.restrictionReason ? { verifiedRestrictionReason: vbPin.restrictionReason } : {}),
    } satisfies BreadboardPinMapEntry;
  });

  const pinMapConfidence: BreadboardPinMapConfidence =
    exactCount === pins.length
      ? 'exact'
      : exactCount > 0
        ? 'mixed'
        : 'heuristic';
  const roleCounts = pins.reduce<Record<BreadboardPinRole, number>>((current, pin) => {
    current[pin.role] += 1;
    return current;
  }, { ...EMPTY_ROLE_COUNTS });
  const resolvedFit = insight?.fit ?? meta.breadboardFit ?? 'native';
  const resolvedModelQuality = insight?.modelQuality ?? meta.breadboardModelQuality ?? 'ai_drafted';
  const coach = buildBenchCoach({
    family,
    fit: resolvedFit,
    insight,
    modelQuality: resolvedModelQuality,
    pinCount: pins.length,
    pinMapConfidence,
    roleCounts,
    type,
  });
  const criticalPinCount = pins.filter((pin) => pin.isCritical).length;

  return {
    authoritativeWiringAllowed: canUseAuthoritativeWiring(meta),
    instanceId: instance.id,
    refDes: instance.referenceDesignator,
    title: meta.title ?? instance.referenceDesignator,
    family,
    type,
    manufacturer: meta.manufacturer ?? null,
    mpn: meta.mpn ?? null,
    pinCount: pins.length,
    partFamily: trust.family,
    fit: resolvedFit,
    modelQuality: resolvedModelQuality,
    storageLocation: insight?.storageLocation ?? meta.inventoryHint?.defaultStorageLocation ?? null,
    ownedQuantity: insight?.ownedQuantity ?? 0,
    requiredQuantity: insight?.requiredQuantity ?? 1,
    missingQuantity: insight?.missingQuantity ?? 1,
    readyNow: insight?.readyNow ?? false,
    starterFriendly: insight?.starterFriendly ?? true,
    pinMapConfidence,
    exactPinCount: exactCount,
    heuristicPinCount: pins.length - exactCount,
    criticalPinCount,
    requiresVerification,
    roleCounts,
    pinTrustSummary: buildPinTrustSummary(pinMapConfidence),
    fitSummary: buildFitSummary(resolvedFit),
    inventorySummary: buildInventorySummary(insight, meta.title ?? instance.referenceDesignator),
    trustSummary: trust.summary,
    verificationLevel,
    verificationStatus,
    coach: verifiedBoardDef
      ? {
          ...coach,
          cautions: [
            ...coach.cautions,
            ...verifiedBoardDef.warnings.slice(0, 2),
            ...(verifiedBoardDef.bootPins && verifiedBoardDef.bootPins.length > 0
              ? [`${String(verifiedBoardDef.bootPins.length)} strapping/boot pins affect power-on behavior — see Verified Board section below.`]
              : []),
          ].slice(0, 6),
        }
      : coach,
    pins,

    // Verified board intelligence (only present when a board pack match is found)
    ...(verifiedBoardDef ? buildVerifiedBoardFields(verifiedBoardDef) : {}),
  } satisfies BreadboardSelectedPartModel;
}
