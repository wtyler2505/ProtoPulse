import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BomTemplatesPanel from '@/components/views/BomTemplatesPanel';
import type { BomItem } from '@/lib/project-context';
import type { BomTemplateWithItems } from '@/lib/parts/use-bom-templates';

const mockApplyTemplate = vi.fn();
const mockCreateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();

let mockTemplates: Array<Record<string, unknown>> = [];
let mockComponentParts: Array<Record<string, unknown>> = [];
let mockCircuitDesigns: Array<Record<string, unknown>> = [];
let mockCircuitInstances: Array<Record<string, unknown>> = [];
let mockContextBom: BomItem[] = [];
let mockTemplateDetails: Record<string, BomTemplateWithItems> = {};
let mockTemplateDetailLoading = false;
let mockTemplateDetailError = false;

vi.mock('@/lib/parts/use-bom-templates', () => ({
  useBomTemplates: () => ({ data: mockTemplates, isLoading: false }),
  useBomTemplateDetail: (templateId: string | null) => ({
    data: templateId ? mockTemplateDetails[templateId] : undefined,
    isLoading: mockTemplateDetailLoading,
    isError: mockTemplateDetailError,
  }),
  useCreateBomTemplate: () => ({ mutate: mockCreateTemplate, isPending: false }),
  useApplyBomTemplate: () => ({ mutate: mockApplyTemplate, isPending: false }),
  useDeleteBomTemplate: () => ({ mutate: mockDeleteTemplate, isPending: false }),
}));

vi.mock('@/lib/project-context', () => ({
  useBom: () => ({ bom: mockContextBom }),
  useProjectMeta: () => ({ projectName: 'Template Safety Project' }),
  useArchitecture: () => ({ nodes: [{ id: 'mcu' }], edges: [] }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: mockComponentParts }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: mockCircuitDesigns }),
  useCircuitInstances: () => ({ data: mockCircuitInstances }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant: _variant,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/TrustBadge', () => ({
  TrustBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 'part-101',
    partNumber: 'PP-101',
    manufacturer: 'ProtoPulse',
    description: 'Template safety part',
    quantity: 2,
    unitPrice: 1.25,
    totalPrice: 2.5,
    supplier: 'Digi-Key',
    stock: 12,
    status: 'In Stock',
    ...overrides,
  };
}

function makeCircuitInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 7,
    partId: 101,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: 10,
    pcbY: 12,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides,
  };
}

function makeTemplateDetail(overrides: Partial<BomTemplateWithItems> = {}): BomTemplateWithItems {
  return {
    id: 'template-1',
    userId: 1,
    name: 'Sensor BOM',
    description: null,
    tags: ['sensor'],
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
    items: [
      {
        id: 'template-item-existing',
        templateId: 'template-1',
        partId: 'part-101',
        quantityNeeded: 2,
        unitPrice: '1.25',
        supplier: 'Digi-Key',
        notes: null,
        partTitle: 'Template safety part',
        partMpn: 'PP-101',
      },
      {
        id: 'template-item-new',
        templateId: 'template-1',
        partId: 'part-202',
        quantityNeeded: 4,
        unitPrice: '0.50',
        supplier: 'Mouser',
        notes: null,
        partTitle: 'New template part',
        partMpn: 'PP-202',
      },
    ],
    ...overrides,
  };
}

function renderPanel({ bom = [makeBomItem()] }: { bom?: BomItem[] } = {}) {
  return render(<BomTemplatesPanel projectId={1} bom={bom} />);
}

describe('BomTemplatesPanel safety gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('protopulse-session-id', 'session-1');
    mockTemplates = [{
      id: 'template-1',
      userId: 1,
      name: 'Sensor BOM',
      description: null,
      tags: ['sensor'],
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z',
    }];
    mockComponentParts = [];
    mockCircuitDesigns = [{ id: 7, projectId: 1, name: 'Main circuit' }];
    mockCircuitInstances = [];
    mockContextBom = [];
    mockTemplateDetails = { 'template-1': makeTemplateDetail() };
    mockTemplateDetailLoading = false;
    mockTemplateDetailError = false;
  });

  it('blocks save and apply when lifecycle risk has no known alternate', () => {
    mockCircuitInstances = [makeCircuitInstance()];
    mockComponentParts = [{
      id: 101,
      projectId: 1,
      meta: { lifecycleStatus: 'eol' },
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: new Date('2026-05-24T00:00:00.000Z'),
      updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    }];

    renderPanel();

    expect(screen.getByTestId('bom-template-safety-gate').textContent).toContain('BLOCKED');
    expect(screen.getByTestId('bom-template-safety-lifecycle-risk').textContent).toContain('lifecycle-risk part');

    fireEvent.change(screen.getByTestId('bom-templates-name-input'), { target: { value: 'Blocked template' } });

    const saveButton = screen.getByTestId('bom-templates-save-btn') as HTMLButtonElement;
    const applyButton = screen.getByTestId('template-apply-template-1') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(applyButton.disabled).toBe(true);
    expect(applyButton.textContent).toContain('Blocked');

    fireEvent.click(applyButton);
    expect(screen.queryByTestId('bom-template-apply-preview')).toBeNull();
    expect(mockApplyTemplate).not.toHaveBeenCalled();
  });

  it('shows a preview before applying when only trust warnings remain', () => {
    mockCircuitInstances = [makeCircuitInstance()];
    mockComponentParts = [{
      id: 101,
      projectId: 1,
      meta: {},
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: new Date('2026-05-24T00:00:00.000Z'),
      updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    }];

    renderPanel();

    const applyButton = screen.getByTestId('template-apply-template-1') as HTMLButtonElement;
    expect(screen.getByTestId('bom-template-safety-gate').textContent).toContain('REVIEW');
    expect(applyButton.disabled).toBe(false);
    expect(applyButton.textContent).toContain('Review');

    fireEvent.click(applyButton);

    expect(screen.getByTestId('bom-template-apply-preview').textContent).toContain('Sensor BOM');
    expect(screen.getByTestId('bom-template-apply-preview-diff')).toBeDefined();
    expect(screen.getByTestId('bom-template-apply-preview-create-count').textContent).toContain('1 create');
    expect(screen.getByTestId('bom-template-apply-preview-skip-count').textContent).toContain('1 skip');
    expect(screen.getByTestId('bom-template-apply-preview-action-template-item-existing').textContent).toContain('skip');
    expect(screen.getByTestId('bom-template-apply-preview-action-template-item-new').textContent).toContain('create');
    expect(screen.getByTestId('bom-template-apply-preview-row-template-item-new').textContent).toContain('New template part');
    expect(screen.getByTestId('bom-template-apply-preview-warnings').textContent).toContain('not exact-part verified');
    expect(mockApplyTemplate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('bom-template-apply-preview-confirm'));

    expect(mockApplyTemplate).toHaveBeenCalledWith(
      { templateId: 'template-1', projectId: 1 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('keeps apply confirmation disabled until template detail diff loads', () => {
    mockCircuitInstances = [makeCircuitInstance()];
    mockComponentParts = [{
      id: 101,
      projectId: 1,
      meta: {},
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: new Date('2026-05-24T00:00:00.000Z'),
      updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    }];
    mockTemplateDetails = {};
    mockTemplateDetailLoading = true;

    renderPanel();

    fireEvent.click(screen.getByTestId('template-apply-template-1'));

    expect(screen.getByTestId('bom-template-apply-preview-loading').textContent).toContain('Loading template item diff');
    expect(screen.queryByTestId('bom-template-apply-preview-diff')).toBeNull();
    expect((screen.getByTestId('bom-template-apply-preview-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('bom-template-apply-preview-confirm'));
    expect(mockApplyTemplate).not.toHaveBeenCalled();
  });

  it('keeps apply confirmation disabled when template detail loading fails', () => {
    mockCircuitInstances = [makeCircuitInstance()];
    mockComponentParts = [{
      id: 101,
      projectId: 1,
      meta: {},
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: new Date('2026-05-24T00:00:00.000Z'),
      updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    }];
    mockTemplateDetails = {};
    mockTemplateDetailError = true;

    renderPanel();

    fireEvent.click(screen.getByTestId('template-apply-template-1'));

    expect(screen.getByTestId('bom-template-apply-preview-error').textContent).toContain('Could not load template details');
    expect(screen.queryByTestId('bom-template-apply-preview-diff')).toBeNull();
    expect((screen.getByTestId('bom-template-apply-preview-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('bom-template-apply-preview-confirm'));
    expect(mockApplyTemplate).not.toHaveBeenCalled();
  });
});
