/**
 * GenerativeDesignView — NumberInput ARIA-contract migration test (BL-0781).
 *
 * Per the BL-0781 audit (docs/audits/bl-0781-number-input-audit.md,
 * "Component-editor + views" table), both instances are KEEP — real, intentional
 * bounds: population size min=2/max=20, generation count min=1/max=50.
 *
 * Mocks mirror the existing `client/src/components/views/__tests__/GenerativeDesignView.test.tsx`
 * suite so this view can mount without pulling in the generative-design worker,
 * architecture context, or toast machinery.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';

function render(ui: ReactElement) {
  const qc = createTestQueryClient();
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockRun = vi.fn();
const mockCancel = vi.fn();
let mockHookReturn = {
  state: 'idle' as string,
  results: [] as unknown[],
  best: null as unknown,
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

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [],
    edges: [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    pushUndoState: vi.fn(),
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

import GenerativeDesignView from '../GenerativeDesignView';

describe('GenerativeDesignView — NumberInput ARIA contract (BL-0781)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = { state: 'idle', results: [], best: null, run: mockRun, cancel: mockCancel };
  });

  it('population size: renders as a spinbutton, KEEP min=2/max=20', () => {
    render(<GenerativeDesignView />);
    const el = screen.getByTestId('population-size-input');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.getAttribute('aria-valuemin')).toBe('2');
    expect(el.getAttribute('aria-valuemax')).toBe('20');
    expect(el.getAttribute('min')).toBe('2');
    expect(el.getAttribute('max')).toBe('20');
  });

  it('generations: renders as a spinbutton, KEEP min=1/max=50', () => {
    render(<GenerativeDesignView />);
    const el = screen.getByTestId('generations-input');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.getAttribute('aria-valuemin')).toBe('1');
    expect(el.getAttribute('aria-valuemax')).toBe('50');
    expect(el.getAttribute('min')).toBe('1');
    expect(el.getAttribute('max')).toBe('50');
  });

  it('mirrors the current population/generations values onto aria-valuenow', () => {
    render(<GenerativeDesignView />);
    // Defaults per GenerativeDesignView: populationSize=6, generations=5
    expect(screen.getByTestId('population-size-input').getAttribute('aria-valuenow')).toBe('6');
    expect(screen.getByTestId('generations-input').getAttribute('aria-valuenow')).toBe('5');
  });

  it('regression guard: neither field is ever "0" for a real max (KEEP rows are unaffected by the bug, but must not regress)', () => {
    render(<GenerativeDesignView />);
    expect(screen.getByTestId('population-size-input').getAttribute('aria-valuemax')).not.toBe('0');
    expect(screen.getByTestId('generations-input').getAttribute('aria-valuemax')).not.toBe('0');
  });
});
