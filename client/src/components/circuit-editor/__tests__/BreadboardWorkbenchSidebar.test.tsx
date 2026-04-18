/**
 * Smoke tests for BreadboardWorkbenchSidebar (audit finding #333).
 * Covers: renders root aside, stat chips reflect props, no-circuit empty-state CTA,
 * createCircuit button invokes callback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import BreadboardWorkbenchSidebar from '../BreadboardWorkbenchSidebar';
import type { BreadboardBenchSummary } from '@/lib/breadboard-bench';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectIdProvider projectId={1}>{ui}</ProjectIdProvider>
    </QueryClientProvider>,
  );
}

function emptySummary(): BreadboardBenchSummary {
  return {
    insights: [],
    totals: {
      projectPartCount: 0,
      trackedCount: 0,
      ownedCount: 0,
      readyCount: 0,
      verifiedCount: 0,
      starterFriendlyCount: 0,
      lowStockCount: 0,
      missingCount: 0,
      missingModelCount: 0,
    },
  };
}

function baseProps() {
  return {
    benchInsights: {},
    benchSummary: emptySummary(),
    boardAudit: null,
    createPending: false,
    expandPending: false,
    hasCircuits: false,
    placedInstanceCount: 0,
    wireCount: 0,
    projectPartCount: 0,
    onCreateCircuit: vi.fn(),
    onOpenInventory: vi.fn(),
    onOpenBenchChat: vi.fn(),
    onOpenBenchPlanner: vi.fn(),
    onOpenExactPartRequest: vi.fn(),
    onExpandArchitecture: vi.fn(),
    onOpenComponentEditor: vi.fn(),
    onOpenCommunity: vi.fn(),
    onOpenSchematic: vi.fn(),
  };
}

describe('BreadboardWorkbenchSidebar', () => {
  it('renders root aside container', () => {
    renderWithProviders(<BreadboardWorkbenchSidebar {...baseProps()} />);
    expect(screen.getByTestId('breadboard-workbench')).toBeInTheDocument();
  });

  it('renders stat chips reflecting totals from benchSummary', () => {
    const props = baseProps();
    props.benchSummary.totals.trackedCount = 7;
    props.benchSummary.totals.missingCount = 3;
    props.projectPartCount = 12;
    renderWithProviders(<BreadboardWorkbenchSidebar {...props} />);
    expect(screen.getByText('Project Parts')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows empty-state CTA when hasCircuits=false', () => {
    renderWithProviders(<BreadboardWorkbenchSidebar {...baseProps()} />);
    expect(screen.getByText(/No wiring canvas yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('button-create-workbench-circuit')).toBeInTheDocument();
  });

  it('invokes onCreateCircuit when the create button is clicked', () => {
    const props = baseProps();
    renderWithProviders(<BreadboardWorkbenchSidebar {...props} />);
    fireEvent.click(screen.getByTestId('button-create-workbench-circuit'));
    expect(props.onCreateCircuit).toHaveBeenCalledTimes(1);
  });

  it('hides empty-state CTA when hasCircuits=true', () => {
    const props = baseProps();
    props.hasCircuits = true;
    renderWithProviders(<BreadboardWorkbenchSidebar {...props} />);
    expect(screen.queryByText(/No wiring canvas yet/i)).toBeNull();
  });
});
