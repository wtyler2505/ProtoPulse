import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — these modules are being built by other teammates in parallel
// ---------------------------------------------------------------------------

const mockEvaluate = vi.fn();
const mockApiRequest = vi.fn();
const mockToast = vi.fn();
const mockDownloadBlob = vi.fn();
let mockEvaluatorReturn = {
  ir: null as null | { components: { id: string }[]; nets: { id: string }[] },
  error: null as null | { message: string; line?: number },
  isEvaluating: false,
  evaluate: mockEvaluate,
};
let mockLayout: null | {
  components: Array<{
    id: string;
    refdes: string;
    value?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pins: Array<{ name: string; x: number; y: number; netId: string }>;
  }>;
  nets: Array<{
    netId: string;
    name: string;
    type: 'signal' | 'power' | 'ground';
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  }>;
  width: number;
  height: number;
} = null;

vi.mock('@/lib/circuit-dsl/use-circuit-evaluator', () => ({
  useCircuitEvaluator: () => mockEvaluatorReturn,
}));

vi.mock('@/lib/circuit-dsl/circuit-lang', () => ({
  STARTER_TEMPLATE: `// Starter template\nconst c = circuit('My Circuit');\n`,
}));

vi.mock('@/lib/circuit-dsl/ir-to-schematic', () => ({
  irToSchematicLayout: vi.fn(() => mockLayout),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/csv', () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}));

vi.mock('@/components/views/circuit-code/CodeEditor', () => ({
  default: (props: { value: string; onChange: (v: string) => void; errors: unknown[] }) => (
    <div data-testid="circuit-code-editor">
      <textarea
        data-testid="code-editor-textarea"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.errors.length > 0 && <span data-testid="editor-has-errors" />}
    </div>
  ),
}));

vi.mock('@/components/views/circuit-code/SchematicPreview', () => ({
  SchematicPreview: (props: { layout: unknown; isEvaluating: boolean }) => (
    <div data-testid="schematic-preview">
      {props.isEvaluating && <span data-testid="preview-evaluating" />}
      {!props.layout && !props.isEvaluating && <span data-testid="preview-no-components" />}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Import under test (AFTER mocks)
// ---------------------------------------------------------------------------

import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import CircuitCodeView from '../CircuitCodeView';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

function renderView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ProjectIdProvider projectId={1}>
        <CircuitCodeView />
      </ProjectIdProvider>
    </QueryClientProvider>,
  );
}

function dispatchFirmwareRadial(commandId: string): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: { view: 'firmware', target: 'canvas' },
    source: 'radial-menu',
  };

  act(() => {
    window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  });

  return detail;
}

describe('CircuitCodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadBlob.mockResolvedValue(undefined);
    mockApiRequest.mockResolvedValue({ json: async () => ({ success: true, circuitId: 42 }) });
    mockLayout = null;
    mockEvaluatorReturn = {
      ir: null,
      error: null,
      isEvaluating: false,
      evaluate: mockEvaluate,
    };
  });

  it('renders with code editor area and preview area', () => {
    renderView();

    expect(screen.getByTestId('circuit-code-view')).toBeDefined();
    expect(screen.getByTestId('circuit-code-editor')).toBeDefined();
    expect(screen.getByTestId('schematic-preview')).toBeDefined();
  });

  it('shows starter template as initial code', () => {
    renderView();

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Starter template');
  });

  it('shows status bar with component/net counts', () => {
    renderView();

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar).toBeDefined();
    expect(statusBar.textContent).toContain('0 components');
    expect(statusBar.textContent).toContain('0 nets');
  });

  it('shows component and net counts from IR', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      ir: {
        components: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
        nets: [{ id: 'n1' }, { id: 'n2' }],
      },
    };

    renderView();

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('3 components');
    expect(statusBar.textContent).toContain('2 nets');
  });

  it('shows source trust context for the local DSL editor', () => {
    renderView();

    const sourceTrust = screen.getByTestId('circuit-code-source-trust');
    expect(sourceTrust.textContent).toContain('Source trust');
    expect(sourceTrust.textContent).toContain('local DSL editor');
    expect(sourceTrust.textContent).toContain('confirm before project write');
  });

  it('shows "Ready" status when not evaluating', () => {
    renderView();

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('Ready');
  });

  it('shows "Evaluating..." status when evaluating', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      isEvaluating: true,
    };

    renderView();

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('Evaluating...');
  });

  it('shows error panel when there are evaluation errors', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      error: { message: 'Unexpected token at line 5', line: 5 },
    };

    renderView();

    const errorPanel = screen.getByTestId('circuit-code-error-panel');
    expect(errorPanel).toBeDefined();
    expect(errorPanel.textContent).toContain('Unexpected token at line 5');
    expect(errorPanel.textContent).toContain('[Ln 5]');
  });

  it('hides error panel when there are no errors', () => {
    renderView();

    expect(screen.queryByTestId('circuit-code-error-panel')).toBeNull();
  });

  it('"No components" placeholder shown in preview when code produces no IR', () => {
    renderView();

    expect(screen.getByTestId('preview-no-components')).toBeDefined();
  });

  it('evaluates the starter template on initial mount', () => {
    renderView();

    expect(mockEvaluate).toHaveBeenCalledWith("// Starter template\nconst c = circuit('My Circuit');\n");
  });

  it('triggers debounced evaluation on code change', () => {
    vi.useFakeTimers();
    renderView();

    expect(mockEvaluate).toHaveBeenCalledTimes(1);

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(textarea, { target: { value: 'const c = circuit("test");' } });
    });

    // Should not evaluate the changed code immediately (debounced)
    expect(mockEvaluate).toHaveBeenCalledTimes(1);

    // Advance past debounce delay
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockEvaluate).toHaveBeenCalledWith('const c = circuit("test");');
    expect(mockEvaluate).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('opens an apply consequence preview before mutating the project', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      ir: {
        components: [{ id: 'r1' }, { id: 'led1' }],
        nets: [{ id: 'net-vcc' }, { id: 'net-gnd' }],
      },
    };
    mockLayout = {
      components: [
        {
          id: 'r1',
          refdes: 'R1',
          value: '220 ohm',
          x: 40,
          y: 40,
          width: 120,
          height: 60,
          pins: [
            { name: '1', x: 40, y: 55, netId: 'net-vcc' },
            { name: '2', x: 160, y: 55, netId: 'net-signal' },
          ],
        },
        {
          id: 'led1',
          refdes: 'D1',
          value: 'red LED',
          x: 240,
          y: 40,
          width: 120,
          height: 60,
          pins: [
            { name: 'A', x: 240, y: 55, netId: 'net-signal' },
            { name: 'K', x: 360, y: 55, netId: 'net-gnd' },
          ],
        },
      ],
      nets: [
        {
          netId: 'net-vcc',
          name: 'VCC',
          type: 'power',
          segments: [{ x1: 0, y1: 0, x2: 40, y2: 55 }],
        },
        {
          netId: 'net-gnd',
          name: 'GND',
          type: 'ground',
          segments: [
            { x1: 360, y1: 55, x2: 400, y2: 55 },
            { x1: 400, y1: 55, x2: 400, y2: 100 },
          ],
        },
      ],
      width: 420,
      height: 140,
    };

    renderView();

    fireEvent.click(screen.getByTestId('button-apply-circuit-code'));

    const preview = screen.getByTestId('circuit-code-apply-preview');
    expect(preview.textContent).toContain('Apply consequence preview');
    expect(screen.getByTestId('circuit-code-apply-preview-summary').textContent).toContain('1 circuit design');
    expect(screen.getByTestId('circuit-code-apply-preview-summary').textContent).toContain('2 components');
    expect(screen.getByTestId('circuit-code-apply-preview-summary').textContent).toContain('2 nets');
    expect(screen.getByTestId('circuit-code-apply-preview-summary').textContent).toContain('3 wire segments');
    expect(screen.getByTestId('circuit-code-apply-preview-component-r1').textContent).toContain('R1');
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('applies code only after preview confirmation', async () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      ir: {
        components: [{ id: 'r1' }],
        nets: [{ id: 'net-vcc' }],
      },
    };
    mockLayout = {
      components: [
        {
          id: 'r1',
          refdes: 'R1',
          value: '220 ohm',
          x: 40,
          y: 40,
          width: 120,
          height: 60,
          pins: [{ name: '1', x: 40, y: 55, netId: 'net-vcc' }],
        },
      ],
      nets: [
        {
          netId: 'net-vcc',
          name: 'VCC',
          type: 'power',
          segments: [{ x1: 0, y1: 0, x2: 40, y2: 55 }],
        },
      ],
      width: 180,
      height: 120,
    };

    renderView();

    fireEvent.click(screen.getByTestId('button-apply-circuit-code'));
    expect(mockApiRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('circuit-code-apply-preview-confirm'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/projects/1/circuits/apply-code', {
        layout: mockLayout,
      });
    });
  });

  it('shows error severity icon and line number in error panel', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      error: { message: 'SyntaxError: unexpected }', line: 12 },
    };

    renderView();

    const errorPanel = screen.getByTestId('circuit-code-error-panel');
    expect(errorPanel.textContent).toContain('[Ln 12]');
    expect(errorPanel.textContent).toContain('SyntaxError: unexpected }');
    // Should have an error icon
    expect(errorPanel.querySelector('[data-testid="error-severity-icon"]')).toBeDefined();
  });

  it('handles radial snippet insertion for circuit firmware code', () => {
    renderView();

    const detail = dispatchFirmwareRadial('add_firmware_snippet');

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('D_RADIAL');
    expect(textarea.value).toContain('RADIAL_STATUS');
    expect(detail.handled).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Circuit snippet inserted' }));
  });

  it('drafts circuit-code firmware review context to AI chat from a radial command', () => {
    mockLayout = {
      components: [{ id: 'r1', refdes: 'R1', value: '220', x: 10, y: 10, width: 20, height: 8, pins: [] }],
      nets: [{ netId: 'n1', name: 'RADIAL_STATUS', type: 'signal', segments: [{ x1: 0, y1: 0, x2: 20, y2: 20 }] }],
      width: 180,
      height: 120,
    };
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      ir: { components: [{ id: 'r1' }], nets: [{ id: 'n1' }] },
    };
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      renderView();

      const detail = dispatchFirmwareRadial('ai_firmware_review');

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: firmware_review.');
      expect(message).toContain('Circuit code firmware review: 1 components, 1 nets');
      expect(message).toContain('Target: canvas "canvas"');
      expect(message).toContain('Circuit code state:');
      expect(message).toContain('Apply preview available: yes');
      expect(message).toContain('Code preview:');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Firmware Review Drafted' }));
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('handles radial firmware format by normalizing the current source', () => {
    renderView();

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'const x = 1;   \n\n' } });

    const detail = dispatchFirmwareRadial('format_firmware');

    expect(detail.handled).toBe(true);
    expect(textarea.value).toBe('const x = 1;\n');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Circuit code formatted' }));
  });

  it('opens a radial firmware review preview before apply', () => {
    mockLayout = {
      components: [{ id: 'r1', refdes: 'R1', value: '220', x: 10, y: 10, width: 20, height: 8, pins: [] }],
      nets: [{ netId: 'n1', name: 'RADIAL_STATUS', type: 'signal', segments: [{ x1: 0, y1: 0, x2: 20, y2: 20 }] }],
      width: 180,
      height: 120,
    };
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      ir: { components: [{ id: 'r1' }], nets: [{ id: 'n1' }] },
    };
    renderView();

    const detail = dispatchFirmwareRadial('open_firmware_review');

    expect(detail.handled).toBe(true);
    expect(screen.getByTestId('circuit-code-apply-preview')).toBeDefined();
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Apply preview opened' }));
  });

  it('handles radial compile by evaluating the current code', () => {
    renderView();

    mockEvaluate.mockClear();
    const detail = dispatchFirmwareRadial('compile_firmware');

    expect(detail.handled).toBe(true);
    expect(mockEvaluate).toHaveBeenCalledWith("// Starter template\nconst c = circuit('My Circuit');\n");
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Circuit code evaluated' }));
  });

  it('opens radial firmware status output', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      error: { message: 'SyntaxError: unexpected }', line: 12 },
    };
    renderView();

    const detail = dispatchFirmwareRadial('open_firmware_console');

    expect(detail.handled).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Circuit code status',
        description: 'Evaluation error output is centered.',
      }),
    );
  });

  it('handles radial firmware export by downloading the current DSL source', () => {
    renderView();

    const detail = dispatchFirmwareRadial('export_firmware');

    expect(detail.handled).toBe(true);
    expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'protopulse-circuit-code-1.ts');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Circuit code exported' }));
  });
});
