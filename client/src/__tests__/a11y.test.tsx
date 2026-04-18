/**
 * Accessibility audit — all ProtoPulse workspace views
 *
 * Addresses audit finding #343 ("No a11y tests across Breadboard: keyboard nav,
 * ARIA labels, focus management, color contrast.") and extends the scope to
 * every view exposed by `client/src/pages/workspace/lazy-imports.ts`.
 *
 * Strategy
 * --------
 * - Mock every context/provider hook with safe defaults so each view renders
 *   in isolation without needing the full provider tree.
 * - Mock heavy third-party canvas libs (@xyflow/react, @dnd-kit, Three.js,
 *   Monaco, xterm, ReactFlow CSS) with simple stubs — axe cannot meaningfully
 *   audit WebGL canvases and these libs pull layout APIs happy-dom does not
 *   implement.
 * - For each view: render inside QueryClientProvider, run `axe(container)`,
 *   and assert that no violation has `impact === 'critical'` or `'serious'`.
 *   Minor/moderate violations are logged as findings but do not fail the suite.
 *
 * Documented exclusions
 * ---------------------
 * - `color-contrast` — happy-dom does not compute real layout/styles.
 * - `region` (landmark) — most views render fragments inside Sidebar+Workspace
 *   chrome; they are not full pages on their own.
 * - Third-party canvas violations (ReactFlow minimap, Monaco, xterm) — not in
 *   ProtoPulse's control.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { AxeResults, Result } from 'axe-core';
import React from 'react';

expect.extend(toHaveNoViolations);

// ───────────────────────── Context mocks ─────────────────────────
// Each hook returns safe empty defaults. We set values = any so mocks compose.

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [], edges: [], setNodes: vi.fn(), setEdges: vi.fn(),
    focusNodeId: null, selectedNodeId: null, setSelectedNodeId: vi.fn(),
    pushUndoState: vi.fn(), undo: vi.fn(), redo: vi.fn(),
    setPendingComponentPartId: vi.fn(),
  }),
  ArchitectureProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/chat-context', () => ({
  useChat: () => ({
    messages: [], isGenerating: false, addMessage: vi.fn(),
    setIsGenerating: vi.fn(), clearMessages: vi.fn(),
  }),
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({ outputLogs: [], addOutputLog: vi.fn(), clearOutputLogs: vi.fn() }),
  OutputProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'dashboard', setActiveView: vi.fn(),
    projectName: 'Test', projectDescription: '', seeded: true,
  }),
  ProjectMetaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => ({ activeView: 'dashboard', setActiveView: vi.fn() }),
  ProjectMetaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [], bomSettings: { maxCost: 50, batchSize: 1000, inStockOnly: true, manufacturingDate: new Date() },
    setBomSettings: vi.fn(), addBomItem: vi.fn(), deleteBomItem: vi.fn(), updateBomItem: vi.fn(),
  }),
  BomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({ issues: [], addIssue: vi.fn(), clearIssues: vi.fn(), runValidation: vi.fn() }),
  ValidationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/history-context', () => ({
  useHistory: () => ({ entries: [], addEntry: vi.fn(), clearHistory: vi.fn() }),
  HistoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    isRunning: false, start: vi.fn(), stop: vi.fn(), step: vi.fn(),
    probes: [], addProbe: vi.fn(), removeProbe: vi.fn(), traces: {},
  }),
  SimulationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/arduino-context', () => ({
  useArduino: () => ({ connected: false, port: null, baudRate: 9600, logs: [] }),
  ArduinoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
  ProjectIdProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 1, username: 'test' }, isLoading: false, login: vi.fn(), logout: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/undo-redo-context', () => ({
  useUndoRedo: () => ({ undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false, pushState: vi.fn() }),
  UndoRedoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/parts/parts-catalog-context', () => ({
  usePartsCatalog: () => ({ parts: [], isLoading: false, error: null, refetch: vi.fn() }),
  PartsCatalogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/dnd-context', () => ({
  DndProviderWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDndState: () => ({ activeDragData: null, setActiveDragData: vi.fn() }),
}));

vi.mock('@/lib/tutorial-context', () => ({
  useTutorial: () => ({ isActive: false, step: 0, next: vi.fn(), prev: vi.fn(), end: vi.fn() }),
  TutorialProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ───────────────────────── Third-party canvas mocks ─────────────────────────

vi.mock('@xyflow/react/dist/style.css', () => ({}));
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ fitView: vi.fn(), screenToFlowPosition: () => ({ x: 0, y: 0 }), setCenter: vi.fn() }),
  useNodesState: (i: unknown[]) => [i, vi.fn(), vi.fn()],
  useEdgesState: (i: unknown[]) => [i, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
  Background: () => <div />, Controls: () => <div />, MiniMap: () => <div />,
  Handle: () => <div />, Position: { Top: 't', Bottom: 'b', Left: 'l', Right: 'r' },
  SelectionMode: { Full: 0, Partial: 1 },
  MarkerType: { ArrowClosed: 'arrowclosed' },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({ setNodeRef: vi.fn(), listeners: {}, attributes: {}, transform: null, isDragging: false }),
  useDndMonitor: vi.fn(),
  PointerSensor: vi.fn(), KeyboardSensor: vi.fn(),
  useSensor: vi.fn(), useSensors: () => [],
  closestCenter: vi.fn(), closestCorners: vi.fn(),
  DragOverlay: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToWindowEdges: vi.fn(), restrictToParentElement: vi.fn(),
  restrictToHorizontalAxis: vi.fn(), restrictToVerticalAxis: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    setNodeRef: vi.fn(), listeners: {}, attributes: {}, transform: null,
    transition: null, isDragging: false,
  }),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  horizontalListSortingStrategy: vi.fn(),
  arrayMove: <T,>(arr: T[]) => arr,
}));

vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }));

// Three.js / react-three-fiber / drei mocks
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-testid="three-canvas">{children}</div>,
  useFrame: vi.fn(), useThree: () => ({ camera: {}, scene: {}, gl: {} }),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null, PerspectiveCamera: () => null, Environment: () => null,
  Grid: () => null, Text: () => null, Html: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useGLTF: () => ({ scene: {}, nodes: {}, materials: {} }),
}));

// Monaco / code editors
vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: () => <div data-testid="monaco-editor" role="textbox" aria-label="Code editor" />,
  Editor: () => <div data-testid="monaco-editor" role="textbox" aria-label="Code editor" />,
  DiffEditor: () => <div data-testid="monaco-diff" />,
}));

// xterm
vi.mock('@xterm/xterm', () => ({ Terminal: class { open() {} write() {} dispose() {} } }));
vi.mock('xterm', () => ({ Terminal: class { open() {} write() {} dispose() {} } }));

// ───────────────────────── Harness ─────────────────────────

interface ViewEntry {
  id: string;
  load: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
  props?: Record<string, unknown>;
}

const views: ViewEntry[] = [
  { id: 'DashboardView', load: () => import('@/components/views/DashboardView') },
  { id: 'ArchitectureView', load: () => import('@/components/views/ArchitectureView') },
  { id: 'ComponentEditorView', load: () => import('@/components/views/ComponentEditorView') },
  { id: 'SchematicView', load: () => import('@/components/views/SchematicView') },
  { id: 'BreadboardView', load: () => import('@/components/circuit-editor/BreadboardView') },
  { id: 'PCBLayoutView', load: () => import('@/components/circuit-editor/PCBLayoutView') },
  { id: 'ProcurementView', load: () => import('@/components/views/ProcurementView') },
  { id: 'ValidationView', load: () => import('@/components/views/ValidationView') },
  { id: 'SimulationPanel', load: () => import('@/components/simulation/SimulationPanel') },
  { id: 'DesignHistoryView', load: () => import('@/components/views/DesignHistoryView') },
  { id: 'LifecycleDashboard', load: () => import('@/components/views/LifecycleDashboard') },
  { id: 'CalculatorsView', load: () => import('@/components/views/CalculatorsView') },
  { id: 'DesignPatternsView', load: () => import('@/components/views/DesignPatternsView') },
  { id: 'KanbanView', load: () => import('@/components/views/KanbanView') },
  { id: 'KnowledgeView', load: () => import('@/components/views/KnowledgeView') },
  { id: 'BoardViewer3DView', load: () => import('@/components/views/BoardViewer3DView') },
  { id: 'CommunityView', load: () => import('@/components/views/CommunityView') },
  { id: 'PcbOrderingView', load: () => import('@/components/views/PcbOrderingView') },
  { id: 'CircuitCodeView', load: () => import('@/components/views/CircuitCodeView') },
  { id: 'GenerativeDesignView', load: () => import('@/components/views/GenerativeDesignView') },
  { id: 'DigitalTwinView', load: () => import('@/components/views/DigitalTwinView') },
  { id: 'ArduinoWorkbenchView', load: () => import('@/components/views/ArduinoWorkbenchView') },
  { id: 'AuditTrailView', load: () => import('@/components/views/AuditTrailView') },
  { id: 'PartAlternatesBrowserView', load: () => import('@/components/views/PartAlternatesBrowserView') },
  { id: 'PartUsageBrowserView', load: () => import('@/components/views/PartUsageBrowserView') },
  { id: 'VaultBrowserView', load: () => import('@/components/views/VaultBrowserView') },
];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

// axe config — skip rules that are meaningless in happy-dom or out of our control.
const axeConfig = {
  rules: {
    'color-contrast': { enabled: false }, // no real layout in happy-dom
    'region': { enabled: false },          // views render as fragments, not full pages
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
    'html-has-lang': { enabled: false },
    'document-title': { enabled: false },
    'html-lang-valid': { enabled: false },
    'meta-viewport': { enabled: false },
  },
} as const;

type ViewResult =
  | { id: string; status: 'rendered'; violations: Result[] }
  | { id: string; status: 'render-failed'; error: string };

const results: ViewResult[] = [];

// Set a reasonable timeout; axe analysis can be slow across 26 views.
beforeAll(() => {
  // Stub matchMedia, ResizeObserver, IntersectionObserver used by various views.
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof globalThis.matchMedia;
  }
  class RO { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
    root = null; rootMargin = ''; thresholds = [];
  } as unknown as typeof IntersectionObserver;
});

describe('a11y — workspace views (finding #343)', () => {
  for (const entry of views) {
    it(`${entry.id}: renders and has no serious/critical a11y violations`, async () => {
      let mod: { default: React.ComponentType<Record<string, unknown>> };
      try {
        mod = await entry.load();
      } catch (err) {
        results.push({ id: entry.id, status: 'render-failed', error: String(err) });
        // Record as a finding; don't throw — import failure is its own problem.
        expect.soft(false, `Failed to import ${entry.id}: ${String(err)}`).toBe(true);
        return;
      }

      const Component = mod.default;
      const qc = makeClient();
      let container: HTMLElement;
      try {
        const renderResult = render(
          <QueryClientProvider client={qc}>
            <Component {...(entry.props ?? {})} />
          </QueryClientProvider>,
        );
        container = renderResult.container;
      } catch (err) {
        results.push({ id: entry.id, status: 'render-failed', error: String(err) });
        expect.soft(false, `Failed to render ${entry.id}: ${String(err)}`).toBe(true);
        return;
      }

      let axeResults: AxeResults;
      try {
        axeResults = (await axe(container, axeConfig)) as unknown as AxeResults;
      } catch (err) {
        results.push({ id: entry.id, status: 'render-failed', error: `axe failure: ${String(err)}` });
        expect.soft(false, `axe threw on ${entry.id}: ${String(err)}`).toBe(true);
        return;
      }

      results.push({ id: entry.id, status: 'rendered', violations: axeResults.violations });

      const bad = axeResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      if (bad.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[a11y] ${entry.id} — ${bad.length} serious/critical violations:`,
          bad.map((b) => `${b.id} (${b.impact}): ${b.description}`),
        );
      }
      expect(bad).toEqual([]);
    });
  }

  it('prints a per-view a11y summary', () => {
    // This test always passes; it exists to emit a readable snapshot of results.
    const summary = results.map((r) => {
      if (r.status === 'render-failed') {
        return `${r.id}: RENDER-FAILED (${r.error.split('\n')[0].slice(0, 80)})`;
      }
      const counts = r.violations.reduce<Record<string, number>>((acc, v) => {
        const k = v.impact ?? 'unknown';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      return `${r.id}: ${JSON.stringify(counts)}`;
    });
    // eslint-disable-next-line no-console
    console.log(['[a11y summary]', ...summary].join('\n  '));
    expect(results.length).toBeGreaterThan(0);
  });
});
