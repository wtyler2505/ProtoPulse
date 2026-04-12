import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartUsagePanel from '../PartUsagePanel';
import type { PartUsageRow } from '@/lib/parts/use-part-usage';

// ---------------------------------------------------------------------------
// Mock the usePartUsage hook
// ---------------------------------------------------------------------------

const mockUsePartUsage = vi.fn();

vi.mock('@/lib/parts/use-part-usage', () => ({
  usePartUsage: (...args: unknown[]) => mockUsePartUsage(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const SAMPLE_USAGE: PartUsageRow[] = [
  {
    projectId: 1,
    projectName: 'My Rover',
    stockQuantityNeeded: 3,
    stockQuantityOnHand: 10,
    placementCount: 5,
  },
  {
    projectId: 2,
    projectName: 'Weather Station',
    stockQuantityNeeded: 1,
    stockQuantityOnHand: null,
    placementCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartUsagePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUsePartUsage.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUsePartUsage.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fetch failed'),
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-error')).toBeInTheDocument();
  });

  it('renders empty state when no projects use the part', () => {
    mockUsePartUsage.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-empty')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-count')).toHaveTextContent('0 projects');
  });

  it('renders project list with correct data', () => {
    mockUsePartUsage.mockReturnValue({
      data: SAMPLE_USAGE,
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-count')).toHaveTextContent('2 projects');
    expect(screen.getByTestId('part-usage-project-1')).toBeInTheDocument();
    expect(screen.getByTestId('part-usage-project-2')).toBeInTheDocument();
  });

  it('displays project name, quantity needed, and quantity on hand', () => {
    mockUsePartUsage.mockReturnValue({
      data: SAMPLE_USAGE,
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-project-name-1')).toHaveTextContent('My Rover');
    expect(screen.getByTestId('part-usage-qty-needed-1')).toHaveTextContent('Need 3');
    expect(screen.getByTestId('part-usage-qty-on-hand-1')).toHaveTextContent('Have 10');
  });

  it('displays placement count badge when placements exist', () => {
    mockUsePartUsage.mockReturnValue({
      data: SAMPLE_USAGE,
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    // Project 1 has 5 placements — should show badge
    expect(screen.getByTestId('part-usage-placements-1')).toHaveTextContent('5 placed');
    // Project 2 has 0 placements — badge should not exist
    expect(screen.queryByTestId('part-usage-placements-2')).not.toBeInTheDocument();
  });

  it('shows dash for null quantity on hand', () => {
    mockUsePartUsage.mockReturnValue({
      data: SAMPLE_USAGE,
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-qty-on-hand-2')).toHaveTextContent('Have —');
  });

  it('uses singular "project" for count of 1', () => {
    mockUsePartUsage.mockReturnValue({
      data: [SAMPLE_USAGE[0]],
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('part-usage-count')).toHaveTextContent('1 project');
  });

  it('collapses and expands when toggle is clicked', () => {
    mockUsePartUsage.mockReturnValue({
      data: SAMPLE_USAGE,
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="abc-123" />, { wrapper: createWrapper() });

    // Panel starts expanded — projects visible
    expect(screen.getByTestId('part-usage-project-1')).toBeVisible();

    // Click to collapse
    fireEvent.click(screen.getByTestId('part-usage-toggle'));

    // Projects should be hidden
    expect(screen.queryByTestId('part-usage-project-1')).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByTestId('part-usage-toggle'));

    expect(screen.getByTestId('part-usage-project-1')).toBeInTheDocument();
  });

  it('passes partId to usePartUsage', () => {
    mockUsePartUsage.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<PartUsagePanel partId="my-part-uuid" />, { wrapper: createWrapper() });

    expect(mockUsePartUsage).toHaveBeenCalledWith('my-part-uuid');
  });
});
