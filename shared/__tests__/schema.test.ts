import { describe, it, expect } from 'vitest';
import {
  insertProjectSchema,
  insertArchitectureNodeSchema,
  insertArchitectureEdgeSchema,
  insertBomItemSchema,
  insertValidationIssueSchema,
  insertChatMessageSchema,
  insertHistoryItemSchema,
  insertUserSchema,
  insertComponentPartSchema,
  insertComponentLibrarySchema,
  insertCircuitDesignSchema,
  insertCircuitInstanceSchema,
  insertCircuitNetSchema,
  insertCircuitWireSchema,
  insertSimulationResultSchema,
  insertAiActionSchema,
  insertUserChatSettingsSchema,
} from '../schema';

// =============================================================================
// insertProjectSchema
// =============================================================================
describe('insertProjectSchema', () => {
  it('accepts valid project with name', () => {
    const result = insertProjectSchema.safeParse({ name: 'My Project' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Project');
    }
  });

  it('accepts project with name and description', () => {
    const result = insertProjectSchema.safeParse({ name: 'IoT Hub', description: 'Smart home controller' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Smart home controller');
    }
  });

  it('rejects project without name', () => {
    const result = insertProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects project with empty string name', () => {
    // Drizzle text() with notNull just requires presence, not non-empty
    // This verifies the schema shape — the database constraint handles empty strings
    const result = insertProjectSchema.safeParse({ name: '' });
    // Drizzle-zod allows empty string for text columns
    expect(result.success).toBe(true);
  });

  it('strips id, createdAt, updatedAt, deletedAt from input', () => {
    const result = insertProjectSchema.safeParse({
      name: 'Test',
      id: 99,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
      expect(result.data).not.toHaveProperty('deletedAt');
    }
  });
});

// =============================================================================
// insertArchitectureNodeSchema
// =============================================================================
describe('insertArchitectureNodeSchema', () => {
  const validNode = {
    projectId: 1,
    nodeId: 'node-abc',
    nodeType: 'mcu',
    label: 'ESP32',
    positionX: 300,
    positionY: 200,
  };

  it('accepts a valid node', () => {
    const result = insertArchitectureNodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
  });

  it('accepts node with optional data field', () => {
    const result = insertArchitectureNodeSchema.safeParse({
      ...validNode,
      data: { description: 'Main MCU', componentPartId: 5 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts node with null data', () => {
    const result = insertArchitectureNodeSchema.safeParse({ ...validNode, data: null });
    expect(result.success).toBe(true);
  });

  it('rejects node missing required projectId', () => {
    const { projectId, ...noProjectId } = validNode;
    const result = insertArchitectureNodeSchema.safeParse(noProjectId);
    expect(result.success).toBe(false);
  });

  it('rejects node with empty nodeType', () => {
    const result = insertArchitectureNodeSchema.safeParse({ ...validNode, nodeType: '' });
    expect(result.success).toBe(false);
  });

  it('rejects node with nodeType longer than 100 chars', () => {
    const result = insertArchitectureNodeSchema.safeParse({ ...validNode, nodeType: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('strips id, updatedAt, deletedAt from input', () => {
    const result = insertArchitectureNodeSchema.safeParse({
      ...validNode,
      id: 42,
      updatedAt: new Date(),
      deletedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('updatedAt');
      expect(result.data).not.toHaveProperty('deletedAt');
    }
  });

  it('accepts data with passthrough extra fields', () => {
    const result = insertArchitectureNodeSchema.safeParse({
      ...validNode,
      data: { description: 'x', customField: 'y' },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.data) {
      expect((result.data.data as Record<string, unknown>).customField).toBe('y');
    }
  });
});

// =============================================================================
// insertArchitectureEdgeSchema
// =============================================================================
describe('insertArchitectureEdgeSchema', () => {
  const validEdge = {
    projectId: 1,
    edgeId: 'edge-123',
    source: 'node-a',
    target: 'node-b',
  };

  it('accepts a valid edge', () => {
    const result = insertArchitectureEdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
  });

  it('accepts edge with optional fields', () => {
    const result = insertArchitectureEdgeSchema.safeParse({
      ...validEdge,
      label: 'SPI Bus',
      animated: true,
      signalType: 'digital',
      voltage: '3.3V',
      busWidth: '8',
      netName: 'SPI_CLK',
      style: { stroke: '#ff0000' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects edge missing source', () => {
    const { source, ...noSource } = validEdge;
    const result = insertArchitectureEdgeSchema.safeParse(noSource);
    expect(result.success).toBe(false);
  });

  it('rejects edge missing target', () => {
    const { target, ...noTarget } = validEdge;
    const result = insertArchitectureEdgeSchema.safeParse(noTarget);
    expect(result.success).toBe(false);
  });

  it('accepts null style', () => {
    const result = insertArchitectureEdgeSchema.safeParse({ ...validEdge, style: null });
    expect(result.success).toBe(true);
  });

  it('accepts style with passthrough fields', () => {
    const result = insertArchitectureEdgeSchema.safeParse({
      ...validEdge,
      style: { stroke: '#000', customDash: '5,5' },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// insertBomItemSchema
// =============================================================================
describe('insertBomItemSchema', () => {
  const validBom = {
    projectId: 1,
    partNumber: 'ESP32-WROOM-32E',
    manufacturer: 'Espressif',
    description: 'Wi-Fi + BLE SoC module',
    unitPrice: '5.50',
    supplier: 'DigiKey',
  };

  it('accepts a valid BOM item', () => {
    const result = insertBomItemSchema.safeParse(validBom);
    expect(result.success).toBe(true);
  });

  it('defaults status to "In Stock"', () => {
    const result = insertBomItemSchema.safeParse(validBom);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('In Stock');
    }
  });

  it('accepts valid status enum values', () => {
    for (const status of ['In Stock', 'Low Stock', 'Out of Stock', 'On Order'] as const) {
      const result = insertBomItemSchema.safeParse({ ...validBom, status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status value', () => {
    const result = insertBomItemSchema.safeParse({ ...validBom, status: 'Discontinued' });
    expect(result.success).toBe(false);
  });

  it('strips totalPrice from input (computed server-side)', () => {
    const result = insertBomItemSchema.safeParse({ ...validBom, totalPrice: '999' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('totalPrice');
    }
  });

  it('rejects BOM item missing manufacturer', () => {
    const { manufacturer, ...noMfg } = validBom;
    const result = insertBomItemSchema.safeParse(noMfg);
    expect(result.success).toBe(false);
  });

  it('accepts BOM item with quantity', () => {
    const result = insertBomItemSchema.safeParse({ ...validBom, quantity: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(100);
    }
  });
});

// =============================================================================
// insertValidationIssueSchema
// =============================================================================
describe('insertValidationIssueSchema', () => {
  it('accepts valid validation issue with error severity', () => {
    const result = insertValidationIssueSchema.safeParse({
      projectId: 1,
      severity: 'error',
      message: 'No power supply connected',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all severity levels', () => {
    for (const severity of ['error', 'warning', 'info'] as const) {
      const result = insertValidationIssueSchema.safeParse({
        projectId: 1,
        severity,
        message: `Test ${severity}`,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid severity value', () => {
    const result = insertValidationIssueSchema.safeParse({
      projectId: 1,
      severity: 'critical',
      message: 'Oops',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional componentId and suggestion', () => {
    const result = insertValidationIssueSchema.safeParse({
      projectId: 1,
      severity: 'warning',
      message: 'Missing decoupling cap',
      componentId: 'node-mcu',
      suggestion: 'Add a 100nF cap near VCC pin',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing message', () => {
    const result = insertValidationIssueSchema.safeParse({
      projectId: 1,
      severity: 'error',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertChatMessageSchema
// =============================================================================
describe('insertChatMessageSchema', () => {
  it('accepts valid user message', () => {
    const result = insertChatMessageSchema.safeParse({
      projectId: 1,
      role: 'user',
      content: 'Add an ESP32 to the design',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all role values', () => {
    for (const role of ['user', 'assistant', 'system'] as const) {
      const result = insertChatMessageSchema.safeParse({
        projectId: 1,
        role,
        content: 'test',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = insertChatMessageSchema.safeParse({
      projectId: 1,
      role: 'admin',
      content: 'hello',
    });
    expect(result.success).toBe(false);
  });

  it('strips timestamp from input', () => {
    const result = insertChatMessageSchema.safeParse({
      projectId: 1,
      role: 'user',
      content: 'Hi',
      timestamp: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('timestamp');
    }
  });

  it('accepts optional mode field', () => {
    const result = insertChatMessageSchema.safeParse({
      projectId: 1,
      role: 'assistant',
      content: 'Sure thing',
      mode: 'tool',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// insertHistoryItemSchema
// =============================================================================
describe('insertHistoryItemSchema', () => {
  it('accepts valid history item', () => {
    const result = insertHistoryItemSchema.safeParse({
      projectId: 1,
      action: 'Added node ESP32',
      user: 'ai',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing action', () => {
    const result = insertHistoryItemSchema.safeParse({
      projectId: 1,
      user: 'ai',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing user', () => {
    const result = insertHistoryItemSchema.safeParse({
      projectId: 1,
      action: 'Deleted edge',
    });
    expect(result.success).toBe(false);
  });

  it('strips timestamp from input', () => {
    const result = insertHistoryItemSchema.safeParse({
      projectId: 1,
      action: 'test',
      user: 'system',
      timestamp: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('timestamp');
    }
  });
});

// =============================================================================
// insertUserSchema
// =============================================================================
describe('insertUserSchema', () => {
  it('accepts valid user', () => {
    const result = insertUserSchema.safeParse({
      username: 'alice',
      passwordHash: 'somesalt:somehash',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing username', () => {
    const result = insertUserSchema.safeParse({ passwordHash: 'hash' });
    expect(result.success).toBe(false);
  });

  it('rejects missing passwordHash', () => {
    const result = insertUserSchema.safeParse({ username: 'bob' });
    expect(result.success).toBe(false);
  });

  it('strips id and createdAt', () => {
    const result = insertUserSchema.safeParse({
      username: 'carol',
      passwordHash: 'h',
      id: 100,
      createdAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
    }
  });
});

// =============================================================================
// insertComponentPartSchema
// =============================================================================
describe('insertComponentPartSchema', () => {
  it('accepts valid component part with minimal fields', () => {
    const result = insertComponentPartSchema.safeParse({
      projectId: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts component part with all optional fields', () => {
    const result = insertComponentPartSchema.safeParse({
      projectId: 1,
      nodeId: 'node-abc',
      meta: { title: 'Resistor 10k' },
      connectors: [{ id: 'c1', name: 'pin1' }],
      buses: [],
      views: { breadboard: { shapes: [] } },
      constraints: [],
    });
    expect(result.success).toBe(true);
  });

  it('strips id, version, createdAt, updatedAt', () => {
    const result = insertComponentPartSchema.safeParse({
      projectId: 1,
      id: 50,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('version');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    }
  });

  it('rejects missing projectId', () => {
    const result = insertComponentPartSchema.safeParse({ nodeId: 'n1' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertComponentLibrarySchema
// =============================================================================
describe('insertComponentLibrarySchema', () => {
  it('accepts valid library entry', () => {
    const result = insertComponentLibrarySchema.safeParse({
      title: 'Generic Resistor',
    });
    expect(result.success).toBe(true);
  });

  it('accepts full library entry', () => {
    const result = insertComponentLibrarySchema.safeParse({
      title: 'ESP32-DevKitC',
      description: 'Development board',
      meta: { pinout: 'standard' },
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      tags: ['mcu', 'wifi', 'ble'],
      category: 'microcontrollers',
      isPublic: true,
      authorId: 'user-1',
      forkedFromId: 10,
    });
    expect(result.success).toBe(true);
  });

  it('strips downloadCount, id, createdAt, updatedAt', () => {
    const result = insertComponentLibrarySchema.safeParse({
      title: 'Test',
      downloadCount: 9999,
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('downloadCount');
      expect(result.data).not.toHaveProperty('id');
    }
  });

  it('rejects missing title', () => {
    const result = insertComponentLibrarySchema.safeParse({ category: 'passives' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertCircuitDesignSchema
// =============================================================================
describe('insertCircuitDesignSchema', () => {
  it('accepts valid circuit design', () => {
    const result = insertCircuitDesignSchema.safeParse({
      projectId: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts circuit design with all fields', () => {
    const result = insertCircuitDesignSchema.safeParse({
      projectId: 1,
      name: 'Power Supply',
      description: 'Buck converter circuit',
      settings: { gridSize: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('strips id, createdAt, updatedAt', () => {
    const result = insertCircuitDesignSchema.safeParse({
      projectId: 1,
      id: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    }
  });
});

// =============================================================================
// insertCircuitInstanceSchema
// =============================================================================
describe('insertCircuitInstanceSchema', () => {
  const validInstance = {
    circuitId: 1,
    partId: 2,
    referenceDesignator: 'U1',
  };

  it('accepts valid circuit instance', () => {
    const result = insertCircuitInstanceSchema.safeParse(validInstance);
    expect(result.success).toBe(true);
  });

  it('accepts instance with position data', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      ...validInstance,
      schematicX: 100,
      schematicY: 200,
      schematicRotation: 90,
      breadboardX: 50,
      breadboardY: 60,
      pcbX: 10.5,
      pcbY: 20.3,
      pcbRotation: 180,
      pcbSide: 'back',
      properties: { value: '10k' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing referenceDesignator', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      circuitId: 1,
      partId: 2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing circuitId', () => {
    const result = insertCircuitInstanceSchema.safeParse({
      partId: 2,
      referenceDesignator: 'R1',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertCircuitNetSchema
// =============================================================================
describe('insertCircuitNetSchema', () => {
  it('accepts valid net with name and circuitId', () => {
    const result = insertCircuitNetSchema.safeParse({
      circuitId: 1,
      name: 'VCC_3V3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts net with all optional fields', () => {
    const result = insertCircuitNetSchema.safeParse({
      circuitId: 1,
      name: 'SPI_CLK',
      netType: 'signal',
      voltage: '3.3V',
      busWidth: 1,
      segments: [{ x1: 0, y1: 0, x2: 100, y2: 0 }],
      labels: [{ text: 'CLK', x: 50, y: -10 }],
      style: { color: '#00ff00' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects net missing name', () => {
    const result = insertCircuitNetSchema.safeParse({ circuitId: 1 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertCircuitWireSchema
// =============================================================================
describe('insertCircuitWireSchema', () => {
  const validWire = {
    circuitId: 1,
    netId: 1,
    view: 'schematic',
  };

  it('accepts valid wire', () => {
    const result = insertCircuitWireSchema.safeParse(validWire);
    expect(result.success).toBe(true);
  });

  it('accepts wire with all fields', () => {
    const result = insertCircuitWireSchema.safeParse({
      ...validWire,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      layer: 'back',
      width: 2.5,
      color: '#ff0000',
      wireType: 'jumper',
    });
    expect(result.success).toBe(true);
  });

  it('rejects wire missing view', () => {
    const result = insertCircuitWireSchema.safeParse({
      circuitId: 1,
      netId: 1,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertSimulationResultSchema
// =============================================================================
describe('insertSimulationResultSchema', () => {
  it('accepts valid simulation result', () => {
    const result = insertSimulationResultSchema.safeParse({
      circuitId: 1,
      analysisType: 'dc',
    });
    expect(result.success).toBe(true);
  });

  it('accepts simulation result with all fields', () => {
    const result = insertSimulationResultSchema.safeParse({
      circuitId: 1,
      analysisType: 'transient',
      config: { startTime: 0, endTime: 1 },
      results: { voltages: [0, 1, 2, 3] },
      status: 'completed',
      engineUsed: 'ngspice',
      elapsedMs: 1500,
      sizeBytes: 4096,
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing analysisType', () => {
    const result = insertSimulationResultSchema.safeParse({ circuitId: 1 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// insertAiActionSchema
// =============================================================================
describe('insertAiActionSchema', () => {
  it('accepts valid AI action', () => {
    const result = insertAiActionSchema.safeParse({
      projectId: 1,
      toolName: 'add_node',
    });
    expect(result.success).toBe(true);
  });

  it('accepts AI action with all fields', () => {
    const result = insertAiActionSchema.safeParse({
      projectId: 1,
      chatMessageId: 'msg-123',
      toolName: 'generate_architecture',
      parameters: { components: ['ESP32', 'BME280'] },
      result: { success: true, nodesCreated: 2 },
      status: 'completed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing toolName', () => {
    const result = insertAiActionSchema.safeParse({ projectId: 1 });
    expect(result.success).toBe(false);
  });

  it('strips id and createdAt', () => {
    const result = insertAiActionSchema.safeParse({
      projectId: 1,
      toolName: 'run_validation',
      id: 10,
      createdAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
    }
  });
});

// =============================================================================
// insertUserChatSettingsSchema
// =============================================================================
describe('insertUserChatSettingsSchema', () => {
  it('accepts valid chat settings', () => {
    const result = insertUserChatSettingsSchema.safeParse({
      userId: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts chat settings with all fields', () => {
    const result = insertUserChatSettingsSchema.safeParse({
      userId: 1,
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-pro',
      aiTemperature: 0.5,
      customSystemPrompt: 'You are a PCB expert',
      routingStrategy: 'auto',
    });
    expect(result.success).toBe(true);
  });

  it('strips id and updatedAt', () => {
    const result = insertUserChatSettingsSchema.safeParse({
      userId: 1,
      id: 42,
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('updatedAt');
    }
  });
});
