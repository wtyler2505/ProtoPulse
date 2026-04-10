import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import BreadboardExactPartRequestDialog from '../BreadboardExactPartRequestDialog';
import type { ComponentPart } from '@shared/schema';

function createPart(id: number, meta: Record<string, unknown>): ComponentPart {
  const now = new Date();
  return {
    id,
    projectId: 1,
    nodeId: null,
    meta: {
      mountingType: 'tht',
      properties: [],
      tags: [],
      title: `Part ${String(id)}`,
      ...meta,
    },
    connectors: [],
    buses: [],
    views: {
      breadboard: { shapes: [] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
    constraints: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('BreadboardExactPartRequestDialog', () => {
  it('shows a verified match from the verified board registry', () => {
    const onPlaceResolvedPart = vi.fn();

    render(
      <BreadboardExactPartRequestDialog
        activeCircuitReady
        open
        parts={[]}
        onCreateExactDraft={vi.fn()}
        onOpenChange={vi.fn()}
        onOpenComponentEditor={vi.fn()}
        onPlaceResolvedPart={onPlaceResolvedPart}
      />,
    );

    fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
      target: { value: 'Arduino Mega 2560 R3' },
    });

    // The verified board registry includes Arduino Mega 2560 R3, so
    // the resolution should show a verified match message.
    expect(screen.getByTestId('breadboard-exact-part-resolution-message').textContent).toContain('verified exact part');
  });

  it('seeds the exact draft flow when no trustworthy match exists', () => {
    const onCreateExactDraft = vi.fn();

    render(
      <BreadboardExactPartRequestDialog
        activeCircuitReady={false}
        open
        parts={[]}
        onCreateExactDraft={onCreateExactDraft}
        onOpenChange={vi.fn()}
        onOpenComponentEditor={vi.fn()}
        onPlaceResolvedPart={vi.fn()}
      />,
    );

    // Use a generic part name that has no verified board match and no playbook,
    // so the generic draft flow triggers with a generated description.
    fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
      target: { value: 'Pololu DRV8833 dual motor driver' },
    });
    fireEvent.click(screen.getByTestId('button-breadboard-exact-create-draft'));

    expect(screen.getByTestId('breadboard-exact-part-playbook').textContent).toContain('Exact draft handoff');
    expect(onCreateExactDraft).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('Pololu DRV8833'),
    }));
  });
});
