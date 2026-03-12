import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Shared mock functions — reset before every test
// ---------------------------------------------------------------------------

const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockPushUndoState = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockAddBomItem = vi.fn();
const mockDeleteBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const mockRunValidation = vi.fn();
const mockAddValidationIssue = vi.fn();
const mockDeleteValidationIssue = vi.fn();
const mockSetProjectName = vi.fn();
const mockSetProjectDescription = vi.fn();
const mockSetActiveView = vi.fn();
const mockAddToHistory = vi.fn();
const mockAddOutputLog = vi.fn();

// ---------------------------------------------------------------------------
// Mutable state that individual tests can seed before rendering the hook.
// The mock context hooks close over these so that the accumulator pattern
// inside `useActionExecutor` sees whatever state was prepared.
// ---------------------------------------------------------------------------

let mockNodes: import('@xyflow/react').Node[] = [];
let mockEdges: import('@xyflow/react').Edge[] = [];
let mockBom: import('@/lib/project-context').BomItem[] = [];
let mockIssues: import('@/lib/project-context').ValidationIssue[] = [];

// ---------------------------------------------------------------------------
// Mock all 6 context hooks consumed by useActionExecutor
// ---------------------------------------------------------------------------

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockNodes,
    edges: mockEdges,
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    pushUndoState: mockPushUndoState,
    undo: mockUndo,
    redo: mockRedo,
    selectedNodeId: null,
    setSelectedNodeId: vi.fn(),
    focusNode: vi.fn(),
    canUndo: true,
    canRedo: true,
    captureSnapshot: vi.fn(),
    getChangeDiff: vi.fn(() => ''),
    pendingComponentPartId: null,
    setPendingComponentPartId: vi.fn(),
    undoStack: [],
    redoStack: [],
    focusNodeId: null,
    lastAITurnSnapshot: null,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBom,
    bomSettings: {
      maxCost: 50,
      batchSize: 1000,
      inStockOnly: true,
      manufacturingDate: new Date(),
    },
    setBomSettings: vi.fn(),
    addBomItem: mockAddBomItem,
    deleteBomItem: mockDeleteBomItem,
    updateBomItem: mockUpdateBomItem,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: mockIssues,
    runValidation: mockRunValidation,
    addValidationIssue: mockAddValidationIssue,
    deleteValidationIssue: mockDeleteValidationIssue,
  }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'architecture' as const,
    setActiveView: mockSetActiveView,
    projectName: 'Test Project',
    setProjectName: mockSetProjectName,
    projectDescription: 'Test Description',
    setProjectDescription: mockSetProjectDescription,
    schematicSheets: [],
    activeSheetId: 'top',
    setActiveSheetId: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/lib/contexts/history-context', () => ({
  useHistory: () => ({
    history: [],
    addToHistory: mockAddToHistory,
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({
    outputLog: [],
    addOutputLog: mockAddOutputLog,
    clearOutputLog: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/arduino-context', () => ({
  useArduino: () => ({
    generateSketch: vi.fn().mockResolvedValue('// generated sketch'),
    compileJob: vi.fn().mockResolvedValue({ id: 1, status: 'completed' }),
    uploadJob: vi.fn().mockResolvedValue({ id: 2, status: 'completed' }),
    searchLibraries: vi.fn().mockResolvedValue([]),
    listBoards: vi.fn().mockResolvedValue([]),
    health: undefined,
    workspace: undefined,
    profiles: [],
    jobs: [],
    files: [],
    isHealthLoading: false,
    isWorkspaceLoading: false,
    isFilesLoading: false,
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock csv utilities used by export_bom_csv
const mockBuildCSV = vi.fn<(headers: string[], rows: (string | number)[][]) => string>(
  () => 'Part Number,Manufacturer\nESP32,Espressif',
);
const mockDownloadBlob = vi.fn<(blob: Blob, filename: string) => void>();

vi.mock('@/lib/csv', () => ({
  buildCSV: (headers: string[], rows: (string | number)[][]) => mockBuildCSV(headers, rows),
  downloadBlob: (blob: Blob, filename: string) => mockDownloadBlob(blob, filename),
}));

// ---------------------------------------------------------------------------
// Import after all mocks are defined (Vitest hoists vi.mock calls
// automatically, but import order after them is still important for clarity).
// ---------------------------------------------------------------------------

import { useActionExecutor } from '../useActionExecutor';
import type { AIAction } from '../../chat-types';

// ---------------------------------------------------------------------------
// Reset all mocks and mutable state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockNodes = [];
  mockEdges = [];
  mockBom = [];
  mockIssues = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useActionExecutor', () => {
  // -----------------------------------------------------------------------
  // 1. add_node
  // -----------------------------------------------------------------------
  it('add_node creates a node and commits via setNodes', () => {
    const { result } = renderHook(() => useActionExecutor());

    let labels: string[];
    act(() => {
      labels = result.current([
        { type: 'add_node', nodeType: 'mcu', label: 'ESP32', description: 'Main MCU' },
      ]);
    });

    // pushUndoState is called at the top of every executeActions invocation
    expect(mockPushUndoState).toHaveBeenCalledOnce();

    // setNodes should be called once with an array containing the new node
    expect(mockSetNodes).toHaveBeenCalledOnce();
    const nodesArg = mockSetNodes.mock.calls[0][0] as import('@xyflow/react').Node[];
    expect(nodesArg).toHaveLength(1);
    expect(nodesArg[0].data.label).toBe('ESP32');
    expect(nodesArg[0].data.type).toBe('mcu');
    expect(nodesArg[0].data.description).toBe('Main MCU');
    expect(nodesArg[0].type).toBe('custom');

    // History and output log
    expect(mockAddToHistory).toHaveBeenCalled();
    expect(mockAddOutputLog).toHaveBeenCalled();

    // Returned labels should include ACTION_LABELS['add_node']
    expect(labels!).toContain('Added component');
  });

  // -----------------------------------------------------------------------
  // 2. remove_node — filters by label (case-insensitive)
  // -----------------------------------------------------------------------
  it('remove_node filters the matching node by label and removes connected edges', () => {
    // Pre-seed state so the accumulator has something to remove
    const nodeId = 'node-to-remove';
    mockNodes = [
      {
        id: nodeId,
        type: 'custom',
        position: { x: 100, y: 100 },
        data: { label: 'ESP32', type: 'mcu', description: 'MCU' },
      },
      {
        id: 'other-node',
        type: 'custom',
        position: { x: 300, y: 100 },
        data: { label: 'Sensor', type: 'sensor', description: 'Temp' },
      },
    ];
    mockEdges = [
      { id: 'edge-1', source: nodeId, target: 'other-node', label: 'SPI' },
    ];

    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'remove_node', nodeLabel: 'esp32' }]);
    });

    // setNodes should receive only the surviving node
    expect(mockSetNodes).toHaveBeenCalledOnce();
    const remainingNodes = mockSetNodes.mock.calls[0][0] as import('@xyflow/react').Node[];
    expect(remainingNodes).toHaveLength(1);
    expect(remainingNodes[0].data.label).toBe('Sensor');

    // Connected edges should also be removed
    expect(mockSetEdges).toHaveBeenCalledOnce();
    const remainingEdges = mockSetEdges.mock.calls[0][0] as import('@xyflow/react').Edge[];
    expect(remainingEdges).toHaveLength(0);

    expect(mockAddToHistory).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 3. add_bom_item
  // -----------------------------------------------------------------------
  it('add_bom_item calls addBomItem with correct data', () => {
    const { result } = renderHook(() => useActionExecutor());

    const action: AIAction = {
      type: 'add_bom_item',
      partNumber: 'ESP32-WROOM-32',
      manufacturer: 'Espressif',
      description: 'WiFi+BT MCU Module',
      quantity: 5,
      unitPrice: 2.5,
      supplier: 'Digi-Key',
    };

    let labels: string[];
    act(() => {
      labels = result.current([action]);
    });

    expect(mockAddBomItem).toHaveBeenCalledOnce();
    const bomArg = mockAddBomItem.mock.calls[0][0] as Record<string, unknown>;
    expect(bomArg.partNumber).toBe('ESP32-WROOM-32');
    expect(bomArg.manufacturer).toBe('Espressif');
    expect(bomArg.description).toBe('WiFi+BT MCU Module');
    expect(bomArg.quantity).toBe(5);
    expect(bomArg.unitPrice).toBe(2.5);
    // totalPrice is computed server-side: quantity * unitPrice
    expect(bomArg.totalPrice).toBe(12.5);
    expect(bomArg.supplier).toBe('Digi-Key');

    expect(labels!).toContain('Added to BOM');
  });

  // -----------------------------------------------------------------------
  // 4. remove_bom_item — finds by partNumber (case-insensitive includes)
  // -----------------------------------------------------------------------
  it('remove_bom_item calls deleteBomItem with the matching item id', () => {
    mockBom = [
      {
        id: 'bom-abc',
        partNumber: 'ESP32-WROOM-32',
        manufacturer: 'Espressif',
        description: 'MCU',
        quantity: 1,
        unitPrice: 2.5,
        totalPrice: 2.5,
        supplier: 'Digi-Key' as const,
        stock: 100,
        status: 'In Stock' as const,
      },
    ];

    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'remove_bom_item', partNumber: 'esp32-wroom' }]);
    });

    expect(mockDeleteBomItem).toHaveBeenCalledOnce();
    expect(mockDeleteBomItem).toHaveBeenCalledWith('bom-abc');
    expect(mockAddToHistory).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 5. clear_canvas — empties both nodes and edges
  // -----------------------------------------------------------------------
  it('clear_canvas empties nodes and edges', () => {
    mockNodes = [
      {
        id: 'n1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'MCU', type: 'mcu' },
      },
    ];
    mockEdges = [
      { id: 'e1', source: 'n1', target: 'n2' },
    ];

    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'clear_canvas' }]);
    });

    expect(mockSetNodes).toHaveBeenCalledWith([]);
    expect(mockSetEdges).toHaveBeenCalledWith([]);
    expect(mockAddToHistory).toHaveBeenCalledWith('Cleared all architecture nodes', 'AI');
  });

  // -----------------------------------------------------------------------
  // 6. undo
  // -----------------------------------------------------------------------
  it('undo calls architecture.undo()', () => {
    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'undo' }]);
    });

    expect(mockUndo).toHaveBeenCalledOnce();
    expect(mockAddToHistory).toHaveBeenCalledWith('Undid last action', 'AI');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[AI] Undid last action');
  });

  // -----------------------------------------------------------------------
  // 7. redo
  // -----------------------------------------------------------------------
  it('redo calls architecture.redo()', () => {
    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'redo' }]);
    });

    expect(mockRedo).toHaveBeenCalledOnce();
    expect(mockAddToHistory).toHaveBeenCalledWith('Redid action', 'AI');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[AI] Redid action');
  });

  // -----------------------------------------------------------------------
  // 8. run_validation
  // -----------------------------------------------------------------------
  it('run_validation calls validation.runValidation()', () => {
    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'run_validation' }]);
    });

    expect(mockRunValidation).toHaveBeenCalledOnce();
    expect(mockAddToHistory).toHaveBeenCalledWith('Ran design validation', 'AI');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[AI] Ran design validation');
  });

  // -----------------------------------------------------------------------
  // 9. rename_project
  // -----------------------------------------------------------------------
  it('rename_project calls setProjectName with the new name', () => {
    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'rename_project', name: 'IoT Sensor Hub' }]);
    });

    expect(mockSetProjectName).toHaveBeenCalledOnce();
    expect(mockSetProjectName).toHaveBeenCalledWith('IoT Sensor Hub');
    expect(mockAddToHistory).toHaveBeenCalledWith('Renamed project to: IoT Sensor Hub', 'AI');
  });

  // -----------------------------------------------------------------------
  // 10. switch_view
  // -----------------------------------------------------------------------
  it('switch_view calls setActiveView with the target view', () => {
    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'switch_view', view: 'procurement' }]);
    });

    expect(mockSetActiveView).toHaveBeenCalledOnce();
    expect(mockSetActiveView).toHaveBeenCalledWith('procurement');
    expect(mockAddToHistory).toHaveBeenCalledWith('Switched to procurement view', 'AI');
  });

  // -----------------------------------------------------------------------
  // 11. unknown action type — skipped gracefully, no error
  // -----------------------------------------------------------------------
  it('unknown action type is skipped without throwing', () => {
    const { result } = renderHook(() => useActionExecutor());

    let labels: string[];
    act(() => {
      labels = result.current([
        { type: 'nonexistent_action_type_xyz' },
      ]);
    });

    // Should not throw — execution completes normally.
    // The action's label falls through to the raw type string since
    // ACTION_LABELS does not contain an entry for it.
    expect(labels!).toHaveLength(1);
    expect(labels![0]).toBe('nonexistent_action_type_xyz');

    // pushUndoState is always called at the top
    expect(mockPushUndoState).toHaveBeenCalledOnce();

    // No context mutations should have fired (no nodes/edges dirty)
    expect(mockSetNodes).not.toHaveBeenCalled();
    expect(mockSetEdges).not.toHaveBeenCalled();
    expect(mockAddBomItem).not.toHaveBeenCalled();
    expect(mockRunValidation).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 12. empty actions array — returns empty results
  // -----------------------------------------------------------------------
  it('empty actions array returns empty results', () => {
    const { result } = renderHook(() => useActionExecutor());

    let labels: string[];
    act(() => {
      labels = result.current([]);
    });

    expect(labels!).toEqual([]);

    // pushUndoState is still called (it runs before the loop)
    expect(mockPushUndoState).toHaveBeenCalledOnce();

    // No state mutations
    expect(mockSetNodes).not.toHaveBeenCalled();
    expect(mockSetEdges).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 13. export_bom_csv — calls buildCSV and downloadBlob
  // -----------------------------------------------------------------------
  it('export_bom_csv builds CSV and triggers download when BOM is non-empty', () => {
    mockBom = [
      {
        id: 'bom-1',
        partNumber: 'ESP32-WROOM-32',
        manufacturer: 'Espressif',
        description: 'MCU Module',
        quantity: 2,
        unitPrice: 3.0,
        totalPrice: 6.0,
        supplier: 'Digi-Key' as const,
        stock: 50,
        status: 'In Stock' as const,
      },
    ];

    const { result } = renderHook(() => useActionExecutor());

    act(() => {
      result.current([{ type: 'export_bom_csv' }]);
    });

    // buildCSV should have been called with correct headers and row data
    expect(mockBuildCSV).toHaveBeenCalledOnce();
    const [headers, rows] = mockBuildCSV.mock.calls[0];
    expect(headers).toEqual([
      'Part Number', 'Manufacturer', 'Description', 'Quantity',
      'Unit Price', 'Total Price', 'Supplier', 'Status',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('ESP32-WROOM-32');

    // downloadBlob should have been called with a Blob and filename
    expect(mockDownloadBlob).toHaveBeenCalledOnce();
    const [blob, filename] = mockDownloadBlob.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toBe('Test Project_BOM.csv');

    expect(mockAddToHistory).toHaveBeenCalledWith('Exported BOM as CSV', 'AI');
  });

  // -----------------------------------------------------------------------
  // 14. Multiple actions in a single batch use the accumulator correctly
  // -----------------------------------------------------------------------
  it('multiple actions in one batch accumulate state correctly', () => {
    const { result } = renderHook(() => useActionExecutor());

    let labels: string[];
    act(() => {
      labels = result.current([
        { type: 'add_node', nodeType: 'mcu', label: 'ESP32', description: 'MCU' },
        { type: 'add_node', nodeType: 'sensor', label: 'BME280', description: 'Temp sensor' },
      ]);
    });

    // Both nodes should appear in the single setNodes call (accumulated)
    expect(mockSetNodes).toHaveBeenCalledOnce();
    const nodesArg = mockSetNodes.mock.calls[0][0] as import('@xyflow/react').Node[];
    expect(nodesArg).toHaveLength(2);
    expect(nodesArg[0].data.label).toBe('ESP32');
    expect(nodesArg[1].data.label).toBe('BME280');

    // Both labels should be returned
    expect(labels!).toHaveLength(2);
    expect(labels!).toEqual(['Added component', 'Added component']);

    // pushUndoState called exactly once for the whole batch
    expect(mockPushUndoState).toHaveBeenCalledOnce();
  });
});
