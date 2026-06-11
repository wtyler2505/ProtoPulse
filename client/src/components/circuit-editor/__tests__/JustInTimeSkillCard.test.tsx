import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JustInTimeSkillCard from '@/components/circuit-editor/JustInTimeSkillCard';

const mockCopyToClipboard = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 7,
}));

const mockApiRequest = vi.fn().mockResolvedValue({
  json: async () => ({
    data: [
      {
        command: '/resolve-net-driver-conflict',
        status: 'completed',
        message: 'JIT skill command executed: /resolve-net-driver-conflict',
      },
      {
        command: '/apply-input-bias-network',
        status: 'completed',
        message: 'JIT skill command executed: /apply-input-bias-network',
      },
      {
        command: '/trace-power-rail-isolation',
        status: 'failed',
        message: 'JIT skill execution failed',
      },
    ],
  }),
});
vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

describe('JustInTimeSkillCard', () => {
  it('renders recommended title, description, and command', async () => {
    const eventSpy = vi.fn();
    window.addEventListener('protopulse:jit-skill-run', eventSpy as EventListener);

    render(
      <JustInTimeSkillCard
        recommendation={{
          command: '/resolve-net-driver-conflict',
          title: 'Resolve Net Driver Conflict',
          description: 'Converts competing outputs to a single-driver or gated topology.',
          ruleType: 'driver-conflict',
          violationId: 'erc-11',
        }}
      />,
    );

    expect(screen.getByTestId('jit-skill-card')).toBeInTheDocument();
    expect(screen.getByTestId('jit-skill-title').textContent).toContain('Resolve Net Driver Conflict');
    expect(screen.getByTestId('jit-skill-description').textContent).toContain('single-driver');
    expect(screen.getByTestId('jit-skill-command').textContent).toContain('/resolve-net-driver-conflict');

    fireEvent.click(screen.getByTestId('jit-skill-copy'));
    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith('/resolve-net-driver-conflict');
    });
    expect(screen.getByTestId('jit-skill-copy').textContent).toContain('Copied');

    fireEvent.click(screen.getByTestId('jit-skill-run'));
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const customEvent = eventSpy.mock.calls[0][0] as CustomEvent<{ command: string; ruleType: string; violationId: string }>;
    expect(customEvent.detail.command).toBe('/resolve-net-driver-conflict');
    expect(customEvent.detail.ruleType).toBe('driver-conflict');
    expect(customEvent.detail.violationId).toBe('erc-11');
    await waitFor(() => {
      expect(screen.getByTestId('jit-skill-run-status').textContent).toContain('completed');
    });
    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/projects/7/jit-skills/history');
    expect(screen.getByTestId('jit-recent-runs').textContent).toContain('/apply-input-bias-network');
    expect(screen.getByTestId('jit-recent-runs').textContent).toContain('failed');
    expect(screen.getByTestId('jit-skill-refresh')).toBeInTheDocument();

    mockApiRequest.mockClear();
    fireEvent.click(screen.getByTestId('jit-skill-refresh'));
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/projects/7/jit-skills/history');
    });

    window.removeEventListener('protopulse:jit-skill-run', eventSpy as EventListener);
  });
});
