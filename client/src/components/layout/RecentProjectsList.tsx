import { useState, useMemo, useCallback } from 'react';
import { Pin, PinOff, Clock, SortAsc, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRecentProjects } from '@/lib/recent-projects';
import type { RecentProjectEntry, RecentSortMode } from '@/lib/recent-projects';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(epochMs: number): string {
  const now = Date.now();
  const diffMs = now - epochMs;
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
  return new Date(epochMs).toLocaleDateString();
}

const SORT_OPTIONS: { value: RecentSortMode; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'Name' },
  { value: 'pinned', label: 'Pinned' },
];

// ---------------------------------------------------------------------------
// RecentProjectRow
// ---------------------------------------------------------------------------

interface RecentProjectRowProps {
  entry: RecentProjectEntry;
  onSelect: (projectId: number) => void;
  onTogglePin: (projectId: number) => void;
  onRemove: (projectId: number) => void;
}

function RecentProjectRow({ entry, onSelect, onTogglePin, onRemove }: RecentProjectRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
        'hover:bg-muted/50 group',
        entry.pinned && 'bg-[var(--accent-primary,#00F0FF)]/5',
      )}
      data-testid={`recent-project-${String(entry.projectId)}`}
      onClick={() => { onSelect(entry.projectId); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entry.projectId);
        }
      }}
    >
      {/* Pin indicator */}
      <button
        className={cn(
          'flex-shrink-0 p-1 rounded transition-colors',
          entry.pinned
            ? 'text-[var(--accent-primary,#00F0FF)]'
            : 'text-muted-foreground opacity-0 group-hover:opacity-100',
          'hover:bg-muted',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(entry.projectId);
        }}
        data-testid={`pin-project-${String(entry.projectId)}`}
        aria-label={entry.pinned ? 'Unpin project' : 'Pin project'}
        type="button"
      >
        {entry.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
      </button>

      {/* Project info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate group-hover:text-[var(--accent-primary,#00F0FF)] transition-colors">
          {entry.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{formatRelativeTime(entry.lastAccessedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <button
        className="flex-shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-destructive transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.projectId);
        }}
        data-testid={`remove-recent-${String(entry.projectId)}`}
        aria-label="Remove from recents"
        type="button"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentProjectsList
// ---------------------------------------------------------------------------

export interface RecentProjectsListProps {
  searchQuery: string;
  onSelectProject: (projectId: number) => void;
  validProjectIds?: ReadonlySet<number>;
  helperText?: string | null;
}

export function RecentProjectsList({ searchQuery, onSelectProject, validProjectIds, helperText }: RecentProjectsListProps) {
  const { query, togglePin, removeEntry, count } = useRecentProjects();
  const [sortMode, setSortMode] = useState<RecentSortMode>('recent');

  const rawEntries = useMemo(
    () => query(searchQuery, sortMode),
    [query, searchQuery, sortMode],
  );

  const entries = useMemo(
    () => rawEntries.filter((entry) => !validProjectIds || validProjectIds.has(entry.projectId)),
    [rawEntries, validProjectIds],
  );

  const handleTogglePin = useCallback(
    (projectId: number) => {
      togglePin(projectId);
    },
    [togglePin],
  );

  const handleRemove = useCallback(
    (projectId: number) => {
      removeEntry(projectId);
    },
    [removeEntry],
  );

  if (count === 0) {
    return null;
  }

  if (entries.length === 0 && !searchQuery.trim()) {
    return null;
  }

  return (
    <div className="mb-6" data-testid="recent-projects-list">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Projects
        </h3>
        <div className="flex items-center gap-1" data-testid="recent-sort-controls">
          <SortAsc className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sortMode === opt.value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => { setSortMode(opt.value); }}
              data-testid={`sort-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {helperText ? (
        <p className="mb-2 text-xs text-muted-foreground/80" data-testid="recent-projects-helper-text">
          {helperText}
        </p>
      ) : null}

      {/* Entry list */}
      <div className="space-y-0.5" data-testid="recent-entries">
        {entries.map((entry) => (
          <RecentProjectRow
            key={entry.projectId}
            entry={entry}
            onSelect={onSelectProject}
            onTogglePin={handleTogglePin}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Empty search state */}
      {entries.length === 0 && searchQuery.trim() ? (
        <p className="text-xs text-muted-foreground text-center py-3" data-testid="recent-no-results">
          No recent projects match your search
        </p>
      ) : null}
    </div>
  );
}
