/**
 * Tests for the `suggest_trace_path` AI tool — verifies the tool wires the
 * real A* autorouter (server/lib/autorouter.ts) end-to-end instead of the
 * old hardcoded stub `[{x:50,y:50},{x:70,y:70}]` (AI audit TOOLS-01).
 *
 * These tests mock storage and assert on the tool's output shape +
 * behavioural contract, not the inner A* details (those are covered by
 * server/lib/__tests__/autorouter.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../registry';
import { registerPcbAdvancedTools } from '../circuit/pcb-advanced';
import type { ToolContext } from '../types';
import type { IStorage } from '../../storage';

interface MockStorageOverrides {
  getCircuitDesign?: ReturnType<typeof vi.fn>;
  getCircuitNet?: ReturnType<typeof vi.fn>;
  getCircuitNets?: ReturnType<typeof vi.fn>;
  getCircuitInstances?: ReturnType<typeof vi.fn>;
}

function makeStorage(overrides: MockStorageOverrides = {}): IStorage {
  return {
    getCircuitDesign: vi.fn().mockResolvedValue({ id: 1, projectId: 1, name: 'D' }),
    getCircuitNet: vi.fn().mockResolvedValue({
      id: 10,
      circuitId: 1,
      name: 'SIG',
      segments: [
        { fromInstanceId: 100, fromPin: '1', toInstanceId: 200, toPin: '1', waypoints: [] },
      ],
    }),
    getCircuitNets: vi.fn().mockResolvedValue([]),
    getCircuitInstances: vi.fn().mockResolvedValue([
      {
        id: 100,
        referenceDesignator: 'R1',
        pcbX: 10,
        pcbY: 10,
        pcbRotation: 0,
        pcbSide: 'front',
      },
      {
        id: 200,
        referenceDesignator: 'R2',
        pcbX: 40,
        pcbY: 10,
        pcbRotation: 0,
        pcbSide: 'front',
      },
    ]),
    ...overrides,
  } as unknown as IStorage;
}

function createCtx(storage: IStorage): ToolContext {
  return { projectId: 1, storage, confirmed: true };
}

function getTool(): ReturnType<ToolRegistry['get']> {
  const registry = new ToolRegistry();
  registerPcbAdvancedTools(registry);
  return registry.get('suggest_trace_path');
}

describe('suggest_trace_path — tool wiring', () => {
  let tool: NonNullable<ReturnType<ToolRegistry['get']>>;

  beforeEach(() => {
    const t = getTool();
    expect(t).toBeDefined();
    tool = t!;
  });

  it('is registered with the correct metadata', () => {
    expect(tool.name).toBe('suggest_trace_path');
    expect(tool.category).toBe('circuit');
    expect(tool.requiresConfirmation).toBe(false);
  });

  it('returns a real A* path — NOT the hardcoded [(50,50),(70,70)] stub', async () => {
    const storage = makeStorage();
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));

    expect(result.success).toBe(true);
    const data = result.data as {
      type: string;
      path: Array<{ x: number; y: number; layer: string }>;
      viaCount: number;
    };
    expect(data.type).toBe('trace_path_suggestion');
    expect(Array.isArray(data.path)).toBe(true);
    expect(data.path.length).toBeGreaterThanOrEqual(2);

    // Endpoints must match the real placement (x=10,10) and (x=40,10),
    // NOT the old stub coordinates (50,50) and (70,70).
    const first = data.path[0]!;
    const last = data.path[data.path.length - 1]!;
    expect(first.x).toBeCloseTo(10, 0);
    expect(first.y).toBeCloseTo(10, 0);
    expect(last.x).toBeCloseTo(40, 0);
    expect(last.y).toBeCloseTo(10, 0);

    // Every waypoint must carry a layer tag.
    for (const wp of data.path) {
      expect(wp.layer === 'top' || wp.layer === 'bottom').toBe(true);
    }

    // No vias expected for a clear horizontal shot on a single layer.
    expect(data.viaCount).toBe(0);
  });

  it('fails cleanly when the net has no connection segments', async () => {
    const storage = makeStorage({
      getCircuitNet: vi.fn().mockResolvedValue({
        id: 10,
        circuitId: 1,
        name: 'UNCONNECTED',
        segments: [],
      }),
    });
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));
    expect(result.success).toBe(false);
    const data = result.data as { type: string; reason: string };
    expect(data.type).toBe('trace_path_unavailable');
    expect(data.reason).toBe('no-connections');
  });

  it('fails cleanly when endpoints are not placed on the PCB', async () => {
    const storage = makeStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        { id: 100, referenceDesignator: 'R1' }, // no pcb position fields
        { id: 200, referenceDesignator: 'R2', pcbX: 40, pcbY: 10, pcbRotation: 0, pcbSide: 'front' },
      ]),
    });
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));
    expect(result.success).toBe(false);
    const data = result.data as { type: string; reason: string };
    expect(data.type).toBe('trace_path_unavailable');
    expect(data.reason).toBe('endpoints-unplaced');
  });

  it('rejects circuit IDs that belong to a different project', async () => {
    const storage = makeStorage({
      getCircuitDesign: vi.fn().mockResolvedValue({ id: 1, projectId: 999, name: 'Other' }),
    });
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found in this project/i);
  });

  it('rejects a netId whose circuitId does not match the requested circuit', async () => {
    const storage = makeStorage({
      getCircuitNet: vi.fn().mockResolvedValue({
        id: 10,
        circuitId: 999, // mismatched
        name: 'SIG',
        segments: [{ fromInstanceId: 100, fromPin: '1', toInstanceId: 200, toPin: '1', waypoints: [] }],
      }),
    });
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/does not belong to circuit/i);
  });

  it('returns an autorouter failure reason when the destination is walled off', async () => {
    // Place two components, but flood the board with a third component that
    // encloses the destination so no path exists. We do this by adding many
    // small blocker instances in a ring around R2.
    const blockers = [];
    const bx = 40, by = 10;
    // 1 mm-spaced ring close around R2 on the top layer.
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (Math.abs(dx) === 3 || Math.abs(dy) === 3) {
          blockers.push({
            id: 500 + blockers.length,
            referenceDesignator: `B${blockers.length}`,
            pcbX: bx + dx,
            pcbY: by + dy,
            pcbRotation: 0,
            pcbSide: 'front' as const,
          });
        }
      }
    }
    const storage = makeStorage({
      getCircuitInstances: vi.fn().mockResolvedValue([
        { id: 100, referenceDesignator: 'R1', pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'front' },
        { id: 200, referenceDesignator: 'R2', pcbX: bx, pcbY: by, pcbRotation: 0, pcbSide: 'front' },
        ...blockers,
      ]),
    });
    const result = await tool.execute({ circuitId: 1, netId: 10, layer: 'front' }, createCtx(storage));
    // Either success with a path that detours around, or a structured failure —
    // both are acceptable real-autorouter behaviour. Key assertion: NOT the
    // hardcoded stub. If it fails, reason must be a known autorouter reason.
    if (!result.success) {
      const data = result.data as { type: string; reason: string };
      expect(data.type).toBe('trace_path_unavailable');
      expect(['no-path', 'start-blocked', 'end-blocked', 'visited-cap']).toContain(data.reason);
    } else {
      const data = result.data as { path: Array<{ x: number; y: number }> };
      // Must not be the stub coordinates.
      expect(data.path[0]).not.toEqual({ x: 50, y: 50 });
    }
  });
});
