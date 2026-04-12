import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from '../CommandPalette';
import type { PartWithStock } from '@shared/parts/part-row';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span data-testid={`icon-${name}`} {...props} />
  );
  return {
    Search: icon('search'),
    Loader2: icon('loader2'),
    X: icon('x'),
  };
});

// Mock shadcn/ui components
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) => (
    <span {...props}>{children as React.ReactNode}</span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
  ScrollBar: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children as React.ReactNode}</div>
  ),
}));

// Mock useCatalog
let mockParts: PartWithStock[] = [];
let mockIsLoading = false;

vi.mock('@/lib/parts/use-parts-catalog', () => ({
  useCatalog: () => ({
    parts: mockParts,
    isLoading: mockIsLoading,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePart(overrides: Partial<PartWithStock> = {}): PartWithStock {
  return {
    id: crypto.randomUUID(),
    slug: 'atmega328p',
    title: 'ATmega328P',
    description: 'AVR microcontroller',
    manufacturer: 'Microchip',
    mpn: 'ATMEGA328P-AU',
    canonicalCategory: 'Microcontroller',
    packageType: 'TQFP-32',
    tolerance: null,
    esdSensitive: null,
    assemblyCategory: null,
    meta: {},
    connectors: [],
    datasheetUrl: null,
    manufacturerUrl: null,
    origin: 'library',
    originRef: null,
    forkedFromId: null,
    authorUserId: null,
    isPublic: true,
    trustLevel: 'verified',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    stock: null,
    ...overrides,
  };
}

const SAMPLE_PARTS: PartWithStock[] = [
  makePart({
    id: '00000000-0000-0000-0000-000000000001',
    title: 'ATmega328P',
    mpn: 'ATMEGA328P-AU',
    manufacturer: 'Microchip',
    canonicalCategory: 'Microcontroller',
    trustLevel: 'verified',
  }),
  makePart({
    id: '00000000-0000-0000-0000-000000000002',
    title: '10k Resistor',
    mpn: 'RC0805FR-0710KL',
    manufacturer: 'Yageo',
    canonicalCategory: 'Resistor',
    trustLevel: 'manufacturer_verified',
  }),
  makePart({
    id: '00000000-0000-0000-0000-000000000003',
    title: 'ESP32-WROOM-32',
    mpn: null,
    manufacturer: 'Espressif',
    canonicalCategory: 'Module',
    trustLevel: 'community',
  }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParts = [];
    mockIsLoading = false;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onOpenChange={mockOnOpenChange} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay and input when open', () => {
    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    expect(screen.getByTestId('command-palette-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-results')).toBeInTheDocument();
  });

  it('shows empty hint when no query entered', () => {
    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    expect(screen.getByTestId('command-palette-empty')).toBeInTheDocument();
    expect(screen.getByText('Type to search parts across all projects...')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Escape is pressed', () => {
    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    fireEvent.keyDown(screen.getByTestId('command-palette-overlay'), { key: 'Escape' });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when backdrop is clicked', () => {
    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    // The backdrop is the aria-hidden div
    const backdrop = screen.getByTestId('command-palette-overlay').querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('displays loading indicator while fetching', async () => {
    mockIsLoading = true;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    // Type a query and wait for debounce
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'atmega' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByTestId('command-palette-loading')).toBeInTheDocument();
    expect(screen.getByText('Searching parts...')).toBeInTheDocument();
  });

  it('displays search results with part details', async () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'atmega' } });

    act(() => { vi.advanceTimersByTime(350); });

    // Check result rows exist
    expect(screen.getByTestId('command-palette-result-0')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-result-1')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-result-2')).toBeInTheDocument();

    // Check part details
    expect(screen.getByText('ATmega328P')).toBeInTheDocument();
    expect(screen.getByText('ATMEGA328P-AU')).toBeInTheDocument();
    expect(screen.getByText('Microchip')).toBeInTheDocument();
    expect(screen.getByText('Microcontroller')).toBeInTheDocument();

    // Check MPN for second result
    expect(screen.getByText('RC0805FR-0710KL')).toBeInTheDocument();

    // Check third result without MPN still renders
    expect(screen.getByText('ESP32-WROOM-32')).toBeInTheDocument();
  });

  it('displays trust level badges', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'search' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('displays category badges', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'search' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByText('Resistor')).toBeInTheDocument();
    expect(screen.getByText('Module')).toBeInTheDocument();
  });

  it('shows "No parts match your search" when query returns empty results', () => {
    mockParts = [];

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'nonexistent_part_xyz' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByText('No parts match your search')).toBeInTheDocument();
  });

  it('navigates results with arrow keys', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    const overlay = screen.getByTestId('command-palette-overlay');

    // Initially first item is active
    expect(screen.getByTestId('command-palette-result-0')).toHaveAttribute('aria-selected', 'true');

    // Arrow down selects next
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });
    expect(screen.getByTestId('command-palette-result-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('command-palette-result-0')).toHaveAttribute('aria-selected', 'false');

    // Arrow down again
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });
    expect(screen.getByTestId('command-palette-result-2')).toHaveAttribute('aria-selected', 'true');

    // Arrow down wraps to first
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });
    expect(screen.getByTestId('command-palette-result-0')).toHaveAttribute('aria-selected', 'true');

    // Arrow up wraps to last
    fireEvent.keyDown(overlay, { key: 'ArrowUp' });
    expect(screen.getByTestId('command-palette-result-2')).toHaveAttribute('aria-selected', 'true');
  });

  it('selects result on Enter and closes palette', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    const overlay = screen.getByTestId('command-palette-overlay');
    fireEvent.keyDown(overlay, { key: 'Enter' });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('selects result on click and closes palette', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    fireEvent.click(screen.getByTestId('command-palette-result-1'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('highlights result on mouse hover', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    // Hover over second result
    fireEvent.mouseEnter(screen.getByTestId('command-palette-result-1'));
    expect(screen.getByTestId('command-palette-result-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('command-palette-result-0')).toHaveAttribute('aria-selected', 'false');
  });

  it('shows result count in footer', () => {
    mockParts = SAMPLE_PARTS;

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByText('3 results')).toBeInTheDocument();
  });

  it('shows singular "result" for single result', () => {
    mockParts = [SAMPLE_PARTS[0]];

    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'part' } });

    act(() => { vi.advanceTimersByTime(350); });

    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('debounces the search query', () => {
    render(
      <CommandPalette open={true} onOpenChange={mockOnOpenChange} />,
    );

    const input = screen.getByTestId('command-palette-input');

    // Type quickly
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'at' } });
    fireEvent.change(input, { target: { value: 'atm' } });

    // Before debounce fires, should still show the hint
    expect(screen.getByText('Type to search parts across all projects...')).toBeInTheDocument();

    // After debounce
    act(() => { vi.advanceTimersByTime(350); });

    // Now debouncedQuery is set, so hint disappears
    // (with empty results and not loading, shows "No parts match your search")
    expect(screen.getByText('No parts match your search')).toBeInTheDocument();
  });
});
