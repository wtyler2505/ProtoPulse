/**
 * BreadboardToolbar component tests.
 *
 * Colocated with BreadboardToolbar.tsx (extracted from BreadboardView — audit #29).
 * Verifies: workbench toggle, circuit select, live simulation toggle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CircuitDesignRow } from '@shared/schema';
import { BreadboardToolbar } from '../BreadboardToolbar';

// ---------------------------------------------------------------------------
// Mock useSimulation — matches the pattern in BreadboardView.test.tsx
// ---------------------------------------------------------------------------

const mockSetIsLive = vi.fn();
const mockClearStates = vi.fn();

vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    isLive: false,
    setIsLive: mockSetIsLive,
    clearStates: mockClearStates,
    componentStates: {},
    updateComponentState: vi.fn(),
    wireVisualStates: {},
    componentVisualStates: {},
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCircuits: CircuitDesignRow[] = [
  { id: 1, name: 'Main Circuit', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Power Supply', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
];

function makeProps(overrides: Partial<Parameters<typeof BreadboardToolbar>[0]> = {}) {
  return {
    circuits: mockCircuits,
    activeCircuit: mockCircuits[0],
    onSelectCircuit: vi.fn(),
    workbenchOpen: false,
    onToggleWorkbench: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BreadboardToolbar', () => {
  it('renders the toolbar container', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    expect(screen.getByTestId('breadboard-toolbar')).toBeInTheDocument();
  });

  it('renders the workbench toggle button', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    expect(screen.getByTestId('button-toggle-breadboard-bench')).toBeInTheDocument();
  });

  it('calls onToggleWorkbench when the bench toggle is clicked', () => {
    const props = makeProps();
    render(<BreadboardToolbar {...props} />);
    fireEvent.click(screen.getByTestId('button-toggle-breadboard-bench'));
    expect(props.onToggleWorkbench).toHaveBeenCalledTimes(1);
  });

  it('renders the circuit selector', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    expect(screen.getByTestId('select-breadboard-circuit')).toBeInTheDocument();
  });

  it('renders the Live Simulation toggle button', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    expect(screen.getByText('Live Simulation')).toBeInTheDocument();
  });

  it('shows the active circuit name in the label', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    expect(screen.getByText(/Main Circuit/)).toBeInTheDocument();
  });

  it('shows "No circuit selected" when activeCircuit is null', () => {
    render(<BreadboardToolbar {...makeProps({ activeCircuit: null })} />);
    expect(screen.getByText(/No circuit selected/)).toBeInTheDocument();
  });

  it('calls setIsLive when Live Simulation button is clicked', () => {
    render(<BreadboardToolbar {...makeProps()} />);
    fireEvent.click(screen.getByText('Live Simulation'));
    expect(mockSetIsLive).toHaveBeenCalledWith(true);
  });
});
