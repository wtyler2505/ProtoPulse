import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

// Mock lucide-react icons to simple elements
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Package: () => <span data-testid="icon-package" />,
  Search: () => <span data-testid="icon-search" />,
  MapPin: () => <span data-testid="icon-map-pin" />,
}));

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
  Button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children as React.ReactNode}</button>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CollapsibleTrigger: ({ children }: Record<string, unknown>) => <>{children as React.ReactNode}</>,
  CollapsibleContent: ({ children }: Record<string, unknown>) => <div>{children as React.ReactNode}</div>,
}));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

import StorageManagerPanel from '@/components/views/StorageManagerPanel';

const mockBomItems = [
  {
    id: 1,
    projectId: 1,
    partNumber: 'ESP32-S3',
    manufacturer: 'Espressif',
    description: 'WiFi MCU module',
    quantity: 2,
    unitPrice: '3.5000',
    totalPrice: '7.0000',
    supplier: 'Digi-Key',
    stock: 500,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: 'Drawer A1',
    quantityOnHand: 10,
    minimumStock: 3,
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 2,
    projectId: 1,
    partNumber: 'SHT40',
    manufacturer: 'Sensirion',
    description: 'Temp/humidity sensor',
    quantity: 1,
    unitPrice: '2.0000',
    totalPrice: '2.0000',
    supplier: 'Mouser',
    stock: 100,
    status: 'Low Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: 'Drawer A1',
    quantityOnHand: 2,
    minimumStock: 5,
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 3,
    projectId: 1,
    partNumber: 'LM7805',
    manufacturer: 'TI',
    description: '5V regulator',
    quantity: 3,
    unitPrice: '0.5000',
    totalPrice: '1.5000',
    supplier: 'LCSC',
    stock: 1000,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: 'Bin B2',
    quantityOnHand: 20,
    minimumStock: 5,
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 4,
    projectId: 1,
    partNumber: 'R-10K',
    manufacturer: 'Yageo',
    description: '10K resistor',
    quantity: 10,
    unitPrice: '0.0100',
    totalPrice: '0.1000',
    supplier: 'Digi-Key',
    stock: 10000,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    updatedAt: new Date(),
    deletedAt: null,
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderStorageManager(items = mockBomItems) {
  // Mock global fetch
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ data: items }),
  } as Response);

  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <StorageManagerPanel projectId={1} />
    </QueryClientProvider>,
  );
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('StorageManagerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
});
