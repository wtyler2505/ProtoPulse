/**
 * CircuitCodeView — Split-pane layout for code-driven circuit design.
 *
 * Left panel: Code editor (CodeMirror 6)
 * Right panel: Live schematic preview
 * Bottom: Collapsible error panel + status bar
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { STARTER_TEMPLATE } from '@/lib/circuit-dsl/circuit-lang';
import { useCircuitEvaluator } from '@/lib/circuit-dsl/use-circuit-evaluator';
import { irToSchematicLayout } from '@/lib/circuit-dsl/ir-to-schematic';
import CodeEditor from '@/components/views/circuit-code/CodeEditor';
import { SchematicPreview } from '@/components/views/circuit-code/SchematicPreview';
import type { CodeEditorHandle } from '@/components/views/circuit-code/CodeEditor';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import type { EvalError } from '@/lib/circuit-dsl/use-circuit-evaluator';

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebouncedCallback(fn: (code: string) => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return useCallback(
    (code: string) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fn(code);
      }, delay);
    },
    [fn, delay],
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CircuitCodeView() {
  const [code, setCode] = useState(STARTER_TEMPLATE);
  const editorRef = useRef<CodeEditorHandle>(null);
  const { ir, error, isEvaluating, evaluate } = useCircuitEvaluator();
  const layout = useMemo(() => (ir ? irToSchematicLayout(ir) : null), [ir]);

  const debouncedEval = useDebouncedCallback(evaluate, 300);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      debouncedEval(newCode);
    },
    [debouncedEval],
  );

  const componentCount = ir?.components.length ?? 0;
  const netCount = ir?.nets.length ?? 0;
  const errors: EvalError[] = error ? [error] : [];

  return (
    <div data-testid="circuit-code-view" className="flex h-full flex-col bg-background">
      {/* Main split: code editor | schematic preview */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={25}>
          <CodeEditor ref={editorRef} value={code} onChange={handleCodeChange} errors={errors} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={25}>
          <SchematicPreview layout={layout} isEvaluating={isEvaluating} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Error panel — only shown when errors exist */}
      {error && (
        <div
          data-testid="circuit-code-error-panel"
          className={cn(
            'border-t border-destructive/30 bg-destructive/5 px-4 py-2',
            'max-h-40 overflow-y-auto',
          )}
        >
          <button
            type="button"
            data-testid="error-panel-go-to-line"
            className={cn(
              'flex w-full items-start gap-2 text-left text-sm',
              error.line != null && 'cursor-pointer hover:bg-destructive/10 rounded -mx-1 px-1',
            )}
            onClick={() => {
              if (error.line != null) {
                editorRef.current?.goToLine(error.line);
              }
            }}
          >
            <AlertCircle
              data-testid="error-severity-icon"
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            />
            <div className="flex-1">
              {error.line != null && (
                <span className="mr-2 font-mono text-muted-foreground">[Ln {error.line}]</span>
              )}
              <span className="text-destructive">{error.message}</span>
            </div>
          </button>
        </div>
      )}

      {/* Status bar */}
      <div
        data-testid="circuit-code-status-bar"
        className={cn(
          'flex items-center gap-4 border-t border-border px-4 py-1.5',
          'text-xs text-muted-foreground',
        )}
      >
        <span>{componentCount} components</span>
        <span>{netCount} nets</span>
        <span className="ml-auto">
          {isEvaluating ? (
            <span className="text-[#00F0FF]">Evaluating...</span>
          ) : (
            'Ready'
          )}
        </span>
      </div>
    </div>
  );
}
