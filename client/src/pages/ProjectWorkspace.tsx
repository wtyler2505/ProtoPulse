import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { useProject, ProjectProvider } from '@/lib/project-context';
import Sidebar from '@/components/layout/Sidebar';
import ChatPanel from '@/components/panels/ChatPanel';
import { ViewMode } from '@/lib/project-context';

const ArchitectureView = lazy(() => import('@/components/views/ArchitectureView'));
const ComponentEditorView = lazy(() => import('@/components/views/ComponentEditorView'));
const ProcurementView = lazy(() => import('@/components/views/ProcurementView'));
const ValidationView = lazy(() => import('@/components/views/ValidationView'));
const OutputView = lazy(() => import('@/components/views/OutputView'));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { LayoutGrid, Cpu, Package, Activity, TerminalSquare, Menu, MessageCircle, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import ThemeToggle from '@/components/ui/theme-toggle';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const tabDescriptions: Record<string, string> = {
  output: 'View build output and system logs',
  architecture: 'Design system block diagram',
  component_editor: 'Design individual electronic components',
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
  const { activeView, setActiveView } = useProject();
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

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(w => Math.max(180, Math.min(480, w + delta)));
  }, []);

  const handleChatResize = useCallback((delta: number) => {
    setChatWidth(w => Math.max(280, Math.min(600, w + delta)));
  }, []);

  const tabs: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'project_explorer', label: 'Project Explorer', icon: null },
    { id: 'output', label: 'Output', icon: TerminalSquare },
    { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
    { id: 'component_editor', label: 'Component Editor', icon: Cpu },
    { id: 'procurement', label: 'Procurement', icon: Package },
    { id: 'validation', label: 'Validation', icon: Activity },
  ];

  const visibleTabs = tabs.filter(t => t.id !== 'project_explorer');

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm">
        Skip to main content
      </a>
      <div data-testid="mobile-header" className="h-12 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-4 md:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="mobile-menu-toggle"
              className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
            <p>Open menu</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm tracking-tight">ProtoPulse</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="mobile-chat-toggle"
              className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
            <p>Open AI assistant</p>
          </TooltipContent>
        </Tooltip>
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
        
        <main id="main-content" ref={mainRef} tabIndex={-1} aria-live="polite" className="flex-1 flex flex-col min-w-0 relative bg-[#090a0d]">
          <header className="h-10 border-b border-border bg-background/60 backdrop-blur-xl hidden md:flex items-center px-1 gap-0 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="toggle-sidebar"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1"
                  title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>Toggle sidebar</p>
              </TooltipContent>
            </Tooltip>
            <div className="w-px h-5 bg-border mr-1" />
            {visibleTabs.map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
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
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                  <p>{tabDescriptions[tab.id] || tab.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            <div className="flex-1 border-b border-border h-full"></div>
            <div className="w-px h-5 bg-border ml-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="toggle-chat"
                  onClick={() => setChatCollapsed(!chatCollapsed)}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                  title={chatCollapsed ? "Show chat" : "Hide chat"}
                >
                  {chatCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>Toggle AI assistant</p>
              </TooltipContent>
            </Tooltip>

            {/* Theme toggle button to switch between light and dark modes */}
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
          </div>
        </main>

        {!chatCollapsed && <ResizeHandle side="right" onResize={handleChatResize} />}

        <ErrorBoundary>
          <ChatPanel
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            collapsed={chatCollapsed}
            width={chatWidth}
            onToggleCollapse={() => setChatCollapsed(false)}
          />
        </ErrorBoundary>
      </div>

      <div data-testid="mobile-bottom-nav" className="h-14 border-t border-border bg-card/60 backdrop-blur-xl flex items-center justify-around md:hidden">
        {visibleTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
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
                <tab.icon className="w-5 h-5" />
                <span className="hidden sm:block text-[10px] font-medium">{tab.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top">
              <p>{tab.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  return (
    <ProjectProvider>
      <WorkspaceContent />
    </ProjectProvider>
  );
}
