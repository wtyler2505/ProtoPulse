import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useParams, Redirect } from 'wouter';
import { ProjectProvider } from '@/lib/project-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import Sidebar from '@/components/layout/Sidebar';
import ChatPanel from '@/components/panels/ChatPanel';
import { ViewMode } from '@/lib/project-context';

const ArchitectureView = lazy(() => import('@/components/views/ArchitectureView'));
const ComponentEditorView = lazy(() => import('@/components/views/ComponentEditorView'));
const ProcurementView = lazy(() => import('@/components/views/ProcurementView'));
const ValidationView = lazy(() => import('@/components/views/ValidationView'));
const OutputView = lazy(() => import('@/components/views/OutputView'));
const SchematicView = lazy(() => import('@/components/views/SchematicView'));
const BreadboardView = lazy(() => import('@/components/circuit-editor/BreadboardView'));
const PCBLayoutView = lazy(() => import('@/components/circuit-editor/PCBLayoutView'));
const SimulationView = lazy(() => import('@/components/simulation/SimulationPanel'));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { LayoutGrid, Cpu, Package, Activity, TerminalSquare, Menu, MessageCircle, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, CircuitBoard, Grid3X3, Microchip } from 'lucide-react';
import ThemeToggle from '@/components/ui/theme-toggle';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts-modal';

const tabDescriptions: Record<string, string> = {
  output: 'View build output and system logs',
  architecture: 'Design system block diagram',
  component_editor: 'Design individual electronic components',
  schematic: 'Circuit schematic capture and net editing',
  breadboard: 'Virtual breadboard wiring and component placement',
  pcb: 'PCB footprint placement and trace routing',
  procurement: 'Manage bill of materials and sourcing',
  validation: 'Run design rule checks',
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
      className="hidden md:flex w-1 cursor-col-resize items-center justify-center group hover:bg-primary/20 active:bg-primary/30 transition-colors relative z-30 shrink-0 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)]"
      onMouseDown={handleMouseDown}
    >
      <div className="w-px h-8 bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
    </div>
  );
}

function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
    </div>
  );
}

function WorkspaceContent() {
  const { activeView, setActiveView } = useProjectMeta();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [activeView]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [chatWidth, setChatWidth] = useState(350);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(w => Math.max(180, Math.min(480, w + delta)));
  }, []);

  const handleChatResize = useCallback((delta: number) => {
    setChatWidth(w => Math.max(280, Math.min(600, w + delta)));
  }, []);

  const tabs: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> | null }[] = [
    { id: 'project_explorer', label: 'Project Explorer', icon: null },
    { id: 'output', label: 'Output', icon: TerminalSquare },
    { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
    { id: 'component_editor', label: 'Component Editor', icon: Cpu },
    { id: 'schematic', label: 'Schematic', icon: CircuitBoard },
    { id: 'breadboard', label: 'Breadboard', icon: Grid3X3 },
    { id: 'pcb', label: 'PCB', icon: Microchip },
    { id: 'procurement', label: 'Procurement', icon: Package },
    { id: 'validation', label: 'Validation', icon: Activity },
  ];

  const visibleTabs = tabs.filter(t => t.id !== 'project_explorer');

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-main">
        Skip to main content
      </a>
      <a href="#chat-panel" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-20 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm" data-testid="skip-to-chat">
        Skip to AI assistant
      </a>
      <div data-testid="mobile-header" className="h-12 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-4 md:hidden">
        <StyledTooltip content="Open menu" side="bottom">
          <button
            data-testid="mobile-menu-toggle"
            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
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
            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setChatOpen(true)}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </StyledTooltip>
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          width={sidebarWidth}
          onToggleCollapse={() => setSidebarCollapsed(false)}
        />

        {!sidebarCollapsed && <ResizeHandle side="left" onResize={handleSidebarResize} />}
        
        <main id="main-content" ref={mainRef} tabIndex={-1} aria-live="polite" className="flex-1 flex flex-col min-w-0 relative bg-background">
          <header className="h-10 border-b border-border bg-background/60 backdrop-blur-xl hidden md:flex items-center px-1 gap-0 z-10">
            <StyledTooltip content="Toggle sidebar" side="bottom">
              <button
                data-testid="toggle-sidebar"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1"
                title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </StyledTooltip>
            <div className="w-px h-5 bg-border mr-1" />
            {visibleTabs.map((tab) => (
              <StyledTooltip key={tab.id} content={tabDescriptions[tab.id] || tab.label} side="bottom">
                <button
                  data-testid={`tab-${tab.id}`}
                  onClick={() => setActiveView(tab.id)}
                  className={cn(
                    "h-8 px-4 flex items-center gap-2 text-xs font-medium transition-all relative top-[1px]",
                    activeView === tab.id
                      ? "bg-card border-x border-t border-border text-primary z-20 before:absolute before:inset-x-0 before:-top-[1px] before:h-[2px] before:bg-primary"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-transparent"
                  )}
                >
                  {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                  {tab.label}
                </button>
              </StyledTooltip>
            ))}
            <div className="flex-1 border-b border-border h-full"></div>
            <div className="w-px h-5 bg-border ml-1" />
            <StyledTooltip content="Toggle AI assistant" side="bottom">
              <button
                data-testid="toggle-chat"
                onClick={() => setChatCollapsed(!chatCollapsed)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                title={chatCollapsed ? "Show chat" : "Hide chat"}
              >
                {chatCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
              </button>
            </StyledTooltip>

            <div className="ml-2 flex items-center">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
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
          </div>
        </main>

        {!chatCollapsed && <ResizeHandle side="right" onResize={handleChatResize} />}

        <ErrorBoundary>
          <div id="chat-panel">
            <ChatPanel
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              collapsed={chatCollapsed}
              width={chatWidth}
              onToggleCollapse={() => setChatCollapsed(false)}
            />
          </div>
        </ErrorBoundary>
      </div>

      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <div data-testid="mobile-bottom-nav" className="h-14 border-t border-border bg-card/60 backdrop-blur-xl flex items-center justify-around md:hidden">
        {visibleTabs.map((tab) => (
          <StyledTooltip key={tab.id} content={tab.label} side="top">
            <button
              data-testid={`bottom-nav-${tab.id}`}
              onClick={() => setActiveView(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 transition-colors",
                activeView === tab.id
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {tab.icon && <tab.icon className="w-5 h-5" />}
              <span className="hidden sm:block text-[10px] font-medium">{tab.label}</span>
            </button>
          </StyledTooltip>
        ))}
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
      <WorkspaceContent />
    </ProjectProvider>
  );
}
