/**
 * PCBLayoutView — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the two toolbar board-dimension number inputs (`pcb-board-width`
 * and `pcb-board-height`) mirror their `min`/`max` props to
 * `aria-valuemin`/`aria-valuemax` per the WAI-ARIA 1.2 spinbutton spec — fixing
 * the Chromium synthesized `aria-valuemax="0"` accessibility bug
 * (E2E-236/271/284).
 *
 * Migration plan: `docs/audits/bl-0781-number-input-audit.md` (Teammate 3 →
 * PCBLayoutView.tsx). Action: KEEP min=10, max=500, step=5; raw `<input>` →
 * `<NumberInput>`.
 *
 * Visual regression: confirmed in dev-server snapshot — `!w-12 !h-5 !px-1`
 * Tailwind `!` modifiers preserve the tight toolbar sizing.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({
    data: [{ id: 1, projectId: 1, name: 'Test Circuit', settings: null, createdAt: new Date() }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCircuitInstances: () => ({ data: [] }),
  useCircuitNets: () => ({ data: [] }),
  useCircuitWires: () => ({ data: [] }),
  useCircuitVias: () => ({ data: [] }),
  useCreateCircuitWire: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCircuitWire: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdateCircuitInstance: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreateCircuitInstance: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCircuitInstance: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
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
    board: { id: 1, projectId: 1, widthMm: 50, heightMm: 40, layerCount: 4 },
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
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./CollaborationCursors', () => ({
  default: () => null,
  useCursorEmitter: () => vi.fn(),
}));

import PCBLayoutView from '../PCBLayoutView';

describe('PCBLayoutView — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min={10} max={500} onto aria-valuemin/aria-valuemax for pcb-board-width input', () => {
    render(<PCBLayoutView />);
    const input = screen.getByTestId('pcb-board-width') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('10');
    expect(input.getAttribute('aria-valuemax')).toBe('500');
    expect(input.getAttribute('min')).toBe('10');
    expect(input.getAttribute('max')).toBe('500');
  });

  it('mirrors min={10} max={500} onto aria-valuemin/aria-valuemax for pcb-board-height input', () => {
    render(<PCBLayoutView />);
    const input = screen.getByTestId('pcb-board-height') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('10');
    expect(input.getAttribute('aria-valuemax')).toBe('500');
    expect(input.getAttribute('min')).toBe('10');
    expect(input.getAttribute('max')).toBe('500');
  });
});
