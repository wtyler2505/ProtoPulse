import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCreateCircuitDesign,
  useExpandArchitecture,
  useGenerateCircuitWithAi,
  usePushToPcb,
} from '@/lib/circuit-editor/hooks';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, CircuitBoard, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Cpu, Zap, ShieldCheck, GitBranchPlus, FileStack, RefreshCw, ChevronUp, History, ArrowRightToLine, Wand2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CircuitAiExactPartWorkflow } from '@shared/circuit-ai-types';
import type { CircuitDesignRow } from '@shared/schema';
import type { ERCViolation } from '@shared/circuit-types';
import { SchematicCanvasInner } from '@/components/circuit-editor/SchematicCanvas';
import ComponentPlacer from '@/components/circuit-editor/ComponentPlacer';
import PowerSymbolPalette from '@/components/circuit-editor/PowerSymbolPalette';
import ERCPanel from '@/components/circuit-editor/ERCPanel';
import HierarchicalSheetPanel from '@/components/circuit-editor/HierarchicalSheetPanel';
import SimulationScenarioPanel from '@/components/circuit-editor/SimulationScenarioPanel';
import { useToast } from '@/hooks/use-toast';

function SchematicViewContent() {
  const projectId = useProjectId();
  const { data: circuits, isLoading, isError, error, refetch } = useCircuitDesigns(projectId);
  const createMutation = useCreateCircuitDesign();
  const expandMutation = useExpandArchitecture();
  const generateAiMutation = useGenerateCircuitWithAi();
  const pushToPcbMutation = usePushToPcb();
  const { toast } = useToast();
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const [partsPanel, setPartsPanel] = useState(true);
  const [ercPanel, setErcPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'components' | 'power' | 'sheets' | 'sim'>('components');
  const [ercViolations, setErcViolations] = useState<ERCViolation[]>([]);
  const [highlightedViolationId, setHighlightedViolationId] = useState<string | null>(null);
  const [currentSimConfig, setCurrentSimConfig] = useState<Record<string, unknown>>({ analysisType: 'op' });
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiWorkflow, setAiWorkflow] = useState<CircuitAiExactPartWorkflow | null>(null);

  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;

  // Fetch instances for the active circuit to power the "Push to PCB" feature
  const { data: instances } = useCircuitInstances(activeCircuit?.id ?? 0);
  const unplacedInstances = instances?.filter((inst) => inst.pcbX == null || inst.pcbY == null) ?? [];

  const handleEnterSheet = useCallback((id: number) => {
    setActiveCircuitId(id);
  }, []);

  const handleGoToParent = useCallback(() => {
    if (activeCircuit?.parentDesignId) {
      setActiveCircuitId(activeCircuit.parentDesignId);
    }
  }, [activeCircuit]);

  const handleCreateCircuit = useCallback(async () => {
    const result = await createMutation.mutateAsync({ projectId, name: 'New Circuit' });
    setActiveCircuitId(result.id);
  }, [createMutation, projectId]);

  const handleExpandArchitecture = useCallback(async () => {
    const result = await expandMutation.mutateAsync({ projectId });
    setActiveCircuitId(result.circuit.id);
  }, [expandMutation, projectId]);

  const handleHighlightViolation = useCallback((violation: ERCViolation | null) => {
    setHighlightedViolationId(violation?.id ?? null);
  }, []);

  const handlePushToPcb = useCallback(async () => {
    if (!activeCircuit) { return; }
    try {
      const result = await pushToPcbMutation.mutateAsync({ circuitId: activeCircuit.id });
      setPushDialogOpen(false);
      toast({
        title: 'Pushed to PCB',
        description: `${String(result.pushed)} component${result.pushed === 1 ? '' : 's'} placed in unplaced area.${result.alreadyPlaced > 0 ? ` ${String(result.alreadyPlaced)} already placed.` : ''}`,
      });
    } catch (err) {
      toast({
        title: 'Push to PCB failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [activeCircuit, pushToPcbMutation, toast]);

  const handleGenerateWithAi = useCallback(async () => {
    if (!activeCircuit || aiPrompt.trim().length === 0 || aiApiKey.trim().length === 0) {
      return;
    }

    try {
      const result = await generateAiMutation.mutateAsync({
        circuitId: activeCircuit.id,
        description: aiPrompt.trim(),
        apiKey: aiApiKey.trim(),
      });
      setAiWorkflow(result.exactPartWorkflow ?? null);
      setAiDialogOpen(false);
      toast({
        title: result.exactPartWorkflow?.authoritativeWiringAllowed
          ? 'AI schematic generated'
          : 'AI schematic generated provisionally',
        description: result.exactPartWorkflow?.summary ?? result.message,
      });
    } catch (err) {
      toast({
        title: 'AI schematic generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [activeCircuit, aiApiKey, aiPrompt, generateAiMutation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="schematic-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" data-testid="schematic-error">
        <CircuitBoard className="w-10 h-10 text-destructive/60" />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load circuit designs'}
        </p>
        <button
          data-testid="retry-schematic"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-muted hover:bg-muted/80 hover:text-foreground text-muted-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!circuits || circuits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center" data-testid="schematic-empty">
        <CircuitBoard className="w-16 h-16 text-muted-foreground/30" />
        <div>
          <h3 className="text-lg font-medium text-foreground">No Circuit Designs</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a circuit to start placing components and drawing nets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="button-create-first-circuit"
            onClick={handleCreateCircuit}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Circuit
          </Button>
          <Button
            data-testid="button-expand-architecture"
            variant="outline"
            onClick={handleExpandArchitecture}
            disabled={expandMutation.isPending}
            className="gap-2"
          >
            {expandMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranchPlus className="w-4 h-4" />}
            Expand from Architecture
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="schematic-view">
      <div className="h-10 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-3 gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-toggle-parts-panel"
          onClick={() => setPartsPanel((v) => !v)}
          className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Toggle parts panel"
        >
          {partsPanel ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </Button>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-1">
          {activeCircuit?.parentDesignId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToParent}
              className="h-7 px-1.5 text-primary hover:text-primary hover:bg-primary/10"
              title="Go to parent sheet"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          )}
          <Select
            value={String(activeCircuit?.id ?? '')}
            onValueChange={v => setActiveCircuitId(Number(v))}
          >
            <SelectTrigger className="h-7 w-48 text-xs" data-testid="select-circuit">
              <SelectValue placeholder="Select circuit" />
            </SelectTrigger>
            <SelectContent>
              {circuits.map((c: CircuitDesignRow) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-create-circuit"
          onClick={handleCreateCircuit}
          disabled={createMutation.isPending}
          className="h-7 gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs">New</span>
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-open-ai-generate"
          onClick={() => setAiDialogOpen(true)}
          disabled={!activeCircuit}
          className={cn(
            'h-7 gap-1 text-muted-foreground hover:text-foreground',
            aiWorkflow && !aiWorkflow.authoritativeWiringAllowed && 'text-amber-300 hover:text-amber-200',
          )}
          title={!activeCircuit ? 'Select a circuit first' : 'Generate schematic content with AI'}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="text-xs">AI Generate</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-push-to-pcb"
          onClick={() => setPushDialogOpen(true)}
          disabled={!activeCircuit || !instances || instances.length === 0 || unplacedInstances.length === 0 || pushToPcbMutation.isPending}
          className="h-7 gap-1 text-muted-foreground hover:text-foreground"
          title={!instances || instances.length === 0 ? 'No components to push — add components to the schematic first' : unplacedInstances.length === 0 ? 'All components already placed on PCB' : `Push ${String(unplacedInstances.length)} component${unplacedInstances.length === 1 ? '' : 's'} to PCB`}
        >
          {pushToPcbMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightToLine className="w-3.5 h-3.5" />}
          <span className="text-xs">Push to PCB</span>
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {activeCircuit ? activeCircuit.name : 'No circuit selected'}
        </span>
        <div className="w-px h-5 bg-border" />
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-toggle-erc-panel"
          onClick={() => setErcPanel((v) => !v)}
          className={cn(
            'h-7 px-1.5 gap-1 text-muted-foreground hover:text-foreground',
            ercPanel && 'text-primary',
          )}
          title="Electrical Rule Check"
          aria-label="Toggle ERC panel"
        >
          <ShieldCheck className="w-4 h-4" />
          {ercPanel ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {aiWorkflow ? (
        <div
          className={cn(
            'border-b px-3 py-2 text-xs',
            aiWorkflow.authoritativeWiringAllowed
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-amber-500/30 bg-amber-500/10',
          )}
          data-testid="schematic-ai-workflow-banner"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={aiWorkflow.authoritativeWiringAllowed ? 'default' : 'outline'}
                  data-testid="schematic-ai-workflow-badge"
                  className={aiWorkflow.authoritativeWiringAllowed ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'border-amber-300/60 text-amber-100'}
                >
                  {aiWorkflow.authoritativeWiringAllowed ? 'Authoritative exact workflow' : 'Provisional exact workflow'}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {aiWorkflow.usedParts.length} placed part{aiWorkflow.usedParts.length === 1 ? '' : 's'} tracked
                </span>
              </div>
              <p
                className={cn(
                  'max-w-5xl leading-relaxed',
                  aiWorkflow.authoritativeWiringAllowed ? 'text-emerald-100' : 'text-amber-50',
                )}
                data-testid="schematic-ai-workflow-summary"
              >
                {aiWorkflow.summary}
              </p>
              {aiWorkflow.requestedExactParts.length > 0 ? (
                <div className="space-y-1" data-testid="schematic-ai-requested-exact-parts">
                  {aiWorkflow.requestedExactParts.map((intent) => (
                    <div key={`${intent.title}-${intent.kind}`} className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-white/10',
                          intent.kind === 'verified-match'
                            ? 'text-emerald-100'
                            : intent.kind === 'candidate-match'
                              ? 'text-amber-100'
                              : 'text-muted-foreground',
                        )}
                      >
                        {intent.title}
                      </Badge>
                      <span className="text-muted-foreground">{intent.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {aiWorkflow.usedParts.length > 0 ? (
                <div className="flex flex-wrap gap-2" data-testid="schematic-ai-used-parts">
                  {aiWorkflow.usedParts.map((usage) => (
                    <Badge
                      key={`${usage.referenceDesignator}-${usage.partId}`}
                      variant="outline"
                      className="border-white/10 text-foreground"
                    >
                      {usage.referenceDesignator}: {usage.title} ({usage.placementMode})
                    </Badge>
                  ))}
                </div>
              ) : null}
              {aiWorkflow.warnings.length > 0 ? (
                <div className="space-y-1" data-testid="schematic-ai-workflow-warnings">
                  {aiWorkflow.warnings.slice(0, 3).map((warning) => (
                    <div key={warning} className="flex items-start gap-2 text-amber-100">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-dismiss-ai-workflow-banner"
              onClick={() => setAiWorkflow(null)}
              className="h-7 text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden">
        {partsPanel && activeCircuit && (
          <div className="w-56 shrink-0 flex flex-col border-r border-border" data-testid="parts-panel-container">
            {/* Tab switcher */}
            <div className="flex border-b border-border shrink-0">
              <button
                data-testid="panel-tab-components"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
                  panelTab === 'components'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPanelTab('components')}
              >
                <Cpu className="w-3 h-3" />
                Parts
              </button>
              <button
                data-testid="panel-tab-power"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
                  panelTab === 'power'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPanelTab('power')}
              >
                <Zap className="w-3 h-3" />
                Power
              </button>
              <button
                data-testid="panel-tab-sheets"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
                  panelTab === 'sheets'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPanelTab('sheets')}
              >
                <FileStack className="w-3 h-3" />
                Sheets
              </button>
              <button
                data-testid="panel-tab-sim"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
                  panelTab === 'sim'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setPanelTab('sim')}
              >
                <History className="w-3 h-3" />
                Sim
              </button>
            </div>
            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {panelTab === 'components' ? (
                <ComponentPlacer />
              ) : panelTab === 'power' ? (
                <PowerSymbolPalette />
              ) : panelTab === 'sheets' ? (
                <HierarchicalSheetPanel
                  activeCircuitId={activeCircuit?.id ?? null}
                  onSelectCircuit={setActiveCircuitId}
                />
              ) : (
                <SimulationScenarioPanel
                  circuitId={activeCircuit?.id ?? 0}
                  currentConfig={currentSimConfig}
                  onLoadConfig={setCurrentSimConfig}
                />
              )}
            </div>
          </div>
        )}
        <div className="flex-1 relative overflow-hidden">
          {activeCircuit ? (
            <SchematicCanvasInner
              circuitId={activeCircuit.id}
              ercViolations={ercViolations}
              highlightedViolationId={highlightedViolationId}
              onEnterSheet={handleEnterSheet}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a circuit to begin editing
            </div>
          )}
        </div>
        {ercPanel && activeCircuit && (
          <div className="w-64 shrink-0 border-l border-border flex flex-col" data-testid="erc-panel-container">
            <ERCPanel
              circuitId={activeCircuit.id}
              onHighlightViolation={handleHighlightViolation}
              onViolationsChange={setErcViolations}
            />
          </div>
        )}
      </div>

      <AlertDialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <AlertDialogContent data-testid="push-to-pcb-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Push to PCB</AlertDialogTitle>
            <AlertDialogDescription>
              Push {unplacedInstances.length} component{unplacedInstances.length === 1 ? '' : 's'} to
              the PCB layout as unplaced footprints?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unplacedInstances.length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground space-y-0.5 pl-4 list-disc" data-testid="push-to-pcb-list">
              {unplacedInstances.map((inst) => (
                <li key={inst.id}>
                  {inst.referenceDesignator}
                  {(inst.properties as Record<string, string> | null)?.packageType
                    ? ` (${(inst.properties as Record<string, string>).packageType})`
                    : ''}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="push-to-pcb-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="push-to-pcb-confirm"
              onClick={handlePushToPcb}
              disabled={pushToPcbMutation.isPending}
            >
              {pushToPcbMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Pushing...
                </>
              ) : (
                'Push to PCB'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          <p className="text-xs text-muted-foreground mt-2">
            After pushing, you can switch to the PCB view to arrange the footprints.
          </p>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border" data-testid="dialog-ai-generate-circuit">
          <DialogHeader>
            <DialogTitle>Generate schematic with AI</DialogTitle>
            <DialogDescription>
              Ask ProtoPulse to place parts and connect a starting schematic. Exact board/module requests will be checked against the verified exact-part pipeline before the result is marked authoritative.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ai-generate-description" className="text-sm font-medium text-foreground">
                Circuit request
              </label>
              <Textarea
                id="ai-generate-description"
                data-testid="textarea-ai-generate-description"
                placeholder="Example: Add an Arduino Mega 2560 R3, a RioRand motor controller, and the power wiring needed for a first-pass bench test."
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                className="min-h-[140px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ai-generate-api-key" className="text-sm font-medium text-foreground">
                Gemini API key
              </label>
              <Input
                id="ai-generate-api-key"
                data-testid="input-ai-generate-api-key"
                type="password"
                autoComplete="current-password"
                placeholder="Paste a Gemini API key for this generation run"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
              />
            </div>
            <div
              className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground"
              data-testid="ai-generate-exact-part-note"
            >
              Verified exact boards/modules can unlock authoritative wiring. Candidate exact boards/modules can still be placed, but ProtoPulse will flag the result as provisional until the part is reviewed.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="button-ai-generate-submit"
              onClick={() => void handleGenerateWithAi()}
              disabled={generateAiMutation.isPending || aiPrompt.trim().length === 0 || aiApiKey.trim().length === 0 || !activeCircuit}
            >
              {generateAiMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SchematicView() {
  return (
    <ReactFlowProvider>
      <SchematicViewContent />
    </ReactFlowProvider>
  );
}
