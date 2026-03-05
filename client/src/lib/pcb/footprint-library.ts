export type PadType = 'tht' | 'smd';
export type PadShape = 'circle' | 'rect' | 'oblong' | 'square' | 'roundrect';

export interface Pad {
  number: number;
  type: PadType;
  shape: PadShape;
  position: { x: number; y: number };
  width: number;
  height: number;
  drill?: number;
  drillShape?: 'round' | 'slot';
  layer: 'front' | 'back' | 'both';
  netId?: string;
  thermalRelief?: boolean;
  solderMaskExpansion?: number;
  solderPasteMargin?: number;
  cornerRadius?: number;
}

export interface SilkscreenElement {
  type: 'line' | 'rect' | 'circle' | 'arc' | 'text';
  params: Record<string, number | string>;
  lineWidth: number;
}

export interface Footprint {
  packageType: string;
  description: string;
  pads: Pad[];
  courtyard: { x: number; y: number; width: number; height: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  silkscreen: SilkscreenElement[];
  mountingType: 'tht' | 'smd';
  pinCount: number;
}

export interface ConnectorInput {
  id: string;
  name: string;
  padSpec?: {
    type: PadType;
    shape: PadShape;
    width?: number;
    height?: number;
    drill?: number;
    diameter?: number;
  };
  position: { x: number; y: number };
}

// IPC-7351 courtyard margin (mm)
const COURTYARD_MARGIN = 0.25;

export class FootprintLibrary {
  private static database: Map<string, Footprint> | null = null;

  private static ensureDatabase(): Map<string, Footprint> {
    if (this.database) {
      return this.database;
    }
    this.database = new Map<string, Footprint>();

    // DIP packages (2.54mm pitch, THT)
    this.database.set('DIP-8', this.makeDIP(8, 7.62));
    this.database.set('DIP-14', this.makeDIP(14, 7.62));
    this.database.set('DIP-16', this.makeDIP(16, 7.62));
    this.database.set('DIP-28', this.makeDIP(28, 15.24));
    this.database.set('DIP-40', this.makeDIP(40, 15.24));

    // SOIC packages (1.27mm pitch, SMD)
    this.database.set('SOIC-8', this.makeSOIC(8));
    this.database.set('SOIC-14', this.makeSOIC(14));
    this.database.set('SOIC-16', this.makeSOIC(16));

    // SOT packages
    this.database.set('SOT-23', this.makeSOT23());
    this.database.set('SOT-223', this.makeSOT223());

    // QFP packages
    this.database.set('QFP-44', this.makeQFP(44, 0.8));
    this.database.set('QFP-64', this.makeQFP(64, 0.5));
    this.database.set('QFP-100', this.makeQFP(100, 0.5));

    // TO packages
    this.database.set('TO-220', this.makeTO220());
    this.database.set('TO-252', this.makeTO252());

    // Chip components (2-pad SMD)
    this.database.set('0402', this.makeChipComponent('0402', 0.55, 0.55, 0.55));
    this.database.set('0603', this.makeChipComponent('0603', 0.9, 0.55, 0.9));
    this.database.set('0805', this.makeChipComponent('0805', 1.3, 0.65, 1.1));
    this.database.set('1206', this.makeChipComponent('1206', 1.65, 0.8, 2.1));
    this.database.set('2512', this.makeChipComponent('2512', 1.5, 3.2, 3.3));

    // QFN packages (SMD, exposed pad)
    this.database.set('QFN-32', this.makeQFN(32, 0.5, 5.0));

    // SOP (Small Outline Package — wider pitch SOIC variant)
    this.database.set('SOP-8', this.makeSOP8());

    // Diode packages
    this.database.set('SMA', this.makeDiodePackage('SMA', 4.6, 2.6));
    this.database.set('SMB', this.makeDiodePackage('SMB', 5.3, 3.6));
    this.database.set('SMC', this.makeDiodePackage('SMC', 7.6, 5.1));

    return this.database;
  }

  static getFootprint(packageType: string): Footprint | null {
    const db = this.ensureDatabase();
    return db.get(packageType) ?? null;
  }

  static getAllPackageTypes(): string[] {
    const db = this.ensureDatabase();
    return Array.from(db.keys());
  }

  static generateFromConnectors(connectors: ConnectorInput[]): Footprint {
    const pads: Pad[] = connectors.map((conn, i) => {
      if (conn.padSpec) {
        const w = conn.padSpec.width ?? conn.padSpec.diameter ?? 1.0;
        const h = conn.padSpec.height ?? conn.padSpec.diameter ?? 1.0;
        return {
          number: i + 1,
          type: conn.padSpec.type,
          shape: conn.padSpec.shape,
          position: { x: conn.position.x, y: conn.position.y },
          width: w,
          height: h,
          ...(conn.padSpec.type === 'tht'
            ? { drill: conn.padSpec.drill ?? 0.8, layer: 'both' as const }
            : { layer: 'front' as const }),
        };
      }
      // Default: THT pad
      return {
        number: i + 1,
        type: 'tht' as const,
        shape: 'circle' as const,
        position: { x: conn.position.x, y: conn.position.y },
        width: 1.6,
        height: 1.6,
        drill: 0.8,
        layer: 'both' as const,
      };
    });

    const hasSmd = pads.some((p) => p.type === 'smd');
    const allSmd = pads.every((p) => p.type === 'smd');
    const mountingType: 'tht' | 'smd' = allSmd && hasSmd ? 'smd' : 'tht';

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: 'custom',
      description: `Custom footprint with ${connectors.length} pads`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeRectSilkscreen(bbox.width, bbox.height),
      mountingType,
      pinCount: pads.length,
    };
  }

  // ── DIP (Dual In-line Package) ──────────────────────────────────────
  private static makeDIP(pinCount: number, rowSpacing: number): Footprint {
    const pitch = 2.54;
    const padWidth = 1.6;
    const padHeight = 1.0;
    const drill = 0.8;
    const pinsPerSide = pinCount / 2;

    const pads: Pad[] = [];
    const halfRow = rowSpacing / 2;
    const totalHeight = (pinsPerSide - 1) * pitch;
    const yStart = -totalHeight / 2;

    // Left column: pins 1..N/2 going top to bottom
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: i + 1,
        type: 'tht',
        shape: 'oblong',
        position: { x: -halfRow, y: yStart + i * pitch },
        width: padWidth,
        height: padHeight,
        drill,
        layer: 'both',
      });
    }
    // Right column: pins N/2+1..N going bottom to top (standard DIP numbering)
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: pinsPerSide + i + 1,
        type: 'tht',
        shape: 'oblong',
        position: { x: halfRow, y: yStart + (pinsPerSide - 1 - i) * pitch },
        width: padWidth,
        height: padHeight,
        drill,
        layer: 'both',
      });
    }

    const bodyWidth = rowSpacing + padWidth;
    const bodyHeight = totalHeight + padHeight;
    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: `DIP-${pinCount}`,
      description: `${pinCount}-pin Dual In-line Package, ${rowSpacing}mm row spacing`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeDIPSilkscreen(bodyWidth, bodyHeight),
      mountingType: 'tht',
      pinCount,
    };
  }

  // ── SOIC (Small Outline IC) ─────────────────────────────────────────
  private static makeSOIC(pinCount: number): Footprint {
    const pitch = 1.27;
    const padWidth = 0.6;
    const padHeight = 1.5;
    const bodyWidth = 5.3;
    const pinsPerSide = pinCount / 2;

    const pads: Pad[] = [];
    const halfSpan = (bodyWidth / 2) + (padHeight / 2) - 0.3; // pad center from origin
    const totalHeight = (pinsPerSide - 1) * pitch;
    const yStart = -totalHeight / 2;

    // Left column: pins 1..N/2
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: i + 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -halfSpan, y: yStart + i * pitch },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      });
    }
    // Right column: pins N/2+1..N (bottom to top)
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: pinsPerSide + i + 1,
        type: 'smd',
        shape: 'rect',
        position: { x: halfSpan, y: yStart + (pinsPerSide - 1 - i) * pitch },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      });
    }

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: `SOIC-${pinCount}`,
      description: `${pinCount}-pin Small Outline IC, 1.27mm pitch`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeICSilkscreen(bodyWidth, totalHeight + pitch),
      mountingType: 'smd',
      pinCount,
    };
  }

  // ── SOT-23 ──────────────────────────────────────────────────────────
  private static makeSOT23(): Footprint {
    const padWidth = 0.6;
    const padHeight = 0.7;
    // SOT-23: pins 1,2 on left side, pin 3 on right side
    // Body is ~1.3mm wide, ~2.9mm span
    const xSpan = 1.1; // half-span from center to pad center

    const pads: Pad[] = [
      {
        number: 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -xSpan, y: -0.95 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      {
        number: 2,
        type: 'smd',
        shape: 'rect',
        position: { x: -xSpan, y: 0.95 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      {
        number: 3,
        type: 'smd',
        shape: 'rect',
        position: { x: xSpan, y: 0 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
    ];

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: 'SOT-23',
      description: '3-pin Small Outline Transistor',
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeRectSilkscreen(1.3, 2.9),
      mountingType: 'smd',
      pinCount: 3,
    };
  }

  // ── SOT-223 ─────────────────────────────────────────────────────────
  private static makeSOT223(): Footprint {
    const pitch = 2.3;
    const padWidth = 0.7;
    const padHeight = 1.5;
    const tabWidth = 3.0;
    const tabHeight = 1.5;
    const ySpan = 3.15; // half-span from center to pad center

    const pads: Pad[] = [];
    // 3 signal pins on bottom
    for (let i = 0; i < 3; i++) {
      pads.push({
        number: i + 1,
        type: 'smd',
        shape: 'rect',
        position: { x: (i - 1) * pitch, y: ySpan },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      });
    }
    // Tab pad on top
    pads.push({
      number: 4,
      type: 'smd',
      shape: 'rect',
      position: { x: 0, y: -ySpan },
      width: tabWidth,
      height: tabHeight,
      layer: 'front',
    });

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: 'SOT-223',
      description: '4-pin SOT-223 (3 signal + tab)',
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeRectSilkscreen(6.5, 3.5),
      mountingType: 'smd',
      pinCount: 4,
    };
  }

  // ── QFP (Quad Flat Package) ─────────────────────────────────────────
  private static makeQFP(pinCount: number, pitch: number): Footprint {
    const pinsPerSide = pinCount / 4;
    const padWidth = pitch * 0.55; // ~55% of pitch
    const padLength = 1.5;
    // Body size derived from pin count and pitch
    const bodySize = (pinsPerSide - 1) * pitch + 2.0;
    const halfSpan = bodySize / 2 + padLength / 2;

    const pads: Pad[] = [];
    let padNum = 1;

    const sideOffset = ((pinsPerSide - 1) * pitch) / 2;

    // Left side: top to bottom
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: -halfSpan, y: -sideOffset + i * pitch },
        width: padLength,
        height: padWidth,
        layer: 'front',
      });
    }
    // Bottom side: left to right
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: -sideOffset + i * pitch, y: halfSpan },
        width: padWidth,
        height: padLength,
        layer: 'front',
      });
    }
    // Right side: bottom to top
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: halfSpan, y: sideOffset - i * pitch },
        width: padLength,
        height: padWidth,
        layer: 'front',
      });
    }
    // Top side: right to left
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: sideOffset - i * pitch, y: -halfSpan },
        width: padWidth,
        height: padLength,
        layer: 'front',
      });
    }

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: `QFP-${pinCount}`,
      description: `${pinCount}-pin Quad Flat Package, ${pitch}mm pitch`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeICSilkscreen(bodySize, bodySize),
      mountingType: 'smd',
      pinCount,
    };
  }

  // ── TO-220 ──────────────────────────────────────────────────────────
  private static makeTO220(): Footprint {
    const pitch = 2.54;
    const padWidth = 1.6;
    const padHeight = 1.6;
    const drill = 1.0;

    const pads: Pad[] = [];
    for (let i = 0; i < 3; i++) {
      pads.push({
        number: i + 1,
        type: 'tht',
        shape: 'circle',
        position: { x: (i - 1) * pitch, y: 2.54 },
        width: padWidth,
        height: padHeight,
        drill,
        layer: 'both',
      });
    }

    const bbox = this.computeBoundingBox(pads);
    // Extend bbox upward for tab/heatsink area
    const tabBbox = {
      x: -5.08,
      y: -5.0,
      width: 10.16,
      height: bbox.y + bbox.height + 5.0,
    };
    const court = this.computeCourtyard(tabBbox);

    return {
      packageType: 'TO-220',
      description: '3-pin TO-220 power package',
      pads,
      courtyard: court,
      boundingBox: tabBbox,
      silkscreen: [
        { type: 'rect', params: { x: -5.08, y: -5.0, width: 10.16, height: 10.0 }, lineWidth: 0.15 },
        { type: 'line', params: { x1: -5.08, y1: -2.0, x2: 5.08, y2: -2.0 }, lineWidth: 0.15 },
      ],
      mountingType: 'tht',
      pinCount: 3,
    };
  }

  // ── TO-252 (DPAK) ──────────────────────────────────────────────────
  private static makeTO252(): Footprint {
    const pitch = 2.28;
    const padWidth = 0.9;
    const padHeight = 1.5;
    const tabWidth = 5.4;
    const tabHeight = 5.4;

    const pads: Pad[] = [
      // Pin 1
      {
        number: 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -pitch, y: 4.5 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      // Pin 3 (pin 2 is cut on DPAK, but we number sequentially for simplicity)
      {
        number: 2,
        type: 'smd',
        shape: 'rect',
        position: { x: pitch, y: 4.5 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      // Tab pad (large drain/collector)
      {
        number: 3,
        type: 'smd',
        shape: 'rect',
        position: { x: 0, y: -0.5 },
        width: tabWidth,
        height: tabHeight,
        layer: 'front',
      },
    ];

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: 'TO-252',
      description: '3-pad TO-252 (DPAK) power package',
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeRectSilkscreen(6.5, 6.5),
      mountingType: 'smd',
      pinCount: 3,
    };
  }

  // ── Chip component (0402, 0603, 0805, 1206, 2512) ─────────────────
  private static makeChipComponent(
    name: string,
    padWidth: number,
    padHeight: number,
    gap: number,
  ): Footprint {
    const halfGap = gap / 2;
    const padCenterX = halfGap + padWidth / 2;

    const pads: Pad[] = [
      {
        number: 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -padCenterX, y: 0 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      {
        number: 2,
        type: 'smd',
        shape: 'rect',
        position: { x: padCenterX, y: 0 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
    ];

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: name,
      description: `${name} chip component`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeRectSilkscreen(gap, padHeight),
      mountingType: 'smd',
      pinCount: 2,
    };
  }

  // ── Diode package (SMA, SMB, SMC) ──────────────────────────────────
  private static makeDiodePackage(
    name: string,
    bodyLength: number,
    bodyWidth: number,
  ): Footprint {
    const padWidth = bodyLength * 0.35;
    const padHeight = bodyWidth * 0.8;
    const padCenterX = bodyLength / 2 + padWidth * 0.1;

    const pads: Pad[] = [
      {
        number: 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -padCenterX, y: 0 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
      {
        number: 2,
        type: 'smd',
        shape: 'rect',
        position: { x: padCenterX, y: 0 },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      },
    ];

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: name,
      description: `${name} diode package (${bodyLength}x${bodyWidth}mm body)`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: [
        { type: 'rect', params: { x: -bodyLength / 2, y: -bodyWidth / 2, width: bodyLength, height: bodyWidth }, lineWidth: 0.15 },
        // Cathode band
        { type: 'line', params: { x1: -bodyLength / 2 + 0.5, y1: -bodyWidth / 2, x2: -bodyLength / 2 + 0.5, y2: bodyWidth / 2 }, lineWidth: 0.2 },
      ],
      mountingType: 'smd',
      pinCount: 2,
    };
  }

  // ── QFN (Quad Flat No-lead) ───────────────────────────────────────
  private static makeQFN(pinCount: number, pitch: number, bodySize: number): Footprint {
    const pinsPerSide = (pinCount - 1) / 4; // -1 for exposed pad; round if needed
    const actualPinsPerSide = Math.floor(pinCount / 4);
    const padWidth = pitch * 0.55;
    const padLength = 0.8;
    const halfBody = bodySize / 2;
    const padCenter = halfBody; // pads at package edge

    const pads: Pad[] = [];
    let padNum = 1;

    const sideOffset = ((actualPinsPerSide - 1) * pitch) / 2;

    // Left side: top to bottom
    for (let i = 0; i < actualPinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: -padCenter, y: -sideOffset + i * pitch },
        width: padLength,
        height: padWidth,
        layer: 'front',
      });
    }
    // Bottom side: left to right
    for (let i = 0; i < actualPinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: -sideOffset + i * pitch, y: padCenter },
        width: padWidth,
        height: padLength,
        layer: 'front',
      });
    }
    // Right side: bottom to top
    for (let i = 0; i < actualPinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: padCenter, y: sideOffset - i * pitch },
        width: padLength,
        height: padWidth,
        layer: 'front',
      });
    }
    // Top side: right to left
    for (let i = 0; i < actualPinsPerSide; i++) {
      pads.push({
        number: padNum++,
        type: 'smd',
        shape: 'rect',
        position: { x: sideOffset - i * pitch, y: -padCenter },
        width: padWidth,
        height: padLength,
        layer: 'front',
      });
    }

    // Exposed pad (center)
    const epSize = bodySize * 0.6;
    pads.push({
      number: padNum,
      type: 'smd',
      shape: 'rect',
      position: { x: 0, y: 0 },
      width: epSize,
      height: epSize,
      layer: 'front',
      thermalRelief: true,
    });

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: `QFN-${pinCount}`,
      description: `${pinCount}-pin QFN (${bodySize}x${bodySize}mm), ${pitch}mm pitch`,
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeICSilkscreen(bodySize, bodySize),
      mountingType: 'smd',
      pinCount: pads.length,
    };
  }

  // ── SOP-8 (Small Outline Package, 1.27mm pitch, wider body) ────────
  private static makeSOP8(): Footprint {
    const pinCount = 8;
    const pitch = 1.27;
    const padWidth = 0.6;
    const padHeight = 2.0; // longer pads than SOIC
    const bodyWidth = 5.3;
    const pinsPerSide = pinCount / 2;

    const pads: Pad[] = [];
    const halfSpan = bodyWidth / 2 + padHeight / 2;
    const totalHeight = (pinsPerSide - 1) * pitch;
    const yStart = -totalHeight / 2;

    // Left column: pins 1..4
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: i + 1,
        type: 'smd',
        shape: 'rect',
        position: { x: -halfSpan, y: yStart + i * pitch },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      });
    }
    // Right column: pins 5..8 (bottom to top)
    for (let i = 0; i < pinsPerSide; i++) {
      pads.push({
        number: pinsPerSide + i + 1,
        type: 'smd',
        shape: 'rect',
        position: { x: halfSpan, y: yStart + (pinsPerSide - 1 - i) * pitch },
        width: padWidth,
        height: padHeight,
        layer: 'front',
      });
    }

    const bbox = this.computeBoundingBox(pads);
    const court = this.computeCourtyard(bbox);

    return {
      packageType: 'SOP-8',
      description: '8-pin Small Outline Package, 1.27mm pitch',
      pads,
      courtyard: court,
      boundingBox: bbox,
      silkscreen: this.makeICSilkscreen(bodyWidth, totalHeight + pitch),
      mountingType: 'smd',
      pinCount,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private static computeBoundingBox(pads: Pad[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pad of pads) {
      const halfW = pad.width / 2;
      const halfH = pad.height / 2;
      minX = Math.min(minX, pad.position.x - halfW);
      minY = Math.min(minY, pad.position.y - halfH);
      maxX = Math.max(maxX, pad.position.x + halfW);
      maxY = Math.max(maxY, pad.position.y + halfH);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private static computeCourtyard(bbox: { x: number; y: number; width: number; height: number }): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: bbox.x - COURTYARD_MARGIN,
      y: bbox.y - COURTYARD_MARGIN,
      width: bbox.width + 2 * COURTYARD_MARGIN,
      height: bbox.height + 2 * COURTYARD_MARGIN,
    };
  }

  private static makeRectSilkscreen(width: number, height: number): SilkscreenElement[] {
    return [
      {
        type: 'rect',
        params: { x: -width / 2, y: -height / 2, width, height },
        lineWidth: 0.15,
      },
    ];
  }

  private static makeDIPSilkscreen(width: number, height: number): SilkscreenElement[] {
    return [
      {
        type: 'rect',
        params: { x: -width / 2, y: -height / 2, width, height },
        lineWidth: 0.15,
      },
      // Pin 1 notch
      {
        type: 'arc',
        params: { cx: -width / 2, cy: -height / 2 + 1.27, r: 0.5, startAngle: -90, endAngle: 90 },
        lineWidth: 0.15,
      },
    ];
  }

  private static makeICSilkscreen(width: number, height: number): SilkscreenElement[] {
    return [
      {
        type: 'rect',
        params: { x: -width / 2, y: -height / 2, width, height },
        lineWidth: 0.15,
      },
      // Pin 1 dot
      {
        type: 'circle',
        params: { cx: -width / 2 + 0.5, cy: -height / 2 + 0.5, r: 0.25 },
        lineWidth: 0.15,
      },
    ];
  }
}
