import { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useOutput } from '@/lib/contexts/output-context';
import { BomItem, ValidationIssue, ProjectHistoryItem } from '@/lib/project-context';
import type { Node, Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Layers,
  Settings,
  FolderOpen,
  Search,
  Pencil,
  Cloud,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { navItems, alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import SidebarHeader from '@/components/layout/sidebar/SidebarHeader';
import ProjectSettingsPanel from '@/components/layout/sidebar/ProjectSettingsPanel';
import ProjectExplorer from './sidebar/ProjectExplorer';
import HistoryList from './sidebar/HistoryList';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, width = 256, onToggleCollapse }: SidebarProps) {
  const { activeView, setActiveView, projectName, projectDescription, setProjectName, setProjectDescription } = useProjectMeta();
  const { nodes, edges, setNodes, selectedNodeId, focusNode } = useArchitecture();
  const { bom } = useBom();
  const { issues } = useValidation();
  const { history } = useHistory();
  const { addOutputLog } = useOutput();

  const hasDesignContent = (nodes ?? []).length > 0;
  const visibleNavItems = navItems.filter(item =>
    alwaysVisibleIds.has(item.view) || hasDesignContent
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(projectName);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => { setEditNameValue(projectName); }, [projectName]);

  if (collapsed) {
    return (
    <div
        data-testid="sidebar-collapsed"
        role="button"
        tabIndex={0}
        aria-label="Expand sidebar"
        className="hidden lg:flex flex-col items-center w-10 h-full bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border shrink-0 cursor-pointer transition-all duration-300"
        onClick={onToggleCollapse}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse?.(); } }}
      >

        {/* UX-015: Back to Projects (collapsed) */}
        <StyledTooltip content="Back to Projects" side="right">
          <Link
            href="/projects"
            data-testid="sidebar-back-to-projects"
            className="w-full h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors border-b border-sidebar-border/50"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </StyledTooltip>
        <div className="h-10 flex items-center justify-center border-b border-sidebar-border w-full shrink-0">
          <div className="w-7 h-7 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Layers className="w-4 h-4 text-primary" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto no-scrollbar">
          {visibleNavItems.map((item) => (
            <StyledTooltip key={item.view} content={item.label} side="right">
                <button
                  data-testid={`sidebar-icon-${item.view}`}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    activeView === item.view
                      ? "text-primary bg-primary/10 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                      : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveView(item.view);
                  }}
                >
                  <item.icon className="w-4 h-4" />
                </button>
            </StyledTooltip>
          ))}
        </div>
        <div className="pb-3 shrink-0">
          <StyledTooltip content="Open project settings" side="right">
              <button
                data-testid="sidebar-icon-settings"
                title="Settings"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse?.();
                }}
              >
                <Settings className="w-4 h-4" />
              </button>
          </StyledTooltip>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          data-testid="sidebar-backdrop"
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }}
        />
      )}
      <div
        data-testid="sidebar-nav"
        className={cn(
          "bg-sidebar/60 backdrop-blur-xl border-r border-sidebar-border flex flex-col h-full text-sm select-none shrink-0 overflow-hidden",
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:relative lg:w-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ '--sidebar-w': `${width}px` } as React.CSSProperties}
      >

        <div className="flex flex-col h-full w-64 lg:w-[var(--sidebar-w)]">
          <SidebarHeader onClose={onClose} />
          <SidebarContent
            history={history}
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
            setNodes={setNodes}
          />
        </div>
      </div>
    </>
  );
}

interface SidebarContentProps {
  history: ProjectHistoryItem[];
  projectName: string;
  projectDescription: string;
  addOutputLog: (log: string) => void;
  nodes: Node[];
  edges: Edge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  setNodes: (nodes: Node[]) => void;
  selectedNodeId: string | null;
  focusNode: (nodeId: string) => void;
  setProjectName: (name: string) => void;
  setProjectDescription: (desc: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  editingName: boolean;
  setEditingName: (v: boolean) => void;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  timelineExpanded: boolean;
  setTimelineExpanded: (v: boolean) => void;
  expandedCategories: Record<string, boolean>;
  setExpandedCategories: Dispatch<SetStateAction<Record<string, boolean>>>;
}

function SidebarContent({
  history,
  projectName, projectDescription, addOutputLog,
  nodes, edges, bom, issues, setNodes,
  selectedNodeId, focusNode,
  setProjectName, setProjectDescription,
  searchQuery, setSearchQuery,
  editingName, setEditingName, editNameValue, setEditNameValue,
  timelineExpanded, setTimelineExpanded,
  expandedCategories, setExpandedCategories,
}: SidebarContentProps) {
  const editNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && editNameRef.current) {
      editNameRef.current.focus();
      editNameRef.current.select();
    }
  }, [editingName]);

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

  return (
    <>
      {/* UX-015: Back to Projects link */}
      <Link
        href="/projects"
        data-testid="sidebar-back-to-projects-expanded"
        className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-b border-sidebar-border/50"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Back to Projects</span>
      </Link>
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
                placeholder="Search blocks..."
                aria-label="Search blocks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 focus:bg-muted/60 transition-colors focus-ring"
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
                  aria-label="Edit project name"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineName();
                    if (e.key === 'Escape') cancelInlineName();
                  }}
                  onBlur={saveInlineName}
                  className="flex-1 min-w-0 text-sm bg-muted/30 border border-primary/50 px-1.5 py-0.5 text-foreground focus:outline-none focus-ring"
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

            <ProjectExplorer
              nodes={nodes}
              bom={bom}
              issues={issues}
              searchQuery={searchQuery}
              selectedNodeId={selectedNodeId}
              expandedCategories={expandedCategories}
              setExpandedCategories={setExpandedCategories}
              focusNode={focusNode}
              setNodes={setNodes}
              addOutputLog={addOutputLog}
            />

          </div>
        </div>

        <HistoryList
          history={history}
          timelineExpanded={timelineExpanded}
          setTimelineExpanded={setTimelineExpanded}
          addOutputLog={addOutputLog}
        />
      </div>

      <ProjectSettingsPanel
        projectName={projectName}
        setProjectName={setProjectName}
        projectDescription={projectDescription}
        setProjectDescription={setProjectDescription}
        nodes={nodes}
        edges={edges}
        bom={bom}
        issues={issues}
        addOutputLog={addOutputLog}
      />
      <SaveStatusIndicator />
    </>
  );
}

// ---------------------------------------------------------------------------
// Save Status Indicator (UX-010)
// ---------------------------------------------------------------------------

function SaveStatusIndicator() {
  const mutatingCount = useIsMutating();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const prevMutating = useRef(0);

  useEffect(() => {
    // When mutations transition from >0 to 0, record the timestamp
    if (prevMutating.current > 0 && mutatingCount === 0) {
      setLastSavedAt(new Date());
    }
    prevMutating.current = mutatingCount;
  }, [mutatingCount]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      data-testid="save-status-indicator"
      className="px-4 py-2 border-t border-sidebar-border flex items-center gap-1.5 text-[10px] text-muted-foreground"
    >
      {mutatingCount > 0 ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span>Saving changes...</span>
        </>
      ) : lastSavedAt ? (
        <>
          <Cloud className="w-3 h-3 text-emerald-400" />
          <span>Last saved at {formatTime(lastSavedAt)}</span>
        </>
      ) : (
        <>
          <Cloud className="w-3 h-3" />
          <span>All changes saved</span>
        </>
      )}
    </div>
  );
}
