import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRun = vi.fn();
const mockCancel = vi.fn();
let mockHookReturn = {
  state: 'idle' as string,
  results: [] as Array<{
    generation: number;
    candidates: Array<{
      id: string;
      ir: { meta: { name: string }; components: Array<{ id: string; refdes: string; partId: string }> };
      fitness: { overall: number; breakdown: Record<string, { score: number; weight: number; detail: string }> };
    }>;
    bestFitness: number;
    averageFitness: number;
  }>,
  best: null as null | {
    ir: { meta: { name: string }; components: Array<{ id: string; refdes: string; partId: string }> };
    fitness: { overall: number };
  },
  run: mockRun,
  cancel: mockCancel,
};

vi.mock('@/lib/generative-design/generative-engine', () => ({
  useGenerativeDesign: () => mockHookReturn,
  GenerativeDesignEngine: {
    getInstance: vi.fn(),
    resetInstance: vi.fn(),
  },
}));

vi.mock('@/lib/circuit-dsl/ir-to-schematic', () => ({
  irToSchematicLayout: vi.fn().mockReturnValue(null),
}));

const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockPushUndoState = vi.fn();

let mockArchitectureNodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }> = [];
let mockArchitectureEdges: Array<{ id: string; source: string; target: string; label?: string }> = [];

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockArchitectureNodes,
    edges: mockArchitectureEdges,
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    pushUndoState: mockPushUndoState,
    hasResolvedInitialGraph: true,
    selectedNodeId: null,
    setSelectedNodeId: vi.fn(),
    focusNodeId: null,
    focusNode: vi.fn(),
    undoStack: [],
    redoStack: [],
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    lastAITurnSnapshot: null,
    captureSnapshot: vi.fn(),
    getChangeDiff: vi.fn().mockReturnValue(''),
    pendingComponentPartId: null,
    setPendingComponentPartId: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (AFTER mocks)
// ---------------------------------------------------------------------------

import GenerativeDesignView from '../GenerativeDesignView';

describe('GenerativeDesignView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = {
      state: 'idle',
      results: [],
      best: null,
      run: mockRun,
      cancel: mockCancel,
    };
  });

  it('renders the spec form', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('generative-design-view')).toBeDefined();
    expect(screen.getByTestId('spec-description-input')).toBeDefined();
  });

  it('renders generate button', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('generate-button')).toBeDefined();
  });

  it('calls run when generate button is clicked', () => {
    render(<GenerativeDesignView />);

    const descInput = screen.getByTestId('spec-description-input') as HTMLTextAreaElement;
    fireEvent.change(descInput, { target: { value: 'LED driver circuit' } });

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no results', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('empty-state')).toBeDefined();
  });

  it('displays candidate cards when results exist', () => {
    mockHookReturn.results = [
      {
        generation: 0,
        bestFitness: 0.85,
        averageFitness: 0.7,
        candidates: [
          {
            id: 'cand-1',
            ir: {
              meta: { name: 'Candidate 1' },
              components: [
                { id: 'r1', refdes: 'R1', partId: 'resistor' },
              ],
            },
            fitness: {
              overall: 0.85,
              breakdown: {
                componentCount: { score: 1.0, weight: 0.2, detail: '1 component' },
              },
            },
          },
          {
            id: 'cand-2',
            ir: {
              meta: { name: 'Candidate 2' },
              components: [
                { id: 'r2', refdes: 'R2', partId: 'resistor' },
                { id: 'c1', refdes: 'C1', partId: 'capacitor' },
              ],
            },
            fitness: {
              overall: 0.72,
              breakdown: {
                componentCount: { score: 0.9, weight: 0.2, detail: '2 components' },
              },
            },
          },
        ],
      },
    ];

    render(<GenerativeDesignView />);
    const cards = screen.getAllByTestId(/^candidate-card-/);
    expect(cards.length).toBe(2);
  });

  it('shows fitness score on candidate cards', () => {
    mockHookReturn.results = [
      {
        generation: 0,
        bestFitness: 0.85,
        averageFitness: 0.7,
        candidates: [
          {
            id: 'cand-1',
            ir: { meta: { name: 'C1' }, components: [] },
            fitness: {
              overall: 0.85,
              breakdown: {},
            },
          },
        ],
      },
    ];

    render(<GenerativeDesignView />);
    expect(screen.getByTestId('fitness-score-cand-1')).toBeDefined();
  });

  it('shows cancel button during generation', () => {
    mockHookReturn.state = 'generating';
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('cancel-button')).toBeDefined();
  });

  it('calls cancel when cancel button clicked', () => {
    mockHookReturn.state = 'generating';
    render(<GenerativeDesignView />);
    const cancelBtn = screen.getByTestId('cancel-button');
    fireEvent.click(cancelBtn);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during scoring', () => {
    mockHookReturn.state = 'scoring';
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('loading-indicator')).toBeDefined();
  });

  it('shows generation progress info', () => {
    mockHookReturn.state = 'evolving';
    mockHookReturn.results = [
      {
        generation: 0,
        bestFitness: 0.8,
        averageFitness: 0.6,
        candidates: [],
      },
    ];

    render(<GenerativeDesignView />);
    expect(screen.getByTestId('generation-progress')).toBeDefined();
  });

  it('shows constraint sliders', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('constraint-budget')).toBeDefined();
    expect(screen.getByTestId('constraint-power')).toBeDefined();
    expect(screen.getByTestId('constraint-temperature')).toBeDefined();
  });

  it('shows population and generation controls', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('population-size-input')).toBeDefined();
    expect(screen.getByTestId('generations-input')).toBeDefined();
  });

  it('shows component count on candidate cards', () => {
    mockHookReturn.results = [
      {
        generation: 0,
        bestFitness: 0.85,
        averageFitness: 0.7,
        candidates: [
          {
            id: 'cand-1',
            ir: {
              meta: { name: 'C1' },
              components: [
                { id: 'r1', refdes: 'R1', partId: 'resistor' },
                { id: 'c1', refdes: 'C1', partId: 'capacitor' },
              ],
            },
            fitness: { overall: 0.85, breakdown: {} },
          },
        ],
      },
    ];

    render(<GenerativeDesignView />);
    expect(screen.getByTestId('component-count-cand-1')).toBeDefined();
  });

  it('disables generate button when state is not idle or complete', () => {
    mockHookReturn.state = 'generating';
    render(<GenerativeDesignView />);
    const btn = screen.getByTestId('generate-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
