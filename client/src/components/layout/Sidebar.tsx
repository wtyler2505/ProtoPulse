/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  useArchitecture,
  useBom,
  useHistory,
  useOutput,
  useProjectId,
  useProjectMeta,
  useValidation,
} from '@/lib/project-context';
import type { BomItem, ProjectHistoryItem, ValidationIssue, ViewMode } from '@/lib/project-context';
import type { GraphNode, GraphEdge } from '@/lib/graph-types';
import { cn } from '@/lib/utils';
import {
  Layers,
  Settings,
  Search,
  Pencil,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import FeatureMaturityBadge from '@/components/ui/FeatureMaturityBadge';
import { useToast } from '@/hooks/use-toast';
import { alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import { getViewFeatureMaturity } from '@/lib/feature-maturity';
import { projectMutationKeys, projectQueryKeys, isProjectMutationKey } from '@/lib/query-keys';
import { apiRequest } from '@/lib/queryClient';
import {
  SIDEBAR_GROUPS,
  getNavItemsForGroup,
  loadCollapsedGroups,
  saveCollapsedGroups,
} from '@/lib/sidebar-groups';
import { useBeginnerMode } from '@/lib/beginner-mode';
import { useRolePreset } from '@/lib/role-presets';
import SidebarHeader from '@/components/layout/sidebar/SidebarHeader';
import CoachPanel from '@/components/layout/sidebar/CoachPanel';
import ProjectSettingsPanel from '@/components/layout/sidebar/ProjectSettingsPanel';
import {
  getHardwareWorkspaceFactClasses,
  getHardwareWorkspaceToneClasses,
  useHardwareWorkspaceStatus,
} from '@/lib/hardware-workspace-status';
import {
  getProjectHealthFactClasses,
  getProjectHealthToneClasses,
  useProjectHealth,
} from '@/lib/project-health';
import ProjectExplorer from './sidebar/ProjectExplorer';
import HistoryList from './sidebar/HistoryList';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, width = 280, onToggleCollapse }: SidebarProps) {
  const { activeView, setActiveView, projectName, projectDescription, setProjectName, setProjectDescription } = useProjectMeta();
  const { nodes, edges, setNodes, selectedNodeId, focusNode } = useArchitecture();
  const { bom } = useBom();
  const { issues } = useValidation();
  const { history } = useHistory();
  const { addOutputLog } = useOutput();
  const { getLabel } = useBeginnerMode();
  const { isViewVisible } = useRolePreset();

  const hasDesignContent = (nodes ?? []).length > 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(projectName);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(loadCollapsedGroups);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

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
            className="w-full h-7 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors border-b border-sidebar-border/50"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </StyledTooltip>
        <div className="h-9 flex items-center justify-center border-b border-sidebar-border w-full shrink-0">
          <div className="w-6 h-6 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5 overflow-y-auto no-scrollbar">
          {SIDEBAR_GROUPS.map((group) => {
            const items = getNavItemsForGroup(group).filter(
              (item) => isViewVisible(item.view) && (alwaysVisibleIds.has(item.view) || hasDesignContent),
            );
            if (items.length === 0) { return null; }
            const GroupIcon = group.icon;
            const isGroupCollapsed = collapsedGroups[group.id] === true;
            return (
              <div key={group.id} data-testid={`sidebar-group-collapsed-${group.id}`}>
                <StyledTooltip content={group.label} side="right">
                  <button
                    data-testid={`sidebar-group-toggle-${group.id}`}
                    className="w-8 h-5.5 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-1"
                    onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                  >
                    <GroupIcon className="w-3 h-3" />
                  </button>
                </StyledTooltip>
                {!isGroupCollapsed && items.map((item) => {
                  const maturity = getViewFeatureMaturity(item.view);
                  return (
                    <StyledTooltip
                      key={item.view}
                      content={maturity ? (
                        <div className="space-y-1">
                          <p>{getLabel(item.label)}</p>
                          <FeatureMaturityBadge maturity={maturity.maturity} label={maturity.shortLabel} className="pointer-events-none" />
                          <p className="max-w-[220px] text-[11px] text-muted-foreground">{maturity.description}</p>
                        </div>
                      ) : getLabel(item.label)}
                      side="right"
                    >
                      <button
                        data-testid={`sidebar-icon-${item.view}`}
                        className={cn(
                          'w-8 h-8 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                          activeView === item.view
                            ? 'text-primary bg-primary/10 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                            : 'text-muted-foreground hover:text-primary hover:bg-muted/50',
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveView(item.view);
                        }}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                      </button>
                    </StyledTooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="pb-2.5 shrink-0">
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
            activeView={activeView}
            setActiveView={setActiveView}
            hasDesignContent={hasDesignContent}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
            getLabel={getLabel}
            isViewVisible={isViewVisible}
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
  nodes: GraphNode[];
  edges: GraphEdge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  setNodes: (nodes: GraphNode[]) => void;
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
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  hasDesignContent: boolean;
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (groupId: string) => void;
  getLabel: (term: string) => string;
  isViewVisible: (view: ViewMode) => boolean;
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
  activeView, setActiveView,
  hasDesignContent, collapsedGroups, toggleGroup,
  getLabel, isViewVisible,
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
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/25 transition-colors border-b border-sidebar-border/50"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Back to Projects</span>
      </Link>
      <div className="flex-1 overflow-y-auto py-0.5">
        <div className="mb-2">
          <div className="px-2.5 py-1 flex items-center justify-between group cursor-pointer hover:bg-muted/25 rounded-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] flex items-center gap-2">
              Project Explorer
            </span>
          </div>

          <div className="px-2.5 py-0.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                data-testid="sidebar-search"
                type="text"
                placeholder="Search blocks..."
                aria-label="Search blocks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7.5 w-full pl-6.5 pr-2 text-[11px] bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-muted/60 transition-colors focus-ring"
              />
            </div>
          </div>

          <div className="mt-1 space-y-0.5">
            <div className="px-2.5 py-0.5 flex items-center gap-1.5 text-foreground font-medium group">
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
                  className="flex-1 min-w-0 text-sm bg-muted/30 border border-primary/50 px-1.5 py-0 text-foreground focus-visible:outline-none focus-ring"
                />
              ) : (
                <span
                  data-testid="inline-edit-name"
                  className="truncate cursor-pointer flex flex-1 min-w-0 items-center gap-1.5"
                  title={projectName}
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

        {/* Grouped view navigation */}
        <div className="mb-2">
          {SIDEBAR_GROUPS.map((group) => {
            const items = getNavItemsForGroup(group).filter(
              (item) => isViewVisible(item.view) && (alwaysVisibleIds.has(item.view) || hasDesignContent),
            );
            if (items.length === 0) { return null; }
            const GroupIcon = group.icon;
            const isGroupCollapsed = collapsedGroups[group.id] === true;
            return (
              <div key={group.id} data-testid={`sidebar-group-${group.id}`}>
                <InteractiveCard
                  aria-expanded={!isGroupCollapsed}
                  aria-label={isGroupCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                  data-testid={`sidebar-group-header-${group.id}`}
                  className="px-2.5 py-1 flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-sm transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  {isGroupCollapsed
                    ? <ChevronRight className="w-3 h-3 shrink-0" />
                    : <ChevronDown className="w-3 h-3 shrink-0" />
                  }
                  <GroupIcon className="w-3 h-3 shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{group.label}</span>
                </InteractiveCard>
                {!isGroupCollapsed && (
                  <div className="space-y-0">
                    {items.map((item) => {
                      const maturity = getViewFeatureMaturity(item.view);
                      return (
                        <button
                          key={item.view}
                          data-testid={`sidebar-nav-${item.view}`}
                          className={cn(
                            'w-full px-2.5 pl-7 py-1 flex items-center gap-1 text-[11px] leading-5 transition-colors border-l-2 border-transparent',
                            activeView === item.view
                              ? 'text-primary bg-primary/12 border-primary/70'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                          )}
                          onClick={() => setActiveView(item.view)}
                        >
                          <span className="truncate flex-1 text-left">{getLabel(item.label)}</span>
                          {maturity && (
                            <FeatureMaturityBadge
                              maturity={maturity.maturity}
                              label={maturity.shortLabel}
                              className="ml-auto shrink-0"
                              data-testid={`sidebar-maturity-${item.view}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <CoachPanel />

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
  const projectId = useProjectId();
  const { setActiveView } = useProjectMeta();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutatingCount = useIsMutating({
    predicate: (mutation) => isProjectMutationKey(mutation.options.mutationKey, projectId),
  });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const prevMutating = useRef(0);

  useEffect(() => {
    // When mutations transition from >0 to 0, record the timestamp
    if (prevMutating.current > 0 && mutatingCount === 0) {
      setLastSavedAt(new Date());
    }
    prevMutating.current = mutatingCount;
  }, [mutatingCount]);

  const health = useProjectHealth(projectId, {
    isSaving: mutatingCount > 0,
    lastSavedAt,
  });
  const hardwareStatus = useHardwareWorkspaceStatus();
  const createRestorePointMutation = useMutation({
    mutationKey: projectMutationKeys.designSnapshots(projectId),
    mutationFn: async () => {
      const now = new Date();
      const datePart = now.toLocaleDateString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timePart = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const response = await apiRequest('POST', `/api/projects/${projectId}/snapshots`, {
        name: `Recovery checkpoint - ${datePart} ${timePart}`,
        description: 'Quick restore point created from the workspace health panel.',
      });

      return response.json() as Promise<{ id: number; name: string }>;
    },
    onSuccess: async (snapshot) => {
      await queryClient.invalidateQueries({ queryKey: projectQueryKeys.designSnapshots(projectId) });
      toast({
        title: 'Restore point saved',
        description: `"${snapshot.name}" is now available in Design History.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to save restore point',
        description: error.message,
      });
    },
  });

  const StatusIcon = health.isSaving
    ? Loader2
    : health.tone === 'warning'
      ? AlertTriangle
      : health.tone === 'recovery'
        ? History
        : ShieldCheck;

  return (
    <div
      data-testid="project-health-indicator"
      className="border-t border-sidebar-border/80 bg-sidebar/10 px-2 py-1"
    >
      <div className="flex min-h-6 items-center gap-1.5 text-[11px] text-foreground">
        <span
          data-testid="project-health-badge"
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
            getProjectHealthToneClasses(health.tone),
          )}
        >
          <StatusIcon className={cn('h-2.5 w-2.5', health.isSaving && 'animate-spin')} />
          <span>{health.badgeLabel}</span>
        </span>
        <span data-testid="project-health-summary" className="truncate leading-tight">
          {health.summary}
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-[14px]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="project-health-action"
          className="h-6 px-1.5 text-[11px] font-medium text-primary hover:text-primary"
          disabled={createRestorePointMutation.isPending}
          onClick={() => {
            if (health.actionMode === 'createSnapshot') {
              createRestorePointMutation.mutate();
              return;
            }

            setActiveView('design_history');
          }}
        >
          {createRestorePointMutation.isPending ? 'Saving restore point...' : health.actionLabel}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="project-health-details-toggle"
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Details
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="max-h-[min(420px,calc(100vh-96px))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-3"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Project health</p>
              <p data-testid="project-health-detail" className="text-[11px] leading-snug text-muted-foreground/90">
                {health.detail}
              </p>
              <div className="flex flex-wrap gap-1">
                {health.facts.map((fact) => (
                  <span
                    key={fact.id}
                    data-testid={`project-health-fact-${fact.id}`}
                    className={cn(
                      'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      getProjectHealthFactClasses(fact.tone),
                    )}
                  >
                    {fact.label}
                  </span>
                ))}
              </div>
              <div data-testid="hardware-status-indicator" className="space-y-1.5 border-t border-border/40 pt-2">
                <div className="flex items-center gap-1.5 text-[11px] text-foreground">
                  <span
                    data-testid="hardware-status-badge"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      getHardwareWorkspaceToneClasses(hardwareStatus.tone),
                    )}
                  >
                    <span>{hardwareStatus.badgeLabel}</span>
                  </span>
                  <span data-testid="hardware-status-summary" className="truncate">
                    {hardwareStatus.summary}
                  </span>
                </div>
                <p data-testid="hardware-status-detail" className="text-[11px] leading-snug text-muted-foreground">
                  {hardwareStatus.detail}
                </p>
                <div className="flex flex-wrap gap-1">
                  {hardwareStatus.facts.map((fact) => (
                    <span
                      key={fact.id}
                      data-testid={`hardware-status-fact-${fact.id}`}
                      className={cn(
                        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                        getHardwareWorkspaceFactClasses(fact.tone),
                      )}
                    >
                      {fact.label}
                    </span>
                  ))}
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="hardware-status-action"
                    className="h-6 px-1.5 text-[11px] font-medium text-primary hover:text-primary"
                    onClick={() => setActiveView(hardwareStatus.actionView)}
                  >
                    {hardwareStatus.actionLabel}
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
