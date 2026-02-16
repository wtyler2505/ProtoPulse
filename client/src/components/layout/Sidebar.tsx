import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { LayoutGrid, Cpu, FileText, Activity, Layers, Package, Clock, Settings, FolderGit2 } from 'lucide-react';

const navItems = [
  { id: 'architecture', label: 'Architecture', icon: LayoutGrid },
  { id: 'schematic', label: 'Schematic', icon: Cpu },
  { id: 'procurement', label: 'Procurement', icon: Package },
  { id: 'validation', label: 'Validation', icon: Activity },
];

export default function Sidebar() {
  const { activeView, setActiveView } = useProject();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.4)]">
          <Layers className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg tracking-tight text-foreground">ProtoPulse</h1>
          <div className="text-[10px] text-primary uppercase tracking-widest font-mono">Design System</div>
        </div>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Views</div>
        <nav className="space-y-1 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeView === item.id 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</div>
        <div className="px-2 space-y-1">
          {['Microcontrollers', 'Sensors', 'Power', 'Connectors'].map((category) => (
            <div key={category} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between group">
              <span>{category}</span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded group-hover:bg-muted-foreground/20">{(Math.random() * 20).toFixed(0)}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</div>
        <div className="px-2 space-y-3">
          {[
            { label: 'Added ESP32-S3', time: '2m ago' },
            { label: 'Connected Power', time: '15m ago' },
            { label: 'Project Created', time: '1h ago' }
          ].map((log, i) => (
            <div key={i} className="px-3 flex items-start gap-3">
               <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mt-1.5" />
               <div>
                 <div className="text-sm text-muted-foreground">{log.label}</div>
                 <div className="text-[10px] text-muted-foreground/50">{log.time}</div>
               </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
        <div className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-secondary" />
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium truncate">Demo Project</div>
            <div className="text-xs text-muted-foreground">v0.1.0-alpha</div>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
