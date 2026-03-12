import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useCircuitDesigns, useCircuitInstances, useCreateCircuitDesign, useExpandArchitecture, usePushToPcb } from '@/lib/circuit-editor/hooks';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
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
import { Plus, Loader2, CircuitBoard, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Cpu, Zap, ShieldCheck, GitBranchPlus, FileStack, RefreshCw, ChevronUp, ArrowLeft, History, ArrowRightToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { setActiveView } = useProjectMeta();
  const createMutation = useCreateCircuitDesign();
  const expandMutation = useExpandArchitecture();
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
          data-testid="button-push-to-pcb"
          onClick={() => setPushDialogOpen(true)}
          disabled={!activeCircuit || !instances || instances.length === 0 || unplacedInstances.length === 0 || pushToPcbMutation.isPending}
          className="h-7 gap-1 text-muted-foreground hover:text-foreground"
          title={unplacedInstances.length === 0 ? 'All components already placed on PCB' : `Push ${String(unplacedInstances.length)} component${unplacedInstances.length === 1 ? '' : 's'} to PCB`}
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
