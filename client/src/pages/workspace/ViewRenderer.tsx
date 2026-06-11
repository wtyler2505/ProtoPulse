import { memo, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { navItems } from '@/components/layout/sidebar/sidebar-constants';
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
  VaultBrowserView,
} from './lazy-imports';

const viewLabelByMode = new Map<ViewMode, string>(
  navItems.map(({ view, label }) => [view, label]),
);

function formatFallbackViewName(view: ViewMode) {
  return view
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getLoadingLabel(activeView?: ViewMode) {
  if (!activeView) {
    return 'Loading workspace view...';
  }

  return `Loading ${viewLabelByMode.get(activeView) ?? formatFallbackViewName(activeView)}...`;
}

/* AS-01 / UX-103: Panel skeleton loading state for lazy-loaded views */
export function ViewLoadingFallback({
  activeView,
  label,
}: {
  activeView?: ViewMode;
  label?: string;
} = {}) {
  return <PanelSkeleton className="bg-card/30" label={label ?? getLoadingLabel(activeView)} rows={5} />;
}

interface ViewRendererProps {
  activeView: ViewMode;
  projectId: number;
}

function ViewRendererBase({ activeView, projectId }: ViewRendererProps) {
  return (
    <>
      {activeView === 'dashboard' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <DashboardView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'output' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <ExportPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'architecture' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <ArchitectureView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'component_editor' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <ComponentEditorView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'schematic' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <SchematicView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'breadboard' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <BreadboardView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'pcb' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <UndoRedoProvider>
              <PCBLayoutView />
            </UndoRedoProvider>
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'procurement' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <ProcurementView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'validation' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <div className="flex h-full">
              <div className="flex-1 min-w-0 overflow-auto">
                <ValidationView />
              </div>
              <div className="w-84 border-l border-border bg-background/50 shrink-0 overflow-hidden hidden xl:flex flex-col">
                <Suspense fallback={<ViewLoadingFallback label="Loading design troubleshooter..." />}>
                  <DesignTroubleshooterPanel />
                </Suspense>
              </div>
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'simulation' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <SimulationView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'lifecycle' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <LifecycleDashboard />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'design_history' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <DesignHistoryView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'comments' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <CommentsPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'calculators' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <CalculatorsView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'design_patterns' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <DesignPatternsView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'storage' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <StorageManagerPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'kanban' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <KanbanView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'knowledge' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <KnowledgeView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'viewer_3d' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <BoardViewer3DView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'community' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <CommunityView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'ordering' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <PcbOrderingView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'serial_monitor' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <SerialMonitorPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'circuit_code' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <CircuitCodeView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'generative_design' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <GenerativeDesignView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'digital_twin' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <DigitalTwinView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'arduino' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <ArduinoWorkbenchView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'starter_circuits' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <StarterCircuitsPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'audit_trail' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <AuditTrailView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'labs' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <LabTemplatePanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'supply_chain' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <SupplyChainAlertsPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'bom_templates' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <BomTemplatesPanel projectId={projectId} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'personal_inventory' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <PersonalInventoryPanel />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'part_alternates' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <PartAlternatesBrowserView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'part_usage' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <PartUsageBrowserView />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'vault_browser' && (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoadingFallback activeView={activeView} />}>
            <VaultBrowserView />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

export const ViewRenderer = memo(ViewRendererBase);
ViewRenderer.displayName = 'ViewRenderer';
