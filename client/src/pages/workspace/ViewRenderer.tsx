import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import { UndoRedoProvider } from '@/lib/undo-redo-context';
import type { ViewMode } from '@/lib/project-context';
import {
  DashboardView,
  ExportPanel,
  ArchitectureView,
  ComponentEditorView,
  SchematicView,
  BreadboardView,
  PCBLayoutView,
  ProcurementView,
  ValidationView,
  SimulationView,
  LifecycleDashboard,
  DesignHistoryView,
  CommentsPanel,
  CalculatorsView,
  DesignPatternsView,
  StorageManagerPanel,
  KanbanView,
  KnowledgeView,
  BoardViewer3DView,
  CommunityView,
  PcbOrderingView,
  SerialMonitorPanel,
  CircuitCodeView,
  GenerativeDesignView,
  DigitalTwinView,
  ArduinoWorkbenchView,
  StarterCircuitsPanel,
  AuditTrailView,
  LabTemplatePanel,
  DesignTroubleshooterPanel,
  SupplyChainAlertsPanel,
  BomTemplatesPanel,
  PersonalInventoryPanel,
  PartAlternatesBrowserView,
  PartUsageBrowserView,
} from './lazy-imports';

/* AS-01 / UX-103: Panel skeleton loading state for lazy-loaded views */
export function ViewLoadingFallback() {
  return <PanelSkeleton className="bg-card/30" rows={5} />;
}

interface ViewRendererProps {
  activeView: ViewMode;
  projectId: number;
}

export function ViewRenderer({ activeView, projectId }: ViewRendererProps) {
  return (
    <>
      {activeView === 'dashboard' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <DashboardView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'output' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <ExportPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'architecture' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <ArchitectureView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'component_editor' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <ComponentEditorView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'schematic' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <SchematicView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'breadboard' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <BreadboardView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'pcb' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <UndoRedoProvider>
              <PCBLayoutView />
            </UndoRedoProvider>
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'procurement' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <ProcurementView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'validation' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <div className="flex h-full">
              <div className="flex-1 min-w-0 overflow-auto">
                <ValidationView />
              </div>
              <div className="w-80 border-l border-border bg-background/50 shrink-0 overflow-hidden hidden xl:flex flex-col">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <DesignTroubleshooterPanel />
                </Suspense>
              </div>
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'simulation' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <SimulationView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'lifecycle' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <LifecycleDashboard />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'design_history' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <DesignHistoryView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'comments' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <CommentsPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'calculators' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <CalculatorsView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'design_patterns' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <DesignPatternsView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'storage' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <StorageManagerPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'kanban' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <KanbanView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'knowledge' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <KnowledgeView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'viewer_3d' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <BoardViewer3DView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'community' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <CommunityView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'ordering' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <PcbOrderingView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'serial_monitor' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <SerialMonitorPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'circuit_code' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <CircuitCodeView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'generative_design' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <GenerativeDesignView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'digital_twin' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <DigitalTwinView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'arduino' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <ArduinoWorkbenchView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'starter_circuits' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <StarterCircuitsPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'audit_trail' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <AuditTrailView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'labs' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <LabTemplatePanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'supply_chain' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <SupplyChainAlertsPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'bom_templates' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <BomTemplatesPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'personal_inventory' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <PersonalInventoryPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'part_alternates' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <PartAlternatesBrowserView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'part_usage' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback />}>
            <PartUsageBrowserView />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
