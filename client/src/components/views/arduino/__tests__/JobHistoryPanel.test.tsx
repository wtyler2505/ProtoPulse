import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobHistoryPanel from '../JobHistoryPanel';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/project-context', () => ({
  useProjectId: () => 1,
}));

const mockJobs = [
  {
    id: 1,
    projectId: 1,
    profileId: null,
    jobType: 'compile',
    status: 'completed',
    command: 'arduino-cli compile',
    args: { fqbn: 'arduino:avr:uno' },
    startedAt: '2026-03-13T10:00:00Z',
    finishedAt: '2026-03-13T10:00:05Z',
    exitCode: 0,
    summary: 'Compilation successful',
    errorCode: null,
    log: 'Sketch uses 1234 bytes (3%) of program storage space.',
    createdAt: '2026-03-13T10:00:00Z',
  },
  {
    id: 2,
    projectId: 1,
    profileId: null,
    jobType: 'upload',
    status: 'failed',
    command: 'arduino-cli upload',
    args: { fqbn: 'arduino:avr:mega', port: '/dev/ttyUSB0' },
    startedAt: '2026-03-13T11:00:00Z',
    finishedAt: '2026-03-13T11:00:03Z',
    exitCode: 1,
    summary: 'Upload failed: port not found',
    errorCode: 'PORT_NOT_FOUND',
    log: 'Error: cannot find port /dev/ttyUSB0',
    createdAt: '2026-03-13T11:00:00Z',
  },
  {
    id: 3,
    projectId: 1,
    profileId: null,
    jobType: 'compile',
    status: 'cancelled',
    command: 'arduino-cli compile',
    args: { fqbn: 'esp32:esp32:esp32' },
    startedAt: '2026-03-13T12:00:00Z',
    finishedAt: null,
    exitCode: null,
    summary: 'Cancelled by user',
    errorCode: null,
    log: null,
    createdAt: '2026-03-13T12:00:00Z',
  },
  {
    id: 4,
    projectId: 1,
    profileId: null,
    jobType: 'compile',
    status: 'pending',
    command: 'arduino-cli compile',
    args: { fqbn: 'arduino:avr:nano' },
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    summary: 'Queued for compilation...',
    errorCode: null,
    log: null,
    createdAt: '2026-03-13T13:00:00Z',
  },
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderPanel(fetchResponse?: { data: typeof mockJobs; total: number }) {
  const qc = createQueryClient();

  // Mock fetch
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(fetchResponse ?? { data: mockJobs, total: mockJobs.length }),
  });

  return render(
    <QueryClientProvider client={qc}>
      <JobHistoryPanel />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobHistoryPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('test-session');
  });

  it('renders loading state initially', () => {
    const qc = createQueryClient();
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves

    render(
      <QueryClientProvider client={qc}>
        <JobHistoryPanel />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('job-history-panel')).toBeInTheDocument();
  });

  it('renders empty state when no jobs', async () => {
    renderPanel({ data: [], total: 0 });

    await waitFor(() => {
      expect(screen.getByText('No jobs yet')).toBeInTheDocument();
    });

    expect(screen.getByTestId('job-history-panel')).toBeInTheDocument();
  });

  it('renders job list with correct statuses', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('job-history-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('job-history-item-3')).toBeInTheDocument();
    expect(screen.getByTestId('job-history-item-4')).toBeInTheDocument();
  });

  it('displays status badges with correct labels', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('expands job to show log on click', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByTestId('job-history-toggle-1'));

    await waitFor(() => {
      expect(screen.getByTestId('job-history-log-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Sketch uses 1234 bytes (3%) of program storage space.')).toBeInTheDocument();
  });

  it('collapses expanded job on second click', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByTestId('job-history-toggle-1'));
    await waitFor(() => {
      expect(screen.getByTestId('job-history-log-1')).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByTestId('job-history-toggle-1'));
    expect(screen.queryByTestId('job-history-log-1')).not.toBeInTheDocument();
  });

  it('shows "No output log available." when log is null', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-3')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('job-history-toggle-3'));

    await waitFor(() => {
      expect(screen.getByText('No output log available.')).toBeInTheDocument();
    });
  });

  it('shows board label from fqbn args', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    // fqbn "arduino:avr:uno" → last segment "uno"
    expect(screen.getByText('uno')).toBeInTheDocument();
    expect(screen.getByText('mega')).toBeInTheDocument();
  });

  it('displays job count in header', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('4 jobs')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    const qc = createQueryClient();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal server error' }),
    });

    render(
      <QueryClientProvider client={qc}>
        <JobHistoryPanel />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch job history/)).toBeInTheDocument();
    });
  });

  it('shows job type labels', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    const compileLabels = screen.getAllByText('compile');
    expect(compileLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('upload')).toBeInTheDocument();
  });

  it('only expands one job at a time', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('job-history-item-1')).toBeInTheDocument();
    });

    // Expand job 1
    fireEvent.click(screen.getByTestId('job-history-toggle-1'));
    await waitFor(() => {
      expect(screen.getByTestId('job-history-log-1')).toBeInTheDocument();
    });

    // Expand job 2 — job 1 should collapse
    fireEvent.click(screen.getByTestId('job-history-toggle-2'));
    await waitFor(() => {
      expect(screen.getByTestId('job-history-log-2')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('job-history-log-1')).not.toBeInTheDocument();
  });
});
