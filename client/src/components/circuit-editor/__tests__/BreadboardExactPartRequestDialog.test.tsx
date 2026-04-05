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
  it('shows a verified match and places it onto the bench', () => {
    const mega = createPart(11, {
      aliases: ['arduino mega rev3'],
      manufacturer: 'Arduino',
      partFamily: 'board-module',
      title: 'Arduino Mega 2560 R3',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
    });
    const onPlaceResolvedPart = vi.fn();

    render(
      <BreadboardExactPartRequestDialog
        activeCircuitReady
        open
        parts={[mega]}
        onCreateExactDraft={vi.fn()}
        onOpenChange={vi.fn()}
        onOpenComponentEditor={vi.fn()}
        onPlaceResolvedPart={onPlaceResolvedPart}
      />,
    );

    fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
      target: { value: 'Arduino Mega 2560 R3' },
    });

    expect(screen.getByTestId('breadboard-exact-part-resolution-message').textContent).toContain('verified exact part');
    fireEvent.click(screen.getByTestId('button-breadboard-exact-place-11'));

    expect(onPlaceResolvedPart).toHaveBeenCalledWith(mega);
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

    fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
      target: { value: 'RioRand motor controller' },
    });
    fireEvent.change(screen.getByTestId('input-breadboard-exact-part-reference-url'), {
      target: { value: 'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D' },
    });
    fireEvent.click(screen.getByTestId('button-breadboard-exact-create-draft'));

    expect(screen.getByTestId('breadboard-exact-part-playbook').textContent).toContain('RioRand Motor Controller playbook');
    expect(onCreateExactDraft).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('Hall sensors'),
      marketplaceSourceUrl: 'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D',
    }));
  });
});
