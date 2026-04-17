import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartAlternatesPanel from '../PartAlternatesPanel';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsePartAlternates = vi.fn();
const mockMutate = vi.fn();
const mockUseSubstitutePart = vi.fn();

vi.mock('@/lib/parts/use-part-alternates', () => ({
  usePartAlternates: (...args: unknown[]) => mockUsePartAlternates(...args),
  useSubstitutePart: () => mockUseSubstitutePart(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span data-testid={`icon-${name}`} {...props} />
  );
  return {
    ChevronDown: icon('chevron-down'),
    ChevronRight: icon('chevron-right'),
    Loader2: icon('loader2'),
    RefreshCw: icon('refresh-cw'),
    ArrowRightLeft: icon('arrow-right-left'),
  };
});

// Mock shadcn/ui
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardContent: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardHeader: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CardTitle: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: Record<string, unknown>) => <button type="button" {...props}>{children as React.ReactNode}</button>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  CollapsibleTrigger: ({ children }: Record<string, unknown>) => <>{children as React.ReactNode}</>,
  CollapsibleContent: ({ children }: Record<string, unknown>) => <div>{children as React.ReactNode}</div>,
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

const ALTERNATES = [
  {
    id: 'alt-1',
    slug: 'yageo-rc0402',
    title: 'Yageo RC0402FR-0710KL',
    manufacturer: 'Yageo',
    mpn: 'RC0402FR-0710KL',
    canonicalCategory: 'resistor',
  },
  {
    id: 'alt-2',
    slug: 'vishay-crcw0402',
    title: 'Vishay CRCW040210K0FKED',
    manufacturer: 'Vishay',
    mpn: 'CRCW040210K0FKED',
    canonicalCategory: 'resistor',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartAlternatesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSubstitutePart.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders loading state', () => {
    mockUsePartAlternates.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('part-alternates-panel')).toBeInTheDocument();
    expect(screen.getByTestId('part-alternates-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUsePartAlternates.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('part-alternates-error')).toBeInTheDocument();
  });

  it('renders empty state when no alternates exist', () => {
    mockUsePartAlternates.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('part-alternates-empty')).toBeInTheDocument();
    expect(screen.getByTestId('part-alternates-count').textContent).toBe('0 alternates');
  });

  it('renders alternates list with titles and MPN', () => {
    mockUsePartAlternates.mockReturnValue({
      data: ALTERNATES,
      isLoading: false,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('part-alternates-count').textContent).toBe('2 alternates');
    expect(screen.getByTestId('alternate-title-alt-1').textContent).toBe('Yageo RC0402FR-0710KL');
    expect(screen.getByTestId('alternate-title-alt-2').textContent).toBe('Vishay CRCW040210K0FKED');
    expect(screen.getByTestId('substitute-btn-alt-1')).toBeInTheDocument();
    expect(screen.getByTestId('substitute-btn-alt-2')).toBeInTheDocument();
  });

  it('calls substitute mutation when Replace is clicked', () => {
    mockUsePartAlternates.mockReturnValue({
      data: ALTERNATES,
      isLoading: false,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByTestId('substitute-btn-alt-1'));

    expect(mockMutate).toHaveBeenCalledWith(
      { oldPartId: 'abc', substituteId: 'alt-1', projectId: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('disables buttons when substitution is in progress', () => {
    mockUseSubstitutePart.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });
    mockUsePartAlternates.mockReturnValue({
      data: ALTERNATES,
      isLoading: false,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    const btn = screen.getByTestId('substitute-btn-alt-1');
    expect(btn).toBeDisabled();
  });

  it('shows singular "alternate" for count of 1', () => {
    mockUsePartAlternates.mockReturnValue({
      data: [ALTERNATES[0]],
      isLoading: false,
      error: null,
    });

    render(
      <PartAlternatesPanel partId="abc" projectId={1} partTitle="10K Resistor" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('part-alternates-count').textContent).toBe('1 alternate');
  });
});
