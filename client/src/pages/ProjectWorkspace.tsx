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
import { LayoutGrid, Cpu, Package, Activity, TerminalSquare } from 'lucide-react';

function WorkspaceContent() {
  const { activeView, setActiveView } = useProject();

  const tabs: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'project_explorer', label: 'Project Explorer', icon: null }, // Hidden in tab bar, handled by sidebar
    { id: 'output', label: 'Output', icon: TerminalSquare },
    { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
    { id: 'schematic', label: 'Schematic', icon: Cpu },
    { id: 'procurement', label: 'Procurement', icon: Package },
    { id: 'validation', label: 'Validation', icon: Activity },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 relative bg-[#090a0d]">
        {/* Top Tab Bar */}
        <header className="h-10 border-b border-border bg-background flex items-center px-2 gap-1 z-10">
          {tabs.filter(t => t.id !== 'project_explorer').map((tab) => (
            <button
              key={tab.id}
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

        {/* Main Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
          {activeView === 'output' && <OutputView />}
          {activeView === 'architecture' && <ArchitectureView />}
          {activeView === 'schematic' && <SchematicView />}
          {activeView === 'procurement' && <ProcurementView />}
          {activeView === 'validation' && <ValidationView />}
        </div>
      </main>

      <ChatPanel />
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
