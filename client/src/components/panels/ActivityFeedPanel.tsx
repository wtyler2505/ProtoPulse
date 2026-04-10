import { useState, useMemo, useCallback } from 'react';
import { useActivityFeed } from '@/lib/activity-feed';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { cn } from '@/lib/utils';
import {
  Activity,
  Search,
  Trash2,
  Filter,
  Plus,
  Pencil,
  X,
  MessageSquare,
  Download,
  Upload,
  CheckCircle2,
  User,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type { ActivityAction, ActivityEntityType } from '@/lib/activity-feed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<ActivityAction, { label: string; color: string; icon: typeof Plus }> = {
  created: { label: 'Created', color: 'text-emerald-400', icon: Plus },
  updated: { label: 'Updated', color: 'text-cyan-400', icon: Pencil },
  deleted: { label: 'Deleted', color: 'text-red-400', icon: Trash2 },
  commented: { label: 'Commented', color: 'text-amber-400', icon: MessageSquare },
  exported: { label: 'Exported', color: 'text-violet-400', icon: Download },
  imported: { label: 'Imported', color: 'text-blue-400', icon: Upload },
  validated: { label: 'Validated', color: 'text-lime-400', icon: CheckCircle2 },
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  project: 'Project',
  architecture_node: 'Node',
  architecture_edge: 'Edge',
  bom_item: 'BOM Item',
  circuit_design: 'Circuit',
  circuit_instance: 'Instance',
  circuit_wire: 'Wire',
  circuit_net: 'Net',
  component: 'Component',
  validation: 'Validation',
  comment: 'Comment',
  export: 'Export',
  simulation: 'Simulation',
};

const ALL_ACTIONS: ActivityAction[] = [
  'created', 'updated', 'deleted', 'commented', 'exported', 'imported', 'validated',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = Date.now();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return 'just now';
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function userInitials(name?: string): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        data-testid={`activity-filter-${label.toLowerCase()}`}
        aria-label={`Filter by ${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-muted/50 border border-border text-xs px-2 py-1 pr-6 text-foreground focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-cyan-400/50 transition-colors cursor-pointer"
      >
        <option value="">{`All ${label}s`}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ActivityFeedPanel() {
  const projectId = useProjectId();
  const {
    filteredEntries,
    filter,
    setFilter,
    clearAll,
    distinctUsers,
    count,
  } = useActivityFeed(projectId);

  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);
      setFilter({ ...filter, search: q || undefined });
    },
    [filter, setFilter],
  );

  const handleActionFilter = useCallback(
    (action: string) => {
      setFilter({
        ...filter,
        action: action ? (action as ActivityAction) : undefined,
      });
    },
    [filter, setFilter],
  );

  const handleUserFilter = useCallback(
    (userId: string) => {
      setFilter({ ...filter, userId: userId || undefined });
    },
    [filter, setFilter],
  );

  const handleClearFilters = useCallback(() => {
    setFilter({});
    setSearchQuery('');
  }, [setFilter]);

  const hasActiveFilters = useMemo(
    () => !!(filter.action || filter.entityType || filter.userId || filter.search),
    [filter],
  );

  const actionOptions = useMemo(
    () => ALL_ACTIONS.map((a) => ({ value: a, label: ACTION_CONFIG[a].label })),
    [],
  );

  const userOptions = useMemo(
    () =>
      distinctUsers.map((u) => ({
        value: u.userId,
        label: u.userName ?? u.userId,
      })),
    [distinctUsers],
  );

  return (
    <div data-testid="activity-feed-panel" className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Activity Feed</h2>
          {count > 0 && (
            <span
              data-testid="activity-feed-count"
              className="text-[10px] bg-muted/50 border border-border px-1.5 py-0.5 text-muted-foreground"
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="activity-filter-toggle"
            aria-label="Toggle filters"
            className={cn(
              'p-1 transition-colors',
              showFilters || hasActiveFilters
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          {count > 0 && (
            <button
              data-testid="activity-clear-all"
              aria-label="Clear all activity"
              className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
              onClick={clearAll}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 py-2 border-b border-border/50 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            data-testid="activity-search"
            type="text"
            placeholder="Search activity..."
            aria-label="Search activity feed"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-cyan-400/50 transition-colors"
          />
        </div>

        {showFilters && (
          <div data-testid="activity-filters" className="flex items-center gap-2 flex-wrap">
            <FilterDropdown
              label="Action"
              value={filter.action ?? ''}
              options={actionOptions}
              onChange={handleActionFilter}
            />
            {userOptions.length > 0 && (
              <FilterDropdown
                label="User"
                value={filter.userId ?? ''}
                options={userOptions}
                onChange={handleUserFilter}
              />
            )}
            {hasActiveFilters && (
              <button
                data-testid="activity-clear-filters"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 bg-muted/30 border border-border/50"
                onClick={handleClearFilters}
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feed entries */}
      <div
        data-testid="activity-feed-list"
        className="flex-1 overflow-y-auto"
      >
        {filteredEntries.length === 0 ? (
          <div
            data-testid="activity-feed-empty"
            className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 py-8"
          >
            <Activity className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-center mt-1 opacity-70">
              {hasActiveFilters
                ? 'No entries match your filters. Try adjusting or clearing them.'
                : 'Actions like creating nodes, updating BOM items, and running validations will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30" role="list">
            {filteredEntries.map((entry) => {
              const config = ACTION_CONFIG[entry.action];
              const IconComponent = config.icon;
              return (
                <li
                  key={entry.id}
                  data-testid={`activity-entry-${entry.id}`}
                  className="px-4 py-2.5 hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div
                      data-testid={`activity-avatar-${entry.id}`}
                      className="w-7 h-7 shrink-0 bg-muted/50 border border-border flex items-center justify-center text-[10px] font-medium text-muted-foreground mt-0.5"
                      title={entry.userName ?? entry.userId ?? 'System'}
                    >
                      {entry.userName ? (
                        userInitials(entry.userName)
                      ) : entry.userId ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <IconComponent className={cn('w-3 h-3 shrink-0', config.color)} />
                        <span className={cn('text-xs font-medium', config.color)}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {ENTITY_LABELS[entry.entityType]}
                        </span>
                      </div>

                      <p
                        data-testid={`activity-label-${entry.id}`}
                        className="text-xs text-foreground mt-0.5 truncate"
                        title={entry.entityLabel}
                      >
                        {entry.entityLabel}
                      </p>

                      {entry.details && (
                        <p
                          data-testid={`activity-details-${entry.id}`}
                          className="text-[10px] text-muted-foreground mt-0.5 truncate"
                          title={entry.details}
                        >
                          {entry.details}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        {entry.userName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {entry.userName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
