import { useState, useCallback, useRef, useEffect, useMemo, useReducer, lazy, Suspense } from 'react';
import { useParams, Redirect } from 'wouter';
import { ProjectProvider } from '@/lib/project-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { ViewMode } from '@/lib/project-context';

const Sidebar = lazy(() => import('@/components/layout/Sidebar'));
const ChatPanel = lazy(() => import('@/components/panels/ChatPanel'));
const DashboardView = lazy(() => import('@/components/views/DashboardView'));
const ArchitectureView = lazy(() => import('@/components/views/ArchitectureView'));
const ComponentEditorView = lazy(() => import('@/components/views/ComponentEditorView'));
const ProcurementView = lazy(() => import('@/components/views/ProcurementView'));
const ValidationView = lazy(() => import('@/components/views/ValidationView'));
const OutputView = lazy(() => import('@/components/views/OutputView'));
const SchematicView = lazy(() => import('@/components/views/SchematicView'));
const BreadboardView = lazy(() => import('@/components/circuit-editor/BreadboardView'));
const PCBLayoutView = lazy(() => import('@/components/circuit-editor/PCBLayoutView'));
const SimulationView = lazy(() => import('@/components/simulation/SimulationPanel'));
const DesignHistoryView = lazy(() => import('@/components/views/DesignHistoryView'));
const LifecycleDashboard = lazy(() => import('@/components/views/LifecycleDashboard'));
const WorkflowBreadcrumb = lazy(() => import('@/components/layout/WorkflowBreadcrumb'));
const KeyboardShortcutsModal = lazy(() => import('@/components/ui/keyboard-shortcuts-modal'));
const CommandPalette = lazy(() => import('@/components/ui/command-palette'));
const TutorialOverlay = lazy(() => import('@/components/ui/TutorialOverlay'));
const TutorialMenu = lazy(() => import('@/components/ui/TutorialMenu'));
const CommentsPanel = lazy(() => import('@/components/panels/CommentsPanel').then(m => ({ default: m.CommentsPanel })));
const CalculatorsView = lazy(() => import('@/components/views/CalculatorsView'));
const DesignPatternsView = lazy(() => import('@/components/views/DesignPatternsView'));
const StorageManagerPanel = lazy(() => import('@/components/views/StorageManagerPanel'));
const KanbanView = lazy(() => import('@/components/views/KanbanView'));
const KnowledgeView = lazy(() => import('@/components/views/KnowledgeView'));
const BoardViewer3DView = lazy(() => import('@/components/views/BoardViewer3DView'));
const CommunityView = lazy(() => import('@/components/views/CommunityView'));
const PcbOrderingView = lazy(() => import('@/components/views/PcbOrderingView'));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { LayoutDashboard, LayoutGrid, Cpu, Package, Activity, TerminalSquare, Menu, MessageCircle, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, CircuitBoard, Grid3X3, Microchip, MoreHorizontal, ChevronLeft, ChevronRight, History, HeartPulse, MessageSquare, GraduationCap, Calculator, BookOpen, Warehouse, KanbanSquare, BookMarked, Box, Globe, ShoppingBag, Upload, Zap } from 'lucide-react';
import ThemeToggle from '@/components/ui/theme-toggle';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useValidation } from '@/lib/contexts/validation-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useToast } from '@/hooks/use-toast';
import { DndProvider } from '@/lib/dnd-context';
import { TutorialProvider } from '@/lib/tutorial-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

const tabDescriptions: Record<string, string> = {
  dashboard: 'Project overview and summary stats',
  output: 'Export design files and artifacts',
  architecture: 'Design system block diagram',
  component_editor: 'Design individual electronic components',
  schematic: 'Circuit schematic capture and net editing',
  breadboard: 'Virtual breadboard wiring and component placement',
  pcb: 'PCB footprint placement and trace routing',
  procurement: 'Manage bill of materials and sourcing',
  validation: 'Run design rule checks',
  design_history: 'Architecture snapshot history and visual diff',
  lifecycle: 'Component lifecycle tracking and supply chain risk',
  comments: 'Design review comments and discussions',
  calculators: 'Electronics engineering calculators',
  design_patterns: 'Reusable circuit design patterns with educational explanations',
  storage: 'Inventory tracking and storage location management',
  kanban: 'Track design tasks with a kanban board',
  knowledge: 'Electronics reference articles and learning resources',
  viewer_3d: '3D PCB board visualization and mechanical fit check',
  community: 'Browse and share community component library',
  ordering: 'Order PCBs from fabricators with DFM checks',
  simulation: 'SPICE simulation, AC/DC analysis, and waveform viewer',
};

function ResizeHandle({ side, onResize }: { side: 'left' | 'right'; onResize: (delta: number) => void }) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(side === 'left' ? delta : -delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, side]);

  return (
    <div
      data-testid={`resize-handle-${side}`}
      className="hidden lg:flex w-1 cursor-col-resize items-center justify-center group hover:bg-primary/20 active:bg-primary/30 transition-colors relative z-30 shrink-0 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)]"
      onMouseDown={handleMouseDown}
    >
      <div className="w-px h-8 bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
    </div>
  );
}

/* AS-01: Proper skeleton loading state instead of bare spinner */
function ViewLoadingFallback() {
  return (
    <div data-testid="view-loading-fallback" className="flex flex-col items-center justify-center h-full w-full gap-6 bg-card/30">
      <div className="flex items-center gap-8">
        <Skeleton className="w-28 h-16 rounded-lg" />
        <Skeleton className="w-20 h-1 rounded-full" />
        <Skeleton className="w-28 h-16 rounded-lg" />
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="w-24 h-14 rounded-lg" />
        <Skeleton className="w-16 h-1 rounded-full" />
        <Skeleton className="w-24 h-14 rounded-lg" />
        <Skeleton className="w-16 h-1 rounded-full" />
        <Skeleton className="w-24 h-14 rounded-lg" />
      </div>
      <div className="flex flex-col items-center gap-3 mt-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        <span className="text-sm text-muted-foreground">Loading project...</span>
      </div>
    </div>
  );
}

/* AS-05: Scrollable tab bar with fade gradients at edges */
function ScrollableTabBar({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
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

interface WorkspaceState {
  sidebarOpen: boolean;
  chatOpen: boolean;
  sidebarCollapsed: boolean;
  chatCollapsed: boolean;
  sidebarWidth: number;
  chatWidth: number;
  shortcutsOpen: boolean;
  moreMenuOpen: boolean;
}

type WorkspaceAction =
  | { type: 'SET_SIDEBAR_OPEN'; open: boolean }
  | { type: 'SET_CHAT_OPEN'; open: boolean }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_CHAT_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_SIDEBAR_WIDTH'; width: number }
  | { type: 'SET_CHAT_WIDTH'; width: number }
  | { type: 'SET_SHORTCUTS_OPEN'; open: boolean }
  | { type: 'SET_MORE_MENU_OPEN'; open: boolean }
  | { type: 'TOGGLE_SHORTCUTS' };

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.open };
    case 'SET_CHAT_OPEN':
      return { ...state, chatOpen: action.open };
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.collapsed };
    case 'SET_CHAT_COLLAPSED':
      return { ...state, chatCollapsed: action.collapsed };
    case 'SET_SIDEBAR_WIDTH':
      return { ...state, sidebarWidth: action.width };
    case 'SET_CHAT_WIDTH':
      return { ...state, chatWidth: action.width };
    case 'SET_SHORTCUTS_OPEN':
      return { ...state, shortcutsOpen: action.open };
    case 'SET_MORE_MENU_OPEN':
      return { ...state, moreMenuOpen: action.open };
    case 'TOGGLE_SHORTCUTS':
      return { ...state, shortcutsOpen: !state.shortcutsOpen };
  }
}

const initialWorkspaceState: WorkspaceState = {
  sidebarOpen: false,
  chatOpen: false,
  sidebarCollapsed: false,
  chatCollapsed: false,
  sidebarWidth: 256,
  chatWidth: 350,
  shortcutsOpen: false,
  moreMenuOpen: false,
};

function WorkspaceContent() {
  const projectId = useProjectId();
  const { activeView, setActiveView, projectName } = useProjectMeta();
  const { runValidation, issues } = useValidation();
  const { nodes, edges, setNodes, setEdges, pushUndoState } = useArchitecture();
  const { bom, addBomItem } = useBom();
  const { toast } = useToast();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [activeView]);

  const [ws, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SHORTCUTS' });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  /* RS-03: Auto-collapse sidebar at tablet landscape (<=1024px) */
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: true });
      }
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /* RS-04: Auto-collapse chat at narrow desktop (<=1280px) to avoid cramped 3-panel layout */
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: true });
      }
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    dispatch({ type: 'SET_SIDEBAR_WIDTH', width: Math.max(180, Math.min(480, ws.sidebarWidth + delta)) });
  }, [ws.sidebarWidth]);

  const handleChatResize = useCallback((delta: number) => {
    dispatch({ type: 'SET_CHAT_WIDTH', width: Math.max(280, Math.min(600, ws.chatWidth + delta)) });
  }, [ws.chatWidth]);

  /* AS-02: Reorder tabs — Architecture first, Output last (follows hardware design workflow) */
  const tabs = useMemo<{ id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> | null }[]>(() => [
    { id: 'project_explorer', label: 'Project Explorer', icon: null },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
    { id: 'schematic', label: 'Schematic', icon: CircuitBoard },
    { id: 'breadboard', label: 'Breadboard', icon: Grid3X3 },
    { id: 'pcb', label: 'PCB', icon: Microchip },
    { id: 'component_editor', label: 'Component Editor', icon: Cpu },
    { id: 'procurement', label: 'Procurement', icon: Package },
    { id: 'validation', label: 'Validation', icon: Activity },
    { id: 'lifecycle', label: 'Lifecycle', icon: HeartPulse },
    { id: 'design_history', label: 'History', icon: History },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
    { id: 'calculators', label: 'Calculators', icon: Calculator },
    { id: 'design_patterns', label: 'Patterns', icon: BookOpen },
    { id: 'storage', label: 'Inventory', icon: Warehouse },
    { id: 'kanban', label: 'Tasks', icon: KanbanSquare },
    { id: 'knowledge', label: 'Learn', icon: BookMarked },
    { id: 'viewer_3d', label: '3D View', icon: Box },
    { id: 'community', label: 'Community', icon: Globe },
    { id: 'ordering', label: 'Order PCB', icon: ShoppingBag },
    { id: 'simulation', label: 'Simulation', icon: Zap },
    { id: 'output', label: 'Exports', icon: TerminalSquare },
  ], []);

  /* UI-18: Progressive disclosure — hide advanced tabs until prerequisite content exists.
     Always visible: Dashboard, Architecture, Component Editor (entry points).
     Require architecture nodes: Schematic, Breadboard, PCB, Procurement, Validation, Output. */
  const hasDesignContent = (nodes ?? []).length > 0;
  const alwaysVisibleIds = new Set<ViewMode>(['dashboard', 'architecture', 'component_editor', 'calculators', 'design_patterns', 'kanban', 'knowledge', 'community', 'ordering', 'simulation']);

  const visibleTabs = useMemo(
    () => tabs.filter(t => t.id !== 'project_explorer' && (alwaysVisibleIds.has(t.id) || hasDesignContent)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, hasDesignContent],
  );

  const validationErrorCount = (issues ?? []).filter(i => i.severity === 'error').length;
  const validationWarningCount = (issues ?? []).filter(i => i.severity === 'warning').length;
  const bomCount = (bom ?? []).length;
  const activeTabId = `tab-${activeView}`;

  /* UI-18: If current view is hidden by progressive disclosure, redirect to architecture */
  useEffect(() => {
    if (!alwaysVisibleIds.has(activeView) && !hasDesignContent) {
      setActiveView('architecture');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDesignContent, activeView]);

  /* RS-02: Mobile bottom nav primary/secondary split */
  const primaryMobileTabIds = useMemo(() => new Set<ViewMode>(['dashboard', 'architecture', 'schematic', 'component_editor', 'procurement']), []);
  const primaryMobileTabs = useMemo(() => visibleTabs.filter(t => primaryMobileTabIds.has(t.id)), [visibleTabs, primaryMobileTabIds]);
  const secondaryMobileTabs = useMemo(() => visibleTabs.filter(t => !primaryMobileTabIds.has(t.id)), [visibleTabs, primaryMobileTabIds]);

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-main">
        Skip to main content
      </a>
      <a href="#chat-panel" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-20 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-chat">
        Skip to AI assistant
      </a>
      <h1 className="sr-only">ProtoPulse</h1>
      <div data-testid="mobile-header" className="h-12 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-4 lg:hidden">
        <StyledTooltip content="Open menu" side="bottom">
          <button
            data-testid="mobile-menu-toggle"
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', open: true })}
          >
            <Menu className="w-5 h-5" />
          </button>
        </StyledTooltip>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm tracking-tight">ProtoPulse</span>
        </div>
        <StyledTooltip content="Open AI assistant" side="bottom">
          <button
            data-testid="mobile-chat-toggle"
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => dispatch({ type: 'SET_CHAT_OPEN', open: true })}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </StyledTooltip>
      </div>

      <DndProvider>
      <div className="flex flex-1 min-h-0">
        <Suspense fallback={null}>
          <Sidebar
            isOpen={ws.sidebarOpen}
            onClose={() => dispatch({ type: 'SET_SIDEBAR_OPEN', open: false })}
            collapsed={ws.sidebarCollapsed}
            width={ws.sidebarWidth}
            onToggleCollapse={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: false })}
          />
        </Suspense>

        {!ws.sidebarCollapsed && <ResizeHandle side="left" onResize={handleSidebarResize} />}

        <main id="main-content" ref={mainRef} tabIndex={-1} aria-live="polite" className="flex-1 flex flex-col min-w-0 relative bg-background">
          <h2 className="sr-only">Design workspace</h2>
          <header className="h-10 border-b border-border bg-background/60 backdrop-blur-xl hidden lg:flex items-center px-1 gap-0 z-10">
            {/* AS-04: Larger toggle buttons with better contrast */}
            <StyledTooltip content="Toggle sidebar" side="bottom">
              <button
                data-testid="toggle-sidebar"
                onClick={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
                className="p-2 hover:bg-muted/50 bg-muted/20 border border-border/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                title={ws.sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
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
              {visibleTabs.map((tab) => (
                <StyledTooltip key={tab.id} content={tabDescriptions[tab.id] || tab.label} side="bottom">
                  <button
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={activeView === tab.id}
                    aria-controls="main-panel"
                    data-testid={`tab-${tab.id}`}
                    onClick={() => setActiveView(tab.id)}
                    className={cn(
                      /* AS-10: text-sm instead of text-xs; AS-12: h-[3px] accent */
                      "h-8 px-4 flex items-center gap-2 text-sm font-medium transition-all relative top-[1px] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      activeView === tab.id
                        ? "bg-card border-x border-t border-border text-primary z-20 before:absolute before:inset-x-0 before:-top-[1px] before:h-[3px] before:bg-primary before:rounded-b-sm"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-transparent"
                    )}
                  >
                    {/* AS-11: Normalize icon stroke width */}
                    {tab.icon && <tab.icon className="w-3.5 h-3.5 [stroke-width:1.75]" />}
                    {tab.label}
                    {/* UI-18: Badge counts for Validation and Procurement */}
                    {tab.id === 'validation' && validationErrorCount > 0 && (
                      <span data-testid="tab-validation-badge" className="text-[10px] font-medium bg-destructive/20 text-destructive px-1.5 py-0.5 tabular-nums rounded-sm">
                        {validationErrorCount}
                      </span>
                    )}
                    {tab.id === 'validation' && validationErrorCount === 0 && validationWarningCount > 0 && (
                      <span data-testid="tab-validation-badge" className="text-[10px] font-medium bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 tabular-nums rounded-sm">
                        {validationWarningCount}
                      </span>
                    )}
                    {tab.id === 'procurement' && bomCount > 0 && (
                      <span data-testid="tab-procurement-badge" className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 tabular-nums rounded-sm">
                        {bomCount}
                      </span>
                    )}
                  </button>
                </StyledTooltip>
              ))}
            </ScrollableTabBar>

            <div className="border-b border-border h-full w-2 shrink-0"></div>
            <div className="w-px h-5 bg-border ml-1" />
            {/* AS-04: Larger chat toggle button with better contrast */}
            <StyledTooltip content="Toggle AI assistant" side="bottom">
              <button
                data-testid="toggle-chat"
                onClick={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
                className="p-2 hover:bg-muted/50 bg-muted/20 border border-border/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                title={ws.chatCollapsed ? "Show chat" : "Hide chat"}
              >
                {ws.chatCollapsed ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
              </button>
            </StyledTooltip>

            <div className="ml-2 flex items-center gap-1">
              <StyledTooltip content="Import design file" side="bottom">
                <button
                  data-testid="import-design-button"
                  className="p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
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
                  }}
                >
                  <Upload className="w-4 h-4" />
                </button>
              </StyledTooltip>
              <Popover>
                <PopoverTrigger asChild>
                  <StyledTooltip content="Tutorials" side="bottom">
                    <button
                      data-testid="tutorials-button"
                      className="p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <GraduationCap className="w-4 h-4" />
                    </button>
                  </StyledTooltip>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Suspense fallback={null}>
                    <TutorialMenu />
                  </Suspense>
                </PopoverContent>
              </Popover>
              <ThemeToggle />
            </div>
          </header>

          <Suspense fallback={null}>
            <WorkflowBreadcrumb />
          </Suspense>

          <div key={activeView} role="tabpanel" id="main-panel" aria-labelledby={activeTabId} className="view-enter flex-1 relative overflow-hidden bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
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
                    <OutputView />
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
                    <PCBLayoutView />
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
                    <ValidationView />
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
          </div>
        </main>

        {!ws.chatCollapsed && <ResizeHandle side="right" onResize={handleChatResize} />}

        <ErrorBoundary>
          <div id="chat-panel">
            <h2 className="sr-only">AI Assistant</h2>
            <Suspense fallback={null}>
              <ChatPanel
                isOpen={ws.chatOpen}
                onClose={() => dispatch({ type: 'SET_CHAT_OPEN', open: false })}
                collapsed={ws.chatCollapsed}
                width={ws.chatWidth}
                onToggleCollapse={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: false })}
              />
            </Suspense>
          </div>
        </ErrorBoundary>
      </div>
      </DndProvider>

      <Suspense fallback={null}>
        <KeyboardShortcutsModal open={ws.shortcutsOpen} onOpenChange={(open: boolean) => dispatch({ type: 'SET_SHORTCUTS_OPEN', open })} />
      </Suspense>

      <Suspense fallback={null}>
        <CommandPalette
          onNavigate={setActiveView}
          onToggleSidebar={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
          onToggleChat={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
          onRunDrc={runValidation}
          sidebarCollapsed={ws.sidebarCollapsed}
          chatCollapsed={ws.chatCollapsed}
        />
      </Suspense>

      {/* RS-02 + RS-08: Mobile bottom nav with primary tabs + More menu + active indicators */}
      <div data-testid="mobile-bottom-nav" className="h-16 border-t border-border bg-card/60 backdrop-blur-xl flex items-center justify-around lg:hidden px-2">
        {primaryMobileTabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`bottom-nav-${tab.id}`}
            onClick={() => setActiveView(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition-colors relative min-w-[44px] min-h-[44px] rounded-md",
              activeView === tab.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground"
            )}
          >
            {activeView === tab.id && (
              <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
            )}
            {tab.icon && <tab.icon className="w-5 h-5" />}
            <span className="text-[10px] font-medium leading-tight truncate max-w-[60px]">{tab.label}</span>
          </button>
        ))}
        <Popover open={ws.moreMenuOpen} onOpenChange={(open: boolean) => dispatch({ type: 'SET_MORE_MENU_OPEN', open })}>
          <PopoverTrigger asChild>
            <button
              data-testid="bottom-nav-more"
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition-colors relative min-w-[44px] min-h-[44px] rounded-md",
                secondaryMobileTabs.some(t => t.id === activeView)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              {secondaryMobileTabs.some(t => t.id === activeView) && (
                <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
              )}
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-48 p-1">
            {secondaryMobileTabs.map((tab) => (
              <button
                key={tab.id}
                data-testid={`bottom-nav-${tab.id}`}
                onClick={() => {
                  setActiveView(tab.id);
                  dispatch({ type: 'SET_MORE_MENU_OPEN', open: false });
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                  activeView === tab.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.icon && <tab.icon className="w-4 h-4 shrink-0" />}
                {tab.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const params = useParams<{ projectId: string }>();
  const rawId = Number(params.projectId);

  if (!Number.isInteger(rawId) || rawId <= 0) {
    return <Redirect to="/projects/1" />;
  }

  return (
    <ProjectProvider projectId={rawId}>
      <TutorialProvider>
        <WorkspaceContent />
        <Suspense fallback={null}>
          <TutorialOverlay />
        </Suspense>
      </TutorialProvider>
    </ProjectProvider>
  );
}
