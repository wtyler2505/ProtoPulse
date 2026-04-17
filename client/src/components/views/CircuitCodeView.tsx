/**
 * CircuitCodeView — Split-pane layout for code-driven circuit design.
 *
 * Left panel: Code editor (CodeMirror 6)
 * Right panel: Live schematic preview
 * Bottom: Collapsible error panel + status bar
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EvalError } from '@/lib/circuit-dsl/use-circuit-evaluator';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!layout) throw new Error('No valid layout to apply');
      const res = await apiRequest('POST', `/api/projects/${projectId}/circuits/apply-code`, { layout });
      return res.json() as Promise<{ success: boolean; circuitId: number }>;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['circuit-designs', projectId] });
      toast({ title: 'Applied to project', description: `Created circuit design #${data.circuitId}` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to apply', description: err.message, variant: 'destructive' });
    }
  });

  const debouncedEval = useDebouncedCallback(evaluate, 300);

  useEffect(() => {
    evaluate(STARTER_TEMPLATE);
  }, [evaluate]);

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
        <span className="ml-auto flex items-center gap-3">
          {isEvaluating ? (
            <span className="text-[var(--color-editor-accent)]">Evaluating...</span>
          ) : (
            'Ready'
          )}
          <Button
            size="sm"
            className="h-6 text-[10px] uppercase font-bold tracking-wider"
            disabled={!layout || isEvaluating || applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
            data-testid="button-apply-circuit-code"
          >
            {applyMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Apply to Project
          </Button>
        </span>
      </div>
    </div>
  );
}
