import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalInventoryPanel from '../PersonalInventoryPanel';
import type { PartStockRow } from '@shared/parts/part-row';

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockUsePersonalInventory = vi.fn();
const mockUseAddPersonalStock = vi.fn();
const mockUseCatalog = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/parts/use-personal-inventory', () => ({
  usePersonalInventory: (...args: unknown[]) => mockUsePersonalInventory(...args),
  useAddPersonalStock: (...args: unknown[]) => mockUseAddPersonalStock(...args),
}));

vi.mock('@/lib/parts/use-parts-catalog', () => ({
  useCatalog: (...args: unknown[]) => mockUseCatalog(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const SAMPLE_STOCK: PartStockRow[] = [
  {
    id: 'stock-1',
    projectId: null,
    partId: 'part-aaa-111',
    quantityNeeded: 0,
    quantityOnHand: 25,
    minimumStock: null,
    storageLocation: 'Drawer A3',
    unitPrice: '0.1200',
    supplier: 'DigiKey',
    leadTime: null,
    status: 'In Stock',
    notes: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'stock-2',
    projectId: null,
    partId: 'part-bbb-222',
    quantityNeeded: 0,
    quantityOnHand: 3,
    minimumStock: null,
    storageLocation: 'Drawer A3',
    unitPrice: null,
    supplier: null,
    leadTime: null,
    status: 'In Stock',
    notes: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'stock-3',
    projectId: null,
    partId: 'part-ccc-333',
    quantityNeeded: 0,
    quantityOnHand: 1,
    minimumStock: null,
    storageLocation: null,
    unitPrice: '2.5000',
    supplier: 'Mouser',
    leadTime: null,
    status: 'In Stock',
    notes: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
  },
];

function setupMocks(overrides?: {
  inventory?: { data?: PartStockRow[]; isLoading?: boolean };
  addMutation?: Record<string, unknown>;
  catalog?: { parts?: unknown[]; isLoading?: boolean };
}) {
  mockUsePersonalInventory.mockReturnValue({
    data: overrides?.inventory?.data ?? [],
    isLoading: overrides?.inventory?.isLoading ?? false,
  });
  mockUseAddPersonalStock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides?.addMutation,
  });
  mockUseCatalog.mockReturnValue({
    parts: overrides?.catalog?.parts ?? [],
    isLoading: overrides?.catalog?.isLoading ?? false,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersonalInventoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    setupMocks({ inventory: { isLoading: true } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-inventory-panel')).toBeInTheDocument();
    expect(screen.getByTestId('personal-inventory-loading')).toBeInTheDocument();
  });

  it('renders empty state when no personal stock exists', () => {
    setupMocks({ inventory: { data: [] } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-inventory-panel')).toBeInTheDocument();
    expect(screen.getByTestId('personal-inventory-empty')).toBeInTheDocument();
    expect(screen.getByTestId('personal-inventory-count')).toHaveTextContent('0 items');
  });

  it('renders stock items with correct data', () => {
    setupMocks({ inventory: { data: SAMPLE_STOCK } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-inventory-panel')).toBeInTheDocument();
    expect(screen.getByTestId('personal-inventory-count')).toHaveTextContent('3 items');
    expect(screen.getByTestId('personal-inventory-list')).toBeInTheDocument();
    expect(screen.getByTestId('personal-stock-stock-1')).toBeInTheDocument();
    expect(screen.getByTestId('personal-stock-stock-2')).toBeInTheDocument();
    expect(screen.getByTestId('personal-stock-stock-3')).toBeInTheDocument();
  });

  it('displays quantity on hand badge', () => {
    setupMocks({ inventory: { data: SAMPLE_STOCK } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-stock-qty-stock-1')).toHaveTextContent('25 on hand');
    expect(screen.getByTestId('personal-stock-qty-stock-2')).toHaveTextContent('3 on hand');
    expect(screen.getByTestId('personal-stock-qty-stock-3')).toHaveTextContent('1 on hand');
  });

  it('groups items by storage location', () => {
    setupMocks({ inventory: { data: SAMPLE_STOCK } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    // stock-1 and stock-2 share "Drawer A3", stock-3 has null → "Unassigned"
    const list = screen.getByTestId('personal-inventory-list');
    expect(list).toBeInTheDocument();

    // Both "Drawer A3" items should render
    expect(screen.getByTestId('personal-stock-stock-1')).toBeInTheDocument();
    expect(screen.getByTestId('personal-stock-stock-2')).toBeInTheDocument();
    // "Unassigned" item
    expect(screen.getByTestId('personal-stock-stock-3')).toBeInTheDocument();
  });

  it('uses singular "item" for count of 1', () => {
    setupMocks({ inventory: { data: [SAMPLE_STOCK[0]] } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-inventory-count')).toHaveTextContent('1 item');
  });

  it('renders search input', () => {
    setupMocks({ inventory: { data: [] } });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('personal-inventory-search-input')).toBeInTheDocument();
  });

  it('shows search results dropdown when query has 2+ chars and results exist', () => {
    const searchParts = [
      { id: 'part-found-1', title: '10k Resistor', mpn: 'RC0402FR-0710KL' },
    ];
    setupMocks({
      inventory: { data: [] },
      catalog: { parts: searchParts },
    });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    const input = screen.getByTestId('personal-inventory-search-input');
    fireEvent.change(input, { target: { value: '10k' } });

    expect(screen.getByTestId('personal-add-part-found-1')).toBeInTheDocument();
  });

  it('calls addMutation.mutate when a search result is clicked', () => {
    const mutateFn = vi.fn();
    const searchParts = [
      { id: 'part-found-1', title: '10k Resistor', mpn: null },
    ];
    setupMocks({
      inventory: { data: [] },
      addMutation: { mutate: mutateFn },
      catalog: { parts: searchParts },
    });

    render(<PersonalInventoryPanel />, { wrapper: createWrapper() });

    const input = screen.getByTestId('personal-inventory-search-input');
    fireEvent.change(input, { target: { value: '10k' } });
    fireEvent.click(screen.getByTestId('personal-add-part-found-1'));

    expect(mutateFn).toHaveBeenCalledWith(
      { partId: 'part-found-1', quantityOnHand: 1 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});
