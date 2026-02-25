import { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
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
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Search,
  Pencil,
} from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { navItems } from '@/components/layout/sidebar/sidebar-constants';
import SidebarHeader from '@/components/layout/sidebar/SidebarHeader';
import ProjectSettingsPanel from '@/components/layout/sidebar/ProjectSettingsPanel';
import ComponentTree from './sidebar/ComponentTree';
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

  const [blocksExpanded, setBlocksExpanded] = useState(true);
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
            <StyledTooltip key={item.view} content={item.label} side="right">
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
                    setActiveView(item.view);
                  }}
                >
                  <item.icon className="w-4 h-4" />
                </button>
            </StyledTooltip>
          ))}
        </div>
        <div className="pb-3">
          <StyledTooltip content="Open project settings" side="right">
              <button
                data-testid="sidebar-icon-settings"
                title="Settings"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
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
          <SidebarHeader onClose={onClose} />
          <SidebarContent
            history={history}
            blocksExpanded={blocksExpanded}
            setBlocksExpanded={setBlocksExpanded}
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
  blocksExpanded: boolean;
  setBlocksExpanded: (v: boolean) => void;
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
  blocksExpanded, setBlocksExpanded,
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
                placeholder="Search blocks..."
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
    </>
  );
}
