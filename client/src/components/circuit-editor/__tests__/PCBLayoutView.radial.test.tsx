import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { ReactNode } from 'react';
import PCBLayoutView from '../PCBLayoutView';
import { PCB_RUN_DRC_EVENT } from '@/lib/pcb/pcb-surface-status';
import {
  RADIAL_COMMAND_EVENT,
  RADIAL_COMMAND_PREVIEW_EVENT,
  type MenuContext,
  type RadialCommandEventDetail,
  type RadialCommandPreviewEventDetail,
} from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

const mockToast = vi.fn();
const mockUpdateInstance = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() }));
const mockDeleteInstance = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() }));
const mockInstances = vi.hoisted(() => ({
  current: [
    {
      id: 101,
      circuitId: 1,
      partId: 1,
      subDesignId: null,
      referenceDesignator: 'U1',
      schematicX: 0,
      schematicY: 0,
      schematicRotation: 0,
      breadboardX: null,
      breadboardY: null,
      breadboardRotation: null,
      pcbX: 25,
      pcbY: 30,
      pcbRotation: 0,
      pcbSide: 'front',
      pcbLocked: false,
      properties: {},
      createdAt: new Date(),
    },
  ],
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({
    data: [{ id: 1, projectId: 1, name: 'Main Circuit', settings: null, createdAt: new Date() }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCircuitInstances: () => ({ data: mockInstances.current }),
  useCircuitNets: () => ({ data: [] }),
  useCircuitWires: () => ({ data: [] }),
  useCircuitVias: () => ({ data: [] }),
  useCreateCircuitWire: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCircuitWire: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdateCircuitInstance: () => mockUpdateInstance,
  useCreateCircuitInstance: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCircuitInstance: () => mockDeleteInstance,
  useUpdateCircuitDesign: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  usePcbZones: () => ({ data: [] }),
  useCreatePcbZone: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdatePcbZone: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeletePcbZone: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useComments: () => ({ data: { data: [] } }),
  useCreateComment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdateCommentStatus: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteComment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useProjectBoard', () => ({
  projectBoardQueryKey: (projectId: number) => ['projects', projectId, 'board'],
  useProjectBoard: () => ({
    board: { id: 1, projectId: 1, widthMm: 50, heightMm: 40, layers: 4, layerCount: 4 },
    isLoading: false,
    isError: false,
    error: null,
    updateBoard: vi.fn().mockResolvedValue({}),
    isUpdating: false,
  }),
}));

vi.mock('@/lib/undo-redo-context', () => ({
  useUndoRedo: () => ({
    push: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
  UndoRedoProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => ({
    projectName: 'Test Project',
    setActiveView: vi.fn(),
  }),
}));

vi.mock('@/lib/board-stackup', () => ({
  useBoardStackup: () => ({
    layers: [],
    dielectrics: [],
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    updateLayer: vi.fn(),
    reorderLayer: vi.fn(),
    calculateImpedance: vi.fn(),
    applyPreset: vi.fn(),
    applyLayerCount: vi.fn(),
    presets: [],
    totalThickness: 0,
    surfaceFinish: 'HASL',
    setSurfaceFinish: vi.fn(),
    validate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
    exportStackup: vi.fn(() => ''),
    importStackup: vi.fn(() => ({ success: true, errors: [] })),
  }),
}));

vi.mock('@/lib/dfm-pcb-bridge', () => ({
  useDfmHighlights: () => ({ highlight: null, clear: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./CollaborationCursors', () => ({
  default: () => null,
  useCursorEmitter: () => vi.fn(),
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children?: ReactNode }) => <div data-testid="context-menu">{children}</div>,
  ContextMenuItem: ({
    children,
    disabled,
    onSelect,
    textValue: _textValue,
    ...props
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
    textValue?: string;
  } & Record<string, unknown>) => (
    <button type="button" disabled={disabled} onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr data-testid="context-menu-separator" />,
  ContextMenuShortcut: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  ),
}));

function dispatchPcbRadial(commandId: string, context: Partial<MenuContext> = {}): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'pcb',
      target: 'canvas',
      ...context,
    },
    source: 'radial-menu',
  };
  window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  return detail;
}

function dispatchPcbRadialPreview(
  commandId: string,
  context: Partial<MenuContext> = {},
): RadialCommandPreviewEventDetail {
  const detail: RadialCommandPreviewEventDetail = {
    commandId,
    context: {
      view: 'pcb',
      target: 'canvas',
      pointer: { x: 320, y: 240 },
      ...context,
    },
    source: 'radial-menu',
    phase: 'show',
  };
  window.dispatchEvent(new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, { detail }));
  return detail;
}

describe('PCBLayoutView radial command adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstances.current = [
      {
        id: 101,
        circuitId: 1,
        partId: 1,
        subDesignId: null,
        referenceDesignator: 'U1',
        schematicX: 0,
        schematicY: 0,
        schematicRotation: 0,
        breadboardX: null,
        breadboardY: null,
        breadboardRotation: null,
        pcbX: 25,
        pcbY: 30,
        pcbRotation: 0,
        pcbSide: 'front',
        pcbLocked: false,
        properties: {},
        createdAt: new Date(),
      },
    ];
  });

  it('renders the registry-backed PCB linear context menu fallback', () => {
    render(<PCBLayoutView />);

    expect(screen.getByTestId('ctx-command-add_via')).toHaveTextContent('Add Via');
    expect(screen.getByTestId('ctx-command-route_trace')).toHaveTextContent('Route');
    expect(screen.getByTestId('ctx-command-add_pour')).toHaveTextContent('Copper Pour');
    expect(screen.getByTestId('ctx-command-fit_view')).toHaveTextContent('Fit');
    expect(screen.getByTestId('ctx-command-copy')).toHaveTextContent('Copy');
  });

  it('exposes footprint metadata for targeted radial detection', () => {
    render(<PCBLayoutView />);

    const footprint = screen.getByTestId('pcb-instance-101');
    expect(footprint).toHaveAttribute('data-id', '101');
    expect(footprint).toHaveAttribute('data-node-label', 'U1');
  });

  it('handles radial route_trace by switching to the trace tool', async () => {
    render(<PCBLayoutView />);

    const detail = dispatchPcbRadial('route_trace');

    expect(detail.handled).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('pcb-tool-trace').className).toContain('text-primary');
    });
  });

  it('handles radial add_keepout by switching to the keepout tool', async () => {
    render(<PCBLayoutView />);

    const detail = dispatchPcbRadial('add_keepout');

    expect(detail.handled).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('pcb-tool-keepout').className).toContain('text-primary');
    });
  });

  it('renders and clears a board-space radial route preview', async () => {
    render(<PCBLayoutView />);

    dispatchPcbRadialPreview('route_trace');

    await waitFor(() => {
      expect(screen.getByTestId('pcb-radial-adapter-preview')).toHaveAttribute('data-command-id', 'route_trace');
    });
    expect(screen.getByTestId('pcb-radial-adapter-preview')).toHaveAttribute('data-board-x');
    expect(screen.getByTestId('pcb-radial-adapter-preview')).toHaveAttribute('data-board-y');

    window.dispatchEvent(
      new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, {
        detail: { source: 'radial-menu', phase: 'clear' },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByTestId('pcb-radial-adapter-preview')).toBeNull();
    });
  });

  it('handles radial DRC by dispatching the PCB surface event', () => {
    const drcSpy = vi.fn();
    window.addEventListener(PCB_RUN_DRC_EVENT, drcSpy);

    try {
      render(<PCBLayoutView />);
      const detail = dispatchPcbRadial('run_drc');

      expect(detail.handled).toBe(true);
      expect(drcSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(PCB_RUN_DRC_EVENT, drcSpy);
    }
  });

  it('drafts PCB review context to AI chat from a radial command', () => {
    const draftSpy = vi.fn();
    const openSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.addEventListener('protopulse:open-chat-panel', openSpy);

    try {
      render(<PCBLayoutView />);
      const detail = dispatchPcbRadial('ai_pcb_review', {
        target: 'node',
        targetId: '101',
        targetLabel: 'U1',
      });

      expect(detail.handled).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { designAgent: false },
        }),
      );
      expect(draftSpy).toHaveBeenCalledTimes(1);
      const message = (draftSpy.mock.calls[0][0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: review_pcb.');
      expect(message).toContain('PCB review: 1 placed footprint(s)');
      expect(message).toContain('Target: node "U1"');
      expect(message).toContain('Board: 50mm x 40mm, 4 layer(s)');
      expect(message).toContain('Target footprint: U1 id=101');
      expect(message).toContain('Board status:');
    } finally {
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
      window.removeEventListener('protopulse:open-chat-panel', openSpy);
    }
  });

  it('handles targeted footprint rotate, flip, and delete radial commands', () => {
    render(<PCBLayoutView />);
    const context: Partial<MenuContext> = { target: 'node', targetId: '101', targetLabel: 'U1' };

    expect(dispatchPcbRadial('rotate', context).handled).toBe(true);
    expect(mockUpdateInstance.mutate).toHaveBeenCalledWith({
      circuitId: 1,
      id: 101,
      pcbRotation: 90,
    });

    expect(dispatchPcbRadial('flip_side', context).handled).toBe(true);
    expect(mockUpdateInstance.mutate).toHaveBeenCalledWith({
      circuitId: 1,
      id: 101,
      pcbSide: 'back',
    });

    expect(dispatchPcbRadial('delete', context).handled).toBe(true);
    expect(mockDeleteInstance.mutate).toHaveBeenCalledWith({ circuitId: 1, id: 101 });
  });

  it('handles select_all by making selected footprints available to copy', () => {
    render(<PCBLayoutView />);

    const selectDetail = dispatchPcbRadial('select_all');
    const copyDetail = dispatchPcbRadial('copy');

    expect(selectDetail.handled).toBe(true);
    expect(copyDetail.handled).toBe(true);
  });
});
