import { lazy } from 'react';

// ─── Lazy-loaded view & panel components ───────────────────────────────────
export const Sidebar = lazy(() => import('@/components/layout/Sidebar'));
export const ChatPanel = lazy(() => import('@/components/panels/ChatPanel'));
export const DashboardView = lazy(() => import('@/components/views/DashboardView'));
export const ArchitectureView = lazy(() => import('@/components/views/ArchitectureView'));
export const ComponentEditorView = lazy(() => import('@/components/views/ComponentEditorView'));
export const ProcurementView = lazy(() => import('@/components/views/ProcurementView'));
export const ValidationView = lazy(() => import('@/components/views/ValidationView'));
export const ExportPanel = lazy(() => import('@/components/panels/ExportPanel'));
export const SchematicView = lazy(() => import('@/components/views/SchematicView'));
export const BreadboardView = lazy(() => import('@/components/circuit-editor/BreadboardView'));
export const PCBLayoutView = lazy(() => import('@/components/circuit-editor/PCBLayoutView'));
export const SimulationView = lazy(() => import('@/components/simulation/SimulationPanel'));
export const DesignHistoryView = lazy(() => import('@/components/views/DesignHistoryView'));
export const LifecycleDashboard = lazy(() => import('@/components/views/LifecycleDashboard'));
export const WorkflowBreadcrumb = lazy(() => import('@/components/layout/WorkflowBreadcrumb'));
export const ShortcutsOverlay = lazy(() => import('@/components/ui/ShortcutsOverlay'));
export const CommandPalette = lazy(() => import('@/components/ui/command-palette'));
export const PartsCommandPalette = lazy(() => import('@/components/CommandPalette'));
export const UnifiedComponentSearch = lazy(() => import('@/components/ui/UnifiedComponentSearch'));
export const GlobalSearchDialog = lazy(() => import('@/components/ui/GlobalSearchDialog'));
export const TutorialOverlay = lazy(() => import('@/components/ui/TutorialOverlay'));
export const TutorialMenu = lazy(() => import('@/components/ui/TutorialMenu'));
export const CommentsPanel = lazy(() => import('@/components/panels/CommentsPanel').then(m => ({ default: m.CommentsPanel })));
export const CalculatorsView = lazy(() => import('@/components/views/CalculatorsView'));
export const DesignPatternsView = lazy(() => import('@/components/views/DesignPatternsView'));
export const StorageManagerPanel = lazy(() => import('@/components/views/StorageManagerPanel'));
export const KanbanView = lazy(() => import('@/components/views/KanbanView'));
export const KnowledgeView = lazy(() => import('@/components/views/KnowledgeView'));
export const BoardViewer3DView = lazy(() => import('@/components/views/BoardViewer3DView'));
export const CommunityView = lazy(() => import('@/components/views/CommunityView'));
export const PcbOrderingView = lazy(() => import('@/components/views/PcbOrderingView'));
export const SerialMonitorPanel = lazy(() => import('@/components/panels/SerialMonitorPanel'));
export const CircuitCodeView = lazy(() => import('@/components/views/CircuitCodeView'));
export const GenerativeDesignView = lazy(() => import('@/components/views/GenerativeDesignView'));
export const DigitalTwinView = lazy(() => import('@/components/views/DigitalTwinView'));
export const ArduinoWorkbenchView = lazy(() => import('@/components/views/ArduinoWorkbenchView'));
export const StarterCircuitsPanel = lazy(() => import('@/components/views/StarterCircuitsPanel'));
export const ActivityFeedPanel = lazy(() => import('@/components/panels/ActivityFeedPanel'));
export const MentionBadge = lazy(() => import('@/components/ui/MentionBadge'));
export const WhatsNewPanel = lazy(() => import('@/components/ui/WhatsNewPanel'));
export const ShareProjectButton = lazy(() => import('@/components/ui/ShareProjectButton').then(m => ({ default: m.ShareProjectButton })));
export const AuditTrailView = lazy(() => import('@/components/views/AuditTrailView'));
export const LabTemplatePanel = lazy(() => import('@/components/panels/LabTemplatePanel'));
export const FirstRunChecklist = lazy(() => import('@/components/ui/FirstRunChecklist'));
export const LessonModeOverlay = lazy(() => import('@/components/ui/LessonModeOverlay'));
export const ExplainPanelButton = lazy(() => import('@/components/ui/ExplainPanelButton'));
export const PcbTutorialPanel = lazy(() => import('@/components/panels/PcbTutorialPanel'));
export const SmartHintToast = lazy(() => import('@/components/ui/SmartHintToast'));
export const ViewOnboardingHint = lazy(() => import('@/components/ui/ViewOnboardingHint'));
export const MilestonePanel = lazy(() => import('@/components/panels/MilestonePanel'));
export const DesignTroubleshooterPanel = lazy(() => import('@/components/panels/DesignTroubleshooterPanel'));
export const SupplyChainAlertsPanel = lazy(() => import('@/components/views/SupplyChainAlertsPanel'));
export const BomTemplatesPanel = lazy(() => import('@/components/views/BomTemplatesPanel'));
export const PersonalInventoryPanel = lazy(() => import('@/components/views/PersonalInventoryPanel'));
export const PartAlternatesBrowserView = lazy(() => import('@/components/views/PartAlternatesBrowserView'));
export const PartUsageBrowserView = lazy(() => import('@/components/views/PartUsageBrowserView'));
export const VaultBrowserView = lazy(() => import('@/components/views/VaultBrowserView'));

// ─── Prefetch queue ────────────────────────────────────────────────────────
/**
 * Prefetch lazy-loaded view chunks during idle time so that first-click
 * navigation doesn't block on network fetch + parse (500ms-3377ms jank).
 * Chunks are fetched in priority order: high-traffic views first.
 */
const prefetchQueue: Array<() => Promise<unknown>> = [
  // Tier 1 — most-visited views (prefetch immediately on idle)
  () => import('@/components/views/ArchitectureView'),
  () => import('@/components/views/DashboardView'),
  () => import('@/components/panels/ChatPanel'),
  () => import('@/components/layout/Sidebar'),
  // Tier 2 — common workflow views
  () => import('@/components/views/SchematicView'),
  () => import('@/components/circuit-editor/BreadboardView'),
  () => import('@/components/circuit-editor/PCBLayoutView'),
  () => import('@/components/views/ProcurementView'),
  () => import('@/components/views/ValidationView'),
  () => import('@/components/panels/ExportPanel'),
  () => import('@/components/simulation/SimulationPanel'),
  // Tier 3 — secondary views (prefetch last)
  () => import('@/components/views/ComponentEditorView'),
  () => import('@/components/views/DesignHistoryView'),
  () => import('@/components/views/LifecycleDashboard'),
  () => import('@/components/views/CalculatorsView'),
  () => import('@/components/views/DesignPatternsView'),
  () => import('@/components/views/KanbanView'),
  () => import('@/components/views/KnowledgeView'),
  () => import('@/components/views/BoardViewer3DView'),
  () => import('@/components/views/CommunityView'),
  () => import('@/components/views/PcbOrderingView'),
  () => import('@/components/views/StorageManagerPanel'),
  () => import('@/components/panels/SerialMonitorPanel'),
  () => import('@/components/views/CircuitCodeView'),
  () => import('@/components/views/GenerativeDesignView'),
  () => import('@/components/views/DigitalTwinView'),
  () => import('@/components/panels/CommentsPanel'),
  () => import('@/components/views/SupplyChainAlertsPanel'),
  () => import('@/components/views/BomTemplatesPanel'),
  () => import('@/components/views/PersonalInventoryPanel'),
  () => import('@/components/views/PartAlternatesBrowserView'),
  () => import('@/components/views/PartUsageBrowserView'),
  () => import('@/components/views/VaultBrowserView'),
];

let prefetchStarted = false;

export function startPrefetch() {
  if (prefetchStarted) { return; }
  prefetchStarted = true;

  let idx = 0;
  const next = () => {
    if (idx >= prefetchQueue.length) { return; }
    const loader = prefetchQueue[idx++];
    // Fire and forget — we only care about caching the module
    loader().catch(() => { /* chunk load failure is non-fatal */ });
    // Schedule next chunk on next idle period to avoid blocking main thread
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(next);
    } else {
      setTimeout(next, 50);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(next);
  } else {
    setTimeout(next, 100);
  }
}
