import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Camera, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, MoreHorizontal } from 'lucide-react';
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
          className="absolute left-0 z-10 flex h-full w-5 items-center justify-center bg-gradient-to-r from-background/80 to-transparent hover:from-background/90"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="h-3 w-3 text-muted-foreground/80" />
        </button>
      )}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Main views"
        className="flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          data-testid="tab-scroll-right"
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 flex h-full w-5 items-center justify-center bg-gradient-to-l from-background/80 to-transparent hover:from-background/90"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="h-3 w-3 text-muted-foreground/80" />
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
  onOpenHardwareInspection?: () => void;
}

export function WorkspaceHeader({ ws, dispatch, activeView, setActiveView, onOpenHardwareInspection }: WorkspaceHeaderProps) {
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
  const primaryHeaderTabIds = useMemo(() => new Set<ViewMode>([
    'dashboard',
    'architecture',
    'schematic',
    'breadboard',
    'pcb',
  ]), []);
  const primaryTabs = useMemo(
    () => visibleTabs.filter((tab) => primaryHeaderTabIds.has(tab.view)),
    [primaryHeaderTabIds, visibleTabs],
  );
  const secondaryTabs = useMemo(
    () => visibleTabs.filter((tab) => !primaryHeaderTabIds.has(tab.view)),
    [primaryHeaderTabIds, visibleTabs],
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
      className="hidden h-12 items-center gap-1 border-b border-border/70 bg-background/65 px-1.5 backdrop-blur-xl lg:flex z-10"
    >
      <div
        data-testid="header-row-main"
        className="flex min-w-0 flex-1 items-center gap-1"
      >
      <StyledTooltip content="Toggle sidebar" side="bottom">
        <button
          data-testid="toggle-sidebar"
          onClick={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
          className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-sm border border-border/40 bg-muted/10 text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          title={ws.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-label={ws.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {ws.sidebarCollapsed ? <PanelLeftOpen className="h-3.75 w-3.75" /> : <PanelLeftClose className="h-3.75 w-3.75" />}
        </button>
      </StyledTooltip>

      <div className="min-w-0 max-w-[200px] shrink">
        <span data-testid="header-project-name" className="hidden xl:block truncate text-[11px] font-medium text-muted-foreground" title={projectName}>
          {projectName}
        </span>
      </div>

      <ScrollableTabBar>
        {primaryTabs.map((tab) => {
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
                'h-7.5 shrink-0 rounded-sm px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                activeView === tab.view
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground/90 hover:bg-muted/25 hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              {/* UI-18: Badge counts for Validation and Procurement */}
              {tab.view === 'validation' && validationErrorCount > 0 && (
                <span data-testid="tab-validation-badge" className="ml-1 rounded-sm bg-destructive/20 px-1 py-0.5 text-[11px] font-medium tabular-nums text-destructive">
                  {validationErrorCount}
                </span>
              )}
              {tab.view === 'validation' && validationErrorCount === 0 && validationWarningCount > 0 && (
                <span data-testid="tab-validation-badge" className="ml-1 rounded-sm bg-yellow-500/20 px-1 py-0.5 text-[11px] font-medium tabular-nums text-yellow-500">
                  {validationWarningCount}
                </span>
              )}
              {tab.view === 'procurement' && bomCount > 0 && (
                <span data-testid="tab-procurement-badge" className="ml-1 rounded-sm bg-muted/50 px-1 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {bomCount}
                </span>
              )}
            </button>
            </StyledTooltip>
          );
        })}
      </ScrollableTabBar>
      </div>

      <div data-testid="header-actions" className="flex shrink-0 items-center gap-0">
        <StyledTooltip content="Open hardware inspection" side="bottom">
          <button
            data-testid="workspace-open-hardware-inspection"
            type="button"
            onClick={onOpenHardwareInspection}
            className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera className="h-3.5 w-3.5" />
            Inspect
          </button>
        </StyledTooltip>
        <Popover>
          <PopoverTrigger asChild>
            <button
              data-testid="workspace-more-button"
              type="button"
              aria-label="More workspace actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border/50 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="max-h-[min(500px,calc(100vh-72px))] w-[17rem] overflow-y-auto overscroll-contain scrollbar-gutter-stable p-1.5" align="end">
            <div className="space-y-0.5">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Status</p>
              <button
                data-testid="more-status-hardware"
                type="button"
                onClick={() => setActiveView(hardwareStatus.actionView)}
                className={cn(
                  'flex h-7.5 w-full items-center justify-between rounded-sm px-2 text-left text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  getHardwareWorkspaceToneClasses(hardwareStatus.tone),
                )}
              >
                <span>Hardware</span>
                <span className="text-[11px]">{hardwareStatus.badgeLabel}</span>
              </button>
              <button
                data-testid="more-status-health"
                type="button"
                onClick={() => setActiveView('design_history')}
                className={cn(
                  'flex h-7.5 w-full items-center justify-between rounded-sm border px-2 text-left text-[11px] font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  getProjectHealthToneClasses(health.tone),
                )}
              >
                <span>Project health</span>
                <span className="text-[11px]">{health.badgeLabel}</span>
              </button>
            </div>
            <div className="mt-0.5 border-t border-border/60 pt-0.5">
            <div className="space-y-0.5">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Quick actions</p>
              <div className="grid grid-cols-2 gap-0.5">
                <button
                  data-testid="quick-action-import"
                  type="button"
                  onClick={handleImportDesign}
                  className="inline-flex h-7.5 items-center justify-center rounded-sm text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Import
                </button>
                <button
                  data-testid="quick-action-chat"
                  type="button"
                  onClick={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
                  className={cn(
                    'inline-flex h-7.5 items-center justify-center rounded-sm text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ws.chatCollapsed
                      ? 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      : 'text-primary bg-primary/10',
                  )}
                >
                  {ws.chatCollapsed ? 'Show chat' : 'Hide chat'}
                </button>
                <button
                  data-testid="quick-action-hardware-inspection"
                  type="button"
                  onClick={onOpenHardwareInspection}
                  className="inline-flex h-7.5 items-center justify-center rounded-sm text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Inspect hardware
                </button>
              </div>
            </div>
            </div>
            {secondaryTabs.length > 0 && (
              <div className="mt-0.5 border-t border-border/60 pt-0.5">
                <p className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">More views</p>
                {secondaryTabs.map((tab) => (
                  <button
                    key={tab.view}
                    data-testid={`more-tab-${tab.view}`}
                    type="button"
                    onClick={() => setActiveView(tab.view)}
                    className={cn(
                      'flex h-7.5 w-full items-center justify-between rounded-sm px-2 text-left text-[11px] transition-colors',
                      activeView === tab.view
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-0.5 border-t border-border/60 pt-0.5">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Workspace actions</p>
              <div className="grid gap-0.5">
        <Suspense fallback={null}>
          <ExplainPanelButton view={activeView} onNavigate={setActiveView} />
        </Suspense>
        <Popover>
          <StyledTooltip content="Coach and tutorials" side="bottom">
            <PopoverTrigger asChild>
              <button
                data-testid="coach-help-button"
                type="button"
                className="flex h-7.5 w-full items-center rounded-sm px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
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
              'flex h-7.5 w-full items-center rounded-sm px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ws.pcbTutorialOpen
                ? 'text-primary bg-primary/10'
                : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground',
            )}
          >
            <span>PCB Tutorial</span>
          </button>
        </StyledTooltip>
        <StyledTooltip content="Activity feed" side="bottom">
          <button
            data-testid="toggle-activity-feed"
            type="button"
            aria-label="Activity feed"
            aria-pressed={ws.activityFeedOpen}
            onClick={() => dispatch({ type: 'SET_ACTIVITY_FEED_OPEN', open: !ws.activityFeedOpen })}
            className={cn(
              'flex h-7.5 w-full items-center rounded-sm px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ws.activityFeedOpen
                ? 'text-primary bg-primary/10'
                : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Activity feed</span>
          </button>
        </StyledTooltip>
              </div>
            </div>
            <div className="mt-0.5 border-t border-border/60 pt-0.5">
              <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Collaboration & updates</p>
              <div className="grid gap-0.5">
                <Suspense fallback={null}>
                  <WhatsNewPanel />
                </Suspense>
                <Suspense fallback={null}>
                  <MentionBadge />
                </Suspense>
                <Suspense fallback={null}>
                  <ShareProjectButton projectId={projectId} />
                </Suspense>
              </div>
            </div>
            <div className="mt-0.5 border-t border-border/60 pt-0.5">
              <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Workspace mode</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-testid="workspace-mode-button"
                    className="flex h-7 w-full items-center rounded-sm px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{preset.label}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[19rem] space-y-2" align="end">
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
                      'w-full rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
                      plainLabelsEnabled
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {plainLabelsEnabled ? 'Plain-language labels are on' : 'Use plain-language labels'}
                  </button>
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-0.5 border-t border-border/60 pt-0.5">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Display</p>
              <div className="grid gap-0.5">
                <ThemeToggle />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
