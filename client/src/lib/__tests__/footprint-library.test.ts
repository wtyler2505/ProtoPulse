import { describe, it, expect } from 'vitest';
import {
  FootprintLibrary,
  type Footprint,
  type Pad,
  type PadType,
  type PadShape,
  type SilkscreenElement,
  type ConnectorInput,
} from '../pcb/footprint-library';

describe('FootprintLibrary', () => {
  describe('getAllPackageTypes', () => {
    it('returns all 25 built-in package types', () => {
      const types = FootprintLibrary.getAllPackageTypes();
      expect(types).toHaveLength(25);
    });

    it('includes expected package families', () => {
      const types = FootprintLibrary.getAllPackageTypes();
      expect(types).toContain('DIP-8');
      expect(types).toContain('SOIC-8');
      expect(types).toContain('SOT-23');
      expect(types).toContain('QFP-44');
      expect(types).toContain('TO-220');
      expect(types).toContain('0402');
      expect(types).toContain('0805');
      expect(types).toContain('SMA');
      expect(types).toContain('QFN-32');
      expect(types).toContain('SOP-8');
    });
  });

  describe('getFootprint - DIP packages', () => {
    it('DIP-8 returns 8 THT pads with drill holes', () => {
      const fp = FootprintLibrary.getFootprint('DIP-8');
      expect(fp).not.toBeNull();
      expect(fp!.packageType).toBe('DIP-8');
      expect(fp!.pads).toHaveLength(8);
      expect(fp!.mountingType).toBe('tht');
      expect(fp!.pinCount).toBe(8);

      for (const pad of fp!.pads) {
        expect(pad.type).toBe('tht');
        expect(pad.drill).toBeGreaterThan(0);
        expect(pad.layer).toBe('both');
      }
    });

    it('DIP-8 has correct pitch (2.54mm) and row spacing (7.62mm)', () => {
      const fp = FootprintLibrary.getFootprint('DIP-8')!;
      // Pins 1-4 on left column, pins 5-8 on right column
      const leftPads = fp.pads.filter((p) => p.position.x < 0);
      const rightPads = fp.pads.filter((p) => p.position.x > 0);
      expect(leftPads).toHaveLength(4);
      expect(rightPads).toHaveLength(4);

      // Row spacing check: distance between left and right columns
      const rowSpacing = Math.abs(rightPads[0].position.x - leftPads[0].position.x);
      expect(rowSpacing).toBeCloseTo(7.62, 1);

      // Pitch check: y-distance between consecutive pins on same side
      const sortedLeft = [...leftPads].sort((a, b) => a.position.y - b.position.y);
      const pitch = Math.abs(sortedLeft[1].position.y - sortedLeft[0].position.y);
      expect(pitch).toBeCloseTo(2.54, 1);
    });

    it('DIP-8 pads have oblong shape with correct dimensions', () => {
      const fp = FootprintLibrary.getFootprint('DIP-8')!;
      for (const pad of fp.pads) {
        expect(pad.shape).toBe('oblong');
        expect(pad.width).toBeCloseTo(1.6, 1);
        expect(pad.height).toBeCloseTo(1.0, 1);
        expect(pad.drill).toBeCloseTo(0.8, 1);
      }
    });

    it('DIP-14 returns 14 pads', () => {
      const fp = FootprintLibrary.getFootprint('DIP-14');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(14);
      expect(fp!.pinCount).toBe(14);
    });

    it('DIP-16 returns 16 pads', () => {
      const fp = FootprintLibrary.getFootprint('DIP-16');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(16);
    });

    it('DIP-28 returns 28 pads with 15.24mm row spacing', () => {
      const fp = FootprintLibrary.getFootprint('DIP-28')!;
      expect(fp.pads).toHaveLength(28);
      const leftPads = fp.pads.filter((p) => p.position.x < 0);
      const rightPads = fp.pads.filter((p) => p.position.x > 0);
      const rowSpacing = Math.abs(rightPads[0].position.x - leftPads[0].position.x);
      expect(rowSpacing).toBeCloseTo(15.24, 1);
    });

    it('DIP-40 returns 40 pads', () => {
      const fp = FootprintLibrary.getFootprint('DIP-40')!;
      expect(fp.pads).toHaveLength(40);
      expect(fp.pinCount).toBe(40);
    });
  });

  describe('getFootprint - SOIC packages', () => {
    it('SOIC-8 returns 8 SMD pads with correct dimensions', () => {
      const fp = FootprintLibrary.getFootprint('SOIC-8');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(8);
      expect(fp!.mountingType).toBe('smd');

      for (const pad of fp!.pads) {
        expect(pad.type).toBe('smd');
        expect(pad.layer).toBe('front');
        expect(pad.drill).toBeUndefined();
        expect(pad.width).toBeCloseTo(0.6, 1);
        expect(pad.height).toBeCloseTo(1.5, 1);
      }
    });

    it('SOIC-14 returns 14 pads', () => {
      const fp = FootprintLibrary.getFootprint('SOIC-14');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(14);
    });

    it('SOIC-16 returns 16 pads', () => {
      const fp = FootprintLibrary.getFootprint('SOIC-16');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(16);
    });
  });

  describe('getFootprint - SOT packages', () => {
    it('SOT-23 returns 3 SMD pads', () => {
      const fp = FootprintLibrary.getFootprint('SOT-23');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(3);
      expect(fp!.mountingType).toBe('smd');
      expect(fp!.pinCount).toBe(3);

      for (const pad of fp!.pads) {
        expect(pad.type).toBe('smd');
        expect(pad.width).toBeCloseTo(0.6, 1);
        expect(pad.height).toBeCloseTo(0.7, 1);
      }
    });

    it('SOT-223 returns 4 pads (3 signal + 1 tab)', () => {
      const fp = FootprintLibrary.getFootprint('SOT-223');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(4);
      expect(fp!.mountingType).toBe('smd');
    });
  });

  describe('getFootprint - QFP packages', () => {
    it('QFP-44 returns 44 SMD pads on 4 sides', () => {
      const fp = FootprintLibrary.getFootprint('QFP-44');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(44);
      expect(fp!.mountingType).toBe('smd');
      expect(fp!.pinCount).toBe(44);
    });

    it('QFP-64 returns 64 pads', () => {
      const fp = FootprintLibrary.getFootprint('QFP-64');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(64);
    });

    it('QFP-100 returns 100 pads', () => {
      const fp = FootprintLibrary.getFootprint('QFP-100');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(100);
    });
  });

  describe('getFootprint - TO packages', () => {
    it('TO-220 returns 3 THT pads', () => {
      const fp = FootprintLibrary.getFootprint('TO-220');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(3);
      expect(fp!.mountingType).toBe('tht');
    });

    it('TO-252 (DPAK) returns 3 pads', () => {
      const fp = FootprintLibrary.getFootprint('TO-252');
      expect(fp).not.toBeNull();
      expect(fp!.pads).toHaveLength(3);
      expect(fp!.mountingType).toBe('smd');
    });
  });

  describe('getFootprint - Chip components', () => {
    const chipPackages = ['0402', '0603', '0805', '1206', '2512'] as const;

    for (const pkg of chipPackages) {
      it(`${pkg} returns 2 SMD pads`, () => {
        const fp = FootprintLibrary.getFootprint(pkg);
        expect(fp).not.toBeNull();
        expect(fp!.pads).toHaveLength(2);
        expect(fp!.mountingType).toBe('smd');
        expect(fp!.pinCount).toBe(2);

        for (const pad of fp!.pads) {
          expect(pad.type).toBe('smd');
          expect(pad.layer).toBe('front');
          expect(pad.shape).toBe('rect');
        }
      });
    }

    it('0805 has correct pad dimensions', () => {
      const fp = FootprintLibrary.getFootprint('0805')!;
      expect(fp.pads[0].width).toBeCloseTo(1.3, 1);
      expect(fp.pads[0].height).toBeCloseTo(0.65, 1);
    });
  });

  describe('getFootprint - Diode packages', () => {
    const diodePackages = ['SMA', 'SMB', 'SMC'] as const;

    for (const pkg of diodePackages) {
      it(`${pkg} returns 2 SMD pads`, () => {
        const fp = FootprintLibrary.getFootprint(pkg);
        expect(fp).not.toBeNull();
        expect(fp!.pads).toHaveLength(2);
        expect(fp!.mountingType).toBe('smd');
      });
    }
  });

  describe('getFootprint - unknown package', () => {
    it('returns null for unknown package type', () => {
      const fp = FootprintLibrary.getFootprint('NONEXISTENT-99');
      expect(fp).toBeNull();
    });

    it('is case-sensitive', () => {
      const fp = FootprintLibrary.getFootprint('dip-8');
      expect(fp).toBeNull();
    });
  });

  describe('all packages validation', () => {
    it('every package has valid structure', () => {
      const types = FootprintLibrary.getAllPackageTypes();
      for (const pkg of types) {
        const fp = FootprintLibrary.getFootprint(pkg);
        expect(fp, `${pkg} should not be null`).not.toBeNull();
        expect(fp!.pads.length, `${pkg} should have pads`).toBeGreaterThan(0);
        expect(fp!.pinCount, `${pkg} pinCount should match pads`).toBe(fp!.pads.length);
        expect(fp!.packageType, `${pkg} packageType should match`).toBe(pkg);

        // Bounding box should have positive dimensions
        expect(fp!.boundingBox.width, `${pkg} bounding box width`).toBeGreaterThan(0);
        expect(fp!.boundingBox.height, `${pkg} bounding box height`).toBeGreaterThan(0);

        // Courtyard should have positive dimensions
        expect(fp!.courtyard.width, `${pkg} courtyard width`).toBeGreaterThan(0);
        expect(fp!.courtyard.height, `${pkg} courtyard height`).toBeGreaterThan(0);

        // THT pads must have drill
        for (const pad of fp!.pads) {
          if (pad.type === 'tht') {
            expect(pad.drill, `${pkg} pad ${pad.number} THT must have drill`).toBeGreaterThan(0);
            expect(pad.layer, `${pkg} pad ${pad.number} THT layer should be 'both'`).toBe('both');
          }
        }

        // All pads should have valid dimensions
        for (const pad of fp!.pads) {
          expect(pad.width, `${pkg} pad ${pad.number} width`).toBeGreaterThan(0);
          expect(pad.height, `${pkg} pad ${pad.number} height`).toBeGreaterThan(0);
          expect(pad.number, `${pkg} pad number`).toBeGreaterThan(0);
        }

        // Silkscreen should exist
        expect(fp!.silkscreen.length, `${pkg} should have silkscreen`).toBeGreaterThan(0);
      }
    });

    it('pad numbers are sequential starting from 1', () => {
      const types = FootprintLibrary.getAllPackageTypes();
      for (const pkg of types) {
        const fp = FootprintLibrary.getFootprint(pkg)!;
        const numbers = fp.pads.map((p) => p.number).sort((a, b) => a - b);
        for (let i = 0; i < numbers.length; i++) {
          expect(numbers[i], `${pkg} pad numbers should be sequential`).toBe(i + 1);
        }
      }
    });
  });

  describe('generateFromConnectors', () => {
    it('generates a footprint from custom connectors', () => {
      const connectors: ConnectorInput[] = [
        { id: 'c1', name: 'VCC', position: { x: -2.54, y: 0 } },
        { id: 'c2', name: 'GND', position: { x: 2.54, y: 0 } },
      ];
      const fp = FootprintLibrary.generateFromConnectors(connectors);

      expect(fp.pads).toHaveLength(2);
      expect(fp.packageType).toBe('custom');
      expect(fp.mountingType).toBe('tht');
      expect(fp.pinCount).toBe(2);
      expect(fp.pads[0].position.x).toBe(-2.54);
      expect(fp.pads[1].position.x).toBe(2.54);
    });

    it('uses padSpec from connector when provided', () => {
      const connectors: ConnectorInput[] = [
        {
          id: 'c1',
          name: 'Pin1',
          padSpec: { type: 'smd', shape: 'rect', width: 1.0, height: 0.5 },
          position: { x: 0, y: 0 },
        },
      ];
      const fp = FootprintLibrary.generateFromConnectors(connectors);

      expect(fp.pads[0].type).toBe('smd');
      expect(fp.pads[0].shape).toBe('rect');
      expect(fp.pads[0].width).toBe(1.0);
      expect(fp.pads[0].height).toBe(0.5);
    });

    it('generates default THT pads when no padSpec is provided', () => {
      const connectors: ConnectorInput[] = [
        { id: 'c1', name: 'Pin1', position: { x: 0, y: 0 } },
      ];
      const fp = FootprintLibrary.generateFromConnectors(connectors);

      expect(fp.pads[0].type).toBe('tht');
      expect(fp.pads[0].drill).toBeGreaterThan(0);
    });

    it('generates courtyard and bounding box that enclose all pads', () => {
      const connectors: ConnectorInput[] = [
        { id: 'c1', name: 'A', position: { x: -5, y: -3 } },
        { id: 'c2', name: 'B', position: { x: 5, y: 3 } },
      ];
      const fp = FootprintLibrary.generateFromConnectors(connectors);

      // Courtyard should encompass all pads with margin
      expect(fp.courtyard.width).toBeGreaterThan(10);
      expect(fp.courtyard.height).toBeGreaterThan(6);
    });
  });

  describe('type exports', () => {
    it('Pad interface has required fields', () => {
      const fp = FootprintLibrary.getFootprint('DIP-8')!;
      const pad: Pad = fp.pads[0];
      expect(pad.number).toBeDefined();
      expect(pad.type).toBeDefined();
      expect(pad.shape).toBeDefined();
      expect(pad.position).toBeDefined();
      expect(pad.position.x).toBeDefined();
      expect(pad.position.y).toBeDefined();
      expect(pad.width).toBeDefined();
      expect(pad.height).toBeDefined();
      expect(pad.layer).toBeDefined();
    });

    it('Footprint interface has required fields', () => {
      const fp: Footprint = FootprintLibrary.getFootprint('SOIC-8')!;
      expect(fp.packageType).toBeDefined();
      expect(fp.description).toBeDefined();
      expect(fp.pads).toBeDefined();
      expect(fp.courtyard).toBeDefined();
      expect(fp.boundingBox).toBeDefined();
      expect(fp.silkscreen).toBeDefined();
      expect(fp.mountingType).toBeDefined();
      expect(fp.pinCount).toBeDefined();
    });
  });
});
