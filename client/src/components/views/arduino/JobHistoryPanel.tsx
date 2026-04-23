import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  History,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Loader2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectId } from '@/lib/project-context';
import { cn } from '@/lib/utils';

import type { ArduinoJob } from '@shared/schema';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: string | Date | null | undefined): string {
  if (!date) {
    return '—';
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startedAt: string | Date | null | undefined, finishedAt: string | Date | null | undefined): string {
  if (!startedAt || !finishedAt) {
    return '—';
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (isNaN(start) || isNaN(end)) {
    return '—';
  }
  const ms = end - start;
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const secs = Math.round(ms / 1000);
  if (secs < 60) {
    return `${String(secs)}s`;
  }
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${String(mins)}m ${String(remainSecs)}s`;
}

type JobStatus = 'completed' | 'failed' | 'cancelled' | 'pending' | 'running';

const STATUS_CONFIG: Record<JobStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', label: 'Success' },
  failed: { icon: XCircle, color: 'text-red-400 bg-red-500/15 border-red-500/30', label: 'Failed' },
  cancelled: { icon: Ban, color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', label: 'Cancelled' },
  pending: { icon: Clock, color: 'text-muted-foreground bg-muted/50 border-muted-foreground/30', label: 'Pending' },
  running: { icon: Loader2, color: 'text-blue-400 bg-blue-500/15 border-blue-500/30', label: 'Running' },
};

function getStatusConfig(status: string): typeof STATUS_CONFIG.completed {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as JobStatus];
  }
  return STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobHistoryPanelProps {
  className?: string;
}

export default function JobHistoryPanel({ className }: JobHistoryPanelProps) {
  const projectId = useProjectId();
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<{ data: ArduinoJob[]; total: number }>({
    queryKey: ['arduino', 'jobs', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${String(projectId)}/arduino/jobs`, {
        headers: { 'X-Session-Id': localStorage.getItem('sessionId') ?? '' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch job history: ${String(res.status)}`);
      }
      return res.json() as Promise<{ data: ArduinoJob[]; total: number }>;
    },
    refetchInterval: 5000,
  });

  const jobs = data?.data ?? [];

  const toggleExpand = (jobId: number) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="job-history-panel"
        className={cn('flex items-center justify-center h-full', className)}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="job-history-panel"
        className={cn('flex flex-col items-center justify-center h-full gap-2 p-4', className)}
      >
        <XCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load job history'}
        </p>
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <div
        data-testid="job-history-panel"
        className={cn('flex flex-col items-center justify-center h-full gap-3 p-8 text-center', className)}
      >
        <div data-testid="job-history-empty" className="w-full max-w-sm">
          <EmptyState
            icon={History}
            title="No jobs yet"
            description="Compile or upload a sketch to see your build history here. Each job records its output, duration, and status."
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="job-history-panel"
      className={cn('flex flex-col h-full overflow-hidden', className)}
    >
      <div className="border-b border-border bg-card/60 px-3 py-2 flex items-center gap-2">
        <History className="w-4 h-4 text-[var(--color-editor-accent)]" />
        <h2 className="text-sm font-semibold text-foreground">Build History</h2>
        <span className="text-xs text-muted-foreground ml-auto">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border">
          {jobs.map((job) => {
            const config = getStatusConfig(job.status);
            const StatusIcon = config.icon;
            const isExpanded = expandedJobId === job.id;
            const args = job.args as Record<string, unknown> | null;
            const fqbn = typeof args?.fqbn === 'string' ? args.fqbn : undefined;
            const boardLabel = fqbn ? fqbn.split(':').pop() : undefined;

            return (
              <div key={job.id} data-testid={`job-history-item-${String(job.id)}`}>
                <Button
                  variant="ghost"
                  data-testid={`job-history-toggle-${String(job.id)}`}
                  className="w-full justify-start h-auto py-2.5 px-3 rounded-none hover:bg-muted/30"
                  onClick={() => {
                    toggleExpand(job.id);
                  }}
                >
                  <div className="flex items-center gap-2 w-full min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}

                    <StatusIcon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        job.status === 'running' && 'animate-spin',
                        config.color.split(' ')[0],
                      )}
                    />

                    <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-xs font-medium text-foreground capitalize">
                          {job.jobType}
                        </span>
                        {boardLabel && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {boardLabel}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 h-4 ml-auto shrink-0', config.color)}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{formatTimestamp(job.createdAt)}</span>
                        <span>{formatDuration(job.startedAt, job.finishedAt)}</span>
                        {job.exitCode !== null && (
                          <span>exit: {String(job.exitCode)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Button>

                {isExpanded && (
                  <div
                    data-testid={`job-history-log-${String(job.id)}`}
                    className="bg-background/80 border-t border-border"
                  >
                    {job.summary && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/50">
                        {job.summary}
                      </div>
                    )}
                    <pre className="p-3 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-60 overflow-auto">
                      {job.log ?? 'No output log available.'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
