import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getQueryFn } from '@/lib/queryClient';
import { projectQueryKeys } from '@/lib/query-keys';

type RestoreStatus = 'checking' | 'ready' | 'unavailable';
type ProjectHealthTone = 'saving' | 'stable' | 'recovery' | 'warning';
type ProjectHealthFactTone = 'neutral' | 'positive' | 'warning';
export type ProjectHealthActionMode = 'openDesignHistory' | 'createSnapshot';

interface DesignSnapshotSummary {
  id: number;
  name: string;
  createdAt: string;
}

interface DesignSnapshotListResponse {
  data: DesignSnapshotSummary[];
  total: number;
}

interface ProjectHealthSnapshotSummary {
  restorePointCount: number;
  manufacturingCheckpointCount: number;
}

export interface ProjectHealthFact {
  id: string;
  label: string;
  tone: ProjectHealthFactTone;
}

export interface ProjectHealthSummary {
  actionLabel: string;
  actionMode: ProjectHealthActionMode;
  badgeLabel: string;
  detail: string;
  facts: ProjectHealthFact[];
  isSaving: boolean;
  lastSavedAt: Date | null;
  manufacturingCheckpointCount: number;
  restorePointCount: number;
  restoreStatus: RestoreStatus;
  summary: string;
  tone: ProjectHealthTone;
}

export interface BuildProjectHealthSummaryInput {
  isSaving: boolean;
  lastSavedAt: Date | null;
  manufacturingCheckpointCount: number;
  restorePointCount: number;
  restoreStatus: RestoreStatus;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCount(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${String(count)} ${plural}`;
}

export function buildProjectHealthSummary({
  isSaving,
  lastSavedAt,
  manufacturingCheckpointCount,
  restorePointCount,
  restoreStatus,
}: BuildProjectHealthSummaryInput): ProjectHealthSummary {
  const savedFact = lastSavedAt
    ? {
        id: 'saved',
        label: `Saved ${formatTime(lastSavedAt)}`,
        tone: 'neutral' as const,
      }
    : null;

  if (isSaving) {
    const facts: ProjectHealthFact[] = [];
    if (savedFact) {
      facts.push(savedFact);
    }
    facts.push({
      id: 'restore',
      label: restoreStatus === 'ready'
        ? `${formatCount(restorePointCount, 'restore point', 'restore points')} protected`
        : 'Checking restore points',
      tone: restoreStatus === 'ready' && restorePointCount > 0 ? 'positive' : 'neutral',
    });

    return {
      actionLabel: restoreStatus === 'ready' && restorePointCount > 0 ? 'Review restore points' : 'Open Design History',
      actionMode: 'openDesignHistory',
      badgeLabel: 'Saving',
      detail: 'ProtoPulse is persisting your latest project changes and keeping recovery history in sync.',
      facts,
      isSaving,
      lastSavedAt,
      manufacturingCheckpointCount,
      restorePointCount,
      restoreStatus,
      summary: 'Saving project changes',
      tone: 'saving',
    };
  }

  if (restoreStatus === 'unavailable') {
    const facts: ProjectHealthFact[] = [];
    if (savedFact) {
      facts.push(savedFact);
    }
    facts.push({
      id: 'restore',
      label: 'Restore status unavailable',
      tone: 'warning',
    });

    return {
      actionLabel: 'Check restore points',
      actionMode: 'openDesignHistory',
      badgeLabel: 'Restore unknown',
      detail: 'Saved changes are intact, but ProtoPulse could not verify design restore points right now. Open Design History to confirm them.',
      facts,
      isSaving,
      lastSavedAt,
      manufacturingCheckpointCount,
      restorePointCount,
      restoreStatus,
      summary: 'Saved, restore status unavailable',
      tone: 'warning',
    };
  }

  if (restoreStatus === 'checking') {
    const facts: ProjectHealthFact[] = [];
    if (savedFact) {
      facts.push(savedFact);
    }
    facts.push({
      id: 'restore',
      label: 'Checking restore points',
      tone: 'neutral',
    });

    return {
      actionLabel: 'Open Design History',
      actionMode: 'openDesignHistory',
      badgeLabel: 'Saved',
      detail: 'Current edits are saved. ProtoPulse is still checking whether saved restore points are available.',
      facts,
      isSaving,
      lastSavedAt,
      manufacturingCheckpointCount,
      restorePointCount,
      restoreStatus,
      summary: lastSavedAt ? `Saved at ${formatTime(lastSavedAt)}` : 'All changes saved',
      tone: 'stable',
    };
  }

  if (restorePointCount > 0) {
    const facts: ProjectHealthFact[] = [];
    if (savedFact) {
      facts.push(savedFact);
    }
    facts.push({
      id: 'restore',
      label: formatCount(restorePointCount, 'restore point', 'restore points'),
      tone: 'positive',
    });
    if (manufacturingCheckpointCount > 0) {
      facts.push({
        id: 'fab',
        label: formatCount(manufacturingCheckpointCount, 'fab checkpoint', 'fab checkpoints'),
        tone: 'positive',
      });
    }

    return {
      actionLabel: 'Review snapshots',
      actionMode: 'openDesignHistory',
      badgeLabel: 'Saved + restore',
      detail: manufacturingCheckpointCount > 0
        ? `${formatCount(manufacturingCheckpointCount, 'manufacturing checkpoint is', 'manufacturing checkpoints are')} already captured, so you have a rollback trail before major ship actions.`
        : 'Saved restore points are available in Design History if you need to roll back a major change.',
      facts,
      isSaving,
      lastSavedAt,
      manufacturingCheckpointCount,
      restorePointCount,
      restoreStatus,
      summary: `Saved with ${formatCount(restorePointCount, 'restore point', 'restore points')}`,
      tone: 'recovery',
    };
  }

  const facts: ProjectHealthFact[] = [];
  if (savedFact) {
    facts.push(savedFact);
  }
  facts.push({
    id: 'restore',
    label: 'No restore point yet',
    tone: 'warning',
  });

  return {
    actionLabel: 'Create restore point',
    actionMode: 'createSnapshot',
    badgeLabel: 'Saved',
    detail: 'Current edits are saved, but there is no design restore point yet. Capture a snapshot before a risky refactor or export.',
    facts,
    isSaving,
    lastSavedAt,
    manufacturingCheckpointCount,
    restorePointCount,
    restoreStatus,
    summary: lastSavedAt ? `Saved at ${formatTime(lastSavedAt)}` : 'All changes saved',
    tone: 'stable',
  };
}

export function getProjectHealthToneClasses(tone: ProjectHealthTone): string {
  switch (tone) {
    case 'saving':
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'recovery':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'stable':
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

export function getProjectHealthFactClasses(tone: ProjectHealthFactTone): string {
  switch (tone) {
    case 'positive':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'neutral':
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

export function useProjectHealth(
  projectId: number,
  options: { isSaving: boolean; lastSavedAt: Date | null },
): ProjectHealthSummary {
  const snapshotsQuery = useQuery<
    DesignSnapshotListResponse,
    Error,
    ProjectHealthSnapshotSummary
  >({
    queryKey: projectQueryKeys.designSnapshots(projectId),
    queryFn: getQueryFn({ on401: 'throw' }),
    select: (response) => {
      const snapshots = response.data ?? [];
      return {
        restorePointCount: snapshots.length,
        manufacturingCheckpointCount: snapshots.filter((snapshot) =>
          snapshot.name.toLowerCase().startsWith('sent to fab'),
        ).length,
      };
    },
    staleTime: 30_000,
  });

  const restoreStatus: RestoreStatus = snapshotsQuery.isError
    ? 'unavailable'
    : snapshotsQuery.isPending
      ? 'checking'
      : 'ready';

  return useMemo(
    () =>
      buildProjectHealthSummary({
        isSaving: options.isSaving,
        lastSavedAt: options.lastSavedAt,
        manufacturingCheckpointCount: snapshotsQuery.data?.manufacturingCheckpointCount ?? 0,
        restorePointCount: snapshotsQuery.data?.restorePointCount ?? 0,
        restoreStatus,
      }),
    [
      options.isSaving,
      options.lastSavedAt,
      restoreStatus,
      snapshotsQuery.data?.manufacturingCheckpointCount,
      snapshotsQuery.data?.restorePointCount,
    ],
  );
}
