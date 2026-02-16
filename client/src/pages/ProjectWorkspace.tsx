import { ProjectProvider, useProject } from '@/lib/project-context';
import Sidebar from '@/components/layout/Sidebar';
import ChatPanel from '@/components/panels/ChatPanel';
import ArchitectureView from '@/components/views/ArchitectureView';
import SchematicView from '@/components/views/SchematicView';
import ProcurementView from '@/components/views/ProcurementView';
import ValidationView from '@/components/views/ValidationView';

function WorkspaceContent() {
  const { activeView } = useProject();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 border-b border-border bg-background/50 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-3">
             <span className="text-muted-foreground/60 text-xs uppercase tracking-widest font-bold">PROJECT</span>
             <span className="font-display font-bold text-lg text-foreground tracking-wide">SMART_AGRO_NODE_V1</span>
             <span className="px-2 py-0.5 rounded-sm text-[10px] bg-primary/10 text-primary border border-primary/20 font-mono">EDITING</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SYSTEM ONLINE
             </div>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden bg-card/10">
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
    <ProjectProvider>
      <WorkspaceContent />
    </ProjectProvider>
  );
}
