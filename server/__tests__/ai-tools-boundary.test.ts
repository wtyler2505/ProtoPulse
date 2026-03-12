/**
 * AI Tool Registry boundary tests.
 *
 * Validates registry completeness, schema correctness, input rejection,
 * confirmation enforcement, context validation, error structure, category
 * isolation, and format converter outputs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerNavigationTools } from '../ai-tools/navigation';
import { registerArchitectureTools } from '../ai-tools/architecture';
import { registerBomTools } from '../ai-tools/bom';
import { registerValidationTools } from '../ai-tools/validation';
import { registerProjectTools } from '../ai-tools/project';
import { registerCircuitTools, registerPcbTools, registerCircuitCodeTools } from '../ai-tools/circuit';
import { registerComponentTools } from '../ai-tools/component';
import { registerExportTools } from '../ai-tools/export';
import { registerVisionTools } from '../ai-tools/vision';
import { registerGenerativeTools } from '../ai-tools/generative';
import type { ToolContext, ToolCategory, ToolDefinition } from '../ai-tools/types';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fully populated registry identical to the production singleton. */
function createFullRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNavigationTools(registry);
  registerArchitectureTools(registry);
  registerBomTools(registry);
  registerValidationTools(registry);
  registerProjectTools(registry);
  registerCircuitTools(registry);
  registerComponentTools(registry);
  registerPcbTools(registry);
  registerCircuitCodeTools(registry);
  registerExportTools(registry);
  registerVisionTools(registry);
  registerGenerativeTools(registry);
  return registry;
}

function createMockStorage(): IStorage {
  return {
    createNode: vi.fn().mockResolvedValue({ id: 1, nodeId: 'mock-uuid', label: 'Test', nodeType: 'mcu', projectId: 1, positionX: 300, positionY: 200, data: null, version: 1, updatedAt: new Date(), deletedAt: null }),
    getNodes: vi.fn().mockResolvedValue([]),
    getEdges: vi.fn().mockResolvedValue([]),
    createBomItem: vi.fn().mockResolvedValue({ id: 1 }),
    getBomItems: vi.fn().mockResolvedValue([]),
    createValidationIssue: vi.fn().mockResolvedValue({ id: 1 }),
    getValidationIssues: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Test', description: '' }),
    updateProject: vi.fn().mockResolvedValue({ id: 1, name: 'Renamed' }),
    createCircuitDesign: vi.fn().mockResolvedValue({ id: 1, name: 'Test Circuit' }),
    getCircuitDesigns: vi.fn().mockResolvedValue([]),
    createCircuitInstance: vi.fn().mockResolvedValue({ id: 1 }),
    deleteCircuitInstance: vi.fn().mockResolvedValue(true),
    createCircuitNet: vi.fn().mockResolvedValue({ id: 1 }),
    deleteCircuitNet: vi.fn().mockResolvedValue(true),
    createCircuitWire: vi.fn().mockResolvedValue({ id: 1 }),
    deleteCircuitWire: vi.fn().mockResolvedValue(true),
    getCircuitInstances: vi.fn().mockResolvedValue([]),
    getCircuitNets: vi.fn().mockResolvedValue([]),
    getCircuitWires: vi.fn().mockResolvedValue([]),
    createComponentPart: vi.fn().mockResolvedValue({ id: 1 }),
    getComponentPart: vi.fn().mockResolvedValue(null),
    getComponentParts: vi.fn().mockResolvedValue([]),
    updateComponentPart: vi.fn().mockResolvedValue(true),
    deleteComponentPart: vi.fn().mockResolvedValue(true),
  } as unknown as IStorage;
}

function createCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    projectId: 1,
    storage: createMockStorage(),
    confirmed: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// All 12 registration functions
// ---------------------------------------------------------------------------

const ALL_REGISTRATION_FUNCTIONS = [
  { name: 'navigation', fn: registerNavigationTools },
  { name: 'architecture', fn: registerArchitectureTools },
  { name: 'bom', fn: registerBomTools },
  { name: 'validation', fn: registerValidationTools },
  { name: 'project', fn: registerProjectTools },
  { name: 'circuit (schematic)', fn: registerCircuitTools },
  { name: 'component', fn: registerComponentTools },
  { name: 'pcb', fn: registerPcbTools },
  { name: 'circuit-code', fn: registerCircuitCodeTools },
  { name: 'export', fn: registerExportTools },
  { name: 'vision', fn: registerVisionTools },
  { name: 'generative', fn: registerGenerativeTools },
] as const;

// ---------------------------------------------------------------------------
// 1. Registry completeness
// ---------------------------------------------------------------------------

describe('Registry completeness', () => {
  const registry = createFullRegistry();
  const allTools = registry.getAll();

  it('registers all 12 tool modules', () => {
    // Each registration function should add at least 1 tool
    for (const { name, fn } of ALL_REGISTRATION_FUNCTIONS) {
      const r = new ToolRegistry();
      fn(r);
      expect(r.getAll().length).toBeGreaterThan(0);
    }
  });

  it('registers exactly 99 tools total', () => {
    expect(allTools).toHaveLength(99);
  });

  it('every registered tool has a unique name', () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers all 8 ToolCategory values', () => {
    const categories = new Set(allTools.map((t) => t.category));
    const expected: ToolCategory[] = [
      'architecture',
      'circuit',
      'component',
      'bom',
      'validation',
      'export',
      'project',
      'navigation',
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('architecture category registers 22 tools', () => {
    expect(registry.getByCategory('architecture')).toHaveLength(22);
  });

  it('circuit category registers 23 tools', () => {
    expect(registry.getByCategory('circuit')).toHaveLength(23);
  });

  it('bom category registers 12 tools', () => {
    expect(registry.getByCategory('bom')).toHaveLength(12);
  });

  it('validation category registers 11 tools', () => {
    expect(registry.getByCategory('validation')).toHaveLength(11);
  });

  it('export category registers 12 tools', () => {
    expect(registry.getByCategory('export')).toHaveLength(12);
  });

  it('project category registers 10 tools', () => {
    expect(registry.getByCategory('project')).toHaveLength(10);
  });

  it('navigation category registers 2 tools', () => {
    expect(registry.getByCategory('navigation')).toHaveLength(2);
  });

  it('component category registers 7 tools (6 component + 1 vision)', () => {
    expect(registry.getByCategory('component')).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// 2. Schema validation — every tool has valid JSON schema
// ---------------------------------------------------------------------------

describe('Schema validation — every tool has a valid Zod parameter schema', () => {
  const registry = createFullRegistry();
  const allTools = registry.getAll();

  it.each(allTools.map((t) => t.name))('tool "%s" has a parsable parameter schema', (name) => {
    const tool = registry.get(name);
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();
    expect(typeof tool!.parameters.safeParse).toBe('function');
  });

  it('every tool has a non-empty description', () => {
    for (const tool of allTools) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('every tool has requiresConfirmation as a boolean', () => {
    for (const tool of allTools) {
      expect(typeof tool.requiresConfirmation).toBe('boolean');
    }
  });

  it('every tool has an async execute function', () => {
    for (const tool of allTools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Input rejection — each category rejects invalid inputs
// ---------------------------------------------------------------------------

describe('Input rejection — architecture tools', () => {
  const registry = createFullRegistry();

  it('add_node rejects non-string nodeType', () => {
    const r = registry.validate('add_node', { nodeType: 123, label: 'MCU' });
    expect(r.ok).toBe(false);
  });

  it('add_node rejects null params', () => {
    const r = registry.validate('add_node', null);
    expect(r.ok).toBe(false);
  });

  it('add_node rejects empty object', () => {
    const r = registry.validate('add_node', {});
    expect(r.ok).toBe(false);
  });

  it('generate_architecture rejects string instead of array for components', () => {
    const r = registry.validate('generate_architecture', {
      components: 'not-array',
      connections: [],
    });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — circuit tools', () => {
  const registry = createFullRegistry();

  it('create_circuit rejects empty name', () => {
    const r = registry.validate('create_circuit', { name: '' });
    expect(r.ok).toBe(false);
  });

  it('place_component rejects negative circuitId', () => {
    const r = registry.validate('place_component', {
      circuitId: -1,
      partId: 1,
      referenceDesignator: 'U1',
    });
    expect(r.ok).toBe(false);
  });

  it('place_component rejects zero partId', () => {
    const r = registry.validate('place_component', {
      circuitId: 1,
      partId: 0,
      referenceDesignator: 'U1',
    });
    expect(r.ok).toBe(false);
  });

  it('place_component rejects missing referenceDesignator', () => {
    const r = registry.validate('place_component', { circuitId: 1, partId: 1 });
    expect(r.ok).toBe(false);
  });

  it('draw_net rejects invalid netType', () => {
    const r = registry.validate('draw_net', {
      circuitId: 1,
      name: 'VCC',
      netType: 'invalid',
    });
    expect(r.ok).toBe(false);
  });

  it('place_power_symbol rejects invalid symbolType', () => {
    const r = registry.validate('place_power_symbol', {
      circuitId: 1,
      symbolType: 'INVALID',
    });
    expect(r.ok).toBe(false);
  });

  it('place_breadboard_wire rejects single-point path', () => {
    const r = registry.validate('place_breadboard_wire', {
      circuitId: 1,
      netId: 1,
      points: [{ x: 0, y: 0 }],
    });
    expect(r.ok).toBe(false);
  });

  it('draw_pcb_trace rejects non-positive width', () => {
    const r = registry.validate('draw_pcb_trace', {
      circuitId: 1,
      netId: 1,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      width: 0,
    });
    expect(r.ok).toBe(false);
  });

  it('draw_pcb_trace rejects invalid layer', () => {
    const r = registry.validate('draw_pcb_trace', {
      circuitId: 1,
      netId: 1,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      layer: 'middle',
    });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — BOM tools', () => {
  const registry = createFullRegistry();

  it('add_bom_item rejects empty partNumber', () => {
    const r = registry.validate('add_bom_item', {
      partNumber: '',
      manufacturer: 'Test',
      description: 'Test',
    });
    expect(r.ok).toBe(false);
  });

  it('add_bom_item rejects negative unitPrice', () => {
    const r = registry.validate('add_bom_item', {
      partNumber: 'PN001',
      manufacturer: 'Test',
      description: 'Test',
      unitPrice: -5,
    });
    expect(r.ok).toBe(false);
  });

  it('add_datasheet_link rejects invalid URL', () => {
    const r = registry.validate('add_datasheet_link', {
      partNumber: 'PN001',
      url: 'not-a-url',
    });
    expect(r.ok).toBe(false);
  });

  it('parametric_search rejects empty category', () => {
    const r = registry.validate('parametric_search', {
      category: '',
      specs: {},
    });
    expect(r.ok).toBe(false);
  });

  it('suggest_alternatives rejects invalid reason', () => {
    const r = registry.validate('suggest_alternatives', {
      partNumber: 'PN001',
      reason: 'invalid_reason',
    });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — validation tools', () => {
  const registry = createFullRegistry();

  it('add_validation_issue rejects invalid severity', () => {
    const r = registry.validate('add_validation_issue', {
      severity: 'critical',
      message: 'Test',
    });
    expect(r.ok).toBe(false);
  });

  it('add_validation_issue rejects empty message', () => {
    const r = registry.validate('add_validation_issue', {
      severity: 'error',
      message: '',
    });
    expect(r.ok).toBe(false);
  });

  it('generate_test_plan rejects invalid focus', () => {
    const r = registry.validate('generate_test_plan', { focus: 'nonexistent' });
    expect(r.ok).toBe(false);
  });

  it('design_review rejects invalid focus', () => {
    const r = registry.validate('design_review', { focus: 'not_valid' });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — project tools', () => {
  const registry = createFullRegistry();

  it('rename_project rejects empty name', () => {
    const r = registry.validate('rename_project', { name: '' });
    expect(r.ok).toBe(false);
  });

  it('rename_project rejects name over 200 chars', () => {
    const r = registry.validate('rename_project', { name: 'x'.repeat(201) });
    expect(r.ok).toBe(false);
  });

  it('set_project_type rejects invalid type', () => {
    const r = registry.validate('set_project_type', { projectType: 'space' });
    expect(r.ok).toBe(false);
  });

  it('start_tutorial rejects invalid topic', () => {
    const r = registry.validate('start_tutorial', { topic: 'nonexistent' });
    expect(r.ok).toBe(false);
  });

  it('add_annotation rejects invalid color', () => {
    const r = registry.validate('add_annotation', {
      nodeLabel: 'ESP32',
      note: 'Check this',
      color: 'purple',
    });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — component tools', () => {
  const registry = createFullRegistry();

  it('create_component_part rejects empty title', () => {
    const r = registry.validate('create_component_part', { title: '' });
    expect(r.ok).toBe(false);
  });

  it('modify_component rejects non-positive partId', () => {
    const r = registry.validate('modify_component', { partId: 0 });
    expect(r.ok).toBe(false);
  });

  it('delete_component_part rejects missing partId', () => {
    const r = registry.validate('delete_component_part', {});
    expect(r.ok).toBe(false);
  });

  it('fork_library_component rejects string id', () => {
    const r = registry.validate('fork_library_component', { libraryEntryId: 'abc' });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — export tools', () => {
  const registry = createFullRegistry();

  it('export_bom_csv rejects invalid format', () => {
    const r = registry.validate('export_bom_csv', { format: 'invalid' });
    expect(r.ok).toBe(false);
  });

  it('export_design_report rejects invalid format', () => {
    const r = registry.validate('export_design_report', { format: 'pdf' });
    expect(r.ok).toBe(false);
  });

  it('export_spice rejects non-positive circuitId', () => {
    const r = registry.validate('export_spice', { circuitId: -1 });
    expect(r.ok).toBe(false);
  });

  it('export_gerber rejects float circuitId', () => {
    const r = registry.validate('export_gerber', { circuitId: 1.5 });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — navigation tools', () => {
  const registry = createFullRegistry();

  it('switch_view rejects boolean view', () => {
    const r = registry.validate('switch_view', { view: true });
    expect(r.ok).toBe(false);
  });

  it('switch_schematic_sheet rejects number sheetId', () => {
    const r = registry.validate('switch_schematic_sheet', { sheetId: 42 });
    expect(r.ok).toBe(false);
  });
});

describe('Input rejection — vision tools', () => {
  const registry = createFullRegistry();

  it('identify_component_from_image rejects empty image_data', () => {
    const r = registry.validate('identify_component_from_image', { image_data: '' });
    expect(r.ok).toBe(false);
  });

  it('identify_component_from_image rejects missing image_data', () => {
    const r = registry.validate('identify_component_from_image', {});
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Confirmation enforcement
// ---------------------------------------------------------------------------

describe('Confirmation enforcement', () => {
  const registry = createFullRegistry();
  const destructiveTools = registry.getDestructiveTools();

  it('destructive tools list is non-empty', () => {
    expect(destructiveTools.length).toBeGreaterThan(0);
  });

  it('includes known destructive tools', () => {
    const knownDestructive = [
      'remove_node',
      'remove_edge',
      'clear_canvas',
      'remove_bom_item',
      'clear_validation',
      'remove_component_instance',
      'remove_net',
      'remove_wire',
      'delete_component_part',
    ];
    for (const name of knownDestructive) {
      expect(destructiveTools).toContain(name);
    }
  });

  it('non-destructive tools are NOT in destructive list', () => {
    const nonDestructive = [
      'add_node',
      'add_bom_item',
      'rename_project',
      'switch_view',
      'create_circuit',
      'export_kicad',
    ];
    for (const name of nonDestructive) {
      expect(destructiveTools).not.toContain(name);
    }
  });

  it.each(destructiveTools)(
    'destructive tool "%s" rejects execution without confirmed=true',
    async (toolName) => {
      const tool = registry.get(toolName)!;
      // Build minimal valid params for each tool's schema
      const dummyResult = tool.parameters.safeParse({});
      // Some destructive tools need params — use the tool's defaults or minimal valid
      const validParams = getMinimalValidParams(toolName);
      const ctx = createCtx({ confirmed: false });
      const result = await registry.execute(toolName, validParams, ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires user confirmation');
      expect(result.data).toEqual(
        expect.objectContaining({ requiresConfirmation: true, toolName }),
      );
    },
  );

  it.each(destructiveTools)(
    'destructive tool "%s" rejects when confirmed is undefined',
    async (toolName) => {
      const validParams = getMinimalValidParams(toolName);
      const ctx = createCtx({ confirmed: undefined });
      const result = await registry.execute(toolName, validParams, ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires user confirmation');
    },
  );
});

/**
 * Return minimal valid params that pass schema validation for destructive tools.
 */
function getMinimalValidParams(toolName: string): Record<string, unknown> {
  const paramsMap: Record<string, Record<string, unknown>> = {
    remove_node: { nodeLabel: 'ESP32' },
    remove_edge: { sourceLabel: 'A', targetLabel: 'B' },
    clear_canvas: {},
    remove_bom_item: { partNumber: 'PN001' },
    clear_validation: {},
    remove_component_instance: { instanceId: 1 },
    remove_net: { netId: 1 },
    remove_wire: { wireId: 1 },
    delete_component_part: { partId: 1 },
  };
  return paramsMap[toolName] ?? {};
}

// ---------------------------------------------------------------------------
// 5. Error structure — failed tools return { success: false, message: string }
// ---------------------------------------------------------------------------

describe('Error structure', () => {
  const registry = createFullRegistry();

  it('unknown tool returns { success: false } with descriptive message', async () => {
    const ctx = createCtx();
    const result = await registry.execute('totally_fake_tool', {}, ctx);

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe('string');
    expect(result.message).toContain('Unknown tool');
    expect(result.data).toBeUndefined();
  });

  it('validation failure returns { success: false } without data', async () => {
    const ctx = createCtx();
    const result = await registry.execute('add_node', { nodeType: 123, label: '' }, ctx);

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe('string');
    expect(result.message).toContain('Invalid params');
    expect(result.data).toBeUndefined();
  });

  it('validate() returns { ok: false, error: string } for invalid params', () => {
    const v = registry.validate('add_node', { nodeType: '' });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(typeof v.error).toBe('string');
      expect(v.error.length).toBeGreaterThan(0);
    }
  });

  it('validate() returns { ok: false } for unknown tool', () => {
    const v = registry.validate('nonexistent', {});
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.error).toContain('Unknown tool');
    }
  });

  it('validate() returns { ok: true, params } for valid input', () => {
    const v = registry.validate('rename_project', { name: 'New Name' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params).toEqual({ name: 'New Name' });
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Category isolation — tools in one category don't collide
// ---------------------------------------------------------------------------

describe('Category isolation', () => {
  it('registering modules in separate registries produces no name collisions', () => {
    const names = new Set<string>();
    let collision = false;

    for (const { fn } of ALL_REGISTRATION_FUNCTIONS) {
      const r = new ToolRegistry();
      fn(r);
      for (const tool of r.getAll()) {
        if (names.has(tool.name)) {
          collision = true;
        }
        names.add(tool.name);
      }
    }

    expect(collision).toBe(false);
  });

  it('getByCategory returns only tools in the requested category', () => {
    const registry = createFullRegistry();
    const categories: ToolCategory[] = [
      'architecture',
      'circuit',
      'component',
      'bom',
      'validation',
      'export',
      'project',
      'navigation',
    ];

    for (const cat of categories) {
      const tools = registry.getByCategory(cat);
      for (const tool of tools) {
        expect(tool.category).toBe(cat);
      }
    }
  });

  it('sum of per-category counts equals total', () => {
    const registry = createFullRegistry();
    const categories: ToolCategory[] = [
      'architecture',
      'circuit',
      'component',
      'bom',
      'validation',
      'export',
      'project',
      'navigation',
    ];

    let sum = 0;
    for (const cat of categories) {
      sum += registry.getByCategory(cat).length;
    }
    expect(sum).toBe(registry.getAll().length);
  });
});

// ---------------------------------------------------------------------------
// 7. Duplicate registration prevention
// ---------------------------------------------------------------------------

describe('Duplicate registration prevention', () => {
  it.each(ALL_REGISTRATION_FUNCTIONS.map((r) => r.name))(
    'module "%s" throws when registered twice',
    (moduleName) => {
      const entry = ALL_REGISTRATION_FUNCTIONS.find((r) => r.name === moduleName)!;
      const r = new ToolRegistry();
      entry.fn(r);
      expect(() => entry.fn(r)).toThrow('already registered');
    },
  );
});

// ---------------------------------------------------------------------------
// 8. toAnthropicTools() produces valid schemas
// ---------------------------------------------------------------------------

describe('toAnthropicTools() format converter', () => {
  const registry = createFullRegistry();
  const anthropicTools = registry.toAnthropicTools();

  it('returns an array matching total tool count', () => {
    expect(anthropicTools).toHaveLength(99);
  });

  it('every entry has name, description, and input_schema', () => {
    for (const tool of anthropicTools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.input_schema).toBeDefined();
      expect(typeof tool.input_schema).toBe('object');
    }
  });

  it('no entry has $schema meta key (Anthropic rejects it)', () => {
    for (const tool of anthropicTools) {
      expect(tool.input_schema).not.toHaveProperty('$schema');
    }
  });

  it('no entry has additionalProperties meta key', () => {
    for (const tool of anthropicTools) {
      expect(tool.input_schema).not.toHaveProperty('additionalProperties');
    }
  });

  it('every schema has a type field', () => {
    for (const tool of anthropicTools) {
      expect(tool.input_schema).toHaveProperty('type');
    }
  });

  it('tool names in Anthropic format match registry names', () => {
    const registryNames = new Set(registry.getAll().map((t) => t.name));
    const anthropicNames = new Set(anthropicTools.map((t) => t.name));
    expect(anthropicNames).toEqual(registryNames);
  });
});

// ---------------------------------------------------------------------------
// 9. toGeminiFunctionDeclarations() produces valid schemas
// ---------------------------------------------------------------------------

describe('toGeminiFunctionDeclarations() format converter', () => {
  const registry = createFullRegistry();
  const geminiTools = registry.toGeminiFunctionDeclarations();

  it('returns an array matching total tool count', () => {
    expect(geminiTools).toHaveLength(99);
  });

  it('every entry has name, description, and parameters', () => {
    for (const tool of geminiTools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe('object');
    }
  });

  it('no entry has $schema meta key', () => {
    for (const tool of geminiTools) {
      expect(tool.parameters).not.toHaveProperty('$schema');
    }
  });

  it('no entry has additionalProperties meta key', () => {
    for (const tool of geminiTools) {
      expect(tool.parameters).not.toHaveProperty('additionalProperties');
    }
  });

  it('tool names in Gemini format match registry names', () => {
    const registryNames = new Set(registry.getAll().map((t) => t.name));
    const geminiNames = new Set(geminiTools.map((t) => t.name));
    expect(geminiNames).toEqual(registryNames);
  });
});

// ---------------------------------------------------------------------------
// 10. Execution — client-action tools return success with data.type
// ---------------------------------------------------------------------------

describe('Client-action tools return proper structure', () => {
  const registry = createFullRegistry();

  const clientActionTools = [
    { name: 'switch_view', params: { view: 'architecture' } },
    { name: 'run_validation', params: {} },
    { name: 'undo', params: {} },
    { name: 'redo', params: {} },
    { name: 'auto_route', params: { circuitId: 1 } },
    { name: 'run_erc', params: { circuitId: 1 } },
    { name: 'preview_gerber', params: {} },
    { name: 'optimize_bom', params: {} },
  ];

  it.each(clientActionTools)(
    '$name returns success=true with data.type',
    async ({ name, params }) => {
      const ctx = createCtx();
      const result = await registry.execute(name, params, ctx);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as Record<string, unknown>).type).toBe(name);
    },
  );
});

// ---------------------------------------------------------------------------
// 11. Server-side tools call storage methods
// ---------------------------------------------------------------------------

describe('Server-side execution — storage interactions', () => {
  let registry: ToolRegistry;
  let mockStorage: IStorage;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createFullRegistry();
    mockStorage = createMockStorage();
    ctx = createCtx({ storage: mockStorage });
  });

  it('create_circuit calls storage.createCircuitDesign', async () => {
    const result = await registry.execute(
      'create_circuit',
      { name: 'Power Supply' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createCircuitDesign).toHaveBeenCalledTimes(1);
  });

  it('place_component calls storage.createCircuitInstance', async () => {
    const result = await registry.execute(
      'place_component',
      { circuitId: 1, partId: 1, referenceDesignator: 'U1' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createCircuitInstance).toHaveBeenCalledTimes(1);
  });

  it('draw_net calls storage.createCircuitNet', async () => {
    const result = await registry.execute(
      'draw_net',
      { circuitId: 1, name: 'VCC' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createCircuitNet).toHaveBeenCalledTimes(1);
  });

  it('add_bom_item calls storage.createBomItem with correct projectId', async () => {
    const result = await registry.execute(
      'add_bom_item',
      { partNumber: 'LM7805', manufacturer: 'TI', description: 'Voltage regulator' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createBomItem).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 1, partNumber: 'LM7805' }),
    );
  });

  it('rename_project calls storage.updateProject', async () => {
    const result = await registry.execute(
      'rename_project',
      { name: 'My Rover' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.updateProject).toHaveBeenCalledWith(1, { name: 'My Rover' });
  });

  it('add_validation_issue calls storage.createValidationIssue', async () => {
    const result = await registry.execute(
      'add_validation_issue',
      { severity: 'warning', message: 'Missing bypass cap' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createValidationIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 1,
        severity: 'warning',
        message: 'Missing bypass cap',
      }),
    );
  });

  it('create_component_part calls storage.createComponentPart', async () => {
    const result = await registry.execute(
      'create_component_part',
      { title: 'ESP32-S3' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createComponentPart).toHaveBeenCalledTimes(1);
  });

  it('identify_component_from_image returns vision_analysis data', async () => {
    const result = await registry.execute(
      'identify_component_from_image',
      { image_data: 'base64data', context: 'found on Arduino' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.type).toBe('vision_analysis');
    expect(data.imageProvided).toBe(true);
    expect(data.context).toBe('found on Arduino');
  });
});

// ---------------------------------------------------------------------------
// 12. modelPreference is set on expected tools
// ---------------------------------------------------------------------------

describe('modelPreference hints', () => {
  const registry = createFullRegistry();

  it('identify_component_from_image has premium model preference', () => {
    const tool = registry.get('identify_component_from_image');
    expect(tool?.modelPreference).toBe('premium');
  });

  it('design_review has premium model preference', () => {
    const tool = registry.get('design_review');
    expect(tool?.modelPreference).toBe('premium');
  });

  it('suggest_components has premium model preference', () => {
    const tool = registry.get('suggest_components');
    expect(tool?.modelPreference).toBe('premium');
  });

  it('most tools have no modelPreference (defaults to standard)', () => {
    const toolsWithPref = registry.getAll().filter((t) => t.modelPreference !== undefined);
    // Only a few tools should explicitly set this
    expect(toolsWithPref.length).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 13. Edge cases — empty registry, get(), getByCategory()
// ---------------------------------------------------------------------------

describe('Registry edge cases', () => {
  it('empty registry returns no tools', () => {
    const r = new ToolRegistry();
    expect(r.getAll()).toHaveLength(0);
    expect(r.getByCategory('architecture')).toHaveLength(0);
    expect(r.getDestructiveTools()).toHaveLength(0);
  });

  it('get() returns undefined for unknown tool', () => {
    const r = createFullRegistry();
    expect(r.get('nonexistent')).toBeUndefined();
  });

  it('toAnthropicTools() on empty registry returns empty array', () => {
    const r = new ToolRegistry();
    expect(r.toAnthropicTools()).toHaveLength(0);
  });

  it('toGeminiFunctionDeclarations() on empty registry returns empty array', () => {
    const r = new ToolRegistry();
    expect(r.toGeminiFunctionDeclarations()).toHaveLength(0);
  });

  it('validate with undefined params returns error', () => {
    const r = createFullRegistry();
    const v = r.validate('add_node', undefined);
    expect(v.ok).toBe(false);
  });

  it('validate with array params returns error', () => {
    const r = createFullRegistry();
    const v = r.validate('rename_project', ['name']);
    expect(v.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. Default parameter values
// ---------------------------------------------------------------------------

describe('Default parameter values through validation', () => {
  const registry = createFullRegistry();

  it('add_bom_item defaults quantity to 1 and unitPrice to 0', () => {
    const v = registry.validate('add_bom_item', {
      partNumber: 'R100',
      manufacturer: 'Yageo',
      description: '100 ohm resistor',
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.quantity).toBe(1);
      expect(v.params.unitPrice).toBe(0);
      expect(v.params.status).toBe('In Stock');
    }
  });

  it('draw_net defaults netType to signal', () => {
    const v = registry.validate('draw_net', { circuitId: 1, name: 'SDA' });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.netType).toBe('signal');
    }
  });

  it('draw_pcb_trace defaults width to 0.25 and layer to front', () => {
    const v = registry.validate('draw_pcb_trace', {
      circuitId: 1,
      netId: 1,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.width).toBe(0.25);
      expect(v.params.layer).toBe('front');
    }
  });

  it('place_component defaults x to 200, y to 200, rotation to 0', () => {
    const v = registry.validate('place_component', {
      circuitId: 1,
      partId: 1,
      referenceDesignator: 'U1',
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.x).toBe(200);
      expect(v.params.y).toBe(200);
      expect(v.params.rotation).toBe(0);
    }
  });

  it('export_bom_csv defaults format to generic', () => {
    const v = registry.validate('export_bom_csv', {});
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.format).toBe('generic');
    }
  });

  it('generate_test_plan defaults focus to all', () => {
    const v = registry.validate('generate_test_plan', {});
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.params.focus).toBe('all');
    }
  });
});
