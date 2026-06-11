import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentLifecycle } from '@shared/schema';
import LifecycleDashboard from '@/components/views/LifecycleDashboard';

let mockEntries: ComponentLifecycle[] = [];
const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { data: mockEntries, total: mockEntries.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: () => ({ mutate: mockMutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  getQueryFn: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const now = new Date('2026-05-24T12:00:00.000Z');

function lifecycleEntry(overrides: Partial<ComponentLifecycle>): ComponentLifecycle {
  return {
    id: 1,
    projectId: 1,
    bomItemId: null,
    partNumber: 'MCU-123',
    manufacturer: 'Acme',
    lifecycleStatus: 'active',
    lastCheckedAt: null,
    alternatePartNumbers: null,
    dataSource: 'Manual',
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function renderLifecycle(entries: ComponentLifecycle[]) {
  mockEntries = entries;
  return render(<LifecycleDashboard />);
}

describe('LifecycleDashboard release gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntries = [];
    window.localStorage.clear();
    window.localStorage.setItem('protopulse-session-id', 'session-1');
  });

  it('blocks CSV export when lifecycle-risk parts have no alternate', () => {
    renderLifecycle([
      lifecycleEntry({
        id: 1,
        partNumber: 'EOL-001',
        lifecycleStatus: 'eol',
        alternatePartNumbers: null,
      }),
    ]);

    expect(screen.getByTestId('lifecycle-release-gate')).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-gate-status')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('lifecycle-gate-blocker')).toHaveTextContent('Lifecycle Risk');
    expect(screen.getByTestId('button-export-csv')).toBeDisabled();
  });

  it('warns but allows CSV export when EOL and NRND parts have alternates', () => {
    renderLifecycle([
      lifecycleEntry({
        id: 1,
        partNumber: 'EOL-001',
        lifecycleStatus: 'eol',
        alternatePartNumbers: 'ALT-001',
      }),
      lifecycleEntry({
        id: 2,
        partNumber: 'NRND-001',
        lifecycleStatus: 'nrnd',
        alternatePartNumbers: 'ALT-002',
      }),
    ]);

    expect(screen.getByTestId('lifecycle-gate-status')).toHaveTextContent('Review');
    expect(screen.getByTestId('lifecycle-gate-warning')).toHaveTextContent('Lifecycle Risk');
    expect(screen.getByTestId('button-export-csv')).not.toBeDisabled();
  });

  it('marks the gate ready when tracked parts are active', () => {
    renderLifecycle([
      lifecycleEntry({
        id: 1,
        partNumber: 'ACTIVE-001',
        lifecycleStatus: 'active',
      }),
    ]);

    expect(screen.getByTestId('lifecycle-gate-status')).toHaveTextContent('Ready');
    expect(screen.queryByTestId('lifecycle-gate-blocker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lifecycle-gate-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('button-export-csv')).not.toBeDisabled();
  });
});
