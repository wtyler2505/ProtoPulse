import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRadialTelemetry,
  readRadialTelemetry,
  recordRadialTelemetry,
  subscribeRadialTelemetry,
} from '@/lib/radial-menu-telemetry';

describe('radial-menu-telemetry', () => {
  beforeEach(() => {
    clearRadialTelemetry();
  });

  it('records radial telemetry events in order', () => {
    recordRadialTelemetry({
      name: 'visible-open',
      view: 'architecture',
      target: 'canvas',
      actionCount: 6,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
      distancePx: 72,
      actionCount: 6,
    });
    recordRadialTelemetry({
      name: 'ai-draft',
      view: 'pcb',
      target: 'node',
      commandId: 'review_pcb',
      intent: 'review_pcb',
      promptChars: 640,
      reason: 'PCB review: U1',
    });

    expect(readRadialTelemetry()).toMatchObject([
      { name: 'visible-open', view: 'architecture', target: 'canvas', actionCount: 6 },
      {
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 42,
        distancePx: 72,
      },
      {
        name: 'ai-draft',
        view: 'pcb',
        target: 'node',
        commandId: 'review_pcb',
        intent: 'review_pcb',
        promptChars: 640,
        reason: 'PCB review: U1',
      },
    ]);
  });

  it('caps the in-memory event buffer', () => {
    for (let index = 0; index < 130; index += 1) {
      recordRadialTelemetry({
        name: 'mark-start',
        view: 'architecture',
        target: 'canvas',
        actionCount: index,
      });
    }

    const events = readRadialTelemetry();
    expect(events).toHaveLength(120);
    expect(events[0]).toMatchObject({ actionCount: 10 });
    expect(events.at(-1)).toMatchObject({ actionCount: 129 });
  });

  it('clears telemetry events', () => {
    recordRadialTelemetry({
      name: 'customize-open',
      view: 'architecture',
      target: 'node',
    });
    clearRadialTelemetry();
    expect(readRadialTelemetry()).toEqual([]);
  });

  it('notifies subscribers when telemetry changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRadialTelemetry(listener);

    recordRadialTelemetry({
      name: 'visible-mounted',
      view: 'architecture',
      target: 'canvas',
      durationMs: 12,
    });
    clearRadialTelemetry();
    unsubscribe();
    recordRadialTelemetry({
      name: 'visible-open',
      view: 'architecture',
      target: 'canvas',
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
