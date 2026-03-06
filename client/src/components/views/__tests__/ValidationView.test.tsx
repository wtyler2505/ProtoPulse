import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------------------------------------------------------------------
// Mocks — every context / hook the component touches
// -------------------------------------------------------------------

const mockRunValidation = vi.fn();
const mockDeleteValidationIssue = vi.fn();
const mockAddOutputLog = vi.fn();
const mockSetActiveView = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: mockIssues,
    runValidation: mockRunValidation,
    deleteValidationIssue: mockDeleteValidationIssue,
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({
    addOutputLog: mockAddOutputLog,
  }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView: mockSetActiveView,
    activeView: 'validation',
  }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock clipboard
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

// Mock component parts hook — return empty by default
vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: [] }),
}));

// Mock circuit hooks — return empty
vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: [] }),
  useCircuitInstances: () => ({ data: [] }),
  useCircuitNets: () => ({ data: [] }),
}));

// Mock architecture & BOM contexts used for real-data wiring
vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [],
    edges: [],
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
  }),
}));

// Mock DRC / ERC engines
vi.mock('@/lib/component-editor/drc', () => ({
  runDRC: () => [],
  getDefaultDRCRules: () => [],
}));

vi.mock('@/lib/component-editor/validation', () => ({
  validatePart: () => [],
}));

vi.mock('@/lib/circuit-editor/erc-engine', () => ({
  runERC: () => [],
}));

vi.mock('@shared/circuit-types', () => ({
  DEFAULT_ERC_RULES: [],
  DEFAULT_CIRCUIT_SETTINGS: {},
}));

// Mock virtualizer since happy-dom lacks layout
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 72,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 72,
        size: 72,
        key: i,
      })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

// Tooltip pass-through
vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Context menus pass-through
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

// Alert dialog mocks
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  buttonVariants: () => '',
}));

// -------------------------------------------------------------------
// Shared test state
// -------------------------------------------------------------------

let mockIssues: Array<{
  id: string;
  severity: string;
  message: string;
  componentId?: string;
  suggestion?: string;
}> = [];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, queryFn: async () => ({ data: [], total: 0 }) },
      mutations: { retry: false },
    },
  });
}

// Import AFTER mocks are defined — vi.mock is hoisted automatically
import ValidationView from '@/components/views/ValidationView';

function renderValidationView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ValidationView />
    </QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('ValidationView', { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssues = [];
  });

  it('shows empty state when no issues exist', () => {
    renderValidationView();
    expect(screen.getByTestId('empty-state-validation')).toBeDefined();
    expect(screen.getByText('All Systems Nominal')).toBeDefined();
  });

  it('shows "Run DRC Checks" button in empty state and fires runValidation + toast on click', () => {
    renderValidationView();
    const btn = screen.getByTestId('button-run-drc-empty');
    fireEvent.click(btn);
    expect(mockRunValidation).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Validation Running' }),
    );
  });

  it('renders architecture issue rows with severity icon and message', () => {
    mockIssues = [
      { id: '1', severity: 'error', message: 'SPI contention detected', componentId: 'MCU' },
      { id: '2', severity: 'warning', message: 'Missing pull-ups', suggestion: 'Add 4.7k resistors' },
    ];
    renderValidationView();
    expect(screen.getByText('SPI contention detected')).toBeDefined();
    expect(screen.getByText('Missing pull-ups')).toBeDefined();
    expect(screen.getByText(/Add 4.7k resistors/)).toBeDefined();
  });

  it('shows total issue count in header', () => {
    mockIssues = [
      { id: '1', severity: 'error', message: 'Error one' },
      { id: '2', severity: 'warning', message: 'Warning one' },
      { id: '3', severity: 'info', message: 'Info one' },
    ];
    renderValidationView();
    expect(screen.getByText(/Found 3 potential issues/)).toBeDefined();
  });

  it('header "Run DRC Checks" button fires runValidation and toast', () => {
    mockIssues = [{ id: '1', severity: 'error', message: 'Issue' }];
    renderValidationView();
    const btn = screen.getByTestId('run-drc-checks');
    fireEvent.click(btn);
    expect(mockRunValidation).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Validation Running' }),
    );
  });

  it('"Mark Resolved" button on an issue calls deleteValidationIssue', () => {
    mockIssues = [{ id: '42', severity: 'error', message: 'Fix this' }];
    renderValidationView();
    const btn = screen.getByTestId('button-resolve-42');
    fireEvent.click(btn);
    expect(mockDeleteValidationIssue).toHaveBeenCalledWith('42');
    expect(mockAddOutputLog).toHaveBeenCalledWith(expect.stringContaining('Fix this'));
  });

  it('clicking an issue row with componentId navigates to architecture view', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    renderValidationView();
    const row = screen.getByTestId('row-issue-10');
    fireEvent.click(row);
    expect(mockSetActiveView).toHaveBeenCalledWith('architecture');
  });

  it('displays GLOBAL when issue has no componentId', () => {
    mockIssues = [{ id: '5', severity: 'info', message: 'General info' }];
    renderValidationView();
    expect(screen.getByText('GLOBAL')).toBeDefined();
  });
});
