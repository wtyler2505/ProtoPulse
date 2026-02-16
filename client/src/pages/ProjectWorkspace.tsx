import { useState } from 'react';
import { useProject, ProjectProvider } from '@/lib/project-context';
import Sidebar from '@/components/layout/Sidebar';
import ChatPanel from '@/components/panels/ChatPanel';
import ArchitectureView from '@/components/views/ArchitectureView';
import SchematicView from '@/components/views/SchematicView';
import ProcurementView from '@/components/views/ProcurementView';
import ValidationView from '@/components/views/ValidationView';
import OutputView from '@/components/views/OutputView';
import { ViewMode } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { LayoutGrid, Cpu, Package, Activity, TerminalSquare, Menu, MessageCircle, Layers } from 'lucide-react';

function WorkspaceContent() {
  const { activeView, setActiveView } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const tabs: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'project_explorer', label: 'Project Explorer', icon: null },
    { id: 'output', label: 'Output', icon: TerminalSquare },
    { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
    { id: 'schematic', label: 'Schematic', icon: Cpu },
    { id: 'procurement', label: 'Procurement', icon: Package },
    { id: 'validation', label: 'Validation', icon: Activity },
  ];

  const visibleTabs = tabs.filter(t => t.id !== 'project_explorer');

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <div data-testid="mobile-header" className="h-12 border-b border-border bg-card flex items-center justify-between px-4 md:hidden">
        <button
          data-testid="mobile-menu-toggle"
          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm tracking-tight">ProtoPulse</span>
        </div>
        <button
          data-testid="mobile-chat-toggle"
          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 flex flex-col min-w-0 relative bg-[#090a0d]">
          <header className="h-10 border-b border-border bg-background hidden md:flex items-center px-2 gap-1 z-10">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
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
            ))}
            <div className="flex-1 border-b border-border h-full"></div>
          </header>

          <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
            {activeView === 'output' && <OutputView />}
            {activeView === 'architecture' && <ArchitectureView />}
            {activeView === 'schematic' && <SchematicView />}
            {activeView === 'procurement' && <ProcurementView />}
            {activeView === 'validation' && <ValidationView />}
          </div>
        </main>

        <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      </div>

      <div data-testid="mobile-bottom-nav" className="h-14 border-t border-border bg-card flex items-center justify-around md:hidden">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
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
        ))}
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  return (
    <div className="dark">
      <ProjectProvider>
        <WorkspaceContent />
      </ProjectProvider>
    </div>
  );
}
