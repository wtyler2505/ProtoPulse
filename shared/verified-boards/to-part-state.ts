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
  const scale = 2.2;
  const pinPitchPx = Math.max(5, board.pinSpacing * scale);
  const widthPx = Math.max(84, Math.round(board.dimensions.width * scale));
  const heightPx = Math.max(42, Math.round(board.dimensions.height * scale));
  const edgeInset = Math.max(7, Math.round(pinPitchPx * 0.7));
  const groupGap = Math.max(10, Math.round(pinPitchPx * 1.2));

  const sideGroups = {
    left: board.headerLayout.filter((header) => header.side === 'left'),
    right: board.headerLayout.filter((header) => header.side === 'right'),
    top: board.headerLayout.filter((header) => header.side === 'top'),
    bottom: board.headerLayout.filter((header) => header.side === 'bottom'),
  } as const;

  const sideOrigins = new Map<string, number>();

  const distributeAlongSide = (
    headers: typeof board.headerLayout,
    availableSpan: number,
  ) => {
    if (headers.length === 0) {
      return;
    }
    const spans = headers.map((header) => Math.max(0, (header.pinCount - 1) * pinPitchPx));
    const totalSpan = spans.reduce((sum, span) => sum + span, 0) + groupGap * Math.max(0, headers.length - 1);
    let cursor = Math.max(edgeInset, Math.round((availableSpan - totalSpan) / 2));

    headers.forEach((header, index) => {
      sideOrigins.set(header.id, cursor);
      cursor += spans[index] + groupGap;
    });
  };

  distributeAlongSide(sideGroups.left, heightPx);
  distributeAlongSide(sideGroups.right, heightPx);
  distributeAlongSide(sideGroups.top, widthPx);
  distributeAlongSide(sideGroups.bottom, widthPx);

  for (const header of board.headerLayout) {
    const start = sideOrigins.get(header.id) ?? edgeInset;
    for (let i = 0; i < header.pinIds.length; i++) {
      const pinId = header.pinIds[i];
      if (!pinId) {
        continue;
      }

      switch (header.side) {
        case 'left':
          positions.set(pinId, {
            x: edgeInset,
            y: start + i * pinPitchPx,
          });
          break;
        case 'right':
          positions.set(pinId, {
            x: widthPx - edgeInset,
            y: start + i * pinPitchPx,
          });
          break;
        case 'top':
          positions.set(pinId, {
            x: start + i * pinPitchPx,
            y: edgeInset,
          });
          break;
        case 'bottom':
          positions.set(pinId, {
            x: start + i * pinPitchPx,
            y: heightPx - edgeInset,
          });
          break;
      }
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
  const scale = 2.2;
  const widthPx = Math.max(84, Math.round(board.dimensions.width * scale));
  const heightPx = Math.max(42, Math.round(board.dimensions.height * scale));
  const edgeInset = Math.max(7, Math.round(board.pinSpacing * scale * 0.7));

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
      connectorType: 'female',
      shapeIds: {
        schematic: [`${connId}-sch`],
        breadboard: [`${connId}-bb`],
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

  const headerStripShapes = board.headerLayout.map((header) => {
    const headerPins = header.pinIds
      .map((pinId) => breadboardPositions.get(pinId))
      .filter((position): position is { x: number; y: number } => Boolean(position));
    if (headerPins.length === 0) {
      return null;
    }

    const xs = headerPins.map((position) => position.x);
    const ys = headerPins.map((position) => position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const horizontal = header.side === 'top' || header.side === 'bottom';

    return {
      id: `header-${header.id}`,
      type: 'rect' as const,
      x: horizontal ? minX - 5 : minX - 3,
      y: horizontal ? minY - 3 : minY - 5,
      width: horizontal ? Math.max(12, maxX - minX + 10) : 6,
      height: horizontal ? 6 : Math.max(12, maxY - minY + 10),
      rotation: 0,
      rx: 2,
      style: { fill: '#111827', stroke: '#475569', strokeWidth: 0.8, opacity: 0.95 },
    };
  }).filter((shape): shape is NonNullable<typeof shape> => shape != null);

  const pinShapes = board.pins.map((pin) => {
    const position = breadboardPositions.get(pin.id);
    if (!position) {
      return null;
    }

    return {
      id: `${pinToConnectorId(pin)}-bb`,
      type: 'circle' as const,
      x: position.x - 2.2,
      y: position.y - 2.2,
      width: 4.4,
      height: 4.4,
      cx: position.x,
      cy: position.y,
      rotation: 0,
      style: {
        fill: pin.role === 'power'
          ? '#ef4444'
          : pin.role === 'ground'
            ? '#38bdf8'
            : pin.role === 'communication'
              ? '#22d3ee'
              : pin.role === 'analog'
                ? '#84cc16'
                : '#cbd5e1',
        stroke: '#020617',
        strokeWidth: 0.6,
      },
    };
  }).filter((shape): shape is NonNullable<typeof shape> => shape != null);

  const featureShapes = [
    {
      id: 'bb-body',
      type: 'rect' as const,
      x: 0,
      y: 0,
      width: widthPx,
      height: heightPx,
      rotation: 0,
      rx: 8,
      style: { fill: '#0f172a', stroke: '#334155', strokeWidth: 1.2 },
    },
    {
      id: 'bb-silkscreen',
      type: 'rect' as const,
      x: edgeInset + 4,
      y: edgeInset + 4,
      width: Math.max(26, widthPx - (edgeInset + 4) * 2),
      height: Math.max(14, heightPx - (edgeInset + 4) * 2),
      rotation: 0,
      rx: 6,
      style: { fill: '#0b1220', stroke: '#1e293b', strokeWidth: 0.6, opacity: 0.35 },
    },
    {
      id: 'title-label',
      type: 'text' as const,
      x: 10,
      y: 8,
      width: widthPx - 20,
      height: 12,
      rotation: 0,
      text: board.title,
      style: { fill: '#cbd5e1', fontSize: 8, fontFamily: 'monospace', textAnchor: 'start' },
    },
    {
      id: 'manufacturer-label',
      type: 'text' as const,
      x: 10,
      y: heightPx - 18,
      width: widthPx - 20,
      height: 10,
      rotation: 0,
      text: `${board.manufacturer} • ${board.operatingVoltage}V`,
      style: { fill: '#67e8f9', fontSize: 6, fontFamily: 'monospace', textAnchor: 'start' },
    },
  ];

  if (board.aliases.some((alias) => /uno|mega|arduino/i.test(alias)) || /arduino/i.test(board.title)) {
    featureShapes.push(
      {
        id: 'feature-usb',
        type: 'rect' as const,
        x: 0,
        y: 10,
        width: 12,
        height: 18,
        rotation: 0,
        rx: 2,
        style: { fill: '#94a3b8', stroke: '#cbd5e1', strokeWidth: 0.8 },
      },
      {
        id: 'feature-power-jack',
        type: 'circle' as const,
        x: widthPx - 16,
        y: 10,
        width: 10,
        height: 10,
        cx: widthPx - 11,
        cy: 15,
        rotation: 0,
        style: { fill: '#0f172a', stroke: '#94a3b8', strokeWidth: 0.8 },
      },
    );
  }

  if (/esp32|nodemcu|feather|thing plus|pico|teensy/i.test(board.title)) {
    featureShapes.push({
      id: 'feature-usb-c',
      type: 'rect' as const,
      x: Math.max(8, widthPx / 2 - 8),
      y: 0,
      width: 16,
      height: 8,
      rotation: 0,
      rx: 2,
      style: { fill: '#94a3b8', stroke: '#cbd5e1', strokeWidth: 0.8 },
    });
  }

  const breadboardShapes = [...featureShapes, ...headerStripShapes, ...pinShapes];

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
