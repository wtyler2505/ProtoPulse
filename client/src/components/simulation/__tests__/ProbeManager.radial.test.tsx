import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProbeManager from '@/components/simulation/ProbeManager';
import type { Probe } from '@/components/simulation/simulation-types';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

function dispatchSimulationRadialCommand(
  commandId: string,
  targetId?: string,
  targetLabel?: string,
): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'simulation',
      target: 'probe',
      targetId,
      targetLabel,
    },
    source: 'radial-menu',
  };
  act(() => {
    window.dispatchEvent(new CustomEvent(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

describe('ProbeManager radial targets', () => {
  it('exposes probe metadata for radial target detection', () => {
    const probes: Probe[] = [
      {
        id: 'probe-1',
        name: 'Output probe',
        type: 'voltage',
        nodeOrComponent: 'VOUT',
      },
    ];

    render(<ProbeManager probes={probes} onProbesChange={vi.fn()} disabled={false} />);

    const row = screen.getByTestId('probe-probe-1');
    expect(row).toHaveAttribute('data-probe-id', 'probe-1');
    expect(row).toHaveAttribute('data-probe-label', 'Output probe');
  });

  it('drafts bounded simulation probe context to AI chat from a radial command', () => {
    const probes: Probe[] = [
      {
        id: 'probe-1',
        name: 'Output probe',
        type: 'voltage',
        nodeOrComponent: 'VOUT',
      },
      {
        id: 'probe-2',
        name: 'Motor current',
        type: 'current',
        nodeOrComponent: 'M1',
      },
    ];
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    mockToast.mockClear();

    try {
      render(<ProbeManager probes={probes} onProbesChange={vi.fn()} disabled={false} />);

      const detail = dispatchSimulationRadialCommand('ai_simulation_explain', 'probe-1', 'Output probe');

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect((chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>).detail.designAgent).toBe(
        false,
      );
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: explain_simulation.');
      expect(message).toContain('Simulation explanation: 2 probe(s), selected Output probe.');
      expect(message).toContain('Target: probe "Output probe"');
      expect(message).toContain('Selected probe: Output probe id=probe-1 type=voltage target=VOUT');
      expect(message).toContain('Simulation probes:');
      expect(message).toContain('Motor current id=probe-2 type=current target=M1');
      expect(message).toContain('Simulation control state:');
      expect(message).toContain('Probe controls: enabled');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Simulation Drafted',
          description: 'Drafted Output probe simulation prompt in AI chat.',
        }),
      );
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('removes a targeted simulation probe from a radial command', () => {
    const probes: Probe[] = [
      {
        id: 'probe-1',
        name: 'Output probe',
        type: 'voltage',
        nodeOrComponent: 'VOUT',
      },
      {
        id: 'probe-2',
        name: 'Motor current',
        type: 'current',
        nodeOrComponent: 'M1',
      },
    ];
    const onProbesChange = vi.fn();
    mockToast.mockClear();

    render(<ProbeManager probes={probes} onProbesChange={onProbesChange} disabled={false} />);

    const detail = dispatchSimulationRadialCommand('remove_probe', 'probe-1', 'Output probe');

    expect(detail.handled).toBe(true);
    expect(onProbesChange).toHaveBeenCalledWith([probes[1]]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Probe removed',
        description: 'Output probe was removed from the simulation setup.',
      }),
    );
  });

  it('reports when a radial remove command has no simulation probe target', () => {
    const onProbesChange = vi.fn();
    mockToast.mockClear();

    render(<ProbeManager probes={[]} onProbesChange={onProbesChange} disabled={false} />);

    const detail = dispatchSimulationRadialCommand('remove_probe');

    expect(detail.handled).toBe(true);
    expect(onProbesChange).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No probe to remove',
        variant: 'destructive',
      }),
    );
  });
});
