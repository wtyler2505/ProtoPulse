import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockGenerateWithAi = vi.fn();
const mockCreateCircuit = vi.fn();
const mockExpandArchitecture = vi.fn();
const mockPushToPcb = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => ({}),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({
    data: [
      {
        id: 7,
        name: 'Main Circuit',
        projectId: 1,
      },
    ],
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCircuitInstances: () => ({
    data: [],
  }),
  useCreateCircuitDesign: () => ({
    mutateAsync: mockCreateCircuit,
    isPending: false,
  }),
  useExpandArchitecture: () => ({
    mutateAsync: mockExpandArchitecture,
    isPending: false,
  }),
  useGenerateCircuitWithAi: () => ({
    mutateAsync: mockGenerateWithAi,
    isPending: false,
  }),
  usePushToPcb: () => ({
    mutateAsync: mockPushToPcb,
    isPending: false,
  }),
}));

vi.mock('@/components/circuit-editor/SchematicCanvas', () => ({
  SchematicCanvasInner: ({ circuitId }: { circuitId: number }) => (
    <div data-testid="schematic-canvas">Canvas {String(circuitId)}</div>
  ),
}));

vi.mock('@/components/circuit-editor/ComponentPlacer', () => ({
  default: () => <div data-testid="component-placer">Component placer</div>,
}));

vi.mock('@/components/circuit-editor/PowerSymbolPalette', () => ({
  default: () => <div data-testid="power-symbol-palette">Power palette</div>,
}));

vi.mock('@/components/circuit-editor/ERCPanel', () => ({
  default: () => <div data-testid="erc-panel">ERC panel</div>,
}));

vi.mock('@/components/circuit-editor/HierarchicalSheetPanel', () => ({
  default: () => <div data-testid="hierarchical-sheet-panel">Sheets</div>,
}));

vi.mock('@/components/circuit-editor/SimulationScenarioPanel', () => ({
  default: () => <div data-testid="simulation-scenario-panel">Simulation</div>,
}));

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button onClick={onClick} {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

import SchematicView from '@/components/views/SchematicView';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderSchematicView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SchematicView />
    </QueryClientProvider>,
  );
}

describe('SchematicView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCircuit.mockResolvedValue({ id: 99, name: 'New Circuit' });
    mockExpandArchitecture.mockResolvedValue({ circuit: { id: 88, name: 'Expanded Circuit' } });
    mockPushToPcb.mockResolvedValue({ pushed: 0, alreadyPlaced: 0 });
  });

  it('renders an AI Generate entry point in the schematic toolbar', () => {
    renderSchematicView();

    expect(screen.getByTestId('button-open-ai-generate')).toBeInTheDocument();
  });

  it('surfaces a provisional exact-part workflow banner after AI generation', async () => {
    mockGenerateWithAi.mockResolvedValue({
      success: true,
      message: 'Circuit generated with provisional exact-part guidance',
      exactPartWorkflow: {
        authoritativeWiringAllowed: false,
        requestedExactParts: [
          {
            kind: 'candidate-match',
            message: 'RioRand Motor Controller: only a candidate exact part is available as Part #21. Placement may be provisional, but exact wiring is not authoritative yet.',
            recommendedDraftDescription: 'RioRand KJL-01 exact part draft',
            title: 'RioRand Motor Controller',
            topMatchPartId: 21,
          },
        ],
        summary: 'ProtoPulse generated the circuit, but at least one requested or placed exact board/module is still provisional.',
        usedParts: [
          {
            aiRule: 'This exact board/module is still a candidate.',
            authoritativeWiringAllowed: false,
            family: 'driver',
            level: 'mixed-source',
            partId: 21,
            placementMode: 'provisional-exact',
            referenceDesignator: 'U2',
            requiresVerification: true,
            status: 'candidate',
            summary: 'This board/module is still a candidate.',
            title: 'RioRand Motor Controller',
          },
        ],
        warnings: [
          'U2 uses candidate exact part "RioRand Motor Controller". Exact hookup guidance for this board/module remains provisional until verification is complete.',
        ],
      },
    });

    renderSchematicView();

    fireEvent.click(screen.getByTestId('button-open-ai-generate'));
    fireEvent.change(screen.getByTestId('textarea-ai-generate-description'), {
      target: {
        value: 'Add an Arduino Mega 2560 R3 and a RioRand motor controller for a first-pass bench test.',
      },
    });
    fireEvent.change(screen.getByTestId('input-ai-generate-api-key'), {
      target: { value: 'test-gemini-key' },
    });
    fireEvent.click(screen.getByTestId('button-ai-generate-submit'));

    await waitFor(() => {
      expect(mockGenerateWithAi).toHaveBeenCalledWith({
        apiKey: 'test-gemini-key',
        circuitId: 7,
        description: 'Add an Arduino Mega 2560 R3 and a RioRand motor controller for a first-pass bench test.',
      });
    });

    expect(await screen.findByTestId('schematic-ai-workflow-banner')).toBeInTheDocument();
    expect(screen.getByTestId('schematic-ai-workflow-badge').textContent).toContain('Provisional exact workflow');
    expect(screen.getByTestId('schematic-ai-workflow-summary').textContent).toContain('still provisional');
    expect(screen.getByTestId('schematic-ai-requested-exact-parts').textContent).toContain('RioRand Motor Controller');
    expect(screen.getByTestId('schematic-ai-used-parts').textContent).toContain('U2: RioRand Motor Controller');
    expect(screen.getByTestId('schematic-ai-workflow-warnings').textContent).toContain('candidate exact part');
    expect(mockToast).toHaveBeenCalled();
  });
});
