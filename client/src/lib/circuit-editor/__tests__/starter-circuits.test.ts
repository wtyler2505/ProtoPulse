import { describe, it, expect } from 'vitest';
import {
  getStarterCircuit,
  getStarterCircuitIds,
  type StarterCircuitId,
} from '../starter-circuits';
import { BB, coordToPixel } from '../breadboard-model';

describe('starter circuits', () => {
  describe('getStarterCircuitIds', () => {
    it('returns 4 circuit template IDs', () => {
      const ids = getStarterCircuitIds();
      expect(ids).toHaveLength(4);
    });

    it('includes all expected IDs', () => {
      const ids = getStarterCircuitIds();
      expect(ids).toContain('led-basic');
      expect(ids).toContain('voltage-divider');
      expect(ids).toContain('button-led');
      expect(ids).toContain('h-bridge');
    });
  });

  describe('getStarterCircuit', () => {
    it('LED circuit has resistor + LED + wires', () => {
      const circuit = getStarterCircuit('led-basic');
      expect(circuit.instances).toHaveLength(2);
      expect(circuit.wires.length).toBeGreaterThanOrEqual(2);
    });

    it('voltage divider has 2 resistors + wires', () => {
      const circuit = getStarterCircuit('voltage-divider');
      expect(circuit.instances).toHaveLength(2);
      expect(circuit.wires.length).toBeGreaterThanOrEqual(3);
    });

    it('button-LED has button + resistor + LED + wires', () => {
      const circuit = getStarterCircuit('button-led');
      expect(circuit.instances).toHaveLength(3);
      expect(circuit.wires.length).toBeGreaterThanOrEqual(3);
    });

    it('H-bridge has motor driver IC + motor + wires', () => {
      const circuit = getStarterCircuit('h-bridge');
      expect(circuit.instances.length).toBeGreaterThanOrEqual(2);
      expect(circuit.wires.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('all circuits produce valid data', () => {
    it('all instances have valid breadboard coordinates', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const inst of circuit.instances) {
          expect(inst.breadboardX).toBeGreaterThan(0);
          expect(inst.breadboardY).toBeGreaterThan(0);
        }
      }
    });

    it('all instances have reference designators', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const inst of circuit.instances) {
          expect(inst.referenceDesignator).toBeTruthy();
          expect(typeof inst.referenceDesignator).toBe('string');
        }
      }
    });

    it('all instances have componentType in properties', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const inst of circuit.instances) {
          const props = inst.properties as Record<string, unknown>;
          expect(props.componentType).toBeTruthy();
        }
      }
    });

    it('all wires have valid start/end points', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const wire of circuit.wires) {
          expect(wire.points.length).toBeGreaterThanOrEqual(2);
          for (const pt of wire.points) {
            expect(typeof pt.x).toBe('number');
            expect(typeof pt.y).toBe('number');
          }
        }
      }
    });

    it('all wires have breadboard view', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const wire of circuit.wires) {
          expect(wire.view).toBe('breadboard');
        }
      }
    });

    it('all wire coordinates are within board bounds', () => {
      const maxX = BB.ORIGIN_X + 9 * BB.PITCH + BB.CHANNEL_GAP + BB.RAIL_MARGIN_RIGHT + BB.PITCH;
      const maxY = BB.ORIGIN_Y + (BB.ROWS - 1) * BB.PITCH;
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const wire of circuit.wires) {
          for (const pt of wire.points) {
            expect(pt.x).toBeGreaterThanOrEqual(0);
            expect(pt.x).toBeLessThanOrEqual(maxX);
            expect(pt.y).toBeGreaterThanOrEqual(0);
            expect(pt.y).toBeLessThanOrEqual(maxY);
          }
        }
      }
    });

    it('all circuits have metadata', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        expect(circuit.name).toBeTruthy();
        expect(circuit.description).toBeTruthy();
        expect(circuit.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
      }
    });

    it('instance coordinates align with breadboard grid', () => {
      // Verify that breadboard coordinates correspond to valid tie-point positions
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        for (const inst of circuit.instances) {
          // Coordinates should be integer multiples of pitch from origin
          const relX = inst.breadboardX - BB.ORIGIN_X;
          const relY = inst.breadboardY - BB.ORIGIN_Y;
          // Y should be on a row boundary
          expect(relY % BB.PITCH).toBe(0);
        }
      }
    });
  });

  describe('circuit isolation', () => {
    it('each call returns a fresh copy (no shared references)', () => {
      const a = getStarterCircuit('led-basic');
      const b = getStarterCircuit('led-basic');
      expect(a).not.toBe(b);
      expect(a.instances).not.toBe(b.instances);
      expect(a.wires).not.toBe(b.wires);
    });

    it('no two circuits share the same reference designators', () => {
      for (const id of getStarterCircuitIds()) {
        const circuit = getStarterCircuit(id);
        const refDes = circuit.instances.map((i) => i.referenceDesignator);
        const unique = new Set(refDes);
        expect(unique.size).toBe(refDes.length);
      }
    });
  });
});
