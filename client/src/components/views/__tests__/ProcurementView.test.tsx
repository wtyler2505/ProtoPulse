import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const mockAddBomItem = vi.fn();
const mockDeleteBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const mockSetBomSettings = vi.fn();
const mockAddOutputLog = vi.fn();
const mockToast = vi.fn();

let mockBom: Array<{
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  stock: number;
  status: string;
}> = [];

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBom,
    bomSettings: { maxCost: 50, batchSize: 1000, inStockOnly: true, manufacturingDate: new Date() },
    setBomSettings: mockSetBomSettings,
    addBomItem: mockAddBomItem,
    deleteBomItem: mockDeleteBomItem,
    updateBomItem: mockUpdateBomItem,
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({ addOutputLog: mockAddOutputLog }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('@/lib/csv', () => ({
  buildCSV: vi.fn().mockReturnValue('csv-content'),
  downloadBlob: vi.fn(),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/lib/constants', () => ({
  STORAGE_KEYS: {
    OPTIMIZATION_GOAL: 'opt-goal',
    PREFERRED_SUPPLIERS: 'pref-suppliers',
    BOM_SORT_ORDER: 'bom-sort',
    AI_PROVIDER: 'ai-provider',
    AI_MODEL: 'ai-model',
    AI_TEMPERATURE: 'ai-temp',
    AI_SYSTEM_PROMPT: 'ai-prompt',
    ROUTING_STRATEGY: 'routing-strategy',
  },
  DEFAULT_PREFERRED_SUPPLIERS: { 'Digi-Key': true, Mouser: true, LCSC: true },
  OPTIMIZATION_GOALS: { Cost: 'Minimize cost', Power: 'Minimize power', Size: 'Minimize size', Avail: 'Maximize availability' } as Record<string, string>,
  getSupplierSearchUrl: (s: string) => (s === 'Digi-Key' ? 'https://digikey.com/search?q=' : ''),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ trigger, onConfirm }: { trigger: React.ReactNode; onConfirm?: () => void }) => (
    <div onClick={onConfirm}>{trigger}</div>
  ),
}));

// Mock all shadcn UI primitives to simple HTML
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: (props: Record<string, unknown>) => <input type="range" data-testid={props['data-testid'] as string} />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: Record<string, unknown>) => <input type="checkbox" data-testid={props['data-testid'] as string} />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// dnd-kit — minimal mock
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}));

// Tabs — Radix primitives are too heavy for happy-dom; use lightweight mocks.
// Only render the "management" TabsContent (the default tab) to avoid loading
// lazy-imported panels (BomDiffPanel, AssemblyGroupPanel, AvlCompliancePanel).
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  TabsContent: ({ children, value, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: string }) =>
    value === 'management' ? <div data-value={value} {...props}>{children}</div> : null,
}));

// LifecycleBadge — lightweight mock to avoid pulling lifecycle-badges module weight
vi.mock('@/components/ui/LifecycleBadge', () => ({
  LifecycleBadge: ({ partNumber }: { partNumber: string }) => (
    <span data-testid={`lifecycle-badge-card-${partNumber}`} />
  ),
}));

// lifecycle-badges — mock classifyLifecycle for summary counter in ProcurementView
vi.mock('@/lib/lifecycle-badges', () => ({
  classifyLifecycle: (_pn: string, _mfg?: string) => 'unknown' as const,
}));

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

import ProcurementView from '@/components/views/ProcurementView';
import { buildCSV, downloadBlob } from '@/lib/csv';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderProcurement() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ProcurementView />
    </QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('ProcurementView', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBom = [];
  });

  it('renders empty state when BOM is empty', () => {
    renderProcurement();
    expect(screen.getByTestId('empty-state-bom')).toBeDefined();
    expect(screen.getByText(/No items in your Bill of Materials/)).toBeDefined();
    expect(screen.getByTestId('button-add-first-item')).toBeDefined();
  });

  it('renders BOM items in mobile card layout', () => {
    mockBom = [
      {
        id: '1',
        partNumber: 'ESP32-S3',
        manufacturer: 'Espressif',
        description: 'MCU module',
        quantity: 2,
        unitPrice: 3.5,
        totalPrice: 7.0,
        supplier: 'Digi-Key',
        stock: 500,
        status: 'In Stock',
      },
    ];
    renderProcurement();
    // Both mobile card and desktop table render in happy-dom (no media queries),
    // so text appears twice. Scope assertions to the mobile card element.
    const card = screen.getByTestId('card-bom-1');
    expect(card).toBeDefined();
    expect(within(card).getByText('ESP32-S3')).toBeDefined();
    expect(within(card).getByText('Espressif')).toBeDefined();
  });

  it('displays total cost in the header', () => {
    mockBom = [
      {
        id: '1', partNumber: 'R1', manufacturer: 'Yageo', description: 'Resistor',
        quantity: 10, unitPrice: 0.01, totalPrice: 0.1, supplier: 'Mouser', stock: 10000, status: 'In Stock',
      },
      {
        id: '2', partNumber: 'C1', manufacturer: 'Murata', description: 'Cap',
        quantity: 5, unitPrice: 0.05, totalPrice: 0.25, supplier: 'Digi-Key', stock: 5000, status: 'In Stock',
      },
    ];
    renderProcurement();
    const costEl = screen.getByTestId('text-total-cost');
    expect(costEl.textContent).toContain('$0.35');
  });

  it('search input filters BOM items', () => {
    mockBom = [
      {
        id: '1', partNumber: 'ESP32', manufacturer: 'Espressif', description: 'MCU',
        quantity: 1, unitPrice: 3, totalPrice: 3, supplier: 'Digi-Key', stock: 100, status: 'In Stock',
      },
      {
        id: '2', partNumber: 'SHT40', manufacturer: 'Sensirion', description: 'Sensor',
        quantity: 1, unitPrice: 2, totalPrice: 2, supplier: 'Mouser', stock: 50, status: 'Low Stock',
      },
    ];
    renderProcurement();
    const searchInput = screen.getByTestId('input-search-bom');
    fireEvent.change(searchInput, { target: { value: 'SHT40' } });
    // After filter, SHT40 should be visible (appears in both mobile card + desktop table)
    expect(screen.getAllByText('SHT40').length).toBeGreaterThanOrEqual(1);
    // ESP32 mobile card should be gone (we check the card test id)
    expect(screen.queryByTestId('card-bom-1')).toBeNull();
  });

  it('shows search-no-results empty state when no items match', () => {
    mockBom = [
      {
        id: '1', partNumber: 'ESP32', manufacturer: 'Espressif', description: 'MCU',
        quantity: 1, unitPrice: 3, totalPrice: 3, supplier: 'Digi-Key', stock: 100, status: 'In Stock',
      },
    ];
    renderProcurement();
    const searchInput = screen.getByTestId('input-search-bom');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('empty-state-bom')).toBeDefined();
    expect(screen.getByText(/No matching components/)).toBeDefined();
    expect(screen.getByTestId('button-clear-search')).toBeDefined();
  });

  it('"Clear Search" button resets the search', () => {
    mockBom = [
      {
        id: '1', partNumber: 'ESP32', manufacturer: 'Espressif', description: 'MCU',
        quantity: 1, unitPrice: 3, totalPrice: 3, supplier: 'Digi-Key', stock: 100, status: 'In Stock',
      },
    ];
    renderProcurement();
    const searchInput = screen.getByTestId('input-search-bom');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    const clearBtn = screen.getByTestId('button-clear-search');
    fireEvent.click(clearBtn);
    // After clearing, the item should be visible again (appears in both
    // mobile card + desktop table since happy-dom doesn't apply media queries)
    expect(screen.getAllByText('ESP32').length).toBeGreaterThanOrEqual(1);
  });

  it('toggling settings panel shows optimization controls', () => {
    renderProcurement();
    expect(screen.queryByTestId('panel-settings')).toBeNull();
    const settingsBtn = screen.getByTestId('button-toggle-settings');
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId('panel-settings')).toBeDefined();
    expect(screen.getByText('Production Batch Size')).toBeDefined();
    expect(screen.getByText('Max BOM Cost Target')).toBeDefined();
    expect(screen.getByText('Optimization Goal')).toBeDefined();
  });

  it('clicking Export CSV calls buildCSV/downloadBlob and shows toast', () => {
    mockBom = [
      {
        id: '1', partNumber: 'R1', manufacturer: 'Yageo', description: 'Res',
        quantity: 10, unitPrice: 0.01, totalPrice: 0.1, supplier: 'Mouser', stock: 10000, status: 'In Stock',
      },
    ];
    renderProcurement();
    const exportBtn = screen.getByTestId('button-export-csv');
    fireEvent.click(exportBtn);
    expect(vi.mocked(buildCSV)).toHaveBeenCalled();
    expect(vi.mocked(downloadBlob)).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export Complete' }));
  });

  it('component parts reference section toggle works', () => {
    renderProcurement();
    expect(screen.queryByTestId('panel-component-ref-content')).toBeNull();
    const refBtn = screen.getByTestId('button-toggle-component-ref');
    fireEvent.click(refBtn);
    expect(screen.getByTestId('panel-component-ref-content')).toBeDefined();
  });
});
