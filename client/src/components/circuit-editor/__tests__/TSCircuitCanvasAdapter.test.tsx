import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TSCircuitCanvasAdapter from '@/components/circuit-editor/TSCircuitCanvasAdapter';

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

const mockRunPinVerificationMutate = vi.fn();
const mockRunPinVerificationMutateAsync = vi.fn().mockResolvedValue({
  flaggedInstances: 2,
  unverifiedGuessCount: 1,
  conflictCount: 1,
  results: [{ authoritativeSource: 'datasheet_pin_map', authoritativeSourceLabel: 'auditor_mcp_datasheet' }],
  orchestration: {
    mode: 'local_mcp_swarm',
    stages: [
      { role: 'drafter', source: 'instance.properties.aiPinMappings', action: 'generated candidate pin mappings' },
      { role: 'auditor', source: 'auditor_reports', action: 'loaded authoritative pin candidates' },
      { role: 'judge', source: 'pin-verification crosscheck', action: 'classified entries as verified, unverified_ai_guess, or conflict' },
    ],
  },
});
const mockRefetchPinVerificationHistory = vi.fn();
vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesign: () => ({ data: { id: 9, name: 'Adapter Circuit' } }),
  useCircuitInstances: () => ({
    data: [
      {
        id: 1,
        referenceDesignator: 'U1',
        properties: {
          pinVerificationEntries: [
            { pinLabel: 'GPIO0', status: 'unverified_ai_guess', source: 'auditor_mcp', note: 'no matching datasheet pin' },
          ],
        },
      },
      {
        id: 2,
        referenceDesignator: 'U2',
        properties: {
          pricingTrust: { verified: false, value: 0.5 },
          pinVerificationEntries: [
            { pinLabel: 'EN', status: 'conflict', source: 'judge_crosscheck' },
          ],
        },
      },
    ],
  }),
  useCircuitNets: () => ({ data: [{ id: 100 }, { id: 101 }, { id: 102 }] }),
  useRunCircuitPinVerification: () => ({
    mutate: mockRunPinVerificationMutate,
    mutateAsync: mockRunPinVerificationMutateAsync,
    isPending: false,
  }),
  useCircuitPinVerificationHistory: () => ({
    data: [
      {
        runId: 'pv-9',
        circuitId: 9,
        createdAt: Date.now(),
        flaggedInstances: 2,
        unverifiedGuessCount: 1,
        conflictCount: 1,
        dryRun: false,
        topAuthoritativeSourceLabel: 'auditor_mcp_datasheet',
      },
    ],
    refetch: mockRefetchPinVerificationHistory,
  }),
}));

const mockProbeTSCircuitRuntime = vi.fn().mockResolvedValue({ status: 'ready', source: 'tscircuit' });
vi.mock('@/lib/tscircuit-runtime', () => ({
  probeTSCircuitRuntime: () => mockProbeTSCircuitRuntime(),
}));

const mockDisposeScene = vi.fn();
const mockCreateTSCircuitScene = vi.fn().mockReturnValue({ dispose: mockDisposeScene });
vi.mock('@/lib/tscircuit-render-bridge', () => ({
  createTSCircuitScene: (...args: unknown[]) => mockCreateTSCircuitScene(...args),
}));

describe('TSCircuitCanvasAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProbeTSCircuitRuntime.mockResolvedValue({ status: 'ready', source: 'tscircuit' });
    mockCreateTSCircuitScene.mockReturnValue({ dispose: mockDisposeScene });
  });

  it('renders live circuit summary and trust status from schematic data', async () => {
    const { unmount } = render(
      <TSCircuitCanvasAdapter
        circuitId={9}
        ercViolations={[
          { id: 'erc-1', ruleType: 'floating-input', severity: 'warning', message: 'Pin is floating', location: { x: 0, y: 0 } },
        ]}
      />,
    );

    expect(screen.getByTestId('tscircuit-canvas-adapter')).toBeInTheDocument();
    expect(screen.getByTestId('tscircuit-adapter-summary').textContent).toContain('Adapter Circuit');
    expect(screen.getByTestId('tscircuit-stat-instances').textContent).toBe('2');
    expect(screen.getByTestId('tscircuit-stat-nets').textContent).toBe('3');
    expect(screen.getByTestId('tscircuit-stat-erc').textContent).toBe('1');
    expect(screen.getByTestId('tscircuit-stat-trust').textContent).toContain('Estimated data present');
    expect(screen.getByTestId('tscircuit-pin-verification-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tscircuit-pin-verification-count').textContent).toContain('2 pin verification issues');
    expect(screen.getByText('UNVERIFIED_AI_GUESS')).toBeInTheDocument();
    expect(screen.getByText('PIN_CONFLICT')).toBeInTheDocument();
    expect(screen.getByTestId('tscircuit-pin-verification-list').textContent).toContain('U1.GPIO0');
    expect(screen.getByTestId('tscircuit-pin-verification-list').textContent).toContain('U2.EN');
    expect(screen.getByTestId('tscircuit-run-pin-verification')).toBeInTheDocument();
    expect(screen.getByTestId('tscircuit-verification-history')).toBeInTheDocument();
    expect(screen.getByTestId('tension-triage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tension-triage-next').textContent).toContain('U2.EN');
    await waitFor(() => {
      expect(screen.getByTestId('tscircuit-runtime-badge').textContent).toContain('Runtime Ready');
    });
    expect(screen.getByTestId('tscircuit-runtime-source').textContent).toContain('tscircuit');
    expect(screen.getByTestId('tscircuit-scene-host')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockCreateTSCircuitScene).toHaveBeenCalledTimes(1);
    });
    unmount();
    expect(mockDisposeScene).toHaveBeenCalledTimes(1);
  });

  it('triggers server-backed auditor/judge run when button is clicked', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<TSCircuitCanvasAdapter circuitId={9} ercViolations={[]} />);
    fireEvent.click(screen.getByTestId('tscircuit-run-pin-verification'));
    await waitFor(() => {
      expect(mockRunPinVerificationMutateAsync).toHaveBeenCalledWith({ circuitId: 9, dryRun: false });
    });
    expect(mockRefetchPinVerificationHistory).toHaveBeenCalled();
    expect(screen.getByTestId('tscircuit-last-verification-summary').textContent).toContain('source auditor_mcp_datasheet');
    expect(screen.getByTestId('tscircuit-swarm-trace')).toBeInTheDocument();
    expect(screen.getByTestId('tscircuit-swarm-stage-drafter').textContent).toContain('generated candidate pin mappings');
    expect(screen.getByTestId('tscircuit-swarm-stage-auditor').textContent).toContain('loaded authoritative pin candidates');
    expect(screen.getByTestId('tscircuit-swarm-stage-judge').textContent).toContain('classified entries');
  });

  it('shows runtime fallback state when probe fails to resolve runtime', async () => {
    mockProbeTSCircuitRuntime.mockResolvedValueOnce({
      status: 'unavailable',
      source: '@tscircuit/core',
      reason: 'module not found',
    });

    render(<TSCircuitCanvasAdapter circuitId={9} ercViolations={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('tscircuit-runtime-badge').textContent).toContain('Runtime Fallback');
    });
    expect(screen.getByTestId('tscircuit-runtime-source').textContent).toContain('@tscircuit/core');
    expect(screen.getByTestId('tscircuit-runtime-source').textContent).toContain('module not found');
    expect(mockCreateTSCircuitScene).not.toHaveBeenCalled();
  });

  it('shows scene fallback reason when bridge initialization throws', async () => {
    mockCreateTSCircuitScene.mockImplementationOnce(() => {
      throw new Error('bridge boot failed');
    });

    render(<TSCircuitCanvasAdapter circuitId={9} ercViolations={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('tscircuit-runtime-badge').textContent).toContain('Runtime Ready');
    });
    await waitFor(() => {
      expect(screen.getByTestId('tscircuit-scene-error').textContent).toContain('bridge boot failed');
    });
  });

  it('switches optional overlay lanes and reinitializes the scene bridge with selected mode', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<TSCircuitCanvasAdapter circuitId={9} ercViolations={[]} />);

    await waitFor(() => {
      expect(mockCreateTSCircuitScene).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('tscircuit-overlay-tldraw'));
    await waitFor(() => {
      const lastCall = mockCreateTSCircuitScene.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ overlayMode: 'tldraw' });
    });

    fireEvent.click(screen.getByTestId('tscircuit-overlay-three'));
    await waitFor(() => {
      const lastCall = mockCreateTSCircuitScene.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ overlayMode: 'three' });
    });
  });
});
