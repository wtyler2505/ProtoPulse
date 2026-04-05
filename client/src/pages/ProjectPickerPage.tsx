import { useState, useEffect, useMemo, useCallback, type ComponentType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Loader2,
  Plus,
  Search,
  FolderOpen,
  Clock,
  Layers,
  ArrowRight,
  EyeOff,
  ArchiveRestore,
  Sparkles,
  FlaskConical,
  FolderArchive,
  FolderKanban,
  Beaker,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { RecentProjectsManager, useRecentProjects } from '@/lib/recent-projects';
import { clearCurrentLastProjectId, getLastProjectId, setLastProjectId } from '@/lib/project-navigation-state';
import { getHiddenProjectIds, hideProjectFromPicker, pruneHiddenProjectIds, showProjectInPicker } from '@/lib/project-picker-visibility';
import { projectQueryKeys } from '@/lib/query-keys';
import { RecentProjectsList } from '@/components/layout/RecentProjectsList';
import TeamTemplateSelector from '@/components/views/TeamTemplateSelector';
import SampleProjectGallery from '@/components/views/SampleProjectGallery';
import { useToast } from '@/hooks/use-toast';
import type { AppliedTemplate } from '@/lib/team-templates';
import { SAMPLE_PROJECTS, type SampleProject } from '@/lib/sample-projects';
import type { Project } from '@shared/schema';

interface ProjectListResponse {
  data: Project[];
  total: number;
}

type ProjectFacet = 'all' | 'recent' | 'sample' | 'learning' | 'experimental' | 'archived';

type ProjectStatusBadge = {
  key: string;
  label: string;
  className: string;
};

const SAMPLE_NAME_PREFIXES = SAMPLE_PROJECTS.map((sample) => sample.name.toLowerCase());

const FACET_META: Record<
  ProjectFacet,
  { label: string; description: string; icon: ComponentType<{ className?: string }> }
> = {
  all: {
    label: 'All',
    description: 'Everything currently visible on your home surface.',
    icon: FolderKanban,
  },
  recent: {
    label: 'Recent',
    description: 'Jump back into projects you touched most recently.',
    icon: Clock,
  },
  sample: {
    label: 'Sample',
    description: 'Projects created from guided examples and starter kits.',
    icon: Sparkles,
  },
  learning: {
    label: 'Learning',
    description: 'Friendly projects for practice, tutorials, and guided building.',
    icon: GraduationCap,
  },
  experimental: {
    label: 'Experimental',
    description: 'Sandboxes, tests, audits, and verification workspaces.',
    icon: Beaker,
  },
  archived: {
    label: 'Archived',
    description: 'Projects hidden from the main home surface until you restore them.',
    icon: FolderArchive,
  },
};

function getProjectFacetSet(
  project: Project,
  recentProjectIds: ReadonlySet<number>,
  hiddenProjectIds: ReadonlySet<number>,
): Set<ProjectFacet> {
  const facets = new Set<ProjectFacet>(['all']);
  const haystack = `${project.name} ${project.description ?? ''}`.toLowerCase();
  const normalizedName = project.name.toLowerCase();
  const isArchived = hiddenProjectIds.has(project.id);
  const isSample =
    /\(sample\)\s*$/i.test(project.name) ||
    SAMPLE_NAME_PREFIXES.some((prefix) => normalizedName.startsWith(prefix));
  const isLearning =
    isSample || /\b(learn|learning|starter|tutorial|lab|beginner|guide|exercise|lesson|practice)\b/i.test(haystack);
  const isExperimental = /\b(e2e|test|verify|audit|dev(?:elopment)?|sandbox|prototype|experimental)\b/i.test(haystack);

  if (recentProjectIds.has(project.id) && !isArchived) {
    facets.add('recent');
  }
  if (isSample && !isArchived) {
    facets.add('sample');
  }
  if (isLearning && !isArchived) {
    facets.add('learning');
  }
  if (isExperimental && !isArchived) {
    facets.add('experimental');
  }
  if (isArchived) {
    facets.add('archived');
  }

  return facets;
}

function getProjectStatusBadges(facets: ReadonlySet<ProjectFacet>): ProjectStatusBadge[] {
  const badges: ProjectStatusBadge[] = [];

  if (facets.has('archived')) {
    badges.push({
      key: 'archived',
      label: 'Archived',
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    });
  }
  if (facets.has('recent')) {
    badges.push({
      key: 'recent',
      label: 'Recent',
      className: 'bg-[var(--accent-primary,#00F0FF)]/10 text-[var(--accent-primary,#00F0FF)] border-[var(--accent-primary,#00F0FF)]/30',
    });
  }
  if (facets.has('sample')) {
    badges.push({
      key: 'sample',
      label: 'Sample',
      className: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    });
  }
  if (facets.has('learning') && !facets.has('sample')) {
    badges.push({
      key: 'learning',
      label: 'Learning',
      className: 'bg-green-500/15 text-green-300 border-green-500/30',
    });
  }
  if (facets.has('experimental')) {
    badges.push({
      key: 'experimental',
      label: 'Experimental',
      className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    });
  }

  return badges.slice(0, 3);
}

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) {
    return 'Unknown';
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'Just now';
  }
  if (diffMin < 60) {
    return `${String(diffMin)}m ago`;
  }
  if (diffHr < 24) {
    return `${String(diffHr)}h ago`;
  }
  if (diffDays < 30) {
    return `${String(diffDays)}d ago`;
  }
  return d.toLocaleDateString();
}

function ProjectCardSkeleton() {
  return (
    <Card className="border-border bg-card" data-testid="project-card-skeleton">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onToggleArchived?: (project: Project) => void;
  isArchived?: boolean;
  statusBadges?: ProjectStatusBadge[];
}

function ProjectCard({ project, onSelect, onToggleArchived, isArchived = false, statusBadges = [] }: ProjectCardProps) {
  return (
    <Card
      className={cn(
        'border-border bg-card cursor-pointer transition-all duration-200',
        'hover:border-[var(--accent-primary,#00F0FF)]/50 hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]',
        'group',
      )}
      data-testid={`project-card-${String(project.id)}`}
      onClick={() => { onSelect(project); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(project);
        }
      }}
    >

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground group-hover:text-[var(--accent-primary,#00F0FF)] transition-colors">
            {project.name}
          </CardTitle>
          <div className="flex items-center gap-1">
            {onToggleArchived ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100"
                data-testid={isArchived ? `restore-project-${String(project.id)}` : `archive-project-${String(project.id)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchived(project);
                }}
              >
                {isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {isArchived ? 'Restore' : 'Hide'}
              </Button>
            ) : null}
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        {project.description ? (
          <CardDescription className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {project.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {statusBadges.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5" data-testid={`project-status-badges-${String(project.id)}`}>
            {statusBadges.map((badge) => (
              <Badge
                key={badge.key}
                variant="outline"
                className={cn('px-1.5 py-0 text-[10px]', badge.className)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" data-testid={`project-updated-${String(project.id)}`}>
            <Clock className="w-3 h-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
          {project.version > 1 && (
            <span className="flex items-center gap-1" data-testid={`project-version-${String(project.id)}`}>
              <Layers className="w-3 h-3" />
              v{project.version}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      data-testid="empty-state"
    >
      <div className="w-16 h-16 rounded-full bg-[var(--accent-primary,#00F0FF)]/10 flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-[var(--accent-primary,#00F0FF)]" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">No projects yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Create your first project to start designing circuits, building architectures, and managing components.
      </p>
      <Button
        onClick={onCreateClick}
        data-testid="button-create-first-project"
        className="bg-[var(--accent-primary,#00F0FF)] text-black hover:bg-[var(--accent-primary,#00F0FF)]/90"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Project
      </Button>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      data-testid="error-state"
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load projects</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {error.message}
      </p>
      <Button
        onClick={onRetry}
        variant="outline"
        data-testid="button-retry"
      >
        Try Again
      </Button>
    </div>
  );
}

export default function ProjectPickerPage() {
  const [locationPath, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStep, setCreateStep] = useState<'info' | 'template'>('info');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [autoRedirectDismissed, setAutoRedirectDismissed] = useState(false);
  const [activeFacet, setActiveFacet] = useState<ProjectFacet>('all');
  const [hiddenProjectIds, setHiddenProjectIds] = useState<number[]>(() => getHiddenProjectIds());
  const [recentHelperText, setRecentHelperText] = useState<string | null>(null);
  const { entries: recentEntries } = useRecentProjects();

  useEffect(() => {
    document.title = 'Projects — ProtoPulse';
    return () => { document.title = 'ProtoPulse'; };
  }, []);

  // Fetch projects
  const {
    data: projectsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectListResponse>({
    queryKey: projectQueryKeys.list(),
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const projects = projectsResponse?.data ?? [];
  const availableProjectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const hiddenProjectIdSet = useMemo(() => new Set(hiddenProjectIds), [hiddenProjectIds]);
  const recentProjectIdSet = useMemo(() => new Set(recentEntries.map((entry) => entry.projectId)), [recentEntries]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !hiddenProjectIdSet.has(project.id)),
    [hiddenProjectIdSet, projects],
  );
  const visibleProjectIds = useMemo(() => new Set(visibleProjects.map((project) => project.id)), [visibleProjects]);
  const archivedProjects = useMemo(
    () => projects.filter((project) => hiddenProjectIdSet.has(project.id)),
    [hiddenProjectIdSet, projects],
  );

  const projectFacets = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          getProjectFacetSet(project, recentProjectIdSet, hiddenProjectIdSet),
        ]),
      ),
    [hiddenProjectIdSet, projects, recentProjectIdSet],
  );

  const facetCounts = useMemo(() => {
    const counts: Record<ProjectFacet, number> = {
      all: visibleProjects.length,
      recent: 0,
      sample: 0,
      learning: 0,
      experimental: 0,
      archived: archivedProjects.length,
    };

    visibleProjects.forEach((project) => {
      const facets = projectFacets.get(project.id);
      if (!facets) {
        return;
      }
      (['recent', 'sample', 'learning', 'experimental'] as const).forEach((facet) => {
        if (facets.has(facet)) {
          counts[facet] += 1;
        }
      });
    });

    return counts;
  }, [archivedProjects.length, projectFacets, visibleProjects]);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    const sourceProjects = activeFacet === 'archived' ? archivedProjects : visibleProjects;
    const facetFiltered = activeFacet === 'all'
      ? sourceProjects
      : sourceProjects.filter((project) => projectFacets.get(project.id)?.has(activeFacet));

    if (!searchQuery.trim()) {
      return facetFiltered;
    }
    const q = searchQuery.toLowerCase().trim();
    return facetFiltered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [activeFacet, archivedProjects, projectFacets, searchQuery, visibleProjects]);

  // Auto-redirect to last visited project — only from root URL ("/"), not "/projects".
  // When a user explicitly navigates to /projects they want to see the project picker.
  const lastProjectId = getLastProjectId();
  const isRootEntry = locationPath === '/' || locationPath === '';
  const shouldAutoRedirect =
    isRootEntry &&
    !autoRedirectDismissed &&
    !isLoading &&
    !error &&
    lastProjectId !== null &&
    projects.length > 0 &&
    projects.some((p) => p.id === lastProjectId);

  useEffect(() => {
    if (shouldAutoRedirect && lastProjectId !== null) {
      navigate(`/projects/${String(lastProjectId)}`);
    }
  }, [shouldAutoRedirect, lastProjectId, navigate]);

  // Navigate to project (also records in recent projects)
  const handleSelectProject = useCallback(
    (project: Project) => {
      setLastProjectId(project.id);
      RecentProjectsManager.getInstance().recordAccess({
        id: project.id,
        name: project.name,
        description: project.description,
      });
      navigate(`/projects/${String(project.id)}`);
    },
    [navigate],
  );

  // Navigate to project by ID (from recent projects list)
  const handleSelectProjectById = useCallback(
    (projectId: number) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        handleSelectProject(project);
      } else {
        RecentProjectsManager.getInstance().removeEntry(projectId);
        if (lastProjectId === projectId) {
          clearCurrentLastProjectId();
        }
        toast({
          variant: 'destructive',
          title: 'Project unavailable',
          description: 'That project is no longer available, so it was removed from your recent list.',
        });
      }
    },
    [handleSelectProject, lastProjectId, projects, toast],
  );

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return (await res.json()) as Project;
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
      setShowCreateDialog(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setLastProjectId(project.id);
      RecentProjectsManager.getInstance().recordAccess({
        id: project.id,
        name: project.name,
        description: project.description,
      });
      navigate(`/projects/${String(project.id)}/dashboard`);
    },
  });

  const handleCreateProject = useCallback((descriptionOverride?: string) => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      return;
    }
    createProjectMutation.mutate({
      name: trimmedName,
      description: (descriptionOverride ?? newProjectDescription).trim(),
    });
  }, [newProjectName, newProjectDescription, createProjectMutation]);

  useEffect(() => {
    if (isLoading || error || createProjectMutation.isPending || createProjectMutation.isSuccess) {
      return;
    }

    const recentProjects = RecentProjectsManager.getInstance();
    let removedRecentCount = 0;
    recentProjects.getEntries().forEach((entry) => {
      if (!availableProjectIds.has(entry.projectId)) {
        recentProjects.removeEntry(entry.projectId);
        removedRecentCount += 1;
      }
    });

    const removedHiddenCount = pruneHiddenProjectIds(availableProjectIds);
    if (removedHiddenCount > 0) {
      setHiddenProjectIds(getHiddenProjectIds());
    }

    if (lastProjectId !== null && !availableProjectIds.has(lastProjectId)) {
      clearCurrentLastProjectId();
    }

    setRecentHelperText(
      removedRecentCount > 0
        ? removedRecentCount === 1
          ? 'Removed unavailable project from recents.'
          : `Removed ${String(removedRecentCount)} unavailable projects from recents.`
        : null,
    );
  }, [
    availableProjectIds,
    createProjectMutation.isPending,
    createProjectMutation.isSuccess,
    error,
    isLoading,
    lastProjectId,
  ]);

  useEffect(() => {
    if (activeFacet === 'archived' && hiddenProjectIds.length === 0) {
      setActiveFacet('all');
    }
  }, [activeFacet, hiddenProjectIds.length]);

  const handleProceedToTemplate = useCallback(() => {
    if (!newProjectName.trim()) {
      return;
    }
    setCreateStep('template');
  }, [newProjectName]);

  const handleApplyTemplate = useCallback((applied: AppliedTemplate) => {
    handleCreateProject(applied.projectDescription);
  }, [handleCreateProject]);

  const handleSkipTemplate = useCallback(() => {
    handleCreateProject();
  }, [handleCreateProject]);

  const handleOpenCreateDialog = useCallback(() => {
    setNewProjectName('');
    setNewProjectDescription('');
    setCreateStep('info');
    setShowCreateDialog(true);
  }, []);

  const handleOpenSample = useCallback(
    (sample: SampleProject) => {
      createProjectMutation.mutate({
        name: `${sample.name} (Sample)`,
        description: sample.description,
      });
    },
    [createProjectMutation],
  );

  const handleDismissAutoRedirect = useCallback(() => {
    setAutoRedirectDismissed(true);
  }, []);

  const handleArchiveProject = useCallback(
    (project: Project) => {
      hideProjectFromPicker(project.id);
      setHiddenProjectIds(getHiddenProjectIds());
      toast({
        title: 'Hidden from home',
        description: `${project.name} moved to Archived. You can restore it anytime.`,
      });
    },
    [toast],
  );

  const handleRestoreProject = useCallback(
    (project: Project) => {
      showProjectInPicker(project.id);
      setHiddenProjectIds(getHiddenProjectIds());
      toast({
        title: 'Restored to home',
        description: `${project.name} is back in your main project list.`,
      });
    },
    [toast],
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="project-picker-page">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">ProtoPulse</h1>
            <p className="text-muted-foreground mt-1">Select a project to continue</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="skeleton-grid">
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background" data-testid="project-picker-page">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">ProtoPulse</h1>
          </div>
          <ErrorState error={error as Error} onRetry={() => { void refetch(); }} />
        </div>
      </div>
    );
  }

  // Auto-redirect banner (briefly visible before redirect happens)
  if (shouldAutoRedirect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="project-picker-page">
        <div className="text-center" data-testid="auto-redirect-notice">
          <Loader2 className="w-6 h-6 text-[var(--accent-primary,#00F0FF)] animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            Resuming your last project...
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissAutoRedirect}
            data-testid="button-view-all-projects"
          >
            View All Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="project-picker-page">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ProtoPulse</h1>
            <p className="text-muted-foreground mt-1">Select a project to continue</p>
          </div>
          {projects.length > 0 ? (
            <Button
              onClick={handleOpenCreateDialog}
              data-testid="button-create-project"
              className="bg-[var(--accent-primary,#00F0FF)] text-black hover:bg-[var(--accent-primary,#00F0FF)]/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          ) : null}
        </div>

        {/* Sample projects — always visible */}
        <SampleProjectGallery onOpenSample={handleOpenSample} />

        {/* Empty state */}
        {projects.length === 0 ? (
          <EmptyState onCreateClick={handleOpenCreateDialog} />
        ) : (
          <>
            {/* Search bar */}
            <div className="relative mb-6" data-testid="search-container">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                className="pl-10 bg-card border-border"
                data-testid="input-search-projects"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6" data-testid="project-command-center">
              {(['recent', 'sample', 'learning', 'experimental', 'archived'] as const).map((facet) => {
                const meta = FACET_META[facet];
                const Icon = meta.icon;
                const isActive = activeFacet === facet;
                return (
                  <button
                    key={facet}
                    type="button"
                    onClick={() => { setActiveFacet(facet); }}
                    className={cn(
                      'rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors',
                      isActive && 'border-[var(--accent-primary,#00F0FF)]/50 bg-[var(--accent-primary,#00F0FF)]/5',
                    )}
                    data-testid={`facet-card-${facet}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Icon className="w-4 h-4 text-[var(--accent-primary,#00F0FF)]" />
                      <span className="text-lg font-semibold text-foreground">{facetCounts[facet]}</span>
                    </div>
                    <div className="text-sm font-medium text-foreground">{meta.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mb-6 flex flex-wrap gap-2" data-testid="project-facet-filters">
              {(Object.keys(FACET_META) as ProjectFacet[]).map((facet) => (
                <Button
                  key={facet}
                  type="button"
                  variant={activeFacet === facet ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveFacet(facet); }}
                  data-testid={`facet-filter-${facet}`}
                >
                  {FACET_META[facet].label}
                  <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                    {facetCounts[facet]}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Recent projects with pinning and sort */}
            <RecentProjectsList
              searchQuery={searchQuery}
              onSelectProject={handleSelectProjectById}
              validProjectIds={visibleProjectIds}
              helperText={recentHelperText}
            />

            {/* All projects heading */}
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3" data-testid="all-projects-heading">
              {activeFacet === 'all' ? 'Active Projects' : FACET_META[activeFacet].label}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground" data-testid="facet-description">
              {activeFacet === 'all'
                ? 'Your active project home, with noisy or archived work tucked out of the way.'
                : FACET_META[activeFacet].description}
            </p>

            {/* Project grid */}
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12" data-testid="no-results">
                <p className="text-muted-foreground">
                  {searchQuery.trim()
                    ? `No ${FACET_META[activeFacet].label.toLowerCase()} projects match "${searchQuery}".`
                    : activeFacet === 'archived'
                      ? 'No archived projects yet.'
                      : `No ${FACET_META[activeFacet].label.toLowerCase()} projects yet.`}
                </p>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                data-testid="project-grid"
              >
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    onToggleArchived={activeFacet === 'archived' ? handleRestoreProject : handleArchiveProject}
                    isArchived={activeFacet === 'archived'}
                    statusBadges={getProjectStatusBadges(projectFacets.get(project.id) ?? new Set<ProjectFacet>(['all']))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={cn('bg-card border-border', createStep === 'template' && 'sm:max-w-2xl')} data-testid="create-project-dialog">
          {createStep === 'info' ? (
            <>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Start a new electronics design project.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={newProjectName}
                    onChange={(e) => { setNewProjectName(e.target.value); }}
                    placeholder="My Awesome Circuit"
                    data-testid="input-project-name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleProceedToTemplate();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-description">Description (optional)</Label>
                  <Input
                    id="project-description"
                    value={newProjectDescription}
                    onChange={(e) => { setNewProjectDescription(e.target.value); }}
                    placeholder="A brief description of your project"
                    data-testid="input-project-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setShowCreateDialog(false); }}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProceedToTemplate}
                  disabled={!newProjectName.trim()}
                  data-testid="button-confirm-create"
                  className="bg-[var(--accent-primary,#00F0FF)] text-black hover:bg-[var(--accent-primary,#00F0FF)]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Next: Choose Template
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Choose a Template</DialogTitle>
                <DialogDescription>
                  Select a template to pre-configure DRC rules, BOM requirements, and export presets for &quot;{newProjectName}&quot;.
                </DialogDescription>
              </DialogHeader>
              <TeamTemplateSelector
                projectName={newProjectName.trim()}
                onSelect={handleApplyTemplate}
                onSkip={handleSkipTemplate}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
