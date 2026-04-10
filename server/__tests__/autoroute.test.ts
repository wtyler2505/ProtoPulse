import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../db', () => ({ db: {}, pool: { end: vi.fn() } }));
vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1 }),
  getUserById: vi.fn().mockResolvedValue({ username: 'test' }),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireCircuitOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import type { Server } from 'http';
import type { IStorage } from '../storage';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, CircuitWireRow } from '@shared/schema';
import { registerCircuitAutorouteRoutes } from '../circuit-routes/autoroute';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers: mock data factories
// ---------------------------------------------------------------------------

let wireIdCounter = 100;

function makeDesign(overrides: Partial<CircuitDesignRow> = {}): CircuitDesignRow {
  return {
    id: 1,
    projectId: 1,
    name: 'Test Design',
    description: null,
    parentDesignId: null,
    settings: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CircuitDesignRow;
}

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makeNet(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
  return {
    id: 1,
    circuitId: 1,
    name: 'NET1',
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: ++wireIdCounter,
    circuitId: 1,
    netId: 1,
    view: 'pcb',
    points: [],
    layer: 'front',
    width: 1.0,
    color: null,
    wireType: 'wire',
    createdAt: new Date(),
    ...overrides,
  } as CircuitWireRow;
}

// ---------------------------------------------------------------------------
// Mock storage factory
// ---------------------------------------------------------------------------

function createMockStorage(overrides: Partial<IStorage> = {}): IStorage {
  return {
    getCircuitDesign: vi.fn().mockResolvedValue(undefined),
    getCircuitInstances: vi.fn().mockResolvedValue([]),
    getCircuitNets: vi.fn().mockResolvedValue([]),
    getCircuitWires: vi.fn().mockResolvedValue([]),
    createCircuitWire: vi.fn().mockImplementation(async (data) => makeWire({ ...data })),
    // Unused methods — provide stubs
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getProjectsByOwner: vi.fn(),
    isProjectOwner: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getNodes: vi.fn(),
    getNode: vi.fn(),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    getEdges: vi.fn(),
    getEdge: vi.fn(),
    createEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    getBomItems: vi.fn(),
    getBomItem: vi.fn(),
    createBomItem: vi.fn(),
    updateBomItem: vi.fn(),
    deleteBomItem: vi.fn(),
    getValidationIssues: vi.fn(),
    getValidationIssue: vi.fn(),
    createValidationIssue: vi.fn(),
    updateValidationIssue: vi.fn(),
    deleteValidationIssue: vi.fn(),
    getChatMessages: vi.fn(),
    getChatMessage: vi.fn(),
    createChatMessage: vi.fn(),
    deleteChatMessage: vi.fn(),
    getHistoryItems: vi.fn(),
    getHistoryItem: vi.fn(),
    createHistoryItem: vi.fn(),
    deleteHistoryItem: vi.fn(),
    getComponentParts: vi.fn(),
    getComponentPart: vi.fn(),
    createComponentPart: vi.fn(),
    updateComponentPart: vi.fn(),
    deleteComponentPart: vi.fn(),
    getComponentLibrary: vi.fn(),
    getComponentLibraryEntry: vi.fn(),
    createComponentLibraryEntry: vi.fn(),
    updateComponentLibraryEntry: vi.fn(),
    deleteComponentLibraryEntry: vi.fn(),
    getUserChatSettings: vi.fn(),
    createUserChatSettings: vi.fn(),
    updateUserChatSettings: vi.fn(),
    getCircuitDesigns: vi.fn(),
    createCircuitDesign: vi.fn(),
    updateCircuitDesign: vi.fn(),
    deleteCircuitDesign: vi.fn(),
    getCircuitInstance: vi.fn(),
    createCircuitInstance: vi.fn(),
    updateCircuitInstance: vi.fn(),
    deleteCircuitInstance: vi.fn(),
    getCircuitNet: vi.fn(),
    createCircuitNet: vi.fn(),
    updateCircuitNet: vi.fn(),
    deleteCircuitNet: vi.fn(),
    getCircuitWire: vi.fn(),
    updateCircuitWire: vi.fn(),
    deleteCircuitWire: vi.fn(),
    getSimulationResults: vi.fn(),
    getSimulationResult: vi.fn(),
    createSimulationResult: vi.fn(),
    deleteSimulationResult: vi.fn(),
    cleanupSimulationResults: vi.fn(),
    getChildDesigns: vi.fn(),
    getRootDesigns: vi.fn(),
    getHierarchicalPorts: vi.fn(),
    getHierarchicalPort: vi.fn(),
    createHierarchicalPort: vi.fn(),
    updateHierarchicalPort: vi.fn(),
    deleteHierarchicalPort: vi.fn(),
    createAiAction: vi.fn(),
    getAiActions: vi.fn(),
    getSpiceModels: vi.fn(),
    getSpiceModel: vi.fn(),
    createSpiceModel: vi.fn(),
    updateSpiceModel: vi.fn(),
    deleteSpiceModel: vi.fn(),
    getDesignPreferences: vi.fn(),
    getDesignPreference: vi.fn(),
    createDesignPreference: vi.fn(),
    updateDesignPreference: vi.fn(),
    deleteDesignPreference: vi.fn(),
    getBomSnapshots: vi.fn(),
    getBomSnapshot: vi.fn(),
    createBomSnapshot: vi.fn(),
    deleteBomSnapshot: vi.fn(),
    getComponentLifecycles: vi.fn(),
    getComponentLifecycle: vi.fn(),
    createComponentLifecycle: vi.fn(),
    updateComponentLifecycle: vi.fn(),
    deleteComponentLifecycle: vi.fn(),
    getDesignSnapshots: vi.fn(),
    getDesignSnapshot: vi.fn(),
    createDesignSnapshot: vi.fn(),
    deleteDesignSnapshot: vi.fn(),
    getDesignComments: vi.fn(),
    getDesignComment: vi.fn(),
    createDesignComment: vi.fn(),
    updateDesignComment: vi.fn(),
    deleteDesignComment: vi.fn(),
    ...overrides,
  } as unknown as IStorage;
}

// ---------------------------------------------------------------------------
// Test server setup
// ---------------------------------------------------------------------------

let app: express.Express;
let server: Server;
let baseUrl: string;
let mockStorage: IStorage;

function setupApp(storage: IStorage): void {
  app = express();
  app.use(express.json({ limit: '150kb' }));
  registerCircuitAutorouteRoutes(app, storage);

  // Error handler to match production behavior
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message });
  });
}

beforeAll(async () => {
  mockStorage = createMockStorage();
  setupApp(mockStorage);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) { reject(err); } else { resolve(); }
    });
  });
});

beforeEach(() => {
  wireIdCounter = 100;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/circuits/:circuitId/autoroute
// ---------------------------------------------------------------------------

describe('POST /api/circuits/:circuitId/autoroute', () => {
  // ------ Endpoint exists ------

  it('endpoint exists and responds (not 404 on route)', async () => {
    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    // Should NOT be a 404 (route not found)
    expect(res.status).not.toBe(404);
  });

  // ------ Validation ------

  it('returns 400 for invalid circuitId (non-numeric)', async () => {
    const res = await fetch(`${baseUrl}/api/circuits/abc/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid view parameter', async () => {
    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'invalid-view' }),
    });

    expect(res.status).toBe(400);
  });

  it('defaults to breadboard view when view is omitted', async () => {
    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
  });

  // ------ Design not found ------

  it('returns 404 when design does not exist', async () => {
    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/circuits/999/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/not found/i);
  });

  // ------ No nets to route ------

  it('returns appropriate message when no nets exist', async () => {
    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routedCount).toBe(0);
    expect(body.unroutedCount).toBe(0);
  });

  // ------ Already-routed nets skipped ------

  it('skips already-routed nets', async () => {
    const net1 = makeNet({ id: 10, segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }] });
    const net2 = makeNet({ id: 20, segments: [{ fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' }] });
    const existingWire = makeWire({ netId: 10, view: 'pcb', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });

    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net1, net2]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([existingWire]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // net1 already routed, only net2 should be routed
    expect(body.routedCount).toBe(1);
    expect(body.wireIds).toHaveLength(1);
  });

  // ------ Wire creation with correct format ------

  it('creates wires with correct designId, netId, points, layer, width', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 100, pcbY: 200, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 300, pcbY: 400, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routedCount).toBe(1);

    // Verify createCircuitWire was called with correct shape
    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls).toHaveLength(1);

    const wireData = createCalls[0][0];
    expect(wireData.circuitId).toBe(1);
    expect(wireData.netId).toBe(10);
    expect(wireData.view).toBe('pcb');
    expect(wireData.layer).toBe('front');
    expect(typeof wireData.width).toBe('number');
    expect(wireData.width).toBeGreaterThan(0);

    // Points should be an array of {x, y} objects with at least 2 points
    expect(Array.isArray(wireData.points)).toBe(true);
    expect(wireData.points.length).toBeGreaterThanOrEqual(2);
    for (const pt of wireData.points) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
    }
  });

  // ------ Manhattan-style routing ------

  it('creates Manhattan-style (L-shaped) wire paths', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 20, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 80, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    const wireData = createCalls[0][0];
    const points = wireData.points as Array<{ x: number; y: number }>;

    // Manhattan path: 3 points (start, bend, end) for an L-shape
    expect(points.length).toBe(3);

    // First point should be near source instance position
    expect(points[0].x).toBe(10);
    expect(points[0].y).toBe(20);

    // Last point should be near target instance position
    expect(points[2].x).toBe(50);
    expect(points[2].y).toBe(80);

    // Middle point should share one coordinate with start and one with end (L-shape)
    const midPt = points[1];
    const isHorizFirst = midPt.x === points[2].x && midPt.y === points[0].y;
    const isVertFirst = midPt.x === points[0].x && midPt.y === points[2].y;
    expect(isHorizFirst || isVertFirst).toBe(true);
  });

  // ------ Breadboard view routing ------

  it('uses breadboard coordinates for breadboard view', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, breadboardX: 15, breadboardY: 25, pcbX: 100, pcbY: 200, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, breadboardX: 55, breadboardY: 85, pcbX: 300, pcbY: 400, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'breadboard' }),
    });

    expect(res.status).toBe(200);

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls).toHaveLength(1);

    const wireData = createCalls[0][0];
    const points = wireData.points as Array<{ x: number; y: number }>;

    // Should use breadboard coords, not pcb coords
    expect(points[0].x).toBe(15);
    expect(points[0].y).toBe(25);
    expect(points[points.length - 1].x).toBe(55);
    expect(points[points.length - 1].y).toBe(85);
  });

  // ------ Response format ------

  it('returns correct response format with routedCount, unroutedCount, viaCount, wireIds, message', async () => {
    const net1 = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const net2 = makeNet({
      id: 20,
      name: 'NET2',
      segments: [{ fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net1, net2]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.routedCount).toBe('number');
    expect(typeof body.unroutedCount).toBe('number');
    expect(typeof body.viaCount).toBe('number');
    expect(Array.isArray(body.wireIds)).toBe(true);
    expect(typeof body.message).toBe('string');
    expect(body.routedCount).toBe(2);
    expect(body.wireIds).toHaveLength(2);
  });

  // ------ Multiple segments per net ------

  it('handles nets with multiple segments', async () => {
    const net = makeNet({
      id: 10,
      segments: [
        { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
        { fromInstanceId: 2, fromPin: 'pin2', toInstanceId: 3, toPin: 'pin1' },
      ],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });
    const inst3 = makeInstance({ id: 3, pcbX: 90, pcbY: 10, referenceDesignator: 'C1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2, inst3]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Should create wires for each segment in the net
    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls.length).toBeGreaterThanOrEqual(1);
    expect(body.routedCount).toBeGreaterThanOrEqual(1);
  });

  // ------ Nets with empty segments skipped ------

  it('skips nets with empty segments', async () => {
    const netWithSegments = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const netWithoutSegments = makeNet({ id: 20, name: 'NET2', segments: [] });

    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([netWithSegments, netWithoutSegments]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Only 1 net should be routed (the one with segments)
    expect(body.routedCount).toBe(1);
    // The net with no segments counts as unrouted
    expect(body.unroutedCount).toBe(1);
  });

  // ------ Missing instance positions ------

  it('handles instances with missing position data gracefully', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    // inst1 has pcb position, inst2 does NOT
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: null, pcbY: null, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Should not crash; net counts as unrouted
    expect(body.unroutedCount).toBeGreaterThanOrEqual(1);
  });

  // ------ Instance not found for segment ------

  it('handles segment referencing non-existent instance', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 999, fromPin: 'pin1', toInstanceId: 998, toPin: 'pin1' }],
    });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Should not crash, net counts as unrouted
    expect(body.unroutedCount).toBeGreaterThanOrEqual(1);
  });

  // ------ Wire IDs in response ------

  it('returns wire IDs of created wires', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const body = await res.json();
    expect(body.wireIds).toHaveLength(1);
    expect(typeof body.wireIds[0]).toBe('number');
  });

  // ------ Trace width defaults ------

  it('uses default trace width of 0.254mm', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls[0][0].width).toBe(0.254);
  });

  // ------ Wider trace for power nets ------

  it('uses wider trace width for power nets', async () => {
    const net = makeNet({
      id: 10,
      netType: 'power',
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    // Power nets should use wider trace
    expect(createCalls[0][0].width).toBeGreaterThan(0.254);
  });

  // ------ All nets already routed ------

  it('returns 0 routed when all nets already have wires', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const existingWire = makeWire({ netId: 10, view: 'pcb' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([existingWire]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routedCount).toBe(0);
    expect(body.unroutedCount).toBe(0);
  });

  // ------ View-specific wire filtering ------

  it('only considers wires matching the requested view when checking already-routed', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    // Wire exists for breadboard view, NOT for pcb view
    const breadboardWire = makeWire({ netId: 10, view: 'breadboard' });

    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([breadboardWire]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Net should be routed for pcb since existing wire is breadboard only
    expect(body.routedCount).toBe(1);
  });

  // ------ Overlap avoidance (L-shape fallback) ------

  it('tries vertical-first L-shape when horizontal-first would overlap existing wire', async () => {
    const net1 = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const net2 = makeNet({
      id: 20,
      name: 'NET2',
      segments: [{ fromInstanceId: 3, fromPin: 'pin1', toInstanceId: 4, toPin: 'pin1' }],
    });

    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 100, pcbY: 100, referenceDesignator: 'R1' });
    const inst3 = makeInstance({ id: 3, pcbX: 0, pcbY: 10, referenceDesignator: 'C1' });
    const inst4 = makeInstance({ id: 4, pcbX: 100, pcbY: 110, referenceDesignator: 'L1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net1, net2]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2, inst3, inst4]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routedCount).toBe(2);

    // Both nets should be routed
    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls).toHaveLength(2);
  });

  // ------ Instances fetched once per request ------

  it('fetches instances once, not once per net', async () => {
    const net1 = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const net2 = makeNet({
      id: 20,
      name: 'NET2',
      segments: [{ fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' }],
    });

    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net1, net2]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    // getCircuitInstances should only be called once (not per-net)
    expect(mockStorage.getCircuitInstances).toHaveBeenCalledTimes(1);
  });

  // ------ Wire type is 'trace' for PCB ------

  it('sets wireType to trace for pcb view', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls[0][0].wireType).toBe('trace');
  });

  it('sets wireType to wire for breadboard view', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, breadboardX: 10, breadboardY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, breadboardX: 50, breadboardY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'breadboard' }),
    });

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls[0][0].wireType).toBe('wire');
  });

  // ------ viaCount is 0 for server-side routing ------

  it('returns viaCount of 0 for simple Manhattan routing', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const body = await res.json();
    expect(body.viaCount).toBe(0);
  });

  // ------ Same-position instances ------

  it('handles source and target at same position (zero-length wire)', async () => {
    const net = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 50, pcbY: 50, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    // Should still succeed, just with a short/direct wire
    const body = await res.json();
    expect(body.routedCount).toBe(1);
  });

  // ------ Color assignment ------

  it('assigns distinct colors to different net wires', async () => {
    const net1 = makeNet({
      id: 10,
      segments: [{ fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' }],
    });
    const net2 = makeNet({
      id: 20,
      name: 'NET2',
      segments: [{ fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' }],
    });
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([net1, net2]);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);

    await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    const createCalls = (mockStorage.createCircuitWire as ReturnType<typeof vi.fn>).mock.calls;
    expect(createCalls).toHaveLength(2);

    const color1 = createCalls[0][0].color;
    const color2 = createCalls[1][0].color;
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
    // Different nets should get different colors
    expect(color1).not.toBe(color2);
  });

  // ------ Large number of nets ------

  it('handles routing many nets without error', async () => {
    const nets: CircuitNetRow[] = [];
    const instances: CircuitInstanceRow[] = [];

    for (let i = 0; i < 20; i++) {
      const fromId = i * 2 + 1;
      const toId = i * 2 + 2;
      nets.push(makeNet({
        id: 100 + i,
        name: `NET${i}`,
        segments: [{ fromInstanceId: fromId, fromPin: 'pin1', toInstanceId: toId, toPin: 'pin1' }],
      }));
      instances.push(makeInstance({ id: fromId, pcbX: i * 20, pcbY: 0, referenceDesignator: `U${fromId}` }));
      instances.push(makeInstance({ id: toId, pcbX: i * 20, pcbY: 100, referenceDesignator: `R${toId}` }));
    }

    (mockStorage.getCircuitDesign as ReturnType<typeof vi.fn>).mockResolvedValue(makeDesign());
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue(nets);
    (mockStorage.getCircuitWires as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue(instances);

    const res = await fetch(`${baseUrl}/api/circuits/1/autoroute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.routedCount).toBe(20);
    expect(body.wireIds).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// POST /api/circuits/:circuitId/suggest-layout (existing endpoint)
// ---------------------------------------------------------------------------

describe('POST /api/circuits/:circuitId/suggest-layout', () => {
  it('returns layout suggestions for instances', async () => {
    const inst1 = makeInstance({ id: 1, pcbX: 10, pcbY: 10, referenceDesignator: 'U1' });
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, referenceDesignator: 'R1' });

    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([inst1, inst2]);
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/suggest-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toHaveLength(2);
    expect(body.instanceCount).toBe(2);
  });

  it('returns 400 when no instances exist', async () => {
    (mockStorage.getCircuitInstances as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockStorage.getCircuitNets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/suggest-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'pcb' }),
    });

    expect(res.status).toBe(400);
  });
});
