import { useState, useCallback, useRef, useEffect, useMemo, useReducer, Suspense, type FocusEvent, type ReactNode } from 'react';
import { useParams, useLocation, Redirect } from 'wouter';
import {
  ProjectProvider,
  useArchitecture,
  useBom,
  useProjectId,
  useProjectMeta,
  useValidation,
} from '@/lib/project-context';
import type { ViewMode } from '@/lib/project-context';

import { buildValidationContext } from '@/lib/pcb-tutorial';
import { MilestoneTracker } from '@/lib/progress-milestones';
import type { ProjectState as MilestoneProjectState } from '@/lib/progress-milestones';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { Menu, MessageCircle, Layers } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { useToast } from '@/hooks/use-toast';
import { DndProvider } from '@/lib/dnd-context';
import { TutorialProvider } from '@/lib/tutorial-context';
import { navItems, alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import { shouldIgnoreKeyboardShortcut } from '@/lib/keyboard-shortcuts';
import { createResizeKeyHandler, getResizeAriaProps } from '@/lib/keyboard-resize';
import type { KeyboardResizeConfig } from '@/lib/keyboard-resize';

import { useActionExecutor } from '@/components/panels/chat/hooks/useActionExecutor';
import PredictionPanel from '@/components/ui/PredictionPanel';
import { usePredictions } from '@/hooks/usePredictions';
import { useIsMobile } from '@/hooks/use-mobile';
import RadialMenu from '@/components/ui/RadialMenu';
import { buildPredictionAddNodeActions, getPredictionComponentCount, getPredictionComponentLabel } from '@/lib/prediction-actions';
import { getActionsForContext } from '@/lib/radial-menu-actions';
import type { RadialMenuPosition } from '@/components/ui/RadialMenu';
import type { MenuContext, MenuContextType, TargetKind } from '@/lib/radial-menu-actions';

import {
  Sidebar,
  ChatPanel,
  WorkflowBreadcrumb,
  ShortcutsOverlay,
  CommandPalette,
  UnifiedComponentSearch,
  GlobalSearchDialog,
  TutorialOverlay,
  LessonModeOverlay,
  ActivityFeedPanel,
  PcbTutorialPanel,
  SmartHintToast,
  startPrefetch,
} from './workspace/lazy-imports';
import {
  workspaceReducer,
  createInitialWorkspaceState,
  loadPersistedLayout,
  persistLayout,
} from './workspace/workspace-reducer';
import type { PersistedPanelLayout } from './workspace/workspace-reducer';
import { useHoverPeekPanel } from './workspace/useHoverPeekPanel';
import { ViewRenderer, ViewLoadingFallback } from './workspace/ViewRenderer';
import { WorkspaceHeader } from './workspace/WorkspaceHeader';
import { MobileNav } from './workspace/MobileNav';

/** All valid ViewMode values — used for URL deep link validation. */
const VALID_VIEW_MODES: ReadonlySet<string> = new Set<string>([
  ...navItems.map(i => i.view),
  'project_explorer',
  'dashboard',
  'output',
  'design_history',
  'lifecycle',
  'comments'
]);

function ResizeHandle({ side, onResize, keyboardConfig }: {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
  keyboardConfig: KeyboardResizeConfig;
}) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) { return; }
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

  const handleKeyDown = useMemo(() => createResizeKeyHandler(keyboardConfig), [keyboardConfig]);
  const ariaProps = useMemo(() => getResizeAriaProps(keyboardConfig), [keyboardConfig]);

  return (
    <div
      data-testid={`resize-handle-${side}`}
      className="hidden lg:flex w-1 cursor-col-resize items-center justify-center group hover:bg-primary/20 active:bg-primary/30 transition-colors relative z-30 shrink-0 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-0"
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      {...ariaProps}
    >
      <div className="w-px h-8 bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
    </div>
  );
}

const HOVER_OPEN_DELAY_MS = 220;
const HOVER_CLOSE_DELAY_MS = 110;

function HoverPeekDock({
  side,
  collapsed,
  peekVisible,
  onPeekOpen,
  onPeekClose,
  children,
}: {
  side: 'left' | 'right';
  collapsed: boolean;
  peekVisible: boolean;
  onPeekOpen: () => void;
  onPeekClose: () => void;
  children: ReactNode;
}) {
  // Store the latest handlers in refs so scheduleOpen/scheduleClose can stay
  // stable across renders. This prevents the event listener identity on the
  // wrapper div from churning (which would re-attach on every parent render).
  const onPeekOpenRef = useRef(onPeekOpen);
  const onPeekCloseRef = useRef(onPeekClose);
  useEffect(() => { onPeekOpenRef.current = onPeekOpen; }, [onPeekOpen]);
  useEffect(() => { onPeekCloseRef.current = onPeekClose; }, [onPeekClose]);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable (empty deps) — reads from refs at fire time.
  const scheduleOpen = useCallback(() => {
    if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current !== null) { return; }
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      onPeekOpenRef.current();
    }, HOVER_OPEN_DELAY_MS);
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current !== null) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current !== null) { return; }
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onPeekCloseRef.current();
    }, HOVER_CLOSE_DELAY_MS);
  }, []);

  // Cleanup on unmount — stable closure over the timer refs.
  useEffect(() => () => {
    if (openTimer.current !== null) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const handleBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    scheduleClose();
  }, [scheduleClose]);

  return (
    <div
      data-testid={`hover-peek-dock-${side}`}
      className={cn(
        'relative flex h-full shrink-0 overflow-visible',
        side === 'right' ? 'justify-end' : 'justify-start',
        collapsed ? 'w-10' : 'w-auto',
        peekVisible && collapsed && 'z-40',
      )}
      onMouseEnter={collapsed ? scheduleOpen : undefined}
      onMouseLeave={collapsed ? scheduleClose : undefined}
      onFocusCapture={collapsed ? scheduleOpen : undefined}
      onBlurCapture={collapsed ? handleBlurCapture : undefined}
    >
      <div
        data-testid={`hover-peek-panel-${side}`}
        className={cn(
          'relative h-full transition-shadow duration-200',
          peekVisible && collapsed && 'shadow-2xl',
        )}
      >
        {children}
      </div>

      {collapsed && !peekVisible && (
        <div
          data-testid={`hover-peek-hotspot-${side}`}
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 z-10',
            side === 'left' ? 'left-0 w-3' : 'right-0 w-3',
          )}
          onMouseEnter={scheduleOpen}
        />
      )}
    </div>
  );
}

function WorkspaceContent() {
  const projectId = useProjectId();
  const isMobile = useIsMobile();
  const { activeView, setActiveView, projectName } = useProjectMeta();
  const { runValidation, issues } = useValidation();
  const { nodes, edges, hasResolvedInitialGraph } = useArchitecture();
  const { bom } = useBom();
  const { toast } = useToast();
  const mainRef = useRef<HTMLElement>(null);
  const [location, setLocation] = useLocation();
  const initialUrlApplied = useRef(false);
  const initialViewSyncComplete = useRef(false);
  const activeViewRef = useRef(activeView);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  // Set browser tab title to project name + active view
  useEffect(() => {
    const viewLabel = navItems.find(n => n.view === activeView)?.label ?? activeView;
    document.title = `${viewLabel} — ${projectName} — ProtoPulse`;
    return () => { document.title = 'ProtoPulse'; };
  }, [activeView, projectName]);

  // Initialize prediction engine
  const executeActions = useActionExecutor();
  const { predictions, dismiss, accept, clearAll, isAnalyzing } = usePredictions(
    nodes.map(n => ({ id: n.id, type: n.type ?? 'generic', label: (n.data != null && typeof n.data === 'object' && 'label' in n.data ? String((n.data as Record<string, unknown>).label) : n.id) })),
    edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label as string })),
    bom.map(b => ({ id: String(b.id), partNumber: b.partNumber, description: b.description, quantity: b.quantity }))
  );
  const shouldShowPredictionPanel = isAnalyzing || predictions.length > 0;

  const handlePredictionAccept = useCallback((id: string) => {
    const pred = predictions.find(p => p.id === id);
    if (pred && pred.action) {
      const { type, payload } = pred.action;

      if (type === 'add_component') {
        const label = getPredictionComponentLabel(payload);
        const count = getPredictionComponentCount(payload);
        executeActions(buildPredictionAddNodeActions(payload));
        toast({
          title: count === 1 ? 'Component added' : 'Components added',
          description: count === 1
            ? `Added ${label} to architecture.`
            : `Added ${count} ${label} components to architecture.`,
        });
      } else if (type === 'open_view') {
        const view = typeof payload.view === 'string' ? payload.view : null;
        if (view && VALID_VIEW_MODES.has(view)) {
          setActiveView(view as ViewMode);
          toast({ title: 'View switched', description: `Opened ${view.replace(/_/g, ' ')} view.` });
        }
      } else if (type === 'show_info') {
        const topic = typeof payload.topic === 'string' ? payload.topic : null;
        if (topic) {
          setActiveView('knowledge');
          toast({ title: 'Knowledge Hub', description: `Showing information about ${topic.replace(/[-_]/g, ' ')}.` });
        }
      }
    }
    accept(id);
  }, [predictions, executeActions, accept, toast, setActiveView]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [activeView]);

  // Prefetch lazy-loaded view chunks after initial render
  useEffect(() => {
    startPrefetch();
  }, []);

  const persistedLayout = useMemo(() => loadPersistedLayout(projectId), [projectId]);
  const [ws, dispatch] = useReducer(workspaceReducer, projectId, createInitialWorkspaceState);
  const {
    peekVisible: sidebarPeekVisible,
    openPeek: openSidebarPeek,
    closePeek: closeSidebarPeek,
  } = useHoverPeekPanel({
    collapsed: ws.sidebarCollapsed,
    isMobile,
  });
  const {
    peekVisible: chatPeekVisible,
    openPeek: openChatPeek,
    closePeek: closeChatPeek,
  } = useHoverPeekPanel({
    collapsed: ws.chatCollapsed,
    isMobile,
  });
  const sidebarCollapsed = ws.sidebarCollapsed && !sidebarPeekVisible;
  const chatCollapsed = ws.chatCollapsed && !chatPeekVisible;

  // BL-0231: Radial context menu state
  const [radialMenu, setRadialMenu] = useState<{
    position: RadialMenuPosition;
    context: MenuContext;
  } | null>(null);

  const closeRadialMenu = useCallback(() => setRadialMenu(null), []);

  /** Map activeView to the radial-menu context type (only views that support it). */
  const viewToContextType = useCallback((view: string): MenuContextType | null => {
    switch (view) {
      case 'architecture': return 'architecture';
      case 'schematic': return 'schematic';
      case 'pcb': return 'pcb';
      case 'breadboard': return 'breadboard';
      case 'procurement': return 'bom';
      default: return null;
    }
  }, []);

  /** Detect what was right-clicked based on DOM data attributes. */
  const detectTarget = useCallback((e: MouseEvent): { target: TargetKind; targetId?: string } => {
    let el = e.target as HTMLElement | null;
    while (el && el !== document.body) {
      const nodeId = el.getAttribute('data-id') ?? el.getAttribute('data-nodeid');
      if (nodeId) {
        return { target: 'node', targetId: nodeId };
      }
      const bomRow = el.getAttribute('data-bom-id');
      if (bomRow) {
        return { target: 'bom_row', targetId: bomRow };
      }
      el = el.parentElement;
    }
    return { target: 'canvas' };
  }, []);

  // BL-0231: Right-click handler for radial menu
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) { return; }

    const handleContextMenu = (e: MouseEvent) => {
      const contextType = viewToContextType(activeView);
      if (!contextType) { return; }

      const { target, targetId } = detectTarget(e);
      const ctx: MenuContext = { view: contextType, target, targetId };
      const actions = getActionsForContext(ctx);
      if (actions.length === 0) { return; }

      e.preventDefault();
      setRadialMenu({ position: { x: e.clientX, y: e.clientY }, context: ctx });
    };

    mainEl.addEventListener('contextmenu', handleContextMenu);
    return () => mainEl.removeEventListener('contextmenu', handleContextMenu);
  }, [activeView, viewToContextType, detectTarget]);

  const handleRadialSelect = useCallback((itemId: string) => {
    toast({
      title: `Action: ${itemId}`,
      description: `"${itemId}" triggered on ${radialMenu?.context.view ?? 'unknown'} view${radialMenu?.context.targetId ? ` (target: ${radialMenu.context.targetId})` : ''}.`,
    });
    setRadialMenu(null);
  }, [radialMenu, toast]);

  // BL-0114 + BL-0234: Bootstrap the first active view from the URL (or
  // persisted layout) before enabling the steady-state URL<->view sync.
  useEffect(() => {
    if (initialUrlApplied.current) {
      return;
    }

    const segments = location.split('/').filter(Boolean);
    const urlViewName = segments.length >= 3 && segments[0] === 'projects' ? segments[2] : undefined;

    if (urlViewName && VALID_VIEW_MODES.has(urlViewName)) {
      if (urlViewName !== activeView) {
        setActiveView(urlViewName as ViewMode);
        return;
      }

      initialUrlApplied.current = true;
      initialViewSyncComplete.current = true;
      return;
    }

    // First mount only: fallback to localStorage if no viewName in URL.
    const saved = persistedLayout.activeView;
    if (saved && saved !== activeView && VALID_VIEW_MODES.has(saved)) {
      setActiveView(saved as ViewMode);
      return;
    }
    initialUrlApplied.current = true;
    initialViewSyncComplete.current = true;
    setLocation(`/projects/${String(projectId)}/${activeView}`, { replace: true });
  }, [activeView, location, persistedLayout.activeView, projectId, setActiveView, setLocation]);

  // Important: this must only react to real location changes, not local
  // activeView updates, or it can race against the companion activeView->URL
  // effect and bounce between the old and new view during tab clicks.
  useEffect(() => {
    if (!initialViewSyncComplete.current) {
      return;
    }

    const segments = location.split('/').filter(Boolean);
    const urlViewName = segments.length >= 3 && segments[0] === 'projects' ? segments[2] : undefined;

    if (urlViewName && VALID_VIEW_MODES.has(urlViewName) && urlViewName !== activeViewRef.current) {
      setActiveView(urlViewName as ViewMode);
    }
  }, [location, setActiveView]);

  // UX-011 + BL-0234: Persist panel sizes, collapsed states, and activeView to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const layout: PersistedPanelLayout = {
        sidebarCollapsed: ws.sidebarCollapsed,
        chatCollapsed: ws.chatCollapsed,
        sidebarWidth: ws.sidebarWidth,
        chatWidth: ws.chatWidth,
        activeView,
      };
      persistLayout(projectId, layout);
    }, 500);
    return () => clearTimeout(timer);
  }, [ws.sidebarCollapsed, ws.chatCollapsed, ws.sidebarWidth, ws.chatWidth, activeView, projectId]);

  // BL-0114: Sync URL when activeView changes (after initial mount)
  useEffect(() => {
    if (!initialUrlApplied.current || !initialViewSyncComplete.current) { return; }
    const expectedPath = `/projects/${String(projectId)}/${activeView}`;
    if (location !== expectedPath) {
      setLocation(expectedPath, { replace: true });
    }
  }, [activeView, projectId, location, setLocation]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(e)) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SHORTCUTS' });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenChatPanel = () => {
      dispatch({ type: 'SET_CHAT_OPEN', open: true });
      dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: false });
    };

    window.addEventListener('protopulse:open-chat-panel', handleOpenChatPanel);
    return () => window.removeEventListener('protopulse:open-chat-panel', handleOpenChatPanel);
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

  const hasDesignContent = (nodes ?? []).length > 0;
  const validationErrorCount = (issues ?? []).filter(i => i.severity === 'error').length;
  const activeTabId = `tab-${activeView}`;

  /* BL-0314: Check milestones when project state changes */
  useEffect(() => {
    const safeBom = bom ?? [];
    const safeNodes = nodes ?? [];
    const safeEdges = edges ?? [];
    const milestoneState: MilestoneProjectState = {
      hasNodes: safeNodes.length > 0,
      nodeCount: safeNodes.length,
      hasEdges: safeEdges.length > 0,
      edgeCount: safeEdges.length,
      hasBom: safeBom.length > 0,
      bomItemCount: safeBom.length,
      bomItemsWithPartNumbers: safeBom.filter((b) => b.partNumber && b.partNumber.trim() !== '').length,
      bomItemsWithPrices: safeBom.filter((b) => Number(b.unitPrice) > 0).length,
      hasCircuit: false,
      circuitInstanceCount: 0,
      circuitWireCount: 0,
      hasDrc: false,
      drcErrors: validationErrorCount,
      drcCleanRunCount: 0,
      drcTotalRunCount: 0,
      hasSimulation: false,
      hasExport: false,
      exportFormats: [],
      hasPcbLayout: false,
      pcbTraceCount: 0,
      hasFabOrder: false,
      hasDesignVariables: false,
      sheetCount: 1,
      ercClean: false,
      hasGerberExport: false,
      projectCount: 1,
      hasCommunityContribution: false,
      validationErrorCount,
    };
    const tracker = MilestoneTracker.getInstance();
    const newlyUnlocked = tracker.checkMilestones(milestoneState);
    if (newlyUnlocked.length > 0) {
      for (const id of newlyUnlocked) {
        const milestone = tracker.getMilestone(id);
        if (milestone) {
          toast({ title: `Milestone Unlocked: ${milestone.name}`, description: milestone.reward });
        }
      }
    }
  }, [nodes, edges, bom, validationErrorCount, toast]);

  /* UI-18: Redirect hidden deep links by resetting activeView AND changing the URL.
   * BL-0615: Must update activeView in the same commit as setLocation; otherwise the
   * activeView<->URL sync effects race and bounce between the old (hidden) view and
   * architecture, triggering "Maximum update depth exceeded". */
  useEffect(() => {
    if (!hasResolvedInitialGraph) {
      return;
    }
    if (!alwaysVisibleIds.has(activeView) && !hasDesignContent) {
      const fallbackPath = `/projects/${String(projectId)}/architecture`;
      if (activeView !== 'architecture') {
        setActiveView('architecture');
      }
      if (location !== fallbackPath) {
        setLocation(fallbackPath, { replace: true });
      }
    }
  }, [
    activeView,
    hasDesignContent,
    hasResolvedInitialGraph,
    location,
    projectId,
    setActiveView,
    setLocation,
  ]);

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-main">
        Skip to main content
      </a>
      <a href="#chat-panel" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-20 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-chat">
        Skip to AI assistant
      </a>
      <h1 className="sr-only">ProtoPulse</h1>
      {isMobile && (
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
      )}

      <DndProvider>
      <div className="flex flex-1 min-h-0">
        <ErrorBoundary fallback={<div data-testid="diag-sidebar-error" className="w-64 shrink-0 border-r border-border bg-card/60 p-4 text-xs text-destructive">Sidebar region error</div>}>
          <Suspense fallback={null}>
            <HoverPeekDock
              side="left"
              collapsed={ws.sidebarCollapsed}
              peekVisible={sidebarPeekVisible}
              onPeekOpen={openSidebarPeek}
              onPeekClose={closeSidebarPeek}
            >
              <Sidebar
                isOpen={ws.sidebarOpen}
                onClose={() => dispatch({ type: 'SET_SIDEBAR_OPEN', open: false })}
                collapsed={sidebarCollapsed}
                width={ws.sidebarWidth}
                onToggleCollapse={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: false })}
              />
            </HoverPeekDock>
          </Suspense>
        </ErrorBoundary>

        {!ws.sidebarCollapsed && <ResizeHandle side="left" onResize={handleSidebarResize} keyboardConfig={{ currentValue: ws.sidebarWidth, min: 180, max: 480, onResize: handleSidebarResize, orientation: 'horizontal', positiveDirection: 'grow' }} />}

        <main id="main-content" data-testid="workspace-main" ref={mainRef} tabIndex={-1} aria-live="polite" className="flex-1 flex flex-col min-w-0 relative bg-background">
          <h2 className="sr-only">Design workspace</h2>
          <ErrorBoundary fallback={<div data-testid="diag-header-error" className="border-b border-border bg-card/60 p-3 text-xs text-destructive">Header region error</div>}>
            <WorkspaceHeader ws={ws} dispatch={dispatch} activeView={activeView} setActiveView={setActiveView} />
            <Suspense fallback={null}>
              <WorkflowBreadcrumb />
            </Suspense>
          </ErrorBoundary>

          <div key={activeView} role="tabpanel" id="main-panel" aria-labelledby={activeTabId} className="view-enter flex-1 relative overflow-hidden flex flex-col bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
              <div className="flex-1 relative overflow-hidden">
                <ViewRenderer activeView={activeView} projectId={projectId} />
              </div>
          </div>

          {shouldShowPredictionPanel && (
            ws.predictionPanelOpen ? (
              <div
                data-testid="prediction-panel-dock"
                className="absolute bottom-4 right-4 z-20 w-full max-w-sm max-h-[40vh] overflow-y-auto"
              >
                <PredictionPanel
                  predictions={predictions}
                  onAccept={handlePredictionAccept}
                  onDismiss={dismiss}
                  onClearAll={clearAll}
                  isAnalyzing={isAnalyzing}
                />
              </div>
            ) : (
              <button
                data-testid="prediction-panel-badge"
                onClick={() => dispatch({ type: 'TOGGLE_PREDICTION_PANEL' })}
                className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-xl hover:bg-card transition-colors"
              >
                <span className="text-[#00F0FF]">{predictions.length}</span>
                <span>Design Suggestions</span>
              </button>
            )
          )}

          {/* BL-0186: Activity feed slide-over */}
          {ws.activityFeedOpen && (
            <div
              data-testid="activity-feed-overlay"
              className="absolute top-0 right-0 z-30 w-80 h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl"
            >
              <ErrorBoundary>
                <Suspense fallback={<ViewLoadingFallback />}>
                  <ActivityFeedPanel />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* BL-0301: PCB Tutorial panel */}
          {ws.pcbTutorialOpen && (
            <div
              data-testid="pcb-tutorial-overlay"
              className="absolute top-0 right-0 z-30 h-full"
            >
              <ErrorBoundary>
                <Suspense fallback={<ViewLoadingFallback />}>
                  <PcbTutorialPanel
                    open={ws.pcbTutorialOpen}
                    onClose={() => dispatch({ type: 'SET_PCB_TUTORIAL_OPEN', open: false })}
                    onNavigate={(view: string) => setActiveView(view as ViewMode)}
                    validationContext={buildValidationContext({})}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          {/* BL-0231: Radial context menu */}
          {radialMenu && (
            <RadialMenu
              items={getActionsForContext(radialMenu.context)}
              position={radialMenu.position}
              onClose={closeRadialMenu}
              onSelect={handleRadialSelect}
            />
          )}

          {/* BL-0311: Smart hints triggered by repeated mistakes */}
          <ErrorBoundary fallback={<div data-testid="diag-smart-hint-error" className="fixed bottom-4 left-4 z-50 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Smart hint error</div>}>
            <Suspense fallback={null}>
              <SmartHintToast />
            </Suspense>
          </ErrorBoundary>
        </main>

        {!ws.chatCollapsed && <ResizeHandle side="right" onResize={handleChatResize} keyboardConfig={{ currentValue: ws.chatWidth, min: 280, max: 600, onResize: handleChatResize, orientation: 'horizontal', positiveDirection: 'shrink' }} />}

        <ErrorBoundary fallback={<div data-testid="diag-chat-error" className="w-[350px] shrink-0 border-l border-border bg-card/60 p-4 text-xs text-destructive">Chat region error</div>}>
          <div id="chat-panel">
            <h2 className="sr-only">AI Assistant</h2>
            <Suspense fallback={null}>
              <HoverPeekDock
                side="right"
                collapsed={ws.chatCollapsed}
                peekVisible={chatPeekVisible}
                onPeekOpen={openChatPeek}
                onPeekClose={closeChatPeek}
              >
                <ChatPanel
                  isOpen={ws.chatOpen}
                  onClose={() => dispatch({ type: 'SET_CHAT_OPEN', open: false })}
                  collapsed={chatCollapsed}
                  width={ws.chatWidth}
                  onToggleCollapse={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: false })}
                />
              </HoverPeekDock>
            </Suspense>
          </div>
        </ErrorBoundary>
      </div>
      </DndProvider>

      <ErrorBoundary fallback={<div data-testid="diag-shortcuts-error" className="fixed inset-x-4 top-4 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Shortcuts overlay error</div>}>
        <Suspense fallback={null}>
          <ShortcutsOverlay open={ws.shortcutsOpen} onClose={() => dispatch({ type: 'SET_SHORTCUTS_OPEN', open: false })} activeView={activeView} />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary fallback={<div data-testid="diag-command-error" className="fixed inset-x-4 top-16 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Command/search region error</div>}>
        <Suspense fallback={null}>
          <UnifiedComponentSearch />
          <CommandPalette
            onNavigate={setActiveView}
            onToggleSidebar={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
            onToggleChat={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
            onRunDrc={runValidation}
            sidebarCollapsed={ws.sidebarCollapsed}
            chatCollapsed={ws.chatCollapsed}
          />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary fallback={<div data-testid="diag-global-search-error" className="fixed inset-x-4 top-28 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">Global search error</div>}>
        <Suspense fallback={null}>
          <GlobalSearchDialog onNavigate={setActiveView} />
        </Suspense>
      </ErrorBoundary>

      {/* RS-02 + RS-08: Mobile bottom nav with primary tabs + More menu + active indicators */}
      <ErrorBoundary fallback={<div data-testid="diag-mobile-nav-error" className="h-16 border-t border-border bg-card/60 p-3 text-xs text-destructive lg:hidden">Mobile nav error</div>}>
        <MobileNav ws={ws} dispatch={dispatch} activeView={activeView} setActiveView={setActiveView} />
      </ErrorBoundary>

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
    <ProjectProvider key={rawId} projectId={rawId}>
      <TutorialProvider>
        <WorkspaceContent />
        <Suspense fallback={null}>
          <TutorialOverlay />
        </Suspense>
        <Suspense fallback={null}>
          <LessonModeOverlay />
        </Suspense>
      </TutorialProvider>
    </ProjectProvider>
  );
}
