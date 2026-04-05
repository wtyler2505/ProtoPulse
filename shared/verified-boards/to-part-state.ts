/**
 * Conversion layer: VerifiedBoardDefinition → PartState
 *
 * Pure function that converts a research-backed board definition into the
 * PartState format consumed by the component editor, breadboard renderer,
 * AI system, and exact-part trust pipeline.
 */

import type { PartSourceEvidence } from '../component-trust';
import type {
  Bus,
  Connector,
  PartMeta,
  PartState,
  PartViews,
} from '../component-types';
import type { VerifiedBoardDefinition, VerifiedPin } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a unique connector ID from a pin. */
function pinToConnectorId(pin: VerifiedPin): string {
  return `conn-${pin.id}`;
}

/** Classify the primary pin role into a connector description. */
function pinRoleDescription(pin: VerifiedPin): string {
  const parts: string[] = [];

  if (pin.role === 'power') {
    parts.push(`Power (${pin.voltage}V)`);
  } else if (pin.role === 'ground') {
    parts.push('Ground');
  } else if (pin.role === 'analog') {
    parts.push('Analog I/O');
  } else if (pin.role === 'communication') {
    parts.push('Communication');
  } else if (pin.role === 'control') {
    parts.push('Control');
  } else if (pin.role === 'nc') {
    parts.push('Not Connected');
  } else {
    parts.push('Digital I/O');
  }

  // Add alternate function summary
  const funcTypes = pin.functions.map((fn) => fn.type);
  const uniqueTypes = Array.from(new Set(funcTypes));
  if (uniqueTypes.length > 0) {
    parts.push(uniqueTypes.join(', ').toUpperCase());
  }

  if (pin.restricted) {
    parts.push(`RESTRICTED: ${pin.restrictionReason ?? 'Do not use'}`);
  }

  return parts.join(' — ');
}

/**
 * Compute schematic terminal positions for pins based on header layout.
 * Arranges pins along the edges of a rectangular schematic symbol.
 */
function computeSchematicPositions(
  board: VerifiedBoardDefinition,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const PIN_SPACING = 20;
  const BODY_WIDTH = 200;
  const MARGIN = 40;

  for (const header of board.headerLayout) {
    for (let i = 0; i < header.pinIds.length; i++) {
      const pinId = header.pinIds[i];
      if (!pinId) {
        continue;
      }
      const y = MARGIN + i * PIN_SPACING;
      let x: number;

      switch (header.side) {
        case 'left':
          x = 0;
          break;
        case 'right':
          x = BODY_WIDTH;
          break;
        case 'top':
          x = MARGIN + i * PIN_SPACING;
          break;
        case 'bottom':
          x = MARGIN + i * PIN_SPACING;
          break;
      }

      positions.set(pinId, { x, y });
    }
  }

  return positions;
}

/**
 * Compute breadboard terminal positions for boards that fit on a breadboard.
 * Returns an empty map for non-breadboard-friendly boards.
 */
function computeBreadboardPositions(
  board: VerifiedBoardDefinition,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (board.breadboardFit === 'not_breadboard_friendly') {
    return positions;
  }

  // For dual-header boards (like ESP32), place left header on left side,
  // right header on right side of the breadboard channel
  const PIN_PITCH_PX = 10; // Breadboard artwork pixel pitch
  const LEFT_X = 0;
  const RIGHT_X = 90; // ~22.86mm at breadboard scale

  for (const header of board.headerLayout) {
    const baseX = header.side === 'left' ? LEFT_X : RIGHT_X;

    for (let i = 0; i < header.pinIds.length; i++) {
      const pinId = header.pinIds[i];
      if (!pinId) {
        continue;
      }
      positions.set(pinId, {
        x: baseX,
        y: i * PIN_PITCH_PX,
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

/**
 * Convert a VerifiedBoardDefinition into a PartState that the component
 * editor, breadboard renderer, and AI system can consume.
 */
export function boardDefinitionToPartState(board: VerifiedBoardDefinition): PartState {
  const schematicPositions = computeSchematicPositions(board);
  const breadboardPositions = computeBreadboardPositions(board);

  // Build connectors from pins
  const connectors: Connector[] = board.pins.map((pin): Connector => {
    const connId = pinToConnectorId(pin);
    const schPos = schematicPositions.get(pin.id) ?? { x: 0, y: 0 };
    const bbPos = breadboardPositions.get(pin.id);

    const terminalPositions: Record<string, { x: number; y: number }> = {
      schematic: schPos,
    };
    if (bbPos) {
      terminalPositions['breadboard'] = bbPos;
    }

    return {
      id: connId,
      name: pin.name,
      description: pinRoleDescription(pin),
      connectorType: 'pad',
      shapeIds: {
        schematic: [`${connId}-sch`],
      },
      terminalPositions,
      padSpec: {
        type: 'tht',
        shape: 'circle',
        diameter: pin.role === 'power' || pin.role === 'ground' ? 2.0 : 1.6,
        drill: pin.role === 'power' || pin.role === 'ground' ? 1.0 : 0.8,
      },
    };
  });

  // Build buses from board bus definitions
  const buses: Bus[] = board.buses.map((busDef): Bus => ({
    id: busDef.id,
    name: busDef.name,
    connectorIds: busDef.pinIds.map((pinId) => pinToConnectorId(
      board.pins.find((p) => p.id === pinId) ?? { id: pinId } as VerifiedPin,
    )),
  }));

  // Build schematic view shapes (rectangular body + pin stubs)
  const bodyWidth = 200;
  const bodyHeight = Math.max(100, board.pins.length * 8);
  const schematicShapes = [
    {
      id: 'body',
      type: 'rect' as const,
      x: 0,
      y: 0,
      width: bodyWidth,
      height: bodyHeight,
      rotation: 0,
      style: { fill: '#1a1a2e', stroke: '#00F0FF', strokeWidth: 2 },
    },
    {
      id: 'title-label',
      type: 'text' as const,
      x: bodyWidth / 2,
      y: -10,
      width: bodyWidth,
      height: 20,
      rotation: 0,
      text: board.title,
      style: { fill: '#00F0FF', fontSize: 12, fontFamily: 'monospace', textAnchor: 'middle' },
    },
  ];

  // Build breadboard view shapes (board outline only for breadboard-compatible boards)
  const breadboardShapes = board.breadboardFit !== 'not_breadboard_friendly'
    ? [
        {
          id: 'bb-body',
          type: 'rect' as const,
          x: 0,
          y: 0,
          width: Math.round(board.dimensions.width / board.pinSpacing * 10),
          height: Math.round(board.dimensions.height / board.pinSpacing * 10),
          rotation: 0,
          style: { fill: '#0d1117', stroke: '#30363d', strokeWidth: 1 },
        },
      ]
    : [];

  const views: PartViews = {
    breadboard: { shapes: breadboardShapes },
    schematic: { shapes: schematicShapes },
    pcb: { shapes: [] },
  };

  // Build verification notes from warnings + boot pins
  const allNotes = [...board.verificationNotes];
  if (board.bootPins && board.bootPins.length > 0) {
    allNotes.push(
      `${String(board.bootPins.length)} strapping/boot pins affect power-on behavior — see pin warnings for details.`,
    );
  }

  // Aggregate tags from pin functions for searchability
  const functionTags = new Set<string>();
  for (const pin of board.pins) {
    for (const fn of pin.functions) {
      functionTags.add(fn.type);
      if (fn.bus) {
        functionTags.add(fn.bus);
      }
    }
  }

  const meta: PartMeta = {
    title: board.title,
    aliases: board.aliases,
    family: board.family,
    manufacturer: board.manufacturer,
    mpn: board.mpn,
    description: board.description,
    tags: [
      board.family,
      board.manufacturer.toLowerCase(),
      ...Array.from(functionTags),
    ],
    mountingType: 'tht',
    packageType: board.family === 'driver' ? 'module' : 'dev-board',
    properties: [
      { key: 'Operating Voltage', value: `${String(board.operatingVoltage)}V` },
      { key: 'Input Voltage', value: `${String(board.inputVoltageRange[0])}-${String(board.inputVoltageRange[1])}V` },
      { key: 'Digital I/O', value: String(board.pins.filter((p) => p.role === 'digital').length) },
      { key: 'Analog Inputs', value: String(board.pins.filter((p) => p.role === 'analog').length) },
      { key: 'Total Pins', value: String(board.pins.length) },
    ],
    datasheetUrl: board.evidence.find((e) => e.type === 'datasheet')?.href,
    breadboardFit: board.breadboardFit,
    breadboardModelQuality: 'verified',
    partFamily: board.family,
    verificationStatus: 'verified',
    verificationLevel: board.evidence.some((e) => e.type === 'datasheet' && e.confidence === 'high')
      ? 'official-backed'
      : 'mixed-source',
    sourceEvidence: board.evidence as PartSourceEvidence[],
    verificationNotes: allNotes,
    visualAccuracyReport: {
      outline: board.breadboardFit !== 'not_breadboard_friendly' ? 'approximate' : 'unknown',
      connectors: 'exact',
      silkscreen: 'approximate',
      mountingHoles: 'unknown',
    },
    pinAccuracyReport: {
      connectorNames: 'exact',
      electricalRoles: 'exact',
      breadboardAnchors: board.breadboardFit !== 'not_breadboard_friendly' ? 'approximate' : 'unknown',
      unresolved: board.pins.filter((p) => p.restricted).map((p) => `${p.id}: ${p.restrictionReason ?? 'restricted'}`),
    },
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'ProtoPulse Verified Board Pack',
    benchCategory: board.family === 'driver' ? 'Motor Controllers' : 'Microcontrollers',
    inventoryHint: {
      ownedPreferred: true,
    },
  };

  return {
    meta,
    connectors,
    buses,
    views,
  };
}
