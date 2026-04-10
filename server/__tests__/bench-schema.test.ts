import { describe, it, expect } from 'vitest';
import {
  circuitInstances,
  circuitWires,
  insertCircuitInstanceSchema,
  insertCircuitWireSchema,
} from '@shared/schema';

describe('Bench Surface Schema Columns', () => {
  describe('circuitInstances — benchX / benchY', () => {
    it('has benchX column defined', () => {
      expect(circuitInstances.benchX).toBeDefined();
      expect(circuitInstances.benchX.name).toBe('bench_x');
    });

    it('has benchY column defined', () => {
      expect(circuitInstances.benchY).toBeDefined();
      expect(circuitInstances.benchY.name).toBe('bench_y');
    });

    it('benchX and benchY are nullable (no .notNull())', () => {
      // Drizzle columns without .notNull() have notNull = false in their config
      expect(circuitInstances.benchX.notNull).toBe(false);
      expect(circuitInstances.benchY.notNull).toBe(false);
    });

    it('insert schema accepts benchX and benchY', () => {
      const result = insertCircuitInstanceSchema.safeParse({
        circuitId: 1,
        referenceDesignator: 'R1',
        benchX: 150.5,
        benchY: 200.0,
      });
      expect(result.success).toBe(true);
    });

    it('insert schema accepts null benchX/benchY', () => {
      const result = insertCircuitInstanceSchema.safeParse({
        circuitId: 1,
        referenceDesignator: 'R1',
        benchX: null,
        benchY: null,
      });
      expect(result.success).toBe(true);
    });

    it('insert schema allows omitting benchX/benchY', () => {
      const result = insertCircuitInstanceSchema.safeParse({
        circuitId: 1,
        referenceDesignator: 'R1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('circuitWires — endpointMeta / provenance', () => {
    it('has endpointMeta column defined', () => {
      expect(circuitWires.endpointMeta).toBeDefined();
      expect(circuitWires.endpointMeta.name).toBe('endpoint_meta');
    });

    it('has provenance column defined', () => {
      expect(circuitWires.provenance).toBeDefined();
      expect(circuitWires.provenance.name).toBe('provenance');
    });

    it('provenance defaults to "manual"', () => {
      expect(circuitWires.provenance.default).toBe('manual');
    });

    it('insert schema accepts endpointMeta object', () => {
      const result = insertCircuitWireSchema.safeParse({
        circuitId: 1,
        netId: 1,
        view: 'breadboard',
        endpointMeta: {
          start: { type: 'hole', col: 'a', row: 5 },
          end: { type: 'bench-pin', instanceId: 42, pinId: 'VCC' },
        },
      });
      expect(result.success).toBe(true);
    });

    it('insert schema accepts provenance values', () => {
      for (const prov of ['manual', 'synced', 'coach', 'jumper']) {
        const result = insertCircuitWireSchema.safeParse({
          circuitId: 1,
          netId: 1,
          view: 'breadboard',
          provenance: prov,
        });
        expect(result.success).toBe(true);
      }
    });

    it('insert schema allows omitting endpointMeta and provenance', () => {
      const result = insertCircuitWireSchema.safeParse({
        circuitId: 1,
        netId: 1,
        view: 'breadboard',
      });
      expect(result.success).toBe(true);
    });
  });
});
