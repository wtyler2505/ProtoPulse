import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, Plus, Search, FolderOpen, Clock, Layers, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { Project } from '@shared/schema';

const LAST_PROJECT_KEY = 'protopulse-last-project';

interface ProjectListResponse {
  data: Project[];
  total: number;
}

function getLastProjectId(): number | null {
  try {
    const stored = localStorage.getItem(LAST_PROJECT_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function setLastProjectId(id: number): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, String(id));
  } catch {
    // localStorage unavailable
  }
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
}

function ProjectCard({ project, onSelect }: ProjectCardProps) {
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
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {project.description ? (
          <CardDescription className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {project.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" data-testid={`project-updated-${String(project.id)}`}>
            <Clock className="w-3 h-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
          <span className="flex items-center gap-1" data-testid={`project-version-${String(project.id)}`}>
            <Layers className="w-3 h-3" />
            v{project.version}
          </span>
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
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [autoRedirectDismissed, setAutoRedirectDismissed] = useState(false);

  // Fetch projects
  const {
    data: projectsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectListResponse>({
    queryKey: ['/api/projects?limit=100&offset=0&sort=desc'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const projects = projectsResponse?.data ?? [];

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery]);

  // Auto-redirect to last visited project
  const lastProjectId = getLastProjectId();
  const shouldAutoRedirect =
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

  // Navigate to project
  const handleSelectProject = useCallback(
    (project: Project) => {
      setLastProjectId(project.id);
      navigate(`/projects/${String(project.id)}`);
    },
    [navigate],
  );

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return (await res.json()) as Project;
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/projects?limit=100&offset=0&sort=desc'] });
      setShowCreateDialog(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setLastProjectId(project.id);
      navigate(`/projects/${String(project.id)}`);
    },
  });

  const handleCreateProject = useCallback(() => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      return;
    }
    createProjectMutation.mutate({
      name: trimmedName,
      description: newProjectDescription.trim(),
    });
  }, [newProjectName, newProjectDescription, createProjectMutation]);

  const handleOpenCreateDialog = useCallback(() => {
    setNewProjectName('');
    setNewProjectDescription('');
    setShowCreateDialog(true);
  }, []);

  const handleDismissAutoRedirect = useCallback(() => {
    setAutoRedirectDismissed(true);
  }, []);

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

            {/* Project grid */}
            {filteredProjects.length === 0 ? (
              <div className="text-center py-12" data-testid="no-results">
                <p className="text-muted-foreground">
                  No projects match &quot;{searchQuery}&quot;
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
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border-border" data-testid="create-project-dialog">
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
                    handleCreateProject();
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
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || createProjectMutation.isPending}
              data-testid="button-confirm-create"
              className="bg-[var(--accent-primary,#00F0FF)] text-black hover:bg-[var(--accent-primary,#00F0FF)]/90"
            >
              {createProjectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
