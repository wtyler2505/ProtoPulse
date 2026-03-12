/**
 * BreadboardView Component Tests
 *
 * Tests for the BreadboardView React component (client/src/components/circuit-editor/BreadboardView.tsx).
 * Covers rendering states, toolbar, canvas tools, and keyboard shortcuts.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mock all hooks and child components before importing BreadboardView
// ---------------------------------------------------------------------------

const mockCircuits = [
  { id: 1, name: 'Main Circuit', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Power Supply', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
];

const mockInstances = [
  {
    id: 1,
    circuitDesignId: 1,
    componentId: null,
    referenceDesignator: 'U1',
    x: 100,
    y: 100,
    rotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: null,
    breadboardX: null,
    breadboardY: null,
  },
];

const mockNets = [
  {
    id: 1,
    name: 'GND',
    circuitDesignId: 1,
    segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
  },
];

const mockWires = [
  {
    id: 1,
    circuitDesignId: 1,
    netId: 1,
    view: 'breadboard',
    points: [{ x: 30, y: 50 }, { x: 60, y: 50 }],
    layer: null,
    width: 1.5,
    color: '#e74c3c',
    wireType: 'wire',
  },
  {
    id: 2,
    circuitDesignId: 1,
    netId: 1,
    view: 'schematic', // Should be filtered out
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    layer: null,
    width: 1,
    color: '#333',
    wireType: 'wire',
  },
];

const mockCreateWire = { mutate: vi.fn() };
const mockCreateInstance = { mutate: vi.fn() };
const mockDeleteWire = { mutate: vi.fn() };
const mockUpdateInstance = { mutate: vi.fn() };

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    isLive: false,
    setIsLive: vi.fn(),
    clearStates: vi.fn(),
    componentStates: {},
    updateComponentState: vi.fn(),
  }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: (_projectId: number) => ({ data: [] }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: (_projectId: number) => ({ data: mockCircuits, isLoading: false }),
  useCircuitInstances: (_circuitId: number) => ({ data: mockInstances }),
  useCircuitNets: (_circuitId: number) => ({ data: mockNets }),
  useCircuitWires: (_circuitId: number) => ({ data: mockWires }),
  useCreateCircuitWire: () => mockCreateWire,
  useCreateCircuitInstance: () => mockCreateInstance,
  useDeleteCircuitWire: () => mockDeleteWire,
  useUpdateCircuitInstance: () => mockUpdateInstance,
}));

vi.mock('../BreadboardGrid', () => ({
  default: (props: Record<string, unknown>) => (
    <g data-testid="mock-breadboard-grid" data-props={JSON.stringify(Object.keys(props))} />
  ),
}));

vi.mock('../RatsnestOverlay', () => ({
  default: (props: Record<string, unknown>) => (
    <g data-testid="mock-ratsnest-overlay" data-nets={String(props.nets)} />
  ),
}));

vi.mock('../ToolButton', () => ({
  default: ({ icon: _icon, label, active, onClick, testId }: {
    icon: unknown;
    label: string;
    active?: boolean;
    onClick: () => void;
    testId: string;
  }) => (
    <button
      data-testid={testId}
      data-active={String(active ?? false)}
      title={label}
      onClick={onClick}
    >
      {label}
    </button>
  ),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange: (v: string) => void; value: string }) => (
    <div data-testid="mock-select" data-value={value} onClick={() => onValueChange('2')}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) => (
    <button data-testid={props['data-testid'] ?? 'select-trigger'}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
  CircuitBoard: () => <svg data-testid="icon-circuit-board" />,
  MousePointer2: () => <svg data-testid="icon-mouse-pointer" />,
  Pencil: () => <svg data-testid="icon-pencil" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  ZoomIn: () => <svg data-testid="icon-zoom-in" />,
  ZoomOut: () => <svg data-testid="icon-zoom-out" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
  Info: () => <svg data-testid="icon-info" />,
  Activity: () => <svg data-testid="icon-activity" />,
  Square: () => <svg data-testid="icon-square" />,
}));

vi.mock('../BreadboardComponentRenderer', () => ({
  BreadboardComponentOverlay: () => <g data-testid="mock-component-overlay" />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Now import BreadboardView after all mocks
import BreadboardView from '../BreadboardView';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BreadboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the breadboard view container', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-view')).toBeDefined();
    });

    it('renders the toolbar', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-toolbar')).toBeDefined();
    });

    it('renders the canvas container', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-canvas-container')).toBeDefined();
    });

    it('renders the SVG element', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-svg')).toBeDefined();
    });

    it('renders the BreadboardGrid child', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('mock-breadboard-grid')).toBeDefined();
    });

    it('renders the RatsnestOverlay child', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('mock-ratsnest-overlay')).toBeDefined();
    });
  });

  describe('toolbar tools', () => {
    it('renders select, wire, and delete tool buttons', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('tool-select')).toBeDefined();
      expect(screen.getByTestId('tool-wire')).toBeDefined();
      expect(screen.getByTestId('tool-delete')).toBeDefined();
    });

    it('renders zoom controls', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('tool-zoom-in')).toBeDefined();
      expect(screen.getByTestId('tool-zoom-out')).toBeDefined();
      expect(screen.getByTestId('tool-reset-view')).toBeDefined();
    });

    it('select tool is active by default', () => {
      render(<BreadboardView />);
      const selectBtn = screen.getByTestId('tool-select');
      expect(selectBtn.getAttribute('data-active')).toBe('true');
    });

    it('clicking wire tool activates it', () => {
      render(<BreadboardView />);
      fireEvent.click(screen.getByTestId('tool-wire'));
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');
      expect(screen.getByTestId('tool-select').getAttribute('data-active')).toBe('false');
    });

    it('clicking delete tool activates it', () => {
      render(<BreadboardView />);
      fireEvent.click(screen.getByTestId('tool-delete'));
      expect(screen.getByTestId('tool-delete').getAttribute('data-active')).toBe('true');
    });
  });

  describe('keyboard shortcuts', () => {
    it('pressing 1 activates select tool', () => {
      render(<BreadboardView />);
      // First activate wire so we can verify switch
      fireEvent.click(screen.getByTestId('tool-wire'));
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');

      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '1' });
      expect(screen.getByTestId('tool-select').getAttribute('data-active')).toBe('true');
    });

    it('pressing 2 activates wire tool', () => {
      render(<BreadboardView />);
      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '2' });
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');
    });

    it('pressing 3 activates delete tool', () => {
      render(<BreadboardView />);
      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '3' });
      expect(screen.getByTestId('tool-delete').getAttribute('data-active')).toBe('true');
    });
  });

  describe('empty guidance', () => {
    it('shows guidance when no instances are placed on breadboard', () => {
      render(<BreadboardView />);
      // All mock instances have breadboardX = null
      expect(screen.getByTestId('breadboard-empty-guidance')).toBeDefined();
    });
  });

  describe('wires', () => {
    it('renders breadboard wires (filters out schematic wires)', () => {
      render(<BreadboardView />);
      // Wire 1 is breadboard view, wire 2 is schematic view
      expect(screen.getByTestId('wire-1')).toBeDefined();
      expect(screen.queryByTestId('wire-2')).toBeNull();
    });
  });
});

// ============================================================================
// Drag-to-place (BL-0478)
// ============================================================================

describe('BreadboardView — drag-to-place', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canvas accepts dragOver with correct data type', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: ['application/reactflow/type'],
        dropEffect: '',
      },
    });
    Object.defineProperty(event, 'clientX', { value: 200 });
    Object.defineProperty(event, 'clientY', { value: 200 });
    const prevented = !canvas.dispatchEvent(event);
    // preventDefault was called → event default was prevented
    expect(prevented).toBe(true);
  });

  it('canvas ignores dragOver without correct data type', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: ['text/plain'],
        dropEffect: '',
      },
    });
    const prevented = !canvas.dispatchEvent(event);
    expect(prevented).toBe(false);
  });

  it('drop creates a new instance via mutation', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');

    // Simulate drop with component data
    const dropEvent = createDropEvent('mcu', 'ATmega328P', 200, 200);
    fireEvent(canvas, dropEvent);

    expect(mockCreateInstance.mutate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateInstance.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.circuitId).toBe(1);
    expect(callArgs.partId).toBeNull();
    expect(callArgs.referenceDesignator).toBeDefined();
    expect(typeof callArgs.breadboardX).toBe('number');
    expect(typeof callArgs.breadboardY).toBe('number');
  });

  it('drop without component data type does NOT create instance', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');

    // Drop with empty node type (no reactflow data)
    const event = new Event('drop', { bubbles: true, cancelable: true });
    const emptyStore: Record<string, string> = {};
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: [],
        getData: (key: string) => emptyStore[key] ?? '',
        setData: vi.fn(),
        dropEffect: 'copy',
        effectAllowed: 'all',
      },
    });
    Object.defineProperty(event, 'clientX', { value: 200 });
    Object.defineProperty(event, 'clientY', { value: 200 });
    fireEvent(canvas, event);

    expect(mockCreateInstance.mutate).not.toHaveBeenCalled();
  });
});

/** Helper to create a synthetic drop event with dataTransfer data. */
function createDropEvent(nodeType: string, label: string, clientX: number, clientY: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: DataTransfer;
    clientX: number;
    clientY: number;
  };
  const dataStore: Record<string, string> = {
    'application/reactflow/type': nodeType,
    'application/reactflow/label': label,
  };
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: Object.keys(dataStore),
      getData: (key: string) => dataStore[key] ?? '',
      setData: vi.fn(),
      dropEffect: 'copy',
      effectAllowed: 'all',
    },
  });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  return event;
}

// ============================================================================
// Loading and empty states (separate mock overrides)
// ============================================================================

describe('BreadboardView — loading state', () => {
  it('shows loader when circuits are loading', async () => {
    const hooksModule = await import('@/lib/circuit-editor/hooks') as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: undefined, isLoading: true });

    render(<BreadboardView />);
    expect(screen.getByTestId('breadboard-loading')).toBeDefined();

    // Restore
    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });
});

describe('BreadboardView — empty state', () => {
  it('shows empty state when no circuits exist', async () => {
    const hooksModule = await import('@/lib/circuit-editor/hooks') as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: [], isLoading: false });

    render(<BreadboardView />);
    expect(screen.getByTestId('breadboard-empty')).toBeDefined();

    // Restore
    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });
});
