import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerArchitectureTools } from '../ai-tools/architecture';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerArchitectureTools(registry);
  return registry;
}

function createMockStorage(): IStorage {
  return {
    createNode: vi.fn().mockResolvedValue({
      id: 1,
      projectId: 1,
      nodeId: 'mock-uuid',
      nodeType: 'mcu',
      label: 'ESP32',
      positionX: 300,
      positionY: 200,
      data: null,
      version: 1,
      updatedAt: new Date(),
      deletedAt: null,
    }),
    getNodes: vi.fn().mockResolvedValue([]),
    getEdges: vi.fn().mockResolvedValue([]),
  } as unknown as IStorage;
}

function createCtx(storage?: IStorage): ToolContext {
  return {
    projectId: 1,
    storage: storage ?? createMockStorage(),
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('Architecture tools — registration', () => {
  const registry = createRegistry();

  const expectedTools = [
    'add_node',
    'remove_node',
    'update_node',
    'connect_nodes',
    'remove_edge',
    'clear_canvas',
    'generate_architecture',
    'auto_layout',
    'add_subcircuit',
    'assign_net_name',
    'create_sheet',
    'rename_sheet',
    'move_to_sheet',
    'select_node',
    'focus_node_in_view',
    'copy_architecture_summary',
    'copy_architecture_json',
    'search_datasheet',
    'set_pin_map',
    'auto_assign_pins',
  ];

  it.each(expectedTools)('registers "%s"', (name) => {
    expect(registry.get(name)).toBeDefined();
  });

  it('registers all architecture tools under the "architecture" category', () => {
    const archTools = registry.getByCategory('architecture');
    expect(archTools.length).toBe(expectedTools.length);
    for (const tool of archTools) {
      expect(tool.category).toBe('architecture');
    }
  });

  it('marks remove_node, remove_edge, and clear_canvas as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).toContain('remove_node');
    expect(destructive).toContain('remove_edge');
    expect(destructive).toContain('clear_canvas');
  });

  it('does not mark add_node as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).not.toContain('add_node');
  });
});

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

describe('Architecture tools — parameter validation', () => {
  const registry = createRegistry();

  describe('add_node', () => {
    it('accepts valid params with required fields only', () => {
      const result = registry.validate('add_node', {
        nodeType: 'mcu',
        label: 'ESP32',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts valid params with all optional fields', () => {
      const result = registry.validate('add_node', {
        nodeType: 'sensor',
        label: 'BME280',
        description: 'Temperature & humidity',
        positionX: 400,
        positionY: 250,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects missing nodeType', () => {
      const result = registry.validate('add_node', { label: 'ESP32' });
      expect(result.ok).toBe(false);
    });

    it('rejects missing label', () => {
      const result = registry.validate('add_node', { nodeType: 'mcu' });
      expect(result.ok).toBe(false);
    });

    it('rejects empty nodeType', () => {
      const result = registry.validate('add_node', { nodeType: '', label: 'ESP32' });
      expect(result.ok).toBe(false);
    });

    it('rejects empty label', () => {
      const result = registry.validate('add_node', { nodeType: 'mcu', label: '' });
      expect(result.ok).toBe(false);
    });
  });

  describe('connect_nodes', () => {
    it('accepts valid connection params', () => {
      const result = registry.validate('connect_nodes', {
        sourceLabel: 'ESP32',
        targetLabel: 'BME280',
        edgeLabel: 'I2C Bus',
        busType: 'I2C',
        voltage: '3.3V',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects missing sourceLabel', () => {
      const result = registry.validate('connect_nodes', { targetLabel: 'BME280' });
      expect(result.ok).toBe(false);
    });

    it('rejects empty targetLabel', () => {
      const result = registry.validate('connect_nodes', {
        sourceLabel: 'ESP32',
        targetLabel: '',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('generate_architecture', () => {
    it('accepts valid components and connections arrays', () => {
      const result = registry.validate('generate_architecture', {
        components: [
          { label: 'MCU', nodeType: 'mcu', description: 'Main controller', positionX: 300, positionY: 200 },
        ],
        connections: [
          { sourceLabel: 'MCU', targetLabel: 'Sensor', label: 'I2C' },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('rejects components missing required fields', () => {
      const result = registry.validate('generate_architecture', {
        components: [{ label: 'MCU' }],
        connections: [],
      });
      expect(result.ok).toBe(false);
    });

    it('rejects when components is not an array', () => {
      const result = registry.validate('generate_architecture', {
        components: 'not-an-array',
        connections: [],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('auto_layout', () => {
    it('accepts valid layout algorithm', () => {
      const result = registry.validate('auto_layout', { layout: 'hierarchical' });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid layout algorithm', () => {
      const result = registry.validate('auto_layout', { layout: 'random' });
      expect(result.ok).toBe(false);
    });

    it.each(['hierarchical', 'grid', 'circular', 'force'] as const)(
      'accepts layout "%s"',
      (layout) => {
        expect(registry.validate('auto_layout', { layout }).ok).toBe(true);
      },
    );
  });

  describe('add_subcircuit', () => {
    it('accepts valid template', () => {
      const result = registry.validate('add_subcircuit', { template: 'power_supply_ldo' });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid template', () => {
      const result = registry.validate('add_subcircuit', { template: 'not_a_template' });
      expect(result.ok).toBe(false);
    });
  });

  describe('set_pin_map', () => {
    it('accepts valid pin map', () => {
      const result = registry.validate('set_pin_map', {
        nodeLabel: 'ESP32',
        pins: { MOSI: 'GPIO23', SCK: 'GPIO18', CS: 'GPIO5' },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects missing pins field', () => {
      const result = registry.validate('set_pin_map', { nodeLabel: 'ESP32' });
      expect(result.ok).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Execution — add_node (the only architecture tool with a real executor)
// ---------------------------------------------------------------------------

describe('Architecture tools — add_node execution', () => {
  let registry: ToolRegistry;
  let mockStorage: IStorage;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    mockStorage = createMockStorage();
    ctx = createCtx(mockStorage);
  });

  it('calls storage.createNode with correct params', async () => {
    const result = await registry.execute(
      'add_node',
      { nodeType: 'mcu', label: 'ESP32' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createNode).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(mockStorage.createNode).mock.calls[0][0];
    expect(callArgs.projectId).toBe(1);
    expect(callArgs.nodeType).toBe('mcu');
    expect(callArgs.label).toBe('ESP32');
    expect(callArgs.nodeId).toBeDefined();
  });

  it('uses provided position when given', async () => {
    await registry.execute(
      'add_node',
      { nodeType: 'sensor', label: 'BME280', positionX: 500, positionY: 100 },
      ctx,
    );

    const callArgs = vi.mocked(mockStorage.createNode).mock.calls[0][0];
    expect(callArgs.positionX).toBe(500);
    expect(callArgs.positionY).toBe(100);
  });

  it('auto-places node when position is not provided', async () => {
    await registry.execute(
      'add_node',
      { nodeType: 'mcu', label: 'STM32' },
      ctx,
    );

    const callArgs = vi.mocked(mockStorage.createNode).mock.calls[0][0];
    expect(callArgs.positionX).toBeGreaterThanOrEqual(300);
    expect(callArgs.positionX).toBeLessThan(500);
    expect(callArgs.positionY).toBeGreaterThanOrEqual(200);
    expect(callArgs.positionY).toBeLessThan(400);
  });

  it('stores description in data field when provided', async () => {
    await registry.execute(
      'add_node',
      { nodeType: 'mcu', label: 'ESP32', description: 'WiFi+BLE SoC' },
      ctx,
    );

    const callArgs = vi.mocked(mockStorage.createNode).mock.calls[0][0];
    expect(callArgs.data).toEqual({ description: 'WiFi+BLE SoC' });
  });

  it('stores null data when no description provided', async () => {
    await registry.execute(
      'add_node',
      { nodeType: 'mcu', label: 'ESP32' },
      ctx,
    );

    const callArgs = vi.mocked(mockStorage.createNode).mock.calls[0][0];
    expect(callArgs.data).toBeNull();
  });

  it('returns success message with node label', async () => {
    const result = await registry.execute(
      'add_node',
      { nodeType: 'mcu', label: 'ESP32' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('ESP32');
    expect(result.message).toContain('mcu');
  });

  it('generates unique node IDs per call', async () => {
    await registry.execute('add_node', { nodeType: 'mcu', label: 'ESP32' }, ctx);
    await registry.execute('add_node', { nodeType: 'sensor', label: 'BME280' }, ctx);

    const firstId = vi.mocked(mockStorage.createNode).mock.calls[0][0].nodeId;
    const secondId = vi.mocked(mockStorage.createNode).mock.calls[1][0].nodeId;
    expect(firstId).not.toBe(secondId);
  });

  it('returns error for invalid params without calling storage', async () => {
    const result = await registry.execute(
      'add_node',
      { nodeType: '', label: '' },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(mockStorage.createNode).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Execution — client-action tools
// ---------------------------------------------------------------------------

describe('Architecture tools — client-action execution', () => {
  let registry: ToolRegistry;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    ctx = createCtx();
  });

  it('remove_node returns client action with nodeLabel', async () => {
    const result = await registry.execute('remove_node', { nodeLabel: 'ESP32' }, ctx);

    expect(result.success).toBe(true);
    expect(result.message).toContain('remove_node');
    expect(result.data).toMatchObject({ type: 'remove_node', nodeLabel: 'ESP32' });
  });

  it('update_node returns client action with update fields', async () => {
    const result = await registry.execute(
      'update_node',
      { nodeLabel: 'ESP32', newLabel: 'ESP32-S3', newType: 'mcu' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'update_node',
      nodeLabel: 'ESP32',
      newLabel: 'ESP32-S3',
    });
  });

  it('connect_nodes returns client action with connection data', async () => {
    const result = await registry.execute(
      'connect_nodes',
      { sourceLabel: 'ESP32', targetLabel: 'BME280', busType: 'I2C' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'connect_nodes',
      sourceLabel: 'ESP32',
      targetLabel: 'BME280',
      busType: 'I2C',
    });
  });

  it('remove_edge returns client action', async () => {
    const result = await registry.execute(
      'remove_edge',
      { sourceLabel: 'ESP32', targetLabel: 'BME280' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'remove_edge' });
  });

  it('clear_canvas returns client action', async () => {
    const result = await registry.execute('clear_canvas', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'clear_canvas' });
  });

  it('generate_architecture returns client action with components/connections', async () => {
    const params = {
      components: [
        { label: 'MCU', nodeType: 'mcu', description: 'Main', positionX: 300, positionY: 200 },
      ],
      connections: [
        { sourceLabel: 'MCU', targetLabel: 'Sensor', label: 'I2C' },
      ],
    };
    const result = await registry.execute('generate_architecture', params, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'generate_architecture', ...params });
  });

  it('auto_layout returns client action with layout algorithm', async () => {
    const result = await registry.execute('auto_layout', { layout: 'force' }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'auto_layout', layout: 'force' });
  });

  it('select_node returns client action', async () => {
    const result = await registry.execute('select_node', { nodeLabel: 'ESP32' }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'select_node', nodeLabel: 'ESP32' });
  });

  it('search_datasheet returns client action with query', async () => {
    const result = await registry.execute('search_datasheet', { query: 'STM32F407VG' }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'search_datasheet', query: 'STM32F407VG' });
  });
});

// ---------------------------------------------------------------------------
// Registry — unknown tool
// ---------------------------------------------------------------------------

describe('Architecture tools — registry edge cases', () => {
  const registry = createRegistry();
  const ctx = createCtx();

  it('validate returns error for unknown tool name', () => {
    const result = registry.validate('nonexistent_tool', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unknown tool');
    }
  });

  it('execute returns error for unknown tool name', async () => {
    const result = await registry.execute('nonexistent_tool', {}, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown tool');
  });

  it('prevents duplicate registration', () => {
    const reg = new ToolRegistry();
    registerArchitectureTools(reg);
    expect(() => registerArchitectureTools(reg)).toThrow('already registered');
  });
});
