import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import RadialTelemetryInspector from '@/components/ui/RadialTelemetryInspector';
import {
  clearRadialTelemetry,
  recordRadialTelemetry,
} from '@/lib/radial-menu-telemetry';

describe('RadialTelemetryInspector', () => {
  beforeEach(() => {
    clearRadialTelemetry();
  });

  it('summarizes open and marking timings', () => {
    recordRadialTelemetry({
      name: 'visible-mounted',
      view: 'architecture',
      target: 'canvas',
      durationMs: 16,
      actionCount: 6,
    });
    recordRadialTelemetry({
      name: 'visible-mounted',
      view: 'architecture',
      target: 'node',
      durationMs: 20,
      actionCount: 6,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'node',
      commandId: 'delete',
      slot: 5,
      durationMs: 44,
      distancePx: 72,
      actionCount: 6,
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      reason: 'below-threshold',
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('radial-telemetry-total')).toHaveTextContent('4');
    expect(screen.getByTestId('radial-telemetry-open-average')).toHaveTextContent('18ms');
    expect(screen.getByTestId('radial-telemetry-mark-average')).toHaveTextContent('44ms');
    expect(screen.getByTestId('radial-telemetry-budget')).toHaveTextContent('Fast');
    expect(screen.getByTestId('radial-telemetry-budget-note')).toHaveTextContent('typical open inside <=32ms budget');
    expect(screen.getByText('Mark cancel')).toBeInTheDocument();
    expect(screen.getByText('below-threshold')).toBeInTheDocument();
  });

  it('updates when new telemetry arrives and clears the buffer', async () => {
    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-empty')).toBeInTheDocument();
    expect(screen.getByTestId('radial-telemetry-budget')).toHaveTextContent('Waiting');
    expect(screen.getByTestId('radial-telemetry-budget-note')).toHaveTextContent('open budget <=32ms');
    expect(screen.getByTestId('radial-telemetry-ai-total-count')).toHaveTextContent('0');
    expect(screen.getByTestId('radial-telemetry-ai-draft-count')).toHaveTextContent('0');
    expect(screen.getByTestId('radial-telemetry-ai-send-count')).toHaveTextContent('0');
    expect(screen.getByTestId('radial-telemetry-mastery')).toHaveAttribute('data-status', 'waiting');
    expect(screen.getByTestId('radial-telemetry-mastery-value')).toHaveTextContent('No streak yet');

    act(() => {
      recordRadialTelemetry({
        name: 'visible-mounted',
        view: 'schematic',
        target: 'canvas',
        durationMs: 7.5,
        actionCount: 8,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('radial-telemetry-open-average')).toHaveTextContent('7.5ms');
    });

    fireEvent.click(screen.getByTestId('radial-telemetry-clear'));

    expect(screen.getByTestId('radial-telemetry-empty')).toBeInTheDocument();
    expect(screen.getByTestId('radial-telemetry-total')).toHaveTextContent('0');
  });

  it('surfaces amber and red open-latency budget states', () => {
    recordRadialTelemetry({
      name: 'visible-mounted',
      view: 'architecture',
      target: 'canvas',
      durationMs: 60,
    });

    const { unmount } = render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-budget')).toHaveTextContent('Watch');
    expect(screen.getByTestId('radial-telemetry-budget-note')).toHaveTextContent('typical open above 32ms target');

    unmount();
    clearRadialTelemetry();
    recordRadialTelemetry({
      name: 'visible-mounted',
      view: 'architecture',
      target: 'canvas',
      durationMs: 96,
    });
    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-budget')).toHaveTextContent('Laggy');
    expect(screen.getByTestId('radial-telemetry-budget-note')).toHaveTextContent('typical open above 80ms ceiling');
  });

  it('uses typical open latency so a single cold outlier does not mark the wheel laggy', () => {
    [28, 40, 240].forEach((durationMs) => {
      recordRadialTelemetry({
        name: 'visible-mounted',
        view: 'architecture',
        target: 'canvas',
        durationMs,
      });
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-open-average')).toHaveTextContent('40ms');
    expect(screen.getByTestId('radial-telemetry-budget')).toHaveTextContent('Watch');
    expect(screen.getByTestId('radial-telemetry-budget-note')).toHaveTextContent('typical open above 32ms target');
    expect(screen.getByText('240ms')).toBeInTheDocument();
  });

  it('surfaces AI draft telemetry without showing prompt contents', () => {
    recordRadialTelemetry({
      name: 'ai-draft',
      view: 'pcb',
      target: 'node',
      commandId: 'review_pcb',
      intent: 'review_pcb',
      promptChars: 640,
      reason: 'PCB review: U1',
    });
    recordRadialTelemetry({
      name: 'ai-send-now',
      view: 'pcb',
      target: 'node',
      commandId: 'fix_pcb_clearances',
      intent: 'fix_pcb_clearances',
      promptChars: 512,
      reason: 'Clearance fix: J2',
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-ai-total-count')).toHaveTextContent('2');
    expect(screen.getByTestId('radial-telemetry-ai-draft-count')).toHaveTextContent('1');
    expect(screen.getByTestId('radial-telemetry-ai-send-count')).toHaveTextContent('1');
    expect(screen.getByText('AI draft')).toBeInTheDocument();
    expect(screen.getByText('AI send')).toBeInTheDocument();
    expect(screen.getByText('review_pcb / 640 chars / PCB review: U1')).toBeInTheDocument();
    expect(screen.getByText('fix_pcb_clearances / 512 chars / Clearance fix: J2')).toBeInTheDocument();
  });

  it('rewards the latest repeated gesture streak without treating customizer opens as misses', () => {
    Array.from({ length: 3 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 38,
      });
    });
    recordRadialTelemetry({
      name: 'customize-open',
      view: 'architecture',
      target: 'canvas',
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-mastery')).toHaveAttribute('data-status', 'locked');
    expect(screen.getByTestId('radial-telemetry-mastery-value')).toHaveTextContent('3x Add Node');
    expect(screen.getByTestId('radial-telemetry-mastery-detail')).toHaveTextContent('N gesture trained');
    expect(screen.getByTestId('radial-telemetry-mastery-status')).toHaveTextContent('Locked');
  });

  it('uses the latest gesture run instead of stale earlier marks', () => {
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 36,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 34,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'node',
      commandId: 'delete',
      slot: 5,
      durationMs: 44,
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-mastery')).toHaveAttribute('data-status', 'started');
    expect(screen.getByTestId('radial-telemetry-mastery-value')).toHaveTextContent('1x Delete');
    expect(screen.getByTestId('radial-telemetry-mastery-detail')).toHaveTextContent('SW gesture trained');
    expect(screen.getByTestId('radial-telemetry-mastery-status')).toHaveTextContent('Started');
  });

  it('resets the gesture streak when the latest gesture outcome is a cancel', () => {
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 36,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 34,
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      reason: 'wrong-direction',
    });

    render(<RadialTelemetryInspector />);

    expect(screen.getByTestId('radial-telemetry-mastery')).toHaveAttribute('data-status', 'waiting');
    expect(screen.getByTestId('radial-telemetry-mastery-value')).toHaveTextContent('No streak yet');
    expect(screen.getByTestId('radial-telemetry-mastery-status')).toHaveTextContent('Waiting');
  });

  it('limits recent rows in compact embedded density', () => {
    Array.from({ length: 5 }, (_, index) => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: `command_${String(index)}`,
        slot: 0,
        durationMs: 24 + index,
      });
    });

    render(<RadialTelemetryInspector density="compact" />);

    expect(screen.getByTestId('radial-telemetry-inspector')).toHaveAttribute('data-density', 'compact');
    expect(screen.getByTestId('radial-telemetry-row-0')).toHaveTextContent('command_4');
    expect(screen.getByTestId('radial-telemetry-row-2')).toHaveTextContent('command_2');
    expect(screen.queryByTestId('radial-telemetry-row-3')).not.toBeInTheDocument();
  });
});
