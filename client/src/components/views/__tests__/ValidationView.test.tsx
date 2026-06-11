import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

// -------------------------------------------------------------------
// Mocks — every context / hook the component touches
// -------------------------------------------------------------------

const mockRunValidation = vi.fn();
const mockDeleteValidationIssue = vi.fn();
const mockAddOutputLog = vi.fn();
const mockSetActiveView = vi.fn();
const mockToast = vi.fn();
const mockRunERC = vi.fn().mockReturnValue([]);
let mockComponentParts: unknown[] = [];
let mockCircuitInstances: unknown[] = [];
let mockCircuitNets: unknown[] = [];
let mockCircuitDesigns: unknown[] = [];
let mockBom: Array<Record<string, unknown>> = [];

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

vi.mock('@/lib/use-jit-run-history', () => ({
  useJitRunHistory: () => ({
    items: [],
    loading: false,
    refresh: vi.fn(async () => []),
  }),
}));

vi.mock('@/components/views/SchemaViewerPanel', () => ({
  default: () => <div data-testid="schema-viewer-panel" />,
}));

// Mock component parts hook — return empty by default
vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: mockComponentParts }),
}));

// Mock circuit hooks — return empty
vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: mockCircuitDesigns }),
  useCircuitInstances: () => ({ data: mockCircuitInstances }),
  useCircuitNets: () => ({ data: mockCircuitNets }),
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
    bom: mockBom,
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
  runERC: (...args: unknown[]) => mockRunERC(...args),
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
    <button type="button" onClick={onSelect}>
      {children}
    </button>
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
    <button type="button" data-testid="alert-dialog-action" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
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
import { copyToClipboard } from '@/lib/clipboard';

function renderValidationView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ValidationView />
    </QueryClientProvider>,
  );
}

function dispatchValidationRadial(commandId: string, targetId?: string): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'validation',
      target: targetId ? 'issue' : 'canvas',
      targetId,
      targetLabel: targetId ? 'Validation issue' : 'Validation canvas',
    },
    source: 'radial-menu',
  };
  act(() => {
    window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('ValidationView', { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssues = [];
    mockRunERC.mockReturnValue([]);
    mockComponentParts = [];
    mockCircuitInstances = [];
    mockCircuitNets = [];
    mockCircuitDesigns = [];
    mockBom = [];
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
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Running' }));
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

  it('adds radial target metadata to validation issue rows', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    renderValidationView();

    const row = screen.getByTestId('row-issue-10');
    expect(row.getAttribute('data-issue-id')).toBe('arch:10');
    expect(row.getAttribute('data-issue-label')).toBe('Missing ESD');
  });

  it('reruns validation from a radial command', () => {
    renderValidationView();

    const detail = dispatchValidationRadial('rerun_validation');

    expect(detail.handled).toBe(true);
    expect(mockRunValidation).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Running' }));
  });

  it('opens the validation summary from a radial command', () => {
    renderValidationView();

    const detail = dispatchValidationRadial('open_validation_summary');

    expect(detail.handled).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Summary' }));
  });

  it('jumps to an issue source from a radial command', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    renderValidationView();

    const detail = dispatchValidationRadial('jump_to_source', 'arch:10');

    expect(detail.handled).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith('architecture');
  });

  it('copies issue details from a radial command', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    renderValidationView();

    const detail = dispatchValidationRadial('copy_issue', 'arch:10');

    expect(detail.handled).toBe(true);
    expect(vi.mocked(copyToClipboard)).toHaveBeenCalledWith(expect.stringContaining('Missing ESD'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Issue Copied' }));
  });

  it('drafts issue explanation context to AI chat from a radial command', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    const eventSpy = vi.fn();
    const openSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.addEventListener('protopulse:open-chat-panel', openSpy);
    renderValidationView();

    const detail = dispatchValidationRadial('explain_issue', 'arch:10');

    expect(detail.handled).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const message = (eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
    expect(message).toContain('AI intent: fix_issue.');
    expect(message).toContain('Validation issue: Missing ESD');
    expect(message).toContain('Target: issue "Validation issue"');
    expect(message).toContain('Component: USB');
    expect(message).toContain('Explain the failure in plain language');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[VALIDATION] Drafted issue AI prompt: Missing ESD');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Issue Drafted' }));
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.removeEventListener('protopulse:open-chat-panel', openSpy);
  });

  it('drafts issue fix context to AI chat from a radial command', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    const eventSpy = vi.fn();
    const openSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.addEventListener('protopulse:open-chat-panel', openSpy);
    renderValidationView();

    const detail = dispatchValidationRadial('ai_issue_fix', 'arch:10');

    expect(detail.handled).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const message = (eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
    expect(message).toContain('AI intent: fix_issue.');
    expect(message).toContain('Validation issue: Missing ESD');
    expect(message).toContain('Target: issue "Validation issue"');
    expect(message).toContain('Component: USB');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[VALIDATION] Drafted issue fix AI prompt: Missing ESD');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Fix Drafted' }));
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.removeEventListener('protopulse:open-chat-panel', openSpy);
  });

  it('drafts a task log entry from a radial issue command', () => {
    mockIssues = [{ id: '10', severity: 'warning', message: 'Missing ESD', componentId: 'USB' }];
    renderValidationView();

    const detail = dispatchValidationRadial('create_task', 'arch:10');

    expect(detail.handled).toBe(true);
    expect(mockAddOutputLog).toHaveBeenCalledWith(expect.stringContaining('Validation follow-up: Missing ESD'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task Drafted' }));
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
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Running' }));
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

  it('shows Design Decay next-best action card when ERC violations exist', () => {
    mockComponentParts = [{ id: 11, data: {} }];
    mockCircuitDesigns = [{ id: 7, settings: {} }];
    mockCircuitInstances = [{ id: 101, partId: 11, referenceDesignator: 'U1', properties: {} }];
    mockCircuitNets = [];
    mockRunERC.mockReturnValue([
      {
        id: 'erc-1',
        ruleType: 'driver-conflict',
        severity: 'error',
        message: 'Two outputs drive NET_MAIN',
        location: { x: 12, y: 4 },
      },
    ]);

    renderValidationView();

    expect(screen.getByTestId('design-decay-card')).toBeDefined();
    expect(screen.getByTestId('design-decay-message').textContent).toContain('Two outputs drive NET_MAIN');
    expect(screen.getByTestId('design-decay-action').textContent).toContain('Resolve competing output drivers');
    expect(screen.getByTestId('jit-skill-card')).toBeDefined();
    expect(screen.getByTestId('jit-skill-command').textContent).toContain('/resolve-net-driver-conflict');
  });

  it('surfaces provenance safety gates for unverified generative parts', () => {
    mockComponentParts = [
      {
        id: 11,
        meta: {
          title: 'AI Motor Board',
          verificationStatus: 'candidate',
          breadboardHealth: { status: 'red' },
          lifecycleStatus: 'eol',
        },
      },
    ];
    mockCircuitDesigns = [{ id: 7, settings: {} }];
    mockCircuitInstances = [
      {
        id: 101,
        partId: 11,
        referenceDesignator: 'U1',
        properties: { generatedFrom: 'generative-design' },
        pcbX: 10,
        pcbY: 20,
      },
    ];
    mockBom = [
      {
        id: 'stock-1',
        partNumber: 'OLD-1',
        manufacturer: 'Legacy',
        description: 'Legacy board',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Unknown',
        stock: 0,
        status: 'Low Stock',
        pricingTrust: {
          verified: false,
          value: 0,
          source: 'historical_estimate',
          isMock: true,
        },
      },
    ];

    renderValidationView();

    expect(screen.getByTestId('validation-safety-gates')).toBeDefined();
    expect(screen.getByTestId('validation-safety-gate-summary').textContent).toContain('blocked');
    expect(screen.getByTestId('validation-safety-gate-ai-generated-circuit-provenance').textContent).toContain(
      'exact-part verification',
    );
    expect(screen.getByTestId('validation-safety-gate-breadboard-health').textContent).toContain('unresolved');
    expect(screen.getByTestId('validation-safety-gate-lifecycle-risk').textContent).toContain('verified alternate');
    expect(screen.getByTestId('validation-safety-gate-inventory-confidence').textContent).toContain(
      'estimated or unknown',
    );
    expect(screen.queryByTestId('empty-state-validation')).toBeNull();
    expect(screen.getByText(/Found 6 potential issues/)).toBeDefined();
    expect(screen.getByText('Release Safety Gates')).toBeDefined();
    expect(screen.getByTestId('row-safety-gate-ai-generated-circuit-provenance').textContent).toContain('BLOCKED');
    expect(screen.getByTestId('row-safety-gate-exact-part-verification').textContent).toContain('WARN');

    fireEvent.click(screen.getByTestId('button-review-safety-gate-ai-generated-circuit-provenance'));
    expect(mockSetActiveView).toHaveBeenCalledWith('generative_design');
  });
});
