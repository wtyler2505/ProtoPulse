/**
 * CircuitCodeView — Split-pane layout for code-driven circuit design.
 *
 * Left panel: Code editor (CodeMirror 6)
 * Right panel: Live schematic preview
 * Bottom: Collapsible error panel + status bar
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';
import { STARTER_TEMPLATE } from '@/lib/circuit-dsl/circuit-lang';
import { useCircuitEvaluator } from '@/lib/circuit-dsl/use-circuit-evaluator';
import { irToSchematicLayout } from '@/lib/circuit-dsl/ir-to-schematic';
import type { SchematicLayout } from '@/lib/circuit-dsl/ir-to-schematic';
import CodeEditor from '@/components/views/circuit-code/CodeEditor';
import { SchematicPreview } from '@/components/views/circuit-code/SchematicPreview';
import type { CodeEditorHandle } from '@/components/views/circuit-code/CodeEditor';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EvalError } from '@/lib/circuit-dsl/use-circuit-evaluator';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { downloadBlob } from '@/lib/csv';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';

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

const RADIAL_CIRCUIT_SNIPPET = `// Radial snippet: add a status LED branch
const D_RADIAL = c.led({ refdes: "D_RADIAL" });
const R_RADIAL = c.resistor({ value: "220", refdes: "R_RADIAL" });
const radialStatus = c.net("RADIAL_STATUS");
c.connect(radialStatus, R_RADIAL.pin(1));
c.connect(R_RADIAL.pin(2), D_RADIAL.pin("anode"));
c.connect(D_RADIAL.pin("cathode"), gnd);
`;

function insertRadialCircuitSnippet(source: string): string {
  if (source.includes('D_RADIAL') || source.includes('RADIAL_STATUS')) {
    return source;
  }

  const trimmed = source.trimEnd();
  if (/\nc\.export\(\);\s*$/.test(trimmed)) {
    return trimmed.replace(/\nc\.export\(\);\s*$/, `\n\n${RADIAL_CIRCUIT_SNIPPET}\nc.export();\n`);
  }

  return `${trimmed}\n\n${RADIAL_CIRCUIT_SNIPPET}`;
}

function normalizeCircuitCodeSource(source: string): string {
  return `${source.trimEnd()}\n`;
}

interface ApplyPreviewSummary {
  componentCount: number;
  netCount: number;
  wireSegmentCount: number;
  previewComponents: SchematicLayout['components'];
}

function buildApplyPreviewSummary(layout: SchematicLayout): ApplyPreviewSummary {
  return {
    componentCount: layout.components.length,
    netCount: layout.nets.length,
    wireSegmentCount: layout.nets.reduce((total, net) => total + net.segments.length, 0),
    previewComponents: layout.components.slice(0, 4),
  };
}

function CircuitCodeApplyPreview({
  layout,
  isApplying,
  onCancel,
  onConfirm,
}: {
  layout: SchematicLayout;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = useMemo(() => buildApplyPreviewSummary(layout), [layout]);
  const hiddenComponentCount = Math.max(0, summary.componentCount - summary.previewComponents.length);

  return (
    <section
      data-testid="circuit-code-apply-preview"
      aria-live="polite"
      className="border-t border-primary/30 bg-primary/5 px-3.5 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Apply consequence preview</span>
            <span
              data-testid="circuit-code-apply-preview-source"
              className="inline-flex items-center gap-1 rounded border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              <ShieldCheck className="h-3 w-3 text-primary" />
              Local editor source
            </span>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
            Confirming will create a new circuit design from the current DSL preview. Existing project circuits are not
            deleted or replaced by this action.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px]" data-testid="circuit-code-apply-preview-summary">
            <span className="rounded border border-border bg-background/70 px-2 py-1 text-foreground">
              1 circuit design
            </span>
            <span className="rounded border border-border bg-background/70 px-2 py-1 text-foreground">
              {summary.componentCount} component{summary.componentCount === 1 ? '' : 's'}
            </span>
            <span className="rounded border border-border bg-background/70 px-2 py-1 text-foreground">
              {summary.netCount} net{summary.netCount === 1 ? '' : 's'}
            </span>
            <span className="rounded border border-border bg-background/70 px-2 py-1 text-foreground">
              {summary.wireSegmentCount} wire segment{summary.wireSegmentCount === 1 ? '' : 's'}
            </span>
          </div>
          {summary.previewComponents.length > 0 && (
            <div
              data-testid="circuit-code-apply-preview-components"
              className="grid max-h-32 gap-1 overflow-y-auto rounded border border-border/70 bg-background/60 p-2 text-[11px]"
            >
              {summary.previewComponents.map((component) => (
                <div
                  key={component.id}
                  data-testid={`circuit-code-apply-preview-component-${component.id}`}
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                  <span className="font-semibold text-foreground">{component.refdes}</span>
                  {component.value && <span className="truncate text-muted-foreground">{component.value}</span>}
                  <span className="text-muted-foreground">
                    {component.pins.length} pin{component.pins.length === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
              {hiddenComponentCount > 0 && (
                <span className="text-muted-foreground">
                  +{hiddenComponentCount} more component{hiddenComponentCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isApplying}
            onClick={onCancel}
            data-testid="circuit-code-apply-preview-cancel"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
          <Button size="sm" disabled={isApplying} onClick={onConfirm} data-testid="circuit-code-apply-preview-confirm">
            {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Confirm apply
          </Button>
        </div>
      </div>
    </section>
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
  const [showApplyPreview, setShowApplyPreview] = useState(false);

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
      setShowApplyPreview(false);
      void queryClient.invalidateQueries({ queryKey: ['circuit-designs', projectId] });
      toast({ title: 'Applied to project', description: `Created circuit design #${data.circuitId}` });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to apply', description: message, variant: 'destructive' });
    },
  });

  const debouncedEval = useDebouncedCallback(evaluate, 300);

  useEffect(() => {
    evaluate(STARTER_TEMPLATE);
  }, [evaluate]);

  useEffect(() => {
    setShowApplyPreview(false);
  }, [layout]);

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

  const handleRequestApply = () => {
    if (!layout || isEvaluating || applyMutation.isPending) {
      return;
    }
    setShowApplyPreview(true);
  };

  const handleConfirmApply = () => {
    if (!layout || isEvaluating || applyMutation.isPending) {
      return;
    }
    applyMutation.mutate();
  };

  const handleAiFirmwareReview = useCallback(
    (detail: RadialCommandEventDetail): void => {
      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const codePreview = code.split('\n').slice(0, 40);
      const sections: RadialAiPromptSection[] = [
        {
          title: 'Circuit code state',
          lines: [
            `Components: ${String(componentCount)}`,
            `Nets: ${String(netCount)}`,
            `Evaluation: ${isEvaluating ? 'running' : error ? 'error' : 'ready'}`,
            `Apply preview available: ${layout ? 'yes' : 'no'}`,
          ],
        },
        {
          title: 'Current evaluation issue',
          lines: error
            ? [`${error.line != null ? `Line ${String(error.line)}: ` : ''}${error.message}`]
            : ['No evaluation issue is visible.'],
        },
        {
          title: 'Code preview',
          lines: codePreview.length > 0 ? codePreview : ['No source code is available.'],
        },
      ];

      runRadialAiCommand({
        intent: 'firmware_review',
        intro:
          'Review this ProtoPulse circuit-code firmware surface like a careful embedded systems mentor. Focus on source trust, generated circuit intent, compile/apply readiness, and safe next bench steps.',
        summary: `Circuit code firmware review: ${String(componentCount)} components, ${String(netCount)} nets, ${error ? 'has evaluation issue' : 'ready state'}.`,
        historyLabel: 'Circuit code firmware review',
        context: detail.context,
        delivery,
        targetDetails: [
          `Project id: ${String(projectId)}`,
          `Source: local DSL editor`,
          `Confirm before project write: yes`,
        ],
        sections,
        finalInstruction:
          'Give Tyler a compact review: what this code appears to create, whether it is safe to apply, the highest-risk line or assumption, and the next check before hardware work.',
      });
      toast({
        title: `AI Firmware Review ${deliveryVerb}`,
        description:
          delivery === 'send-now'
            ? 'Sent circuit-code firmware review to AI chat.'
            : 'Drafted circuit-code firmware review in AI chat.',
      });
    },
    [code, componentCount, error, isEvaluating, layout, netCount, projectId, toast],
  );

  const handleRadialCommand = useCallback(
    (detail: RadialCommandEventDetail): boolean => {
      if (detail.source !== 'radial-menu' || detail.context.view !== 'firmware') {
        return false;
      }

      switch (detail.commandId) {
        case 'add_firmware_snippet': {
          const nextCode = insertRadialCircuitSnippet(code);
          handleCodeChange(nextCode);
          toast({ title: 'Circuit snippet inserted', description: 'Status LED branch added before export.' });
          return true;
        }
        case 'ai_firmware_review':
          handleAiFirmwareReview(detail);
          return true;
        case 'format_firmware': {
          const formatted = normalizeCircuitCodeSource(code);
          if (formatted !== code) {
            handleCodeChange(formatted);
          }
          toast({ title: 'Circuit code formatted', description: 'Trailing whitespace normalized for export.' });
          return true;
        }
        case 'open_firmware_review':
          if (!layout || isEvaluating || applyMutation.isPending) {
            toast({
              title: 'Apply preview unavailable',
              description: 'Fix evaluation errors or wait for the current operation before reviewing apply.',
              variant: 'destructive',
            });
          } else {
            setShowApplyPreview(true);
            toast({
              title: 'Apply preview opened',
              description: 'Review generated circuit consequences before writing.',
            });
          }
          return true;
        case 'compile_firmware':
          evaluate(code);
          toast({ title: 'Circuit code evaluated', description: 'The live schematic preview is refreshing.' });
          return true;
        case 'open_firmware_console': {
          const statusBar =
            document.querySelector<HTMLElement>('[data-testid="circuit-code-error-panel"]') ??
            document.querySelector<HTMLElement>('[data-testid="circuit-code-status-bar"]');
          statusBar?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
          statusBar?.focus?.({ preventScroll: true });
          toast({
            title: 'Circuit code status',
            description: error ? 'Evaluation error output is centered.' : 'Status and apply controls are centered.',
          });
          return true;
        }
        case 'firmware_settings': {
          const sourceTrust = document.querySelector<HTMLElement>('[data-testid="circuit-code-source-trust"]');
          sourceTrust?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
          sourceTrust?.focus?.({ preventScroll: true });
          toast({ title: 'Circuit code settings', description: 'Source trust and apply controls are centered.' });
          return true;
        }
        case 'export_firmware': {
          const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
          void downloadBlob(blob, `protopulse-circuit-code-${projectId}.ts`);
          toast({ title: 'Circuit code exported', description: 'Current DSL source was downloaded.' });
          return true;
        }
        default:
          return false;
      }
    },
    [
      applyMutation.isPending,
      code,
      error,
      evaluate,
      handleAiFirmwareReview,
      handleCodeChange,
      isEvaluating,
      layout,
      projectId,
      toast,
    ],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail) {
        return;
      }
      if (handleRadialCommand(detail)) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [handleRadialCommand]);

  return (
    <div data-testid="circuit-code-view" className="flex h-full flex-col bg-background">
      {/* Main split: code editor | schematic preview */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={25}>
          <CodeEditor ref={editorRef} value={code} onChange={handleCodeChange} errors={errors} />
        </ResizablePanel>

        <ResizableHandle
          withHandle
          aria-label="Resize circuit code and schematic preview panels"
          // react-resizable-panels renders the handle as role="separator" and
          // sets aria-valuenow/min/max imperatively from a layout effect
          // (useWindowSplitterPanelGroupBehavior). That effect needs real DOM
          // measurement, so before it commits — and in environments without
          // layout (happy-dom, SSR) or for a screen reader reading the handle on
          // first paint — the separator has no aria-valuenow, which WCAG 4.1.2
          // (aria-required-attr) flags as a critical violation. Seed the value
          // attributes from the panel constraints so the separator is valid from
          // first render. These match calculateAriaValues for this group
          // (left panel defaultSize=50, minSize=25; right panel minSize=25 →
          // valuemin=max(25,0)=25, valuemax=min(100,75)=75, valuenow=50). The
          // library overwrites them with live values once its effect runs.
          aria-valuenow={50}
          aria-valuemin={25}
          aria-valuemax={75}
        />

        <ResizablePanel defaultSize={50} minSize={25}>
          <SchematicPreview layout={layout} isEvaluating={isEvaluating} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <div
        data-testid="circuit-code-source-trust"
        className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">Source trust:</span>
        <span>local DSL editor, live-previewed from parsed circuit code</span>
        <span className="rounded border border-border bg-background/70 px-2 py-0.5 text-[11px] text-foreground">
          confirm before project write
        </span>
      </div>

      {showApplyPreview && layout && (
        <CircuitCodeApplyPreview
          layout={layout}
          isApplying={applyMutation.isPending}
          onCancel={() => {
            setShowApplyPreview(false);
          }}
          onConfirm={handleConfirmApply}
        />
      )}

      {/* Error panel — only shown when errors exist */}
      {error && (
        <div
          data-testid="circuit-code-error-panel"
          className={cn('border-t border-destructive/30 bg-destructive/5 px-3.5 py-2', 'max-h-40 overflow-y-auto')}
        >
          <button
            type="button"
            data-testid="error-panel-go-to-line"
            className={cn(
              'flex w-full items-start gap-2.5 text-left text-sm',
              error.line != null && 'cursor-pointer hover:bg-destructive/10 rounded -mx-1 px-1',
            )}
            onClick={() => {
              if (error.line != null) {
                editorRef.current?.goToLine(error.line);
              }
            }}
          >
            <AlertCircle data-testid="error-severity-icon" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              {error.line != null && <span className="mr-2 font-mono text-muted-foreground">[Ln {error.line}]</span>}
              <span className="text-destructive">{error.message}</span>
            </div>
          </button>
        </div>
      )}

      {/* Status bar */}
      <div
        data-testid="circuit-code-status-bar"
        className={cn('flex items-center gap-4 border-t border-border px-3.5 py-2', 'text-xs text-muted-foreground')}
      >
        <span>{componentCount} components</span>
        <span>{netCount} nets</span>
        <span className="ml-auto flex items-center gap-3">
          {isEvaluating ? <span className="text-[var(--color-editor-accent)]">Evaluating...</span> : 'Ready'}
          <Button
            size="sm"
            className="h-8 px-3 text-[11px] font-semibold"
            disabled={!layout || isEvaluating || applyMutation.isPending}
            onClick={handleRequestApply}
            data-testid="button-apply-circuit-code"
          >
            {applyMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Review apply
          </Button>
        </span>
      </div>
    </div>
  );
}
