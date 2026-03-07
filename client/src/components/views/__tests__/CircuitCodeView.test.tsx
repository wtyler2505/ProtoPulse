import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — these modules are being built by other teammates in parallel
// ---------------------------------------------------------------------------

const mockEvaluate = vi.fn();
let mockEvaluatorReturn = {
  ir: null as null | { components: { id: string }[]; nets: { id: string }[] },
  error: null as null | { message: string; line?: number },
  isEvaluating: false,
  evaluate: mockEvaluate,
};

vi.mock('@/lib/circuit-dsl/use-circuit-evaluator', () => ({
  useCircuitEvaluator: () => mockEvaluatorReturn,
}));

vi.mock('@/lib/circuit-dsl/circuit-lang', () => ({
  STARTER_TEMPLATE: `// Starter template\nconst c = circuit('My Circuit');\n`,
}));

vi.mock('@/lib/circuit-dsl/ir-to-schematic', () => ({
  irToSchematicLayout: vi.fn().mockReturnValue(null),
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

import CircuitCodeView from '../CircuitCodeView';

describe('CircuitCodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluatorReturn = {
      ir: null,
      error: null,
      isEvaluating: false,
      evaluate: mockEvaluate,
    };
  });

  it('renders with code editor area and preview area', () => {
    render(<CircuitCodeView />);

    expect(screen.getByTestId('circuit-code-view')).toBeDefined();
    expect(screen.getByTestId('circuit-code-editor')).toBeDefined();
    expect(screen.getByTestId('schematic-preview')).toBeDefined();
  });

  it('shows starter template as initial code', () => {
    render(<CircuitCodeView />);

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Starter template');
  });

  it('shows status bar with component/net counts', () => {
    render(<CircuitCodeView />);

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

    render(<CircuitCodeView />);

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('3 components');
    expect(statusBar.textContent).toContain('2 nets');
  });

  it('shows "Ready" status when not evaluating', () => {
    render(<CircuitCodeView />);

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('Ready');
  });

  it('shows "Evaluating..." status when evaluating', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      isEvaluating: true,
    };

    render(<CircuitCodeView />);

    const statusBar = screen.getByTestId('circuit-code-status-bar');
    expect(statusBar.textContent).toContain('Evaluating...');
  });

  it('shows error panel when there are evaluation errors', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      error: { message: 'Unexpected token at line 5', line: 5 },
    };

    render(<CircuitCodeView />);

    const errorPanel = screen.getByTestId('circuit-code-error-panel');
    expect(errorPanel).toBeDefined();
    expect(errorPanel.textContent).toContain('Unexpected token at line 5');
    expect(errorPanel.textContent).toContain('[Ln 5]');
  });

  it('hides error panel when there are no errors', () => {
    render(<CircuitCodeView />);

    expect(screen.queryByTestId('circuit-code-error-panel')).toBeNull();
  });

  it('"No components" placeholder shown in preview when code produces no IR', () => {
    render(<CircuitCodeView />);

    expect(screen.getByTestId('preview-no-components')).toBeDefined();
  });

  it('triggers debounced evaluation on code change', () => {
    vi.useFakeTimers();
    render(<CircuitCodeView />);

    const textarea = screen.getByTestId('code-editor-textarea') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(textarea, { target: { value: 'const c = circuit("test");' } });
    });

    // Should not evaluate immediately (debounced)
    expect(mockEvaluate).not.toHaveBeenCalled();

    // Advance past debounce delay
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockEvaluate).toHaveBeenCalledWith('const c = circuit("test");');

    vi.useRealTimers();
  });

  it('shows error severity icon and line number in error panel', () => {
    mockEvaluatorReturn = {
      ...mockEvaluatorReturn,
      error: { message: 'SyntaxError: unexpected }', line: 12 },
    };

    render(<CircuitCodeView />);

    const errorPanel = screen.getByTestId('circuit-code-error-panel');
    expect(errorPanel.textContent).toContain('[Ln 12]');
    expect(errorPanel.textContent).toContain('SyntaxError: unexpected }');
    // Should have an error icon
    expect(errorPanel.querySelector('[data-testid="error-severity-icon"]')).toBeDefined();
  });
});
