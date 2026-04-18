/**
 * BreadboardDialogs component tests.
 *
 * Verifies:
 *   - Nothing visible when state is closed.
 *   - Correct dialog rendered for each of the 4 kinds.
 *   - onClose wired to each dialog's close callback.
 *   - Mutual exclusion: at most one role="dialog" mounted at a time.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UseBreadboardDialogStateResult } from '../useBreadboardDialogState';
import type { ShoppingListItem } from '../../BreadboardShoppingList';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import type { ComponentPart } from '@shared/schema';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';

// ---------------------------------------------------------------------------
// Mock child dialogs — each renders a unique testid so we can assert presence
// ---------------------------------------------------------------------------

vi.mock('../../BreadboardExactPartRequestDialog', () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div role="dialog" data-testid="exact-part-dialog">
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/views/component-editor/ExactPartDraftModal', () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div role="dialog" data-testid="exact-draft-modal">
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

vi.mock('../../BreadboardInventoryDialog', () => ({
  default: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div role="dialog" data-testid="inventory-dialog">
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

// Shopping list dialog uses shadcn Dialog — mock the whole composition
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" data-testid="shopping-list-dialog">
        {children}
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../BreadboardShoppingList', () => ({
  default: () => <div data-testid="shopping-list-content" />,
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are hoisted
// ---------------------------------------------------------------------------

import { BreadboardDialogs } from '../BreadboardDialogs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(kind: UseBreadboardDialogStateResult['state']['kind']): UseBreadboardDialogStateResult {
  const onClose = vi.fn();
  return {
    state: { kind } as UseBreadboardDialogStateResult['state'],
    open: vi.fn(),
    close: onClose,
    isOpen: (k) => k === kind,
  };
}

const noop = vi.fn();

const baseProps = {
  projectId: 1,
  parts: [] as ComponentPart[],
  activeCircuitReady: false,
  shoppingListItems: [] as ShoppingListItem[],
  insights: [] as BreadboardBenchInsight[],
  exactDraftSeed: null as ExactPartDraftSeed | null,
  onCreateExactDraft: noop,
  onOpenComponentEditor: noop,
  onPlaceResolvedPart: noop,
  onExactDraftCreated: noop,
  onExactDraftOpenChange: noop,
  onOpenAiReconcile: noop,
  onOpenStorageView: noop,
  onTrackPart: noop,
  onUpdateTrackedPart: noop,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BreadboardDialogs', () => {
  it('renders nothing visible when state is closed', () => {
    const dialogState = makeState('closed');
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('renders the exact-part dialog when state is exact-part', () => {
    const dialogState = makeState('exact-part');
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    expect(screen.getByTestId('exact-part-dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('renders the exact-draft modal when state is exact-draft', () => {
    const dialogState = makeState('exact-draft');
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    expect(screen.getByTestId('exact-draft-modal')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('renders the inventory dialog when state is inventory', () => {
    const dialogState = makeState('inventory');
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    expect(screen.getByTestId('inventory-dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('renders the shopping-list dialog when state is shopping-list', () => {
    const dialogState = makeState('shopping-list');
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    expect(screen.getByTestId('shopping-list-dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('only one dialog mounted at a time — mutual exclusion', () => {
    // Each re-render with a different kind should show exactly 1 dialog
    const kinds = ['exact-part', 'exact-draft', 'inventory', 'shopping-list'] as const;
    for (const kind of kinds) {
      const dialogState = makeState(kind);
      const { unmount } = render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      unmount();
    }
  });

  it('wires onClose to inventory dialog onOpenChange(false)', () => {
    const closeFn = vi.fn();
    const dialogState: UseBreadboardDialogStateResult = {
      state: { kind: 'inventory' },
      open: vi.fn(),
      close: closeFn,
      isOpen: (k) => k === 'inventory',
    };
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    // The mock renders a close button that calls onOpenChange(false)
    screen.getByText('close').click();
    expect(closeFn).toHaveBeenCalledTimes(1);
  });

  it('wires onClose to shopping-list dialog onOpenChange(false)', () => {
    const closeFn = vi.fn();
    const dialogState: UseBreadboardDialogStateResult = {
      state: { kind: 'shopping-list' },
      open: vi.fn(),
      close: closeFn,
      isOpen: (k) => k === 'shopping-list',
    };
    render(<BreadboardDialogs dialogState={dialogState} {...baseProps} />);
    screen.getByText('close').click();
    expect(closeFn).toHaveBeenCalledTimes(1);
  });
});
