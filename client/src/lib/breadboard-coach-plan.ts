import { type TiePoint, type ColumnLetter, type RailPoint, type RailId } from '@/lib/circuit-editor/breadboard-model';
import type { BreadboardPinMapEntry, BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

// ---------------------------------------------------------------------------
// Verified pin safety helpers
// ---------------------------------------------------------------------------

/** Check if a pin is safe for hookup (not restricted, not a strapping pin). */
function isPinSafeForHookup(pin: BreadboardPinMapEntry): boolean {
  if (pin.verifiedRestricted) {
    return false;
  }
  if (pin.verifiedWarnings?.some((w) => /strapping|boot/i.test(w))) {
    return false;
  }
  return true;
}

/**
 * Pick the safest pin from a list for a rail hookup.
 * Prefers non-restricted, non-strapping pins. Falls back to the first pin
 * if all candidates are problematic (better to hook up with a warning than
 * leave the part unconnected).
 */
function pickSafestHookupPin(pins: BreadboardPinMapEntry[]): BreadboardPinMapEntry | undefined {
  const safe = pins.find((pin) => isPinSafeForHookup(pin));
  return safe ?? pins[0];
}

/** Collect strapping pin IDs from a model's pin map. */
function getStrappingPinIds(model: BreadboardSelectedPartModel): string[] {
  return model.pins
    .filter((pin) => pin.verifiedWarnings?.some((w) => /strapping|boot/i.test(w)))
    .map((pin) => pin.id);
}

/** Collect restricted pin IDs from a model's pin map. */
function getRestrictedPinIds(model: BreadboardSelectedPartModel): string[] {
  return model.pins
    .filter((pin) => pin.verifiedRestricted)
    .map((pin) => pin.id);
}

export interface BreadboardCoachSuggestion {
  id: string;
  label: string;
  type: 'capacitor' | 'resistor';
  value: string;
  preferredColumns: ColumnLetter[];
  priority: 'critical' | 'recommended';
  reason: string;
  targetPinIds: string[];
  desiredAnchor: TiePoint;
}

export interface BreadboardCoachCorridorHint {
  id: string;
  label: string;
  rows: [number, number];
  side: 'left' | 'right';
  tone: 'power' | 'communication' | 'control' | 'analog';
}

export interface BreadboardCoachHookup {
  id: string;
  label: string;
  priority: 'critical' | 'recommended';
  reason: string;
  targetPinId: string;
  netName: string;
  netType: 'power' | 'ground';
  railPoint: RailPoint;
}

export interface BreadboardCoachRailBridge {
  id: string;
  label: string;
  priority: 'critical' | 'recommended';
  reason: string;
  netName: string;
  netType: 'power' | 'ground';
  fromRail: RailPoint;
  toRail: RailPoint;
}

export interface BreadboardCoachPlan {
  bridges: BreadboardCoachRailBridge[];
  headline: string;
  corridorHints: BreadboardCoachCorridorHint[];
  highlightedPinIds: string[];
  hookups: BreadboardCoachHookup[];
  suggestions: BreadboardCoachSuggestion[];
  /** Cautions from verified board intelligence (strapping pins, restricted pins, etc.). */
  verifiedBoardCautions: string[];
}

function clampRow(row: number, maxRow = 63): number {
  return Math.max(1, Math.min(maxRow, row));
}

function getTerminalPinsByRole(
  model: BreadboardSelectedPartModel,
  role: BreadboardPinMapEntry['role'],
): BreadboardPinMapEntry[] {
  return model.pins.filter((pin) => pin.role === role && pin.coord?.type === 'terminal');
}

function buildPreferredColumns(side: BreadboardPinMapEntry['side'], type: 'capacitor' | 'resistor'): ColumnLetter[] {
  if (side === 'right') {
    return type === 'capacitor' ? ['h', 'i', 'j'] : ['g', 'h', 'i'];
  }

  return type === 'capacitor' ? ['c', 'b', 'a'] : ['b', 'a', 'c'];
}

function buildDesiredAnchor(
  pin: BreadboardPinMapEntry,
  type: 'capacitor' | 'resistor',
): TiePoint | null {
  if (!pin.coord || pin.coord.type !== 'terminal') {
    return null;
  }

  return {
    type: 'terminal',
    col: buildPreferredColumns(pin.side, type)[0],
    row: clampRow(pin.coord.row, type === 'capacitor' ? 62 : 63),
  };
}

function buildCorridorHint(
  id: string,
  label: string,
  pins: BreadboardPinMapEntry[],
  tone: BreadboardCoachCorridorHint['tone'],
): BreadboardCoachCorridorHint | null {
  const terminalPins = pins.filter((pin) => pin.coord?.type === 'terminal');
  if (terminalPins.length === 0) {
    return null;
  }

  const rows = terminalPins
    .map((pin) => pin.coord)
    .filter((coord): coord is TiePoint => Boolean(coord && coord.type === 'terminal'))
    .map((coord) => coord.row);

  if (rows.length === 0) {
    return null;
  }

  const rightCount = terminalPins.filter((pin) => pin.side === 'right').length;
  const leftCount = terminalPins.length - rightCount;

  return {
    id,
    label,
    rows: [clampRow(Math.min(...rows) - 1), clampRow(Math.max(...rows) + 1)],
    side: rightCount > leftCount ? 'right' : 'left',
    tone,
  };
}

function buildRailHookup(pin: BreadboardPinMapEntry, netType: 'power' | 'ground'): BreadboardCoachHookup | null {
  if (!pin.coord || pin.coord.type !== 'terminal') {
    return null;
  }

  const prefersLeftRail = pin.side !== 'right';
  const rail: RailId =
    netType === 'power'
      ? prefersLeftRail ? 'top_pos' : 'bottom_pos'
      : prefersLeftRail ? 'top_neg' : 'bottom_neg';

  return {
    id: `hookup-${netType}-${pin.id}`,
    label: netType === 'power' ? 'Power rail hookup' : 'Ground rail hookup',
    priority: 'critical',
    reason:
      netType === 'power'
        ? 'Land the supply pin on a dedicated rail jumper first so the bench has an obvious power path before signal wiring begins.'
        : 'Give the first ground pin a clean rail return so measurements and later signal wiring share a stable reference.',
    targetPinId: pin.id,
    netName: netType === 'power' ? 'VCC' : 'GND',
    netType,
    railPoint: {
      type: 'rail',
      rail,
      index: clampRow(pin.coord.row) - 1,
    },
  };
}

function hasTerminalPinsOnBothSides(model: BreadboardSelectedPartModel): boolean {
  const terminalPins = model.pins.filter((pin) => pin.coord?.type === 'terminal');
  const sides = new Set(terminalPins.map((pin) => pin.side));
  return sides.has('left') && sides.has('right');
}

function getPreferredBridgeRow(model: BreadboardSelectedPartModel): number {
  const terminalRows = model.pins
    .map((pin) => pin.coord)
    .filter((coord): coord is TiePoint => Boolean(coord && coord.type === 'terminal'))
    .map((coord) => coord.row);

  if (terminalRows.length === 0) {
    return 1;
  }

  const maxRow = Math.max(...terminalRows);
  if (maxRow < 63) {
    return clampRow(maxRow + 1);
  }

  return clampRow(Math.min(...terminalRows) - 1);
}

function buildRailBridge(netType: 'power' | 'ground', row: number): BreadboardCoachRailBridge {
  const bridgeIndex = clampRow(row) - 1;
  const [fromRail, toRail] = netType === 'power'
    ? (['top_pos', 'bottom_pos'] as const)
    : (['top_neg', 'bottom_neg'] as const);

  return {
    id: `bridge-${netType}-rails`,
    label: netType === 'power' ? 'Power rail bridge' : 'Ground rail bridge',
    priority: 'recommended',
    reason:
      netType === 'power'
        ? 'Tie the positive rails together near the active part so support parts and later jumpers can grab the same supply without hunting for the live side.'
        : 'Tie the ground rails together near the active part so measurements, pull parts, and later debug jumpers all share the same return path.',
    netName: netType === 'power' ? 'VCC' : 'GND',
    netType,
    fromRail: {
      type: 'rail',
      rail: fromRail,
      index: bridgeIndex,
    },
    toRail: {
      type: 'rail',
      rail: toRail,
      index: bridgeIndex,
    },
  };
}

export function buildBreadboardCoachPlan(model: BreadboardSelectedPartModel): BreadboardCoachPlan {
  const powerPins = getTerminalPinsByRole(model, 'power');
  const groundPins = getTerminalPinsByRole(model, 'ground');
  const controlPins = getTerminalPinsByRole(model, 'control');
  const commPins = getTerminalPinsByRole(model, 'communication');
  const analogPins = getTerminalPinsByRole(model, 'analog');

  const bridges: BreadboardCoachRailBridge[] = [];
  const hookups: BreadboardCoachHookup[] = [];
  const suggestions: BreadboardCoachSuggestion[] = [];
  const verifiedBoardCautions: string[] = [];
  const shouldBridgeRails = hasTerminalPinsOnBothSides(model);
  const bridgeRow = shouldBridgeRails ? getPreferredBridgeRow(model) : null;

  // Use verified-pin-safe selection: prefer non-strapping, non-restricted pins for hookups
  const mainPowerPin = pickSafestHookupPin(powerPins);
  const mainGroundPin = pickSafestHookupPin(groundPins);

  if (mainPowerPin) {
    const powerHookup = buildRailHookup(mainPowerPin, 'power');
    if (powerHookup) {
      hookups.push(powerHookup);
      if (bridgeRow != null) {
        bridges.push(buildRailBridge('power', bridgeRow));
      }
    }
  }
  if (mainGroundPin) {
    const groundHookup = buildRailHookup(mainGroundPin, 'ground');
    if (groundHookup) {
      hookups.push(groundHookup);
      if (bridgeRow != null) {
        bridges.push(buildRailBridge('ground', bridgeRow));
      }
    }
  }
  if (mainPowerPin && mainGroundPin) {
    const desiredAnchor = buildDesiredAnchor(mainPowerPin, 'capacitor');
    if (desiredAnchor) {
      suggestions.push({
        id: 'support-decoupler',
        label: '100 nF decoupler',
        type: 'capacitor',
        value: '1e-7',
        preferredColumns: buildPreferredColumns(mainPowerPin.side, 'capacitor'),
        priority: 'critical',
        reason: 'Keep a small decoupling capacitor close to the first power and ground pins so the rail stays stable during switching.',
        targetPinIds: [mainPowerPin.id, mainGroundPin.id],
        desiredAnchor,
      });
    }
  }

  // For control pin pull resistor, also prefer non-strapping pins
  const safeControlPins = controlPins.filter((pin) => isPinSafeForHookup(pin));
  const controlPin = safeControlPins[0] ?? controlPins[0];
  if (controlPin) {
    const desiredAnchor = buildDesiredAnchor(controlPin, 'resistor');
    if (desiredAnchor) {
      suggestions.push({
        id: 'support-control-pull',
        label: '10 kΩ pull resistor',
        type: 'resistor',
        value: '10000',
        preferredColumns: buildPreferredColumns(controlPin.side, 'resistor'),
        priority: 'recommended',
        reason: 'Anchor the most important control line with a pull resistor so reset or enable behavior stays deterministic on the bench.',
        targetPinIds: [controlPin.id],
        desiredAnchor,
      });
    }
  }

  const corridorHints = [
    buildCorridorHint('power-corridor', 'Keep rail bridge lane open', [...powerPins, ...groundPins], 'power'),
    buildCorridorHint('comm-corridor', 'Reserve bus lane', commPins, 'communication'),
    buildCorridorHint('control-corridor', 'Protect control side', controlPins, 'control'),
    buildCorridorHint('analog-corridor', 'Keep analog lane quiet', analogPins, 'analog'),
  ].filter((hint): hint is BreadboardCoachCorridorHint => Boolean(hint));

  // Verified board pin intelligence — generate cautions and extra corridor hints
  if (model.verifiedBoard) {
    const strappingPinIds = getStrappingPinIds(model);
    const restrictedPinIds = getRestrictedPinIds(model);

    if (strappingPinIds.length > 0) {
      verifiedBoardCautions.push(
        `${String(strappingPinIds.length)} strapping/boot pin${strappingPinIds.length > 1 ? 's' : ''} (${strappingPinIds.join(', ')}) affect power-on behavior. Avoid routing external loads to these pins unless you understand the boot implications.`,
      );

      // Add corridor hint for strapping pin zone
      const strappingPins = model.pins.filter((pin) => strappingPinIds.includes(pin.id));
      const strappingHint = buildCorridorHint('strapping-caution', 'Strapping pin danger zone', strappingPins, 'control');
      if (strappingHint) {
        corridorHints.push(strappingHint);
      }
    }

    if (restrictedPinIds.length > 0) {
      verifiedBoardCautions.push(
        `${String(restrictedPinIds.length)} restricted pin${restrictedPinIds.length > 1 ? 's' : ''} (${restrictedPinIds.join(', ')}) must not be used — they are connected to internal hardware.`,
      );
    }

    if (model.adcWifiConflict && model.adcWifiConflictPinIds && model.adcWifiConflictPinIds.length > 0) {
      verifiedBoardCautions.push(
        `ADC2 pins (${model.adcWifiConflictPinIds.join(', ')}) are unavailable when WiFi is active. Route analog reads to ADC1 channels instead.`,
      );
    }
  }

  const highlightedPinIds = [
    ...suggestions.flatMap((suggestion) => suggestion.targetPinIds),
    ...hookups.map((hookup) => hookup.targetPinId),
  ];

  return {
    bridges,
    headline: model.coach.headline,
    corridorHints,
    highlightedPinIds,
    hookups,
    suggestions,
    verifiedBoardCautions,
  };
}
