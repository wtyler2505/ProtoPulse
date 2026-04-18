/**
 * BreadboardEmptyState component tests.
 *
 * Colocated with BreadboardEmptyState.tsx (extracted from BreadboardView — audit #29).
 * Verifies: all 3 buttons render, each click fires the correct callback prop,
 * pending states disable buttons and update labels.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BreadboardEmptyState } from '../BreadboardEmptyState';

function makeProps(overrides: Partial<Parameters<typeof BreadboardEmptyState>[0]> = {}) {
  return {
    onCreateCircuit: vi.fn(),
    isCreating: false,
    onExpandArchitecture: vi.fn(),
    isExpanding: false,
    onOpenSchematic: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BreadboardEmptyState', () => {
  it('renders the empty state container', () => {
    render(<BreadboardEmptyState {...makeProps()} />);
    expect(screen.getByTestId('breadboard-empty')).toBeInTheDocument();
  });

  it('renders the Create wiring canvas button', () => {
    render(<BreadboardEmptyState {...makeProps()} />);
    expect(screen.getByTestId('button-create-first-breadboard-circuit')).toBeInTheDocument();
    expect(screen.getByText('Create wiring canvas')).toBeInTheDocument();
  });

  it('renders the Expand from architecture button', () => {
    render(<BreadboardEmptyState {...makeProps()} />);
    expect(screen.getByTestId('button-expand-architecture-to-breadboard')).toBeInTheDocument();
    expect(screen.getByText('Expand from architecture')).toBeInTheDocument();
  });

  it('renders the Open schematic button', () => {
    render(<BreadboardEmptyState {...makeProps()} />);
    expect(screen.getByTestId('button-open-schematic-from-empty-breadboard')).toBeInTheDocument();
    expect(screen.getByText('Open schematic')).toBeInTheDocument();
  });

  it('calls onCreateCircuit when Create wiring canvas is clicked', () => {
    const props = makeProps();
    render(<BreadboardEmptyState {...props} />);
    fireEvent.click(screen.getByTestId('button-create-first-breadboard-circuit'));
    expect(props.onCreateCircuit).toHaveBeenCalledTimes(1);
  });

  it('calls onExpandArchitecture when Expand from architecture is clicked', () => {
    const props = makeProps();
    render(<BreadboardEmptyState {...props} />);
    fireEvent.click(screen.getByTestId('button-expand-architecture-to-breadboard'));
    expect(props.onExpandArchitecture).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenSchematic when Open schematic is clicked', () => {
    const props = makeProps();
    render(<BreadboardEmptyState {...props} />);
    fireEvent.click(screen.getByTestId('button-open-schematic-from-empty-breadboard'));
    expect(props.onOpenSchematic).toHaveBeenCalledTimes(1);
  });

  it('disables Create button and shows "Creating…" when isCreating is true', () => {
    render(<BreadboardEmptyState {...makeProps({ isCreating: true })} />);
    const btn = screen.getByTestId('button-create-first-breadboard-circuit');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Creating…')).toBeInTheDocument();
  });

  it('disables Expand button and shows "Expanding…" when isExpanding is true', () => {
    render(<BreadboardEmptyState {...makeProps({ isExpanding: true })} />);
    const btn = screen.getByTestId('button-expand-architecture-to-breadboard');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Expanding…')).toBeInTheDocument();
  });
});
