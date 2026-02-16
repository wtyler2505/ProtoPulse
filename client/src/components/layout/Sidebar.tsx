import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import { 
  LayoutGrid, 
  Cpu, 
  FileText, 
  Activity, 
  Layers, 
  Package, 
  Settings, 
  History, 
  ChevronRight, 
  ChevronDown, 
  File,
  FolderOpen
} from 'lucide-react';

export default function Sidebar() {
  const { activeView, setActiveView, schematicSheets, activeSheetId, setActiveSheetId, history } = useProject();
  const [blocksExpanded, setBlocksExpanded] = useState(true);
  const [schematicsExpanded, setSchematicsExpanded] = useState(true);

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full text-sm select-none">
      {/* Brand Header - Minimal and Clean */}
      <div className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 bg-sidebar/50">
        <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
          <Layers className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col justify-center">
           <span className="font-display font-bold text-lg leading-none tracking-tight">ProtoPulse</span>
           <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1">System Architect</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        
        {/* Project Explorer Section */}
        <div className="mb-6">
          <div className="px-4 py-2 flex items-center justify-between group cursor-pointer hover:bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              Project Explorer
            </span>
          </div>
          
          <div className="mt-2 space-y-0.5">
            {/* Project Name */}
            <div className="px-4 py-1.5 flex items-center gap-2 text-foreground font-medium">
              <div className="w-1.5 h-1.5 bg-primary shadow-[0_0_5px_var(--color-primary)]"></div>
              Smart_Agro_Node_v1
            </div>

            {/* Blocks Tree */}
            <div>
              <div 
                className="px-4 py-1.5 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/50"
                onClick={() => setBlocksExpanded(!blocksExpanded)}
              >
                {blocksExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-xs">Blocks</span>
              </div>
              
              {blocksExpanded && (
                <div className="pl-8 pr-2 py-1 space-y-1">
                  {['MCU (ESP32)', 'Power (PMU)', 'Comms (LoRa)', 'Sensors'].map((block) => (
                    <div key={block} className="text-xs text-muted-foreground hover:text-primary cursor-pointer py-0.5 flex items-center gap-2">
                      <div className="w-1 h-1 bg-muted-foreground/50"></div>
                      {block}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schematics Tree */}
            <div>
              <div 
                className="px-4 py-1.5 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/50"
                onClick={() => setSchematicsExpanded(!schematicsExpanded)}
              >
                {schematicsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-xs">Schematics</span>
              </div>
              
              {schematicsExpanded && (
                <div className="pl-8 pr-2 py-1 space-y-1">
                  {schematicSheets.map((sheet) => (
                    <div 
                      key={sheet.id} 
                      className={cn(
                        "text-xs cursor-pointer py-1 px-2 flex items-center gap-2 transition-colors",
                        activeSheetId === sheet.id && activeView === 'schematic'
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                      onClick={() => {
                        setActiveView('schematic');
                        setActiveSheetId(sheet.id);
                      }}
                    >
                      <File className="w-3 h-3" />
                      {sheet.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="mb-6">
          <div className="px-4 py-2 mb-2 border-t border-border/50">
             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="w-3 h-3" />
              Timeline
            </span>
          </div>
          <div className="px-4 relative space-y-4">
            <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border"></div>
            {history.map((item, idx) => (
              <div key={item.id} className="relative pl-6 group cursor-pointer">
                <div className={cn(
                  "absolute left-[5px] top-1.5 w-2 h-2 border-2 border-background z-10",
                  item.user === 'AI' ? "bg-primary" : "bg-muted-foreground"
                )}></div>
                <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{item.action}</div>
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>{item.user}</span>
                  <span>{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Settings Footer */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar/50">
        <button className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-4 h-4" />
          <span className="text-xs font-medium">Project Settings</span>
        </button>
      </div>
    </div>
  );
}
