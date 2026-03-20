import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerValidationTools } from '../ai-tools/validation';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';
import type {
  ArchitectureNode,
  ArchitectureEdge,
  BomItem,
  ValidationIssue,
  CircuitDesignRow,
  CircuitInstanceRow,
  CircuitNetRow,
  Project,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerValidationTools(registry);
  return registry;
}

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'IoT Weather Station',
    description: 'A weather monitoring device',
    ownerId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ArchitectureNode> = {}): ArchitectureNode {
  return {
    id: 1,
    projectId: 1,
    nodeId: 'uuid-1',
    nodeType: 'mcu',
    label: 'ESP32',
    positionX: 300,
    positionY: 200,
    data: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<ArchitectureEdge> = {}): ArchitectureEdge {
  return {
    id: 1,
    projectId: 1,
    edgeId: 'edge-1',
    source: 'uuid-1',
    target: 'uuid-2',
    label: 'I2C',
    animated: false,
    style: null,
    signalType: 'I2C',
    voltage: '3.3V',
    busWidth: null,
    netName: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'ESP32-S3',
    manufacturer: 'Espressif',
    description: 'WiFi SoC',
    quantity: 1,
    unitPrice: '3.50',
    totalPrice: '3.50',
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    tolerance: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeValidationIssue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    id: 1,
    projectId: 1,
    severity: 'warning',
    message: 'Missing decoupling capacitor',
    componentId: 'ESP32',
    suggestion: 'Add 100nF bypass cap near VCC pin',
    ...overrides,
  };
}

function makeCircuitDesign(overrides: Partial<CircuitDesignRow> = {}): CircuitDesignRow {
  return {
    id: 1,
    projectId: 1,
    name: 'Main Circuit',
    description: null,
    parentDesignId: null,
    settings: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as CircuitDesignRow;
}

function makeCircuitInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 100,
    schematicY: 100,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: now,
    ...overrides,
  };
}

function makeCircuitNet(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
  return {
    id: 1,
    circuitId: 1,
    name: 'VCC',
    netType: 'power',
    voltage: '3.3V',
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: now,
    ...overrides,
  };
}

interface MockStorageData {
  project?: Project;
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  bomItems?: BomItem[];
  issues?: ValidationIssue[];
  circuits?: CircuitDesignRow[];
  instances?: CircuitInstanceRow[];
  nets?: CircuitNetRow[];
}

function createMockStorage(data: MockStorageData = {}): IStorage {
  return {
    getProject: vi.fn().mockResolvedValue(data.project ?? makeProject()),
    getNodes: vi.fn().mockResolvedValue(data.nodes ?? []),
    getEdges: vi.fn().mockResolvedValue(data.edges ?? []),
    getBomItems: vi.fn().mockResolvedValue(data.bomItems ?? []),
    getValidationIssues: vi.fn().mockResolvedValue(data.issues ?? []),
    getCircuitDesigns: vi.fn().mockResolvedValue(data.circuits ?? []),
    getCircuitInstances: vi.fn().mockResolvedValue(data.instances ?? []),
    getCircuitNets: vi.fn().mockResolvedValue(data.nets ?? []),
    createValidationIssue: vi.fn().mockResolvedValue(makeValidationIssue()),
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

describe('Validation tools — registration', () => {
  const registry = createRegistry();

  const expectedTools = [
    'run_validation',
    'clear_validation',
    'add_validation_issue',
    'power_budget_analysis',
    'voltage_domain_check',
    'auto_fix_validation',
    'dfm_check',
    'thermal_analysis',
    'generate_test_plan',
    'design_review',
    'hardware_debug_analysis',
  ];

  it.each(expectedTools)('registers "%s"', (name) => {
    expect(registry.get(name)).toBeDefined();
  });

  it('all validation tools have category "validation"', () => {
    const valTools = registry.getByCategory('validation');
    expect(valTools.length).toBe(expectedTools.length);
    for (const tool of valTools) {
      expect(tool.category).toBe('validation');
    }
  });

  it('marks clear_validation as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).toContain('clear_validation');
  });

  it('does not mark add_validation_issue as destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).not.toContain('add_validation_issue');
  });
});

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

describe('Validation tools — parameter validation', () => {
  const registry = createRegistry();

  describe('add_validation_issue', () => {
    it('accepts valid params with required fields', () => {
      const result = registry.validate('add_validation_issue', {
        severity: 'error',
        message: 'Missing bypass capacitor on VCC',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = registry.validate('add_validation_issue', {
        severity: 'warning',
        message: 'No ESD protection on USB lines',
        componentId: 'USB-C',
        suggestion: 'Add TVS diode array',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid severity', () => {
      const result = registry.validate('add_validation_issue', {
        severity: 'critical',
        message: 'Something bad',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects missing message', () => {
      const result = registry.validate('add_validation_issue', {
        severity: 'error',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects empty message', () => {
      const result = registry.validate('add_validation_issue', {
        severity: 'error',
        message: '',
      });
      expect(result.ok).toBe(false);
    });

    it.each(['error', 'warning', 'info'] as const)(
      'accepts severity "%s"',
      (severity) => {
        const result = registry.validate('add_validation_issue', {
          severity,
          message: 'Test issue',
        });
        expect(result.ok).toBe(true);
      },
    );
  });

  describe('generate_test_plan', () => {
    it('accepts empty params (uses defaults)', () => {
      const result = registry.validate('generate_test_plan', {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.params.focus).toBe('all');
      }
    });

    it('accepts valid focus area', () => {
      const result = registry.validate('generate_test_plan', { focus: 'power' });
      expect(result.ok).toBe(true);
    });

    it('rejects invalid focus area', () => {
      const result = registry.validate('generate_test_plan', { focus: 'invalid' });
      expect(result.ok).toBe(false);
    });

    it.each([
      'all',
      'power',
      'communication',
      'sensors',
      'thermal',
      'mechanical',
      'integration',
    ] as const)('accepts focus "%s"', (focus) => {
      expect(registry.validate('generate_test_plan', { focus }).ok).toBe(true);
    });
  });

  describe('run_validation', () => {
    it('accepts empty params', () => {
      const result = registry.validate('run_validation', {});
      expect(result.ok).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Execution — add_validation_issue
// ---------------------------------------------------------------------------

describe('Validation tools — add_validation_issue execution', () => {
  let registry: ToolRegistry;
  let mockStorage: IStorage;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    mockStorage = createMockStorage();
    ctx = createCtx(mockStorage);
  });

  it('calls storage.createValidationIssue with correct params', async () => {
    const result = await registry.execute(
      'add_validation_issue',
      {
        severity: 'error',
        message: 'Missing bypass cap',
        componentId: 'ESP32',
        suggestion: 'Add 100nF near VCC',
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createValidationIssue).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(mockStorage.createValidationIssue).mock.calls[0][0];
    expect(callArgs.projectId).toBe(1);
    expect(callArgs.severity).toBe('error');
    expect(callArgs.message).toBe('Missing bypass cap');
    expect(callArgs.componentId).toBe('ESP32');
    expect(callArgs.suggestion).toBe('Add 100nF near VCC');
  });

  it('returns success message with severity and message', async () => {
    const result = await registry.execute(
      'add_validation_issue',
      { severity: 'warning', message: 'No pull-up on I2C SDA' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('warning');
    expect(result.message).toContain('No pull-up on I2C SDA');
  });

  it('handles optional fields being undefined', async () => {
    await registry.execute(
      'add_validation_issue',
      { severity: 'info', message: 'Consider adding test points' },
      ctx,
    );

    const callArgs = vi.mocked(mockStorage.createValidationIssue).mock.calls[0][0];
    expect(callArgs.componentId).toBeUndefined();
    expect(callArgs.suggestion).toBeUndefined();
  });

  it('returns error for invalid params without calling storage', async () => {
    const result = await registry.execute(
      'add_validation_issue',
      { severity: 'critical', message: 'Bad' },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(mockStorage.createValidationIssue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Execution — generate_test_plan
// ---------------------------------------------------------------------------

describe('Validation tools — generate_test_plan execution', () => {
  it('gathers full project data and returns structured result', async () => {
    const project = makeProject({ name: 'Weather Station' });
    const nodes = [
      makeNode({ id: 1, label: 'MCU', nodeType: 'mcu' }),
      makeNode({ id: 2, label: 'Sensor', nodeType: 'sensor' }),
    ];
    const edges = [
      makeEdge({ source: 'uuid-1', target: 'uuid-2', signalType: 'I2C', voltage: '3.3V' }),
    ];
    const bomItems = [makeBomItem()];
    const issues = [makeValidationIssue()];
    const circuits = [makeCircuitDesign({ id: 1, name: 'Main' })];
    const instances = [makeCircuitInstance({ referenceDesignator: 'U1', partId: 1 })];
    const nets = [makeCircuitNet({ name: 'VCC', netType: 'power', voltage: '3.3V' })];

    const storage = createMockStorage({
      project,
      nodes,
      edges,
      bomItems,
      issues,
      circuits,
      instances,
      nets,
    });
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('generate_test_plan', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Weather Station');

    const data = result.data as Record<string, unknown>;
    expect(data.projectName).toBe('Weather Station');
    expect(data.nodeCount).toBe(2);
    expect(data.edgeCount).toBe(1);
    expect(data.bomItemCount).toBe(1);

    const resNodes = data.nodes as Array<Record<string, unknown>>;
    expect(resNodes).toHaveLength(2);
    expect(resNodes[0]).toEqual({ label: 'MCU', type: 'mcu' });

    const resEdges = data.edges as Array<Record<string, unknown>>;
    expect(resEdges).toHaveLength(1);
    expect(resEdges[0].signalType).toBe('I2C');
    expect(resEdges[0].voltage).toBe('3.3V');

    const resBom = data.bomItems as Array<Record<string, unknown>>;
    expect(resBom).toHaveLength(1);
    expect(resBom[0].partNumber).toBe('ESP32-S3');

    const resIssues = data.openIssues as Array<Record<string, unknown>>;
    expect(resIssues).toHaveLength(1);
    expect(resIssues[0].severity).toBe('warning');
  });

  it('includes circuit summaries with instances and nets', async () => {
    const circuits = [makeCircuitDesign({ id: 1, name: 'Power' })];
    const instances = [
      makeCircuitInstance({ id: 1, referenceDesignator: 'U1', partId: 1 }),
      makeCircuitInstance({ id: 2, referenceDesignator: 'C1', partId: 2 }),
    ];
    const nets = [
      makeCircuitNet({ id: 1, name: 'VCC', netType: 'power', voltage: '3.3V' }),
      makeCircuitNet({ id: 2, name: 'GND', netType: 'power', voltage: '0V' }),
    ];

    const storage = createMockStorage({ circuits, instances, nets });
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('generate_test_plan', { focus: 'power' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const circuitData = data.circuits as Array<Record<string, unknown>>;
    expect(circuitData).toHaveLength(1);
    expect(circuitData[0].name).toBe('Power');
    expect(circuitData[0].instanceCount).toBe(2);
    expect(circuitData[0].netCount).toBe(2);

    const resInstances = circuitData[0].instances as Array<Record<string, unknown>>;
    expect(resInstances[0]).toEqual({ refDes: 'U1', partId: 1 });

    const resNets = circuitData[0].nets as Array<Record<string, unknown>>;
    expect(resNets[0]).toEqual({ name: 'VCC', type: 'power', voltage: '3.3V' });
  });

  it('handles project with no circuits', async () => {
    const storage = createMockStorage({ circuits: [] });
    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('generate_test_plan', {}, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.circuits).toEqual([]);
  });

  it('handles missing project name gracefully', async () => {
    const storage = createMockStorage({
      project: undefined as unknown as Project,
    });
    // Override getProject to return undefined
    vi.mocked(storage.getProject).mockResolvedValue(undefined);

    const registry = createRegistry();
    const ctx = createCtx(storage);

    const result = await registry.execute('generate_test_plan', {}, ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.projectName).toBe('Untitled');
  });

  it('calls all storage methods with projectId', async () => {
    const storage = createMockStorage({ circuits: [] });
    const registry = createRegistry();
    const ctx: ToolContext = { projectId: 42, storage };

    await registry.execute('generate_test_plan', {}, ctx);

    expect(storage.getProject).toHaveBeenCalledWith(42);
    expect(storage.getNodes).toHaveBeenCalledWith(42);
    expect(storage.getEdges).toHaveBeenCalledWith(42);
    expect(storage.getBomItems).toHaveBeenCalledWith(42);
    expect(storage.getValidationIssues).toHaveBeenCalledWith(42);
    expect(storage.getCircuitDesigns).toHaveBeenCalledWith(42);
  });
});

// ---------------------------------------------------------------------------
// Execution — client-action validation tools
// ---------------------------------------------------------------------------

describe('Validation tools — client-action execution', () => {
  const registry = createRegistry();
  const ctx = createCtx();

  it('run_validation returns client action', async () => {
    const result = await registry.execute('run_validation', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'run_validation' });
  });

  it('clear_validation returns client action', async () => {
    const result = await registry.execute('clear_validation', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'clear_validation' });
  });

  it('power_budget_analysis returns client action', async () => {
    const result = await registry.execute('power_budget_analysis', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'power_budget_analysis' });
  });

  it('voltage_domain_check returns client action', async () => {
    const result = await registry.execute('voltage_domain_check', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'voltage_domain_check' });
  });

  it('auto_fix_validation returns client action', async () => {
    const result = await registry.execute('auto_fix_validation', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'auto_fix_validation' });
  });

  it('dfm_check returns client action', async () => {
    const result = await registry.execute('dfm_check', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'dfm_check' });
  });

  it('thermal_analysis returns client action', async () => {
    const result = await registry.execute('thermal_analysis', {}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'thermal_analysis' });
  });
});
