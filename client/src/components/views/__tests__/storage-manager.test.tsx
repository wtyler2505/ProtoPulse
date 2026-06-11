import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

// Mock lucide-react — must list every icon the component uses
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <span data-testid={`icon-${name}`} {...props} />;
  return {
    ArrowRight: icon('arrow-right'),
    BarChart3: icon('bar-chart-3'),
    Box: icon('box'),
    Check: icon('check'),
    CheckSquare: icon('check-square'),
    ChevronDown: icon('chevron-down'),
    ChevronRight: icon('chevron-right'),
    ChevronUp: icon('chevron-up'),
    CircuitBoard: icon('circuit-board'),
    ClipboardPaste: icon('clipboard-paste'),
    Copy: icon('copy'),
    Crosshair: icon('crosshair'),
    Download: icon('download'),
    Edit: icon('edit'),
    FileCode: icon('file-code'),
    FileJson: icon('file-json'),
    FileText: icon('file-text'),
    FlipHorizontal2: icon('flip-horizontal-2'),
    Gauge: icon('gauge'),
    Grid3X3: icon('grid-3x3'),
    History: icon('history'),
    Link: icon('link'),
    Maximize: icon('maximize'),
    MessageSquarePlus: icon('message-square-plus'),
    Microscope: icon('microscope'),
    Monitor: icon('monitor'),
    Move: icon('move'),
    Package: icon('package'),
    Pentagon: icon('pentagon'),
    Play: icon('play'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh-cw'),
    RotateCw: icon('rotate-cw'),
    Ruler: icon('ruler'),
    Search: icon('search'),
    Settings2: icon('settings-2'),
    ShieldAlert: icon('shield-alert'),
    ShieldCheck: icon('shield-check'),
    SlidersHorizontal: icon('sliders-horizontal'),
    Sparkles: icon('sparkles'),
    Trash2: icon('trash-2'),
    Zap: icon('zap'),
    Activity: icon('activity'),
    AlertTriangle: icon('alert-triangle'),
    MapPin: icon('map-pin'),
    ScanBarcode: icon('scan-barcode'),
    Printer: icon('printer'),
    Info: icon('info'),
    X: icon('x'),
    Video: icon('video'),
    VideoOff: icon('video-off'),
    CheckCircle2: icon('check-circle-2'),
    XCircle: icon('x-circle'),
  };
});

// Mock shadcn/ui primitives
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardContent: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardHeader: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardTitle: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: Record<string, unknown>) => (
    <button type="button" {...props}>
      {children as React.ReactNode}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
  DialogHeader: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
  DialogTitle: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  DialogDescription: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
  DialogFooter: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open: _open, onOpenChange: _onOpenChange, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
  CollapsibleTrigger: ({ children }: Record<string, unknown>) => <>{children as React.ReactNode}</>,
  CollapsibleContent: ({ children }: Record<string, unknown>) => <div>{children as React.ReactNode}</div>,
}));

let mockBomData: unknown[] = [];
const mockAddBomItem = vi.fn();
const mockDeleteBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBomData,
    bomSettings: { maxCost: 50, batchSize: 1000, inStockOnly: true, manufacturingDate: new Date() },
    setBomSettings: vi.fn(),
    addBomItem: mockAddBomItem,
    deleteBomItem: mockDeleteBomItem,
    updateBomItem: mockUpdateBomItem,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

import StorageManagerPanel from '@/components/views/StorageManagerPanel';
import type { BomItem } from '@/lib/project-context';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

const mockBomItems: BomItem[] = [
  {
    id: '1',
    partNumber: 'ESP32-S3',
    manufacturer: 'Espressif',
    description: 'WiFi MCU module',
    quantity: 2,
    unitPrice: 3.5,
    totalPrice: 7,
    supplier: 'Digi-Key' as const,
    stock: 500,
    status: 'In Stock' as const,
    leadTime: undefined,
    storageLocation: 'Drawer A1',
    quantityOnHand: 10,
    minimumStock: 3,
  },
  {
    id: '2',
    partNumber: 'SHT40',
    manufacturer: 'Sensirion',
    description: 'Temp/humidity sensor',
    quantity: 1,
    unitPrice: 2,
    totalPrice: 2,
    supplier: 'Mouser' as const,
    stock: 100,
    status: 'Low Stock' as const,
    leadTime: undefined,
    storageLocation: 'Drawer A1',
    quantityOnHand: 2,
    minimumStock: 5,
  },
  {
    id: '3',
    partNumber: 'LM7805',
    manufacturer: 'TI',
    description: '5V regulator',
    quantity: 3,
    unitPrice: 0.5,
    totalPrice: 1.5,
    supplier: 'LCSC' as const,
    stock: 1000,
    status: 'In Stock' as const,
    leadTime: undefined,
    storageLocation: 'Bin B2',
    quantityOnHand: 20,
    minimumStock: 5,
  },
  {
    id: '4',
    partNumber: 'R-10K',
    manufacturer: 'Yageo',
    description: '10K resistor',
    quantity: 10,
    unitPrice: 0.01,
    totalPrice: 0.1,
    supplier: 'Digi-Key' as const,
    stock: 10000,
    status: 'In Stock' as const,
    leadTime: undefined,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
  },
];

function renderStorageManager(items: BomItem[] = mockBomItems) {
  mockBomData = items;

  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <StorageManagerPanel projectId={1} />
    </QueryClientProvider>,
  );
}

function withInventoryMetadata(item: BomItem, metadata: Record<string, unknown>): BomItem {
  return { ...item, ...metadata } as BomItem;
}

function dispatchInventoryRadial(commandId: string, targetId?: string, targetLabel?: string): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'inventory',
      target: targetId ? 'part' : 'canvas',
      targetId,
      targetLabel,
    },
    source: 'radial-menu',
  };

  act(() => {
    window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  });

  return detail;
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('StorageManagerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('protopulse-session-id', 'test-session');
  });

  it('renders the storage manager panel', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-manager-panel')).toBeDefined();
    });

    expect(screen.getByText('Storage Manager')).toBeDefined();
  });

  it('renders storage locations from BOM items', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    // Should have 3 groups: "Bin B2", "Drawer A1", "Unassigned"
    expect(screen.getByText('Drawer A1')).toBeDefined();
    expect(screen.getByText('Bin B2')).toBeDefined();
    expect(screen.getByText('Unassigned')).toBeDefined();
  });

  it('shows correct stock warning badges', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    // ESP32-S3: quantityOnHand=10, minimumStock=3 -> 10 > 2*3=6 -> "OK"
    const esp32Status = screen.getByTestId('item-status-1');
    expect(esp32Status.textContent).toBe('OK');

    // SHT40: quantityOnHand=2, minimumStock=5 -> 2 <= 5 -> "Critical"
    const sht40Status = screen.getByTestId('item-status-2');
    expect(sht40Status.textContent).toBe('Critical');

    // LM7805: quantityOnHand=20, minimumStock=5 -> 20 > 2*5=10 -> "OK"
    const lm7805Status = screen.getByTestId('item-status-3');
    expect(lm7805Status.textContent).toBe('OK');

    // R-10K: quantityOnHand=null -> "Not tracked"
    const r10kStatus = screen.getByTestId('item-status-4');
    expect(r10kStatus.textContent).toBe('Not tracked');
  });

  it('filters items by search text matching part number', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const searchInput = screen.getByTestId('storage-search-input');
    fireEvent.change(searchInput, { target: { value: 'ESP32' } });

    // ESP32 item should be visible
    expect(screen.getByTestId('item-part-1')).toBeDefined();
    // Other items should not be present
    expect(screen.queryByTestId('item-part-2')).toBeNull();
    expect(screen.queryByTestId('item-part-3')).toBeNull();
    expect(screen.queryByTestId('item-part-4')).toBeNull();
  });

  it('filters items by search text matching location', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const searchInput = screen.getByTestId('storage-search-input');
    fireEvent.change(searchInput, { target: { value: 'Bin B2' } });

    // Only LM7805 is in Bin B2
    expect(screen.getByTestId('item-part-3')).toBeDefined();
    expect(screen.queryByTestId('item-part-1')).toBeNull();
    expect(screen.queryByTestId('item-part-2')).toBeNull();
  });

  it('shows empty state when no items match search', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const searchInput = screen.getByTestId('storage-search-input');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-part' } });

    expect(screen.getByTestId('storage-empty')).toBeDefined();
    expect(screen.getByText('No items match your search.')).toBeDefined();
  });

  it('shows empty state when no BOM items exist', async () => {
    renderStorageManager([]);

    await waitFor(() => {
      expect(screen.getByTestId('storage-empty')).toBeDefined();
    });

    expect(screen.getByText('No BOM items to display.')).toBeDefined();
  });

  it('shows low stock count badge when items have stock warnings', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-low-stock-count')).toBeDefined();
    });

    // SHT40 is the only item with critical stock (qty 2 <= min 5)
    expect(screen.getByTestId('storage-low-stock-count').textContent).toBe('1 low stock');
  });

  it('displays quantity on hand / minimum stock for tracked items', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    // ESP32-S3: 10 / 3
    expect(screen.getByTestId('item-qty-1').textContent).toBe('10 / 3');
    // R-10K: not tracked
    expect(screen.getByTestId('item-qty-4').textContent).toBe('--');
  });

  it('shows an inventory confidence review gate for untracked quantity lines', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('inventory-confidence-gate')).toBeDefined();
    });

    expect(screen.getByTestId('inventory-confidence-status').textContent).toBe('Review');
    expect(screen.getByTestId('inventory-confidence-warnings').textContent).toContain('Inventory Confidence');
    expect(screen.getByTestId('storage-print-btn')).not.toHaveProperty('disabled', true);
  });

  it('shows the inventory confidence gate as ready when tracked stock covers BOM demand', async () => {
    const fullyTracked = mockBomItems.map((item) => ({
      ...item,
      quantityOnHand: item.quantity + 10,
      minimumStock: 1,
    }));

    renderStorageManager(fullyTracked);

    await waitFor(() => {
      expect(screen.getByTestId('inventory-confidence-status').textContent).toBe('Ready');
    });

    expect(screen.queryByTestId('inventory-confidence-warnings')).toBeNull();
    expect(screen.getByTestId('storage-print-btn')).not.toHaveProperty('disabled', true);
  });

  it('warns when BOM demand exceeds tracked on-hand inventory', async () => {
    const shortStock = mockBomItems.map((item) => ({
      ...item,
      quantityOnHand: item.id === '1' ? 1 : item.quantity + 10,
      minimumStock: 1,
    }));

    renderStorageManager(shortStock);

    await waitFor(() => {
      expect(screen.getByTestId('inventory-confidence-status').textContent).toBe('Review');
    });

    expect(screen.getByTestId('inventory-confidence-warnings').textContent).toContain('Inventory Coverage');
    expect(screen.getByTestId('inventory-confidence-warnings').textContent).toContain('1 unit short');
  });

  it('blocks label printing when no inventory lines exist', async () => {
    renderStorageManager([]);

    await waitFor(() => {
      expect(screen.getByTestId('inventory-confidence-status').textContent).toBe('Blocked');
    });

    expect(screen.getByTestId('inventory-confidence-blockers').textContent).toContain('No inventory lines found');
    expect(screen.getByTestId('storage-print-btn')).toHaveProperty('disabled', true);
  });

  it('marks saved-part provenance and 3D readiness on inventory rows', async () => {
    renderStorageManager([
      withInventoryMetadata(mockBomItems[0], {
        verificationLevel: 'official-backed',
        mechanicalModelQuality: 'verified',
        pricingTrust: { verified: true, source: 'octopart' },
      }),
      withInventoryMetadata(mockBomItems[1], {
        generatedFrom: 'generative-design',
        inventoryConfidence: 'estimated',
      }),
      mockBomItems[2],
    ]);

    await waitFor(() => {
      expect(screen.getByTestId('item-trust-1')).toBeDefined();
    });

    expect(screen.getByTestId('item-trust-marker-1-exact').textContent).toBe('Verified exact');
    expect(screen.getByTestId('item-trust-marker-1-mechanical').textContent).toBe('3D verified');
    expect(screen.getByTestId('item-trust-marker-2-generated').textContent).toBe('AI generated');
    expect(screen.getByTestId('item-trust-marker-2-confidence').textContent).toBe('Qty review');
    expect(screen.getByTestId('item-trust-marker-3-local').textContent).toBe('Local unverified');
  });

  it('marks storage rows as radial part targets', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-item-1')).toBeDefined();
    });

    expect(screen.getByTestId('storage-item-1').getAttribute('data-part-id')).toBe('1');
    expect(screen.getByTestId('storage-item-1').getAttribute('data-part-label')).toBe('ESP32-S3');
  });

  it('handles radial part inspection by filtering and highlighting the row', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const detail = dispatchInventoryRadial('inspect_part', '2', 'SHT40');

    await waitFor(() => {
      expect((screen.getByTestId('storage-search-input') as HTMLInputElement).value).toBe('SHT40');
    });

    expect(detail.handled).toBe(true);
    expect(screen.getByTestId('storage-item-2').className).toContain('ring-primary');
    expect(screen.queryByTestId('storage-item-1')).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Part centered' }));
  });

  it('opens inventory intake from the radial add command', async () => {
    renderStorageManager();

    const detail = dispatchInventoryRadial('add_inventory_item');

    await waitFor(() => {
      expect(screen.getByTestId('barcode-scanner-dialog')).toBeDefined();
    });

    expect(detail.handled).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inventory intake opened' }));
  });

  it('fills missing stock fields from the radial edit command', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const detail = dispatchInventoryRadial('edit_inventory_item', '4', 'R-10K');

    expect(detail.handled).toBe(true);
    expect(mockUpdateBomItem).toHaveBeenCalledWith('4', {
      quantityOnHand: 10,
      minimumStock: 5,
      storageLocation: 'Unassigned',
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inventory fields staged' }));
  });

  it('drafts inventory readiness context to AI chat from a radial command', async () => {
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      renderStorageManager();

      await waitFor(() => {
        expect(screen.getByTestId('storage-locations-list')).toBeDefined();
      });

      const detail = dispatchInventoryRadial('ai_inventory_plan', '2', 'SHT40');

      await waitFor(() => {
        expect((screen.getByTestId('storage-search-input') as HTMLInputElement).value).toBe('SHT40');
      });

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: inventory_plan.');
      expect(message).toContain('Inventory plan:');
      expect(message).toContain('Target: part "SHT40"');
      expect(message).toContain('Selected part: SHT40');
      expect(message).toContain('Clicked or representative parts:');
      expect(message).toContain('SHT40: needed');
      expect(message).toContain('Inventory confidence gate:');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Inventory Plan Drafted' }));
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('opens inventory labels from the radial labels command', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const detail = dispatchInventoryRadial('print_inventory_label', '1', 'ESP32-S3');

    await waitFor(() => {
      expect(screen.getByTestId('print-labels-dialog')).toBeDefined();
    });

    expect(detail.handled).toBe(true);
    expect((screen.getByTestId('storage-search-input') as HTMLInputElement).value).toBe('ESP32-S3');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inventory labels opened' }));
  });

  it('removes inventory rows through the radial remove command', async () => {
    renderStorageManager();

    await waitFor(() => {
      expect(screen.getByTestId('storage-locations-list')).toBeDefined();
    });

    const detail = dispatchInventoryRadial('remove_inventory_item', '2', 'SHT40');

    expect(detail.handled).toBe(true);
    expect(mockDeleteBomItem).toHaveBeenCalledWith('2');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inventory item removed' }));
  });
});
