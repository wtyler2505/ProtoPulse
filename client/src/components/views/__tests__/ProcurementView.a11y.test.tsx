/**
 * ProcurementView tabpanel accessibility (E2E-006 — Plan 03 Phase 1)
 *
 * E2E-006 was flagged in docs/audits/2026-04-18-frontend-e2e-walkthrough.md as
 * "Procurement panel content invisible to a11y tree — tabpanel has no
 * aria-labelledby". The audit later self-corrected at line 1974 ("correcting
 * initial snapshot-based false positive E2E-006") — the original report was a
 * limitation of the snapshot tool, not a real a11y bug.
 *
 * This test exists to LOCK the tabpanel accessible-name contract so we don't
 * regress. It verifies:
 *   1. The active tabpanel is present in the DOM.
 *   2. It has an accessible name resolvable by the a11y tree.
 *   3. The accessible name matches the active tab trigger's label (BOM Management).
 *
 * Notable: this test deliberately does NOT mock `@/components/ui/tabs` — the
 * whole point is to exercise real Radix behavior, which auto-wires
 * aria-labelledby on <TabsContent> to the corresponding <TabsTrigger>'s id.
 * If shadcn's wrapper ever regresses (e.g., someone strips props before
 * forwarding), this test will fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─────────────── Context + primitive mocks ───────────────
// Reuse the mock pattern that works in ProcurementView.test.tsx; the only
// important divergence is that `@/components/ui/tabs` is NOT mocked so the
// real Radix Tabs primitives drive aria wiring.

const mockAddBomItem = vi.fn();
const mockDeleteBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const mockSetBomSettings = vi.fn();
const mockAddOutputLog = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
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
  OPTIMIZATION_GOALS: {
    Cost: 'Minimize cost',
    Power: 'Minimize power',
    Size: 'Minimize size',
    Avail: 'Maximize availability',
  } as Record<string, string>,
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
    <button type="button" onClick={onSelect}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ trigger, onConfirm }: { trigger: React.ReactNode; onConfirm?: () => void }) => (
    <div onClick={onConfirm}>{trigger}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: (props: Record<string, unknown>) => (
    <input type="range" data-testid={props['data-testid'] as string} />
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: Record<string, unknown>) => (
    <input type="checkbox" data-testid={props['data-testid'] as string} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
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

vi.mock('@/components/ui/LifecycleBadge', () => ({
  LifecycleBadge: ({ partNumber }: { partNumber: string }) => (
    <span data-testid={`lifecycle-badge-card-${partNumber}`} />
  ),
}));

vi.mock('@/lib/lifecycle-badges', () => ({
  classifyLifecycle: (_pn: string, _mfg?: string) => 'unknown' as const,
}));

// ─────────────── Import under test ───────────────
import ProcurementView from '@/components/views/ProcurementView';

function renderProcurement() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProcurementView />
    </QueryClientProvider>,
  );
}

describe('ProcurementView tabpanel a11y (E2E-006)', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('active tabpanel has an accessible name linked via aria-labelledby', async () => {
    renderProcurement();

    // Radix exposes the active TabsContent as role="tabpanel".
    const tabpanel = await screen.findByRole('tabpanel');
    expect(tabpanel).toBeDefined();

    const labelledby = tabpanel.getAttribute('aria-labelledby');
    const ariaLabel = tabpanel.getAttribute('aria-label');

    // E2E-006 contract: the panel MUST have an accessible name. Radix wires
    // aria-labelledby by default; shadcn's wrapper must forward it.
    expect(labelledby || ariaLabel).toBeTruthy();

    if (labelledby) {
      const labelEl = document.getElementById(labelledby);
      expect(labelEl).not.toBeNull();
      expect(labelEl?.textContent?.trim()).toBeTruthy();
      // The referenced element should be the matching tab trigger.
      expect(labelEl?.getAttribute('role')).toBe('tab');
    }
  });

  it('tabpanel is locatable by its accessible name (default tab: BOM Management)', async () => {
    renderProcurement();

    // If a11y wiring is correct, testing-library's accessible-name resolver
    // should find the panel by the active trigger's text.
    const named = await waitFor(() =>
      screen.getByRole('tabpanel', { name: /bom management/i }),
    );
    expect(named).toBeDefined();
  });

  it('every tab trigger exposing role="tab" has a non-empty accessible name', async () => {
    renderProcurement();

    // Radix marks every trigger role="tab". Each must carry a discernible
    // label so screen readers announce the tab list, and — more importantly —
    // so each tab's corresponding panel inherits a meaningful accessible name
    // when activated.
    const triggers = await screen.findAllByRole('tab');
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      // lucide icons are aria-hidden by default, so the trigger's name comes
      // from its text node.
      expect(trigger.textContent?.trim(), `trigger missing name: ${trigger.outerHTML.slice(0, 120)}`)
        .toBeTruthy();
    }
  });
});
