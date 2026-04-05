import type { HTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ExactPartVerificationDialog from '@/components/views/component-editor/ExactPartVerificationDialog';
import type { Connector, PartMeta, PartViews } from '@shared/component-types';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

function makeViews(withBreadboard = true): PartViews {
  return {
    breadboard: {
      shapes: withBreadboard ? [{ id: 'board-body', type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0 }] : [],
    },
    pcb: { shapes: [] },
    schematic: { shapes: [] },
  };
}

function makeConnector(id: string): Connector {
  return {
    connectorType: 'male',
    id,
    name: id,
    shapeIds: { breadboard: ['board-body'] },
    terminalPositions: { breadboard: { x: 10, y: 10 } },
  };
}

describe('ExactPartVerificationDialog', () => {
  it('disables promotion when readiness is blocked', () => {
    const meta: PartMeta = {
      breadboardModelQuality: 'ai_drafted',
      family: 'mcu',
      mountingType: 'tht',
      partFamily: 'board-module',
      properties: [],
      tags: ['arduino', 'module'],
      title: 'Arduino Mega 2560 R3',
    };

    render(
      <ExactPartVerificationDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        pending={false}
        meta={meta}
        connectors={[makeConnector('D0')]}
        views={makeViews(true)}
      />,
    );

    expect(screen.getByText('Verification blocked')).toBeInTheDocument();
    expect(screen.getByTestId('button-confirm-verify-exact-part')).toBeDisabled();
  });

  it('enables promotion when evidence and exact accuracy are ready', () => {
    const meta: PartMeta = {
      breadboardModelQuality: 'community',
      family: 'driver',
      mountingType: 'tht',
      partFamily: 'driver',
      pinAccuracyReport: {
        breadboardAnchors: 'exact',
        connectorNames: 'exact',
        electricalRoles: 'exact',
        unresolved: [],
      },
      properties: [],
      sourceEvidence: [
        {
          label: 'Official pinout PDF',
          reviewStatus: 'accepted',
          supports: ['outline', 'pins', 'labels'],
          type: 'datasheet',
        },
      ],
      tags: ['motor', 'driver', 'module'],
      title: 'RioRand motor controller',
      visualAccuracyReport: {
        connectors: 'exact',
        mountingHoles: 'exact',
        outline: 'exact',
        silkscreen: 'exact',
      },
    };

    render(
      <ExactPartVerificationDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        pending={false}
        meta={meta}
        connectors={[makeConnector('VM')]}
        views={makeViews(true)}
      />,
    );

    expect(screen.getByText('Ready to promote')).toBeInTheDocument();
    expect(screen.getByTestId('button-confirm-verify-exact-part')).toBeEnabled();
  });
});
