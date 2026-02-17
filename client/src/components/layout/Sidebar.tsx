import { useState, useRef, useEffect } from 'react';
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
  TerminalSquare,
  Search,
  GripVertical,
  Pencil,
  Check,
  ChevronUp,
  Zap,
  Radio,
  Cable,
  MoreHorizontal,
  Plus,
  PlusCircle,
  Link,
  Trash2,
  Edit3,
  ShieldCheck,
  Sparkles,
  Clock,
  RotateCcw,
  Copy
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Cpu }> = {
  mcu: { label: 'MCU', icon: Cpu },
  sensor: { label: 'Sensors', icon: Activity },
  power: { label: 'Power', icon: Zap },
  comm: { label: 'Communications', icon: Radio },
  connector: { label: 'Connectors', icon: Cable },
  generic: { label: 'Other', icon: MoreHorizontal },
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, width = 256, onToggleCollapse }: SidebarProps) {
  const {
    activeView, setActiveView, schematicSheets, activeSheetId, setActiveSheetId,
    history, projectName, projectDescription, addOutputLog,
    nodes, edges, bom, issues, setNodes,
    selectedNodeId, focusNode,
    setProjectName, setProjectDescription,
  } = useProject();

  const [blocksExpanded, setBlocksExpanded] = useState(true);
  const [schematicsExpanded, setSchematicsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(projectName);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [settingsName, setSettingsName] = useState(projectName);
  const [settingsDesc, setSettingsDesc] = useState(projectDescription);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => { setEditNameValue(projectName); }, [projectName]);
  useEffect(() => { setSettingsName(projectName); }, [projectName]);
  useEffect(() => { setSettingsDesc(projectDescription); }, [projectDescription]);

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
        className="hidden md:flex flex-col items-center w-10 h-full bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border shrink-0 cursor-pointer transition-all duration-300"
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
          "bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border flex flex-col h-full text-sm select-none shrink-0 overflow-hidden",
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform md:relative md:w-auto md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ '--sidebar-w': `${width}px` } as React.CSSProperties}
      >
        <div className="flex flex-col h-full w-64 md:w-[var(--sidebar-w)]">
          <div className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 bg-sidebar/20">
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
            nodes={nodes}
            edges={edges}
            bom={bom}
            issues={issues}
            selectedNodeId={selectedNodeId}
            focusNode={focusNode}
            setProjectName={setProjectName}
            setProjectDescription={setProjectDescription}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            editingName={editingName}
            setEditingName={setEditingName}
            editNameValue={editNameValue}
            setEditNameValue={setEditNameValue}
            timelineExpanded={timelineExpanded}
            setTimelineExpanded={setTimelineExpanded}
            expandedCategories={expandedCategories}
            setExpandedCategories={setExpandedCategories}
            settingsName={settingsName}
            setSettingsName={setSettingsName}
            settingsDesc={settingsDesc}
            setSettingsDesc={setSettingsDesc}
            settingsSaved={settingsSaved}
            setSettingsSaved={setSettingsSaved}
            setNodes={setNodes}
          />
        </div>
      </div>
    </>
  );
}

function SidebarContent({
  activeView, setActiveView, schematicSheets, activeSheetId, setActiveSheetId, history,
  blocksExpanded, setBlocksExpanded, schematicsExpanded, setSchematicsExpanded,
  showSettings, setShowSettings, projectName, projectDescription, addOutputLog,
  nodes, edges, bom, issues, setNodes,
  selectedNodeId, focusNode,
  setProjectName, setProjectDescription,
  searchQuery, setSearchQuery,
  editingName, setEditingName, editNameValue, setEditNameValue,
  timelineExpanded, setTimelineExpanded,
  expandedCategories, setExpandedCategories,
  settingsName, setSettingsName,
  settingsDesc, setSettingsDesc,
  settingsSaved, setSettingsSaved,
}: any) {
  const editNameRef = useRef<HTMLInputElement>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'User' | 'AI'>('all');
  const [expandedTimelineItem, setExpandedTimelineItem] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (editingName && editNameRef.current) {
      editNameRef.current.focus();
      editNameRef.current.select();
    }
  }, [editingName]);

  const onDragStart = (e: React.DragEvent, nodeType: string, label: string) => {
    e.dataTransfer.setData('application/reactflow/type', nodeType);
    e.dataTransfer.setData('application/reactflow/label', label);
    e.dataTransfer.effectAllowed = 'move';
  };

  const groupedNodes: Record<string, any[]> = {};
  (nodes || []).forEach((node: any) => {
    const type = node.data?.type || 'generic';
    const key = TYPE_CONFIG[type] ? type : 'generic';
    if (!groupedNodes[key]) groupedNodes[key] = [];
    groupedNodes[key].push(node);
  });

  const categoryOrder = ['mcu', 'sensor', 'power', 'comm', 'connector', 'generic'];
  const activeCategories = categoryOrder.filter(cat => groupedNodes[cat]?.length > 0);

  const query = searchQuery.toLowerCase().trim();
  const filteredCategories = activeCategories.map(cat => {
    const filtered = groupedNodes[cat].filter((n: any) =>
      !query || (n.data?.label || '').toLowerCase().includes(query)
    );
    return { cat, nodes: filtered };
  }).filter(c => c.nodes.length > 0);

  const filteredSheets = (schematicSheets || []).filter((s: any) =>
    !query || s.name.toLowerCase().includes(query)
  );

  const totalNodes = (nodes || []).length;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev: Record<string, boolean>) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const isCategoryExpanded = (cat: string) => expandedCategories[cat] !== false;

  const saveInlineName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setEditNameValue(projectName);
    }
    setEditingName(false);
  };

  const cancelInlineName = () => {
    setEditNameValue(projectName);
    setEditingName(false);
  };

  const formatRelativeTime = (isoStr: string): string => {
    const now = new Date();
    const date = new Date(isoStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatExactTime = (isoStr: string): string => {
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getActionIcon = (action: string) => {
    if (/Created|New/i.test(action)) return Plus;
    if (/Added|Add/i.test(action)) return PlusCircle;
    if (/Connected|Connect|Edge|Wire/i.test(action)) return Link;
    if (/Removed|Delete|Remove/i.test(action)) return Trash2;
    if (/Updated|Renamed|Changed/i.test(action)) return Edit3;
    if (/Validated|Validation|Check/i.test(action)) return ShieldCheck;
    if (/Generated|Generate/i.test(action)) return Sparkles;
    return Clock;
  };

  const getActionColor = (item: any): string => {
    if (/Added|Created/i.test(item.action)) return '#22c55e';
    if (/Removed|Delete/i.test(item.action)) return '#ef4444';
    if (item.user === 'AI') return '#06b6d4';
    if (/Connected|Wire/i.test(item.action)) return '#3b82f6';
    if (/Updated|Changed/i.test(item.action)) return '#f59e0b';
    return '#71717a';
  };

  const getTimePeriod = (isoStr: string): string => {
    const now = new Date();
    const date = new Date(isoStr);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

    if (date >= todayStart) return 'Today';
    if (date >= yesterdayStart) return 'Yesterday';
    if (date >= weekStart) return 'This Week';
    return 'Older';
  };

  const TIMELINE_LIMIT = 5;
  const sortedHistory = [...history].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const filteredHistory = timelineFilter === 'all' ? sortedHistory : sortedHistory.filter((h: any) => h.user === timelineFilter);
  const visibleHistory = timelineExpanded ? filteredHistory : filteredHistory.slice(0, TIMELINE_LIMIT);
  const hiddenCount = Math.max(0, filteredHistory.length - TIMELINE_LIMIT);

  const hasRecentActivity = history.some((h: any) => {
    const diff = Date.now() - new Date(h.timestamp).getTime();
    return diff < 5 * 60 * 1000;
  });

  const groupedVisibleHistory: { period: string; items: any[] }[] = [];
  let lastPeriod = '';
  visibleHistory.forEach((item: any) => {
    const period = getTimePeriod(item.timestamp);
    if (period !== lastPeriod) {
      groupedVisibleHistory.push({ period, items: [item] });
      lastPeriod = period;
    } else {
      groupedVisibleHistory[groupedVisibleHistory.length - 1].items.push(item);
    }
  });

  const settingsDirty = settingsName !== projectName || settingsDesc !== projectDescription;

  const saveSettings = () => {
    if (settingsName.trim() && settingsName !== projectName) {
      setProjectName(settingsName.trim());
    }
    if (settingsDesc !== projectDescription) {
      setProjectDescription(settingsDesc);
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

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

          <div className="px-4 py-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                data-testid="sidebar-search"
                type="text"
                placeholder="Search blocks & sheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/30 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-muted/50 transition-colors"
              />
            </div>
          </div>

          <div className="mt-2 space-y-0.5">
            <div className="px-4 py-1.5 flex items-center gap-2 text-foreground font-medium group">
              <div className="w-1.5 h-1.5 bg-primary shadow-[0_0_5px_var(--color-primary)]"></div>
              {editingName ? (
                <input
                  ref={editNameRef}
                  data-testid="inline-edit-name"
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineName();
                    if (e.key === 'Escape') cancelInlineName();
                  }}
                  onBlur={saveInlineName}
                  className="flex-1 min-w-0 text-sm bg-muted/30 border border-primary/50 px-1.5 py-0.5 text-foreground focus:outline-none"
                />
              ) : (
                <span
                  data-testid="inline-edit-name"
                  className="truncate cursor-pointer flex items-center gap-1.5"
                  onDoubleClick={() => { setEditNameValue(projectName); setEditingName(true); }}
                >
                  {projectName}
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              )}
            </div>

            <div>
              <div
                className="px-4 py-1.5 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/50"
                onClick={() => setBlocksExpanded(!blocksExpanded)}
              >
                {blocksExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-xs">Blocks</span>
                <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 ml-auto">{totalNodes}</span>
              </div>

              {blocksExpanded && (
                <div className="pl-4 pr-2 py-1 space-y-0.5">
                  {filteredCategories.length === 0 && query && (
                    <div className="text-xs text-muted-foreground/60 pl-4 py-1">No results</div>
                  )}
                  {filteredCategories.map(({ cat, nodes: catNodes }) => {
                    const config = TYPE_CONFIG[cat];
                    const IconComp = config.icon;
                    const expanded = isCategoryExpanded(cat);
                    return (
                      <div key={cat} data-testid={`block-category-${cat}`}>
                        <div
                          className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 group/cat"
                          draggable
                          onDragStart={(e) => onDragStart(e, cat, config.label)}
                          onClick={() => toggleCategory(cat)}
                          style={{ cursor: 'grab' }}
                        >
                          <GripVertical className="w-3 h-3 opacity-0 group-hover/cat:opacity-50 shrink-0" />
                          {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                          <IconComp className="w-3 h-3 shrink-0" />
                          <span className="flex-1">{config.label}</span>
                          <span className="text-[10px] bg-muted/50 px-1.5 py-0.5">{catNodes.length}</span>
                        </div>
                        {expanded && (
                          <div className="pl-6 space-y-0.5">
                            {catNodes.map((node: any) => (
                              <ContextMenu key={node.id}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    data-testid={`block-node-${node.id}`}
                                    className={cn(
                                      "text-xs cursor-pointer py-1 px-2 flex items-center gap-2 transition-colors group/node",
                                      selectedNodeId === node.id
                                        ? "bg-primary/20 text-primary"
                                        : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                                    )}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, node.data?.type || cat, node.data?.label || node.id)}
                                    onClick={() => focusNode(node.id)}
                                    style={{ cursor: 'grab' }}
                                  >
                                    <GripVertical className="w-3 h-3 opacity-0 group-hover/node:opacity-50 shrink-0" />
                                    <div className="w-1 h-1 bg-muted-foreground/50 shrink-0"></div>
                                    <span className="truncate">{node.data?.label || node.id}</span>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                                  <ContextMenuItem onSelect={() => focusNode(node.id)}>Focus in Architecture</ContextMenuItem>
                                  <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent((node.data?.label || node.id) + ' datasheet'), '_blank')}>View Datasheet</ContextMenuItem>
                                  <ContextMenuItem onSelect={() => { navigator.clipboard.writeText(node.data?.label || node.id); addOutputLog('[SIDEBAR] Copied: ' + (node.data?.label || node.id)); }}>Copy Name</ContextMenuItem>
                                  <ContextMenuItem onSelect={() => { setNodes(nodes.filter((n: any) => n.id !== node.id)); addOutputLog('[SIDEBAR] Removed from design: ' + (node.data?.label || node.id)); }}>Remove from design</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 ml-auto">{schematicSheets.length}</span>
              </div>

              {schematicsExpanded && (
                <div className="pl-8 pr-2 py-1 space-y-1">
                  {filteredSheets.length === 0 && query && (
                    <div className="text-xs text-muted-foreground/60 py-1">No results</div>
                  )}
                  {filteredSheets.map((sheet: any) => (
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
                        <ContextMenuItem onSelect={() => { navigator.clipboard.writeText(sheet.name); addOutputLog('[SIDEBAR] Copied sheet: ' + sheet.name); }}>Copy Sheet Name</ContextMenuItem>
                        <ContextMenuItem onSelect={() => { addOutputLog('[SIDEBAR] Sheet: ' + sheet.name + ' (' + sheet.components + ' components)'); }}>Sheet Info</ContextMenuItem>
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
              <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 ml-1">({filteredHistory.length})</span>
            </span>
          </div>

          <div className="px-4 mb-2 flex items-center gap-1">
            {(['all', 'User', 'AI'] as const).map((filter) => (
              <button
                key={filter}
                data-testid={`timeline-filter-${filter}`}
                className={cn(
                  "text-[10px] px-2 py-0.5 border transition-colors",
                  timelineFilter === filter
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
                )}
                onClick={() => setTimelineFilter(filter)}
              >
                {filter === 'all' ? 'All' : filter}
              </button>
            ))}
          </div>

          <div className="px-4 relative">
            <div className="flex items-center gap-2 mb-3" data-testid="timeline-live-indicator">
              <div className={cn(
                "w-2 h-2 shrink-0",
                hasRecentActivity
                  ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                  : "bg-muted-foreground/50"
              )} />
              {hasRecentActivity && (
                <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">Live</span>
              )}
            </div>

            {groupedVisibleHistory.map((group, groupIdx) => (
              <div key={group.period}>
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{group.period}</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="relative space-y-0">
                  {group.items.map((item: any, itemIdx: number) => {
                    const IconComp = getActionIcon(item.action);
                    const color = getActionColor(item);
                    const isExpanded = expandedTimelineItem === item.id;
                    const isLastInGroup = itemIdx === group.items.length - 1;
                    return (
                      <div key={item.id} className="relative">
                        {!isLastInGroup && (
                          <div
                            className="absolute left-[5px] top-[18px] bottom-0 w-px z-0"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <div
                          className="relative pl-6 py-1.5 group/item cursor-pointer"
                          onClick={() => setExpandedTimelineItem(isExpanded ? null : item.id)}
                          data-testid={`timeline-item-${item.id}`}
                        >
                          <div className="absolute left-0 top-[6px] z-10 flex items-center justify-center w-3 h-3">
                            <IconComp className="w-3 h-3" style={{ color }} />
                          </div>

                          <button
                            data-testid={`timeline-undo-${item.id}`}
                            className="absolute right-0 top-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:bg-muted/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              addOutputLog('[TIMELINE] Undo requested: ' + item.action);
                            }}
                          >
                            <RotateCcw className="w-[10px] h-[10px] text-muted-foreground" />
                          </button>

                          {isExpanded ? (
                            <div className="border border-border/50 bg-muted/20 p-2 mr-4">
                              <div className="text-xs font-medium text-foreground mb-1">{item.action}</div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 border",
                                  item.user === 'AI'
                                    ? "bg-primary/20 text-primary border-primary/30"
                                    : "bg-muted/50 text-muted-foreground border-border/50"
                                )}>{item.user}</span>
                                <span className="text-[10px] text-muted-foreground">{formatExactTime(item.timestamp)}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1.5">
                                <button
                                  className="text-[10px] px-1.5 py-0.5 bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(item.action);
                                    addOutputLog(`[TIMELINE] Copied: ${item.action}`);
                                  }}
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  Copy
                                </button>
                                <button
                                  className="text-[10px] px-1.5 py-0.5 bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTimelineItem(null);
                                  }}
                                >
                                  <X className="w-2.5 h-2.5" />
                                  Close
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-xs font-medium text-foreground group-hover/item:text-primary transition-colors truncate pr-4">{item.action}</div>
                              <div className="text-[10px] text-muted-foreground flex justify-between pr-4">
                                <span>{item.user}</span>
                                <span>{formatRelativeTime(item.timestamp)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {filteredHistory.length > TIMELINE_LIMIT && (
            <div className="px-4 mt-2">
              <button
                data-testid="timeline-show-more"
                className="text-xs text-primary hover:text-primary/80 transition-colors w-full text-left pl-6 py-1 flex items-center gap-1"
                onClick={() => setTimelineExpanded(!timelineExpanded)}
              >
                {timelineExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show {hiddenCount} more...
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border bg-sidebar/20">
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
            <input
              data-testid="settings-name-input"
              type="text"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              onBlur={saveSettings}
              onKeyDown={(e) => { if (e.key === 'Enter') saveSettings(); }}
              className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Description</div>
            <textarea
              data-testid="settings-desc-input"
              value={settingsDesc}
              onChange={(e) => setSettingsDesc(e.target.value)}
              onBlur={saveSettings}
              rows={2}
              className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
            />
            {settingsDirty && (
              <button
                className="w-full text-xs bg-primary text-primary-foreground py-1.5 px-3 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                onClick={saveSettings}
              >
                <Check className="w-3 h-3" />
                Save Changes
              </button>
            )}
            {settingsSaved && (
              <div className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved successfully
              </div>
            )}
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3">Stats</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{(nodes || []).length}</span> nodes
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{(edges || []).length}</span> edges
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{(bom || []).length}</span> BOM items
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{(issues || []).length}</span> issues
              </div>
            </div>
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
