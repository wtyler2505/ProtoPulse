import { useState, useRef, useEffect } from 'react';
import { useProject } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Cpu,
  Activity,
  Layers,
  Package,
  Settings,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  X,
  TerminalSquare,
  Search,
  Pencil,
  Check,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { SETTINGS_SAVE_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import ComponentTree from './sidebar/ComponentTree';
import SheetList from './sidebar/SheetList';
import HistoryList from './sidebar/HistoryList';

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
    { icon: Cpu, view: 'component_editor', label: 'Component Editor' },
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

  useEffect(() => {
    if (editingName && editNameRef.current) {
      editNameRef.current.focus();
      editNameRef.current.select();
    }
  }, [editingName]);

  const totalNodes = (nodes || []).length;

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

  const settingsDirty = settingsName !== projectName || settingsDesc !== projectDescription;

  const saveSettings = () => {
    if (settingsName.trim() && settingsName !== projectName) {
      setProjectName(settingsName.trim());
    }
    if (settingsDesc !== projectDescription) {
      setProjectDescription(settingsDesc);
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), SETTINGS_SAVE_FEEDBACK_DURATION);
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
                <ComponentTree
                  nodes={nodes}
                  searchQuery={searchQuery}
                  selectedNodeId={selectedNodeId}
                  expandedCategories={expandedCategories}
                  setExpandedCategories={setExpandedCategories}
                  focusNode={focusNode}
                  setNodes={setNodes}
                  addOutputLog={addOutputLog}
                />
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
                <SheetList
                  schematicSheets={schematicSheets}
                  activeSheetId={activeSheetId}
                  activeView={activeView}
                  searchQuery={searchQuery}
                  setActiveView={setActiveView}
                  setActiveSheetId={setActiveSheetId}
                  addOutputLog={addOutputLog}
                />
              )}
            </div>
          </div>
        </div>

        <HistoryList
          history={history}
          timelineExpanded={timelineExpanded}
          setTimelineExpanded={setTimelineExpanded}
          addOutputLog={addOutputLog}
        />
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
                copyToClipboard('ProtoPulse v1.0.0-alpha');
                addOutputLog('[SYSTEM] Version info copied: ProtoPulse v1.0.0-alpha');
              }}
            >v1.0.0-alpha</div>
          </div>
        )}
      </div>
    </>
  );
}
