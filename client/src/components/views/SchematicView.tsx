import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitDesigns, useCreateCircuitDesign, useExpandArchitecture } from '@/lib/circuit-editor/hooks';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Loader2, CircuitBoard, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Cpu, Zap, ShieldCheck, GitBranchPlus, FileStack } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CircuitDesignRow } from '@shared/schema';
import type { ERCViolation } from '@shared/circuit-types';
import { SchematicCanvasInner } from '@/components/circuit-editor/SchematicCanvas';
import ComponentPlacer from '@/components/circuit-editor/ComponentPlacer';
import PowerSymbolPalette from '@/components/circuit-editor/PowerSymbolPalette';
import ERCPanel from '@/components/circuit-editor/ERCPanel';
import HierarchicalSheetPanel from '@/components/circuit-editor/HierarchicalSheetPanel';

function SchematicViewContent() {
  const projectId = useProjectId();
  const { data: circuits, isLoading } = useCircuitDesigns(projectId);
  const createMutation = useCreateCircuitDesign();
  const expandMutation = useExpandArchitecture();
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const [partsPanel, setPartsPanel] = useState(true);
  const [ercPanel, setErcPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'components' | 'power' | 'sheets'>('components');
  const [ercViolations, setErcViolations] = useState<ERCViolation[]>([]);
  const [highlightedViolationId, setHighlightedViolationId] = useState<string | null>(null);

  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="schematic-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            </div>
            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {panelTab === 'components' ? (
                <ComponentPlacer />
              ) : panelTab === 'power' ? (
                <PowerSymbolPalette />
              ) : (
                <HierarchicalSheetPanel
                  activeCircuitId={activeCircuit?.id ?? null}
                  onSelectCircuit={setActiveCircuitId}
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
