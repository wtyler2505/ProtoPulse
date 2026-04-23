import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Upload, GraduationCap, CircuitBoard, Activity } from 'lucide-react';
import ThemeToggle from '@/components/ui/theme-toggle';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import FeatureMaturityBadge from '@/components/ui/FeatureMaturityBadge';
import RolePresetSelector from '@/components/ui/RolePresetSelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { navItems, tabDescriptions, alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import { useBeginnerMode } from '@/lib/beginner-mode';
import { getViewFeatureMaturity } from '@/lib/feature-maturity';
import { useArchitecture, useBom, useProjectId, useProjectMeta, useValidation } from '@/lib/project-context';
import {
  getHardwareWorkspaceFactClasses,
  getHardwareWorkspaceToneClasses,
  useHardwareWorkspaceStatus,
} from '@/lib/hardware-workspace-status';
import { useRolePreset } from '@/lib/role-presets';
import { useToast } from '@/hooks/use-toast';
import type { ViewMode } from '@/lib/project-context';
import type { WorkspaceState, WorkspaceAction } from './workspace-reducer';
import { getProjectHealthToneClasses, useProjectHealth } from '@/lib/project-health';
import { isProjectMutationKey } from '@/lib/query-keys';
import {
  TutorialMenu,
  ExplainPanelButton,
  WhatsNewPanel,
  MentionBadge,
  ShareProjectButton,
} from './lazy-imports';

// ─── ScrollableTabBar ──────────────────────────────────────────────────────

/* AS-05: Scrollable tab bar with fade gradients at edges */
function ScrollableTabBar({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) { return; }
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) { return; }
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative flex items-center flex-1 min-w-0">
      {canScrollLeft && (
        <button
          data-testid="tab-scroll-left"
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 h-full w-7 flex items-center justify-center bg-gradient-to-r from-background/90 to-transparent hover:from-background"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Main views"
        className="flex items-center gap-0 overflow-x-auto no-scrollbar"
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          data-testid="tab-scroll-right"
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 h-full w-7 flex items-center justify-center bg-gradient-to-l from-background/90 to-transparent hover:from-background"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── WorkspaceHeader ───────────────────────────────────────────────────────

interface WorkspaceHeaderProps {
  ws: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
}

export function WorkspaceHeader({ ws, dispatch, activeView, setActiveView }: WorkspaceHeaderProps) {
  const projectId = useProjectId();
  const { projectName } = useProjectMeta();
  const { preset } = useRolePreset();
  const { isEnabled: plainLabelsEnabled, toggle: togglePlainLabels } = useBeginnerMode();
  const { nodes, edges, setNodes, setEdges, pushUndoState } = useArchitecture();
  const { bom, addBomItem } = useBom();
  const { issues } = useValidation();
  const { toast } = useToast();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const previousMutating = useRef(0);
  const mutatingCount = useIsMutating({
    predicate: (mutation) => isProjectMutationKey(mutation.options.mutationKey, projectId),
  });

  /* UI-18: Progressive disclosure — hide advanced tabs until prerequisite content exists. */
  const hasDesignContent = (nodes ?? []).length > 0;

  const visibleTabs = useMemo(
    () => navItems.filter(t => t.view !== 'project_explorer' && (alwaysVisibleIds.has(t.view) || hasDesignContent)),
    [hasDesignContent]
  );

  const validationErrorCount = (issues ?? []).filter(i => i.severity === 'error').length;
  const validationWarningCount = (issues ?? []).filter(i => i.severity === 'warning').length;
  const bomCount = (bom ?? []).length;

  useEffect(() => {
    if (previousMutating.current > 0 && mutatingCount === 0) {
      setLastSavedAt(new Date());
    }
    previousMutating.current = mutatingCount;
  }, [mutatingCount]);

  const health = useProjectHealth(projectId, {
    isSaving: mutatingCount > 0,
    lastSavedAt,
  });
  const hardwareStatus = useHardwareWorkspaceStatus();

  const handleImportDesign = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kicad_sch,.kicad_pcb,.sch,.brd,.SchDoc,.PcbDoc,.asc,.dsn,.net,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        file.text().then((content) => {
          import('@/lib/design-import').then(({ DesignImporter }) => {
            const importer = DesignImporter.getInstance();
            const result = importer.importFile(content, file.name);
            if (result.status === 'complete' && result.design) {
              const proto = importer.convertToProtoPulse(result.design);
              const summary = `Import will add ${String(proto.nodes.length)} nodes, ${String(proto.edges.length)} edges, and ${String(proto.bomItems.length)} BOM items from "${file.name}". Continue?`;
              if (!window.confirm(summary)) {
                return;
              }
              pushUndoState();
              const newNodes = proto.nodes.map((n) => ({
                id: n.id,
                type: 'custom' as const,
                position: n.position,
                data: { label: n.label, type: n.type },
              }));
              const newEdges = proto.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
              }));
              setNodes([...nodes, ...newNodes]);
              setEdges([...edges, ...newEdges]);
              for (const item of proto.bomItems) {
                addBomItem({
                  partNumber: item.partNumber || 'N/A',
                  manufacturer: 'Imported',
                  description: item.name,
                  quantity: item.quantity,
                  unitPrice: 0,
                  totalPrice: 0,
                  supplier: 'Unknown',
                  stock: 0,
                  status: 'In Stock',
                });
              }
              setActiveView('architecture');
              toast({
                title: 'Design imported',
                description: `Added ${String(proto.nodes.length)} nodes, ${String(proto.edges.length)} edges, and ${String(proto.bomItems.length)} BOM items from "${file.name}".`,
              });
              if (result.warningCount > 0) {
                toast({
                  variant: 'destructive',
                  title: 'Import warnings',
                  description: `${String(result.warningCount)} warning(s) encountered during import. Check console for details.`,
                });
              }
            } else if (result.status === 'error') {
              toast({
                variant: 'destructive',
                title: 'Import failed',
                description: `${String(result.errorCount)} error(s) in "${file.name}". The file could not be imported.`,
              });
            }
          }).catch(() => {
            toast({ variant: 'destructive', title: 'Import failed', description: 'Could not load the design import module.' });
          });
        }).catch(() => {
          toast({ variant: 'destructive', title: 'Import failed', description: 'Could not read the file.' });
        });
      }
    };
    input.click();
  }, [nodes, edges, setNodes, setEdges, pushUndoState, addBomItem, setActiveView, toast]);

  return (
    <header
      data-testid="workspace-header"
      className="h-20 border-b border-border bg-background/60 backdrop-blur-xl hidden lg:flex flex-col px-1 z-10"
    >
      {/* Plan 17 Phase 1 — Row 1 (40px): identity + navigation */}
      <div
        data-testid="header-row-identity"
        className="h-10 flex items-center gap-0 shrink-0"
      >
      {/* AS-04: Larger toggle buttons with better contrast */}
      <StyledTooltip content="Toggle sidebar" side="bottom">
        <button
          data-testid="toggle-sidebar"
          onClick={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
          className="p-2 hover:bg-muted/50 bg-muted/20 border border-border/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title={ws.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-label={ws.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {ws.sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </StyledTooltip>
      <div className="w-px h-5 bg-border mr-1" />

      {/* AS-08: Show project name when sidebar collapsed */}
      {ws.sidebarCollapsed && projectName && (
        <span data-testid="header-project-name" className="text-xs text-muted-foreground truncate max-w-[200px] mr-2" title={projectName}>
          {projectName}
        </span>
      )}

      {/* AS-05 + RS-09: Scrollable tab bar with fade indicators */}
      <ScrollableTabBar>
        {visibleTabs.map((tab) => {
          const maturity = getViewFeatureMaturity(tab.view);
          return (
            <StyledTooltip
              key={tab.view}
              content={maturity ? (
                <div className="space-y-1">
                  <p>{tabDescriptions[tab.view] || tab.label}</p>
                  <FeatureMaturityBadge maturity={maturity.maturity} label={maturity.shortLabel} className="pointer-events-none" />
                  <p className="max-w-[220px] text-[11px] text-muted-foreground">{maturity.description}</p>
                </div>
              ) : (tabDescriptions[tab.view] || tab.label)}
              side="bottom"
            >
            <button
              role="tab"
              id={`tab-${tab.view}`}
              aria-label={tab.label}
              aria-selected={activeView === tab.view}
              aria-controls="main-panel"
              data-testid={`tab-${tab.view}`}
              onClick={() => setActiveView(tab.view)}
              className={cn(
                /* Icon-only tabs — labels shown via tooltip on hover */
                'h-8 w-8 flex items-center justify-center text-sm font-medium transition-all relative top-[1px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                activeView === tab.view
                  ? 'bg-card border-x border-t border-border text-primary z-20 before:absolute before:inset-x-0 before:-top-[1px] before:h-[3px] before:bg-primary before:rounded-b-sm'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground border-transparent'
              )}
            >
              {tab.icon && <tab.icon className="w-4 h-4 [stroke-width:1.75]" />}
              {/* UI-18: Badge counts for Validation and Procurement */}
              {tab.view === 'validation' && validationErrorCount > 0 && (
                <span data-testid="tab-validation-badge" className="text-[10px] font-medium bg-destructive/20 text-destructive px-1.5 py-0.5 tabular-nums rounded-sm">
                  {validationErrorCount}
                </span>
              )}
              {tab.view === 'validation' && validationErrorCount === 0 && validationWarningCount > 0 && (
                <span data-testid="tab-validation-badge" className="text-[10px] font-medium bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 tabular-nums rounded-sm">
                  {validationWarningCount}
                </span>
              )}
              {tab.view === 'procurement' && bomCount > 0 && (
                <span data-testid="tab-procurement-badge" className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 tabular-nums rounded-sm">
                  {bomCount}
                </span>
              )}
            </button>
            </StyledTooltip>
          );
        })}
      </ScrollableTabBar>

      <div className="border-b border-border h-full w-2 shrink-0"></div>
      <div className="w-px h-5 bg-border ml-1" />
      {/* AS-04: Larger chat toggle button with better contrast */}
      <StyledTooltip content="Toggle AI assistant" side="bottom">
        <button
          data-testid="toggle-chat"
          onClick={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
          className="p-2 hover:bg-muted/50 bg-muted/20 border border-border/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title={ws.chatCollapsed ? 'Show chat' : 'Hide chat'}
        >
          {ws.chatCollapsed ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
        </button>
      </StyledTooltip>

      <div className="ml-2 flex items-center gap-1">
        <StyledTooltip
          content={(
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{hardwareStatus.summary}</p>
              <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">{hardwareStatus.detail}</p>
              <div className="flex flex-wrap gap-1">
                {hardwareStatus.facts.map((fact) => (
                  <span
                    key={fact.id}
                    className={cn(
                      'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      getHardwareWorkspaceFactClasses(fact.tone),
                    )}
                  >
                    {fact.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-medium text-primary">{hardwareStatus.actionLabel}</p>
            </div>
          )}
          side="bottom"
        >
          <button
            type="button"
            data-testid="workspace-hardware-badge"
            aria-label={hardwareStatus.actionLabel}
            onClick={() => setActiveView(hardwareStatus.actionView)}
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              getHardwareWorkspaceToneClasses(hardwareStatus.tone),
            )}
          >
            {hardwareStatus.badgeLabel}
          </button>
        </StyledTooltip>
        <StyledTooltip
          content={(
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{health.summary}</p>
              <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">{health.detail}</p>
              <div className="flex flex-wrap gap-1">
                {health.facts.map((fact) => (
                  <span
                    key={fact.id}
                    className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                  >
                    {fact.label}
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-medium text-primary">{health.actionLabel}</p>
            </div>
          )}
          side="bottom"
        >
          <button
            type="button"
            data-testid="workspace-health-badge"
            aria-label="Open Design History"
            onClick={() => setActiveView('design_history')}
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              getProjectHealthToneClasses(health.tone),
            )}
          >
            {health.badgeLabel}
          </button>
        </StyledTooltip>
        <Popover>
          <PopoverTrigger asChild>
            <button
              data-testid="workspace-mode-button"
              className="inline-flex items-center gap-2 rounded-sm border border-border/60 bg-muted/20 px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GraduationCap className="h-4 w-4" />
              <span>{preset.label} Mode</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3" align="end">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Workspace Mode</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{preset.description}</p>
            </div>
            <RolePresetSelector className="flex-wrap bg-background/60" />
            <button
              data-testid="workspace-plain-labels-toggle"
              type="button"
              onClick={togglePlainLabels}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                plainLabelsEnabled
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {plainLabelsEnabled ? 'Plain-language labels are on' : 'Use plain-language labels'}
            </button>
          </PopoverContent>
        </Popover>
        <Suspense fallback={null}>
          <ExplainPanelButton view={activeView} onNavigate={setActiveView} />
        </Suspense>
        <StyledTooltip content="Import design file" side="bottom">
          <button
            data-testid="import-design-button"
            type="button"
            aria-label="Import design file"
            className="p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleImportDesign}
          >
            <Upload className="w-4 h-4" />
          </button>
        </StyledTooltip>
        <Popover>
          <StyledTooltip content="Coach and tutorials" side="bottom">
            <PopoverTrigger asChild>
              <button
                data-testid="coach-help-button"
                type="button"
                className="inline-flex items-center gap-2 rounded-sm px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Coach &amp; Help</span>
              </button>
            </PopoverTrigger>
          </StyledTooltip>
          <PopoverContent className="w-80 p-0" align="end">
            <Suspense
              fallback={
                <div
                  data-testid="coach-help-loading"
                  className="flex items-center gap-2 p-4 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-muted-foreground/40" />
                  <span>Loading tutorials…</span>
                </div>
              }
            >
              <TutorialMenu />
            </Suspense>
          </PopoverContent>
        </Popover>
        <StyledTooltip content="PCB Tutorial" side="bottom">
          <button
            data-testid="pcb-tutorial-button"
            type="button"
            aria-label="PCB Tutorial"
            aria-pressed={ws.pcbTutorialOpen}
            onClick={() => dispatch({ type: 'SET_PCB_TUTORIAL_OPEN', open: !ws.pcbTutorialOpen })}
            className={cn(
              'p-2 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ws.pcbTutorialOpen
                ? 'text-primary bg-primary/10'
                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
            )}
          >
            <CircuitBoard className="w-4 h-4" />
          </button>
        </StyledTooltip>
        <Suspense fallback={null}>
          <WhatsNewPanel />
        </Suspense>
        <Suspense fallback={null}>
          <MentionBadge />
        </Suspense>
        <StyledTooltip content="Activity feed" side="bottom">
          <button
            data-testid="toggle-activity-feed"
            type="button"
            aria-label="Activity feed"
            aria-pressed={ws.activityFeedOpen}
            onClick={() => dispatch({ type: 'SET_ACTIVITY_FEED_OPEN', open: !ws.activityFeedOpen })}
            className={cn(
              'p-2 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ws.activityFeedOpen
                ? 'text-primary bg-primary/10'
                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
            )}
          >
            <Activity className="w-4 h-4" />
          </button>
        </StyledTooltip>
        <Suspense fallback={null}>
          <ShareProjectButton projectId={projectId} />
        </Suspense>
        <ThemeToggle />
      </div>
    </header>
  );
}
