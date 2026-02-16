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
  FolderOpen,
  X,
  TerminalSquare
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, width = 256, onToggleCollapse }: SidebarProps) {
  const { activeView, setActiveView, schematicSheets, activeSheetId, setActiveSheetId, history, projectName, projectDescription, addOutputLog } = useProject();
  const [blocksExpanded, setBlocksExpanded] = useState(true);
  const [schematicsExpanded, setSchematicsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const navItems: { icon: typeof LayoutGrid; view: string; label: string }[] = [
    { icon: LayoutGrid, view: 'architecture', label: 'Architecture' },
    { icon: Cpu, view: 'schematic', label: 'Schematic' },
    { icon: Package, view: 'procurement', label: 'Procurement' },
    { icon: Activity, view: 'validation', label: 'Validation' },
    { icon: TerminalSquare, view: 'output', label: 'Output' },
  ];

  if (collapsed) {
    return (
      <div
        data-testid="sidebar-collapsed"
        className="hidden md:flex flex-col items-center w-10 h-full bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border shrink-0 cursor-pointer transition-all duration-300"
        onClick={onToggleCollapse}
      >
        <div className="h-14 flex items-center justify-center border-b border-sidebar-border w-full">
          <div className="w-7 h-7 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Layers className="w-4 h-4 text-primary" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-1">
          {navItems.map((item) => (
            <Tooltip key={item.view}>
              <TooltipTrigger asChild>
                <button
                  data-testid={`sidebar-icon-${item.view}`}
                  title={item.label}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center transition-colors",
                    activeView === item.view
                      ? "text-primary bg-primary/10 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                      : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveView(item.view as any);
                  }}
                >
                  <item.icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="sidebar-icon-settings"
                title="Settings"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Settings className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="right">
              <p>Open project settings</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border flex flex-col h-full text-sm select-none shrink-0 overflow-hidden",
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform md:relative md:w-auto md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ '--sidebar-w': `${width}px` } as React.CSSProperties}
      >
        <div className="flex flex-col h-full w-64 md:w-[var(--sidebar-w)]">
          <div className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 bg-sidebar/30">
            <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col justify-center flex-1 min-w-0">
              <span className="font-display font-bold text-lg leading-none tracking-tight truncate">ProtoPulse</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1">System Architect</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="sidebar-close"
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>Close sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <SidebarContent
            activeView={activeView}
            setActiveView={setActiveView}
            schematicSheets={schematicSheets}
            activeSheetId={activeSheetId}
            setActiveSheetId={setActiveSheetId}
            history={history}
            blocksExpanded={blocksExpanded}
            setBlocksExpanded={setBlocksExpanded}
            schematicsExpanded={schematicsExpanded}
            setSchematicsExpanded={setSchematicsExpanded}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            projectName={projectName}
            projectDescription={projectDescription}
            addOutputLog={addOutputLog}
          />
        </div>
      </div>
    </>
  );
}

function SidebarContent({
  activeView, setActiveView, schematicSheets, activeSheetId, setActiveSheetId, history,
  blocksExpanded, setBlocksExpanded, schematicsExpanded, setSchematicsExpanded,
  showSettings, setShowSettings, projectName, projectDescription, addOutputLog
}: any) {
  return (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="mb-6">
          <div className="px-4 py-2 flex items-center justify-between group cursor-pointer hover:bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              Project Explorer
            </span>
          </div>
          
          <div className="mt-2 space-y-0.5">
            <div className="px-4 py-1.5 flex items-center gap-2 text-foreground font-medium">
              <div className="w-1.5 h-1.5 bg-primary shadow-[0_0_5px_var(--color-primary)]"></div>
              <span className="truncate">{projectName}</span>
            </div>

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
                    <ContextMenu key={block}>
                      <ContextMenuTrigger asChild>
                        <div
                          className="text-xs text-muted-foreground hover:text-primary cursor-pointer py-0.5 flex items-center gap-2"
                          onClick={() => setActiveView('architecture')}
                        >
                          <div className="w-1 h-1 bg-muted-foreground/50"></div>
                          {block}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                        <ContextMenuItem onSelect={() => setActiveView('architecture')}>View in Architecture</ContextMenuItem>
                        <ContextMenuItem onSelect={() => console.log('View datasheet', block)}>View Datasheet</ContextMenuItem>
                        <ContextMenuItem onSelect={() => console.log('Edit properties', block)}>Edit Properties</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </div>

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
                  {schematicSheets.map((sheet: any) => (
                    <ContextMenu key={sheet.id}>
                      <ContextMenuTrigger asChild>
                        <div 
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
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                        <ContextMenuItem onSelect={() => { setActiveView('schematic'); setActiveSheetId(sheet.id); }}>Open Sheet</ContextMenuItem>
                        <ContextMenuItem onSelect={() => console.log('Rename sheet', sheet.name)}>Rename Sheet</ContextMenuItem>
                        <ContextMenuItem onSelect={() => console.log('Duplicate sheet', sheet.name)}>Duplicate Sheet</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="px-4 py-2 mb-2 border-t border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="w-3 h-3" />
              Timeline
            </span>
          </div>
          <div className="px-4 relative space-y-4">
            <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border"></div>
            {history.map((item: any) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <div
                    className="relative pl-6 group cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(item.action);
                      addOutputLog(`[TIMELINE] Copied: ${item.action}`);
                    }}
                    data-testid={`timeline-item-${item.id}`}
                  >
                    <div className={cn(
                      "absolute left-[5px] top-1.5 w-2 h-2 border-2 border-background z-10",
                      item.user === 'AI' ? "bg-primary" : "bg-muted-foreground"
                    )}></div>
                    <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">{item.action}</div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>{item.user}</span>
                      <span>{item.timestamp}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="right">
                  <p>Click to copy: {item.action}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border bg-sidebar/30">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              data-testid="button-project-settings"
              className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-medium">Project Settings</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="right">
            <p>Open project settings</p>
          </TooltipContent>
        </Tooltip>
        {showSettings && (
          <div className="px-3 pb-3 space-y-2 border-t border-border pt-2 mt-1 bg-muted/10 backdrop-blur">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Project Name</div>
            <div className="text-xs font-medium text-foreground">{projectName}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Description</div>
            <div className="text-xs text-muted-foreground">{projectDescription}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Version</div>
            <div
              className="text-xs font-mono text-primary cursor-pointer hover:underline"
              data-testid="text-version"
              onClick={() => {
                navigator.clipboard.writeText('ProtoPulse v1.0.0-alpha');
                addOutputLog('[SYSTEM] Version info copied: ProtoPulse v1.0.0-alpha');
              }}
            >v1.0.0-alpha</div>
          </div>
        )}
      </div>
    </>
  );
}
