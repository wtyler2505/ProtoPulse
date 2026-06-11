import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JitRunHistoryPanel from '@/components/circuit-editor/JitRunHistoryPanel';

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 9,
}));

const mockApiRequest = vi.fn().mockResolvedValue({
  json: async () => ({
    data: [
      { runId: 'jit-1', command: '/apply-input-bias-network', status: 'completed' },
      { runId: 'jit-2', command: '/trace-power-rail-isolation', status: 'failed' },
    ],
  }),
});
vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

describe('JitRunHistoryPanel', () => {
  it('loads and renders recent history with manual refresh', async () => {
    render(<JitRunHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('jit-history-list').textContent).toContain('/apply-input-bias-network');
    });
    expect(screen.getByTestId('jit-history-list').textContent).toContain('failed');
    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/projects/9/jit-skills/history');

    mockApiRequest.mockClear();
    fireEvent.click(screen.getByTestId('jit-history-refresh'));
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/projects/9/jit-skills/history');
    });

    mockApiRequest.mockClear();
    window.dispatchEvent(new CustomEvent('protopulse:jit-skill-updated', {
      detail: { command: '/apply-input-bias-network', status: 'completed' },
    }));
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/projects/9/jit-skills/history');
    });
  });
});
