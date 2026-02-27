import { describe, it, expect } from 'vitest';
import { runDrcGate, type DrcGateInput } from '../export/drc-gate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<DrcGateInput> = {}): DrcGateInput {
  return {
    instances: [],
    nets: [],
    wires: [],
    boardWidth: 100,
    boardHeight: 80,
    ...overrides,
  };
}

function placedInstance(id: number, refDes: string, x: number, y: number) {
  return { id, referenceDesignator: refDes, pcbX: x, pcbY: y, pcbSide: 'front', connectors: [] };
}

function unplacedInstance(id: number, refDes: string) {
  return { id, referenceDesignator: refDes, pcbX: null, pcbY: null, pcbSide: null, connectors: [] };
}

function net(id: number, name: string, segCount: number) {
  const segments = Array.from({ length: segCount }, (_, i) => ({
    fromInstanceId: i,
    fromPin: `pin${i}`,
    toInstanceId: i + 1,
    toPin: `pin${i + 1}`,
  }));
  return { id, name, segments };
}

function pcbWire(netId: number, opts: Partial<{ points: Array<{ x: number; y: number }>; width: number; layer: string }> = {}) {
  return {
    netId,
    view: 'pcb',
    layer: opts.layer ?? 'front',
    points: opts.points ?? [{ x: 10, y: 10 }, { x: 50, y: 10 }],
    width: opts.width ?? 0.25,
  };
}

// =============================================================================
// runDrcGate
// =============================================================================

describe('runDrcGate', () => {

  // -------------------------------------------------------------------------
  // Clean circuit — no violations
  // -------------------------------------------------------------------------

  it('clean circuit with no issues → passed: true, zero errors, zero warnings', () => {
    const result = runDrcGate(makeInput({
      instances: [placedInstance(1, 'R1', 10, 10)],
      nets: [net(1, 'VCC', 1)],
      wires: [pcbWire(1)],
    }));

    expect(result.passed).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.violations).toHaveLength(0);
    expect(result.message).toContain('ready for manufacturing');
  });

  it('empty input → passed: true (nothing to violate)', () => {
    const result = runDrcGate(makeInput());
    expect(result.passed).toBe(true);
    expect(result.errors).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Rule: unplaced-component
  // -------------------------------------------------------------------------

  describe('unplaced-component', () => {
    it('instance with null pcbX/pcbY → error', () => {
      const result = runDrcGate(makeInput({
        instances: [unplacedInstance(1, 'U1')],
      }));

      expect(result.passed).toBe(false);
      expect(result.errors).toBe(1);
      const v = result.violations.find(v => v.rule === 'unplaced-component');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('error');
      expect(v!.message).toContain('U1');
    });

    it('placed instance does not trigger unplaced rule', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'U1', 10, 10)],
      }));
      expect(result.violations.filter(v => v.rule === 'unplaced-component')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: out-of-bounds
  // -------------------------------------------------------------------------

  describe('out-of-bounds', () => {
    it('instance at negative coordinates → warning', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', -5, 10)],
      }));

      const v = result.violations.find(v => v.rule === 'out-of-bounds');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('warning');
      expect(v!.location).toEqual({ x: -5, y: 10 });
    });

    it('instance beyond board width → warning', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', 150, 10)],
        boardWidth: 100,
      }));
      expect(result.violations.some(v => v.rule === 'out-of-bounds')).toBe(true);
    });

    it('instance within bounds → no out-of-bounds warning', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', 50, 40)],
      }));
      expect(result.violations.filter(v => v.rule === 'out-of-bounds')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: unrouted-net
  // -------------------------------------------------------------------------

  describe('unrouted-net', () => {
    it('net with segments but no PCB wire → error', () => {
      const result = runDrcGate(makeInput({
        nets: [net(1, 'VCC', 2)],
        wires: [],
      }));

      const v = result.violations.find(v => v.rule === 'unrouted-net');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('error');
      expect(v!.message).toContain('VCC');
    });

    it('net with segments and matching PCB wire → no error', () => {
      const result = runDrcGate(makeInput({
        nets: [net(1, 'VCC', 1)],
        wires: [pcbWire(1)],
      }));
      expect(result.violations.filter(v => v.rule === 'unrouted-net')).toHaveLength(0);
    });

    it('net with zero segments → not flagged (no connections expected)', () => {
      const result = runDrcGate(makeInput({
        nets: [{ id: 1, name: 'EMPTY', segments: [] }],
      }));
      expect(result.violations.filter(v => v.rule === 'unrouted-net')).toHaveLength(0);
    });

    it('non-PCB wire does not count as routed', () => {
      const result = runDrcGate(makeInput({
        nets: [net(1, 'SIG', 1)],
        wires: [{ netId: 1, view: 'schematic', layer: 'front', points: [{ x: 0, y: 0 }], width: 0.25 }],
      }));
      expect(result.violations.some(v => v.rule === 'unrouted-net')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: min-trace-width
  // -------------------------------------------------------------------------

  describe('min-trace-width', () => {
    it('trace below minimum width → error', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { width: 0.1 })],
        minTraceWidth: 0.15,
      }));

      const v = result.violations.find(v => v.rule === 'min-trace-width');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('error');
      expect(v!.message).toContain('0.100');
    });

    it('trace at exactly minimum width → no error', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { width: 0.15 })],
        minTraceWidth: 0.15,
      }));
      expect(result.violations.filter(v => v.rule === 'min-trace-width')).toHaveLength(0);
    });

    it('trace above minimum width → no error', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { width: 0.5 })],
        minTraceWidth: 0.15,
      }));
      expect(result.violations.filter(v => v.rule === 'min-trace-width')).toHaveLength(0);
    });

    it('uses default minTraceWidth of 0.15 when not specified', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { width: 0.10 })],
      }));
      expect(result.violations.some(v => v.rule === 'min-trace-width')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: trace-out-of-bounds
  // -------------------------------------------------------------------------

  describe('trace-out-of-bounds', () => {
    it('trace point far outside board → warning', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { points: [{ x: 200, y: 10 }] })],
        boardWidth: 100,
      }));

      const v = result.violations.find(v => v.rule === 'trace-out-of-bounds');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('warning');
    });

    it('trace point within clearance tolerance → no warning', () => {
      // With default clearance=0.2, a point at 100.1 on a 100mm board is within tolerance
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { points: [{ x: 100.1, y: 10 }] })],
        boardWidth: 100,
        clearance: 0.2,
      }));
      expect(result.violations.filter(v => v.rule === 'trace-out-of-bounds')).toHaveLength(0);
    });

    it('only one warning per wire even if multiple points are out of bounds', () => {
      const result = runDrcGate(makeInput({
        wires: [pcbWire(1, { points: [{ x: 200, y: 200 }, { x: 300, y: 300 }] })],
      }));
      const outOfBounds = result.violations.filter(v => v.rule === 'trace-out-of-bounds');
      expect(outOfBounds).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: invalid-board-outline
  // -------------------------------------------------------------------------

  describe('invalid-board-outline', () => {
    it('zero board width → error', () => {
      const result = runDrcGate(makeInput({ boardWidth: 0 }));
      expect(result.violations.some(v => v.rule === 'invalid-board-outline')).toBe(true);
    });

    it('negative board dimensions → error', () => {
      const result = runDrcGate(makeInput({ boardWidth: -10, boardHeight: -5 }));
      const v = result.violations.find(v => v.rule === 'invalid-board-outline');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('error');
    });

    it('valid board dimensions → no error', () => {
      const result = runDrcGate(makeInput({ boardWidth: 100, boardHeight: 80 }));
      expect(result.violations.filter(v => v.rule === 'invalid-board-outline')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: clearance-violation
  // -------------------------------------------------------------------------

  describe('clearance-violation', () => {
    it('two traces from different nets too close on same layer → error', () => {
      const result = runDrcGate(makeInput({
        wires: [
          pcbWire(1, { points: [{ x: 10, y: 10 }], width: 0.2, layer: 'front' }),
          pcbWire(2, { points: [{ x: 10.1, y: 10 }], width: 0.2, layer: 'front' }),
        ],
        clearance: 0.2,
      }));

      const v = result.violations.find(v => v.rule === 'clearance-violation');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('error');
    });

    it('two traces from same net → no clearance violation', () => {
      const result = runDrcGate(makeInput({
        wires: [
          pcbWire(1, { points: [{ x: 10, y: 10 }], width: 0.2, layer: 'front' }),
          pcbWire(1, { points: [{ x: 10.1, y: 10 }], width: 0.2, layer: 'front' }),
        ],
      }));
      expect(result.violations.filter(v => v.rule === 'clearance-violation')).toHaveLength(0);
    });

    it('two traces on different layers → no clearance violation', () => {
      const result = runDrcGate(makeInput({
        wires: [
          pcbWire(1, { points: [{ x: 10, y: 10 }], width: 0.2, layer: 'front' }),
          pcbWire(2, { points: [{ x: 10, y: 10 }], width: 0.2, layer: 'back' }),
        ],
      }));
      expect(result.violations.filter(v => v.rule === 'clearance-violation')).toHaveLength(0);
    });

    it('two traces far apart → no clearance violation', () => {
      const result = runDrcGate(makeInput({
        wires: [
          pcbWire(1, { points: [{ x: 10, y: 10 }], width: 0.2, layer: 'front' }),
          pcbWire(2, { points: [{ x: 50, y: 50 }], width: 0.2, layer: 'front' }),
        ],
      }));
      expect(result.violations.filter(v => v.rule === 'clearance-violation')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Result shape — passed, errors, warnings, message
  // -------------------------------------------------------------------------

  describe('result shape', () => {
    it('zero errors → passed: true', () => {
      const result = runDrcGate(makeInput());
      expect(result.passed).toBe(true);
    });

    it('one or more errors → passed: false', () => {
      const result = runDrcGate(makeInput({
        instances: [unplacedInstance(1, 'U1')],
      }));
      expect(result.passed).toBe(false);
    });

    it('warnings only → passed: true (warnings do not block)', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', -5, 10)],
      }));
      expect(result.passed).toBe(true);
      expect(result.warnings).toBeGreaterThan(0);
    });

    it('message mentions error count when failed', () => {
      const result = runDrcGate(makeInput({
        instances: [unplacedInstance(1, 'U1'), unplacedInstance(2, 'U2')],
      }));
      expect(result.message).toContain('2 errors');
      expect(result.message).toContain('DRC failed');
    });

    it('message mentions warnings when passed with warnings', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', -5, 10)],
      }));
      expect(result.message).toContain('warning');
      expect(result.message).toContain('review before export');
    });

    it('errors count matches actual error violations', () => {
      const result = runDrcGate(makeInput({
        instances: [unplacedInstance(1, 'U1')],
        nets: [net(1, 'VCC', 1)],
      }));
      const actualErrors = result.violations.filter(v => v.severity === 'error').length;
      expect(result.errors).toBe(actualErrors);
    });

    it('warnings count matches actual warning violations', () => {
      const result = runDrcGate(makeInput({
        instances: [placedInstance(1, 'R1', -5, 10), placedInstance(2, 'R2', 200, 10)],
      }));
      const actualWarnings = result.violations.filter(v => v.severity === 'warning').length;
      expect(result.warnings).toBe(actualWarnings);
    });
  });
});
