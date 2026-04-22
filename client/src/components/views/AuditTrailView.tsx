import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Pencil,
  RotateCcw,
  Upload,
  FileOutput,
  Clock,
  Filter,
  X,
} from 'lucide-react';
import {
  filterAuditEntries,
  exportAuditCSV,
  formatAuditDiff,
  entityTypeLabel,
  actionLabel,
  formatDiffValue,
} from '@/lib/audit-trail';
import type { AuditEntry, AuditAction, AuditEntityType, AuditFilters, DiffLine } from '@/lib/audit-trail';

// ---------------------------------------------------------------------------
// Audit entries source
// ---------------------------------------------------------------------------
// Historical note (E2E-298 / E2E-460): this view used to render a hardcoded
// DEMO_ENTRIES constant (5 rows attributed to the "OmniTrek Nexus" sample
// project) on every project, which looked exactly like a project-scope leak
// during Tyler's 2026-04-18 E2E walkthrough. It was in fact placeholder demo
// data that was never replaced with a real fetch.
//
// Until the real backend audit subsystem lands (tracked as BL-0863), this
// component renders an empty list — which causes the existing empty-state
// UI below to show "No audit entries found". Generic project-scope middleware
// is tracked as BL-0864.
const ENTRIES: AuditEntry[] = [];

const ALL_ENTITY_TYPES: AuditEntityType[] = [
  'project',
  'architecture_node',
  'architecture_edge',
  'bom_item',
  'circuit_design',
  'circuit_instance',
  'circuit_net',
  'circuit_wire',
  'validation_issue',
  'component',
  'setting',
  'snapshot',
  'comment',
];

const ALL_ACTIONS: AuditAction[] = ['create', 'update', 'delete', 'restore', 'export', 'import'];

// ---------------------------------------------------------------------------
// Action icon helper
// ---------------------------------------------------------------------------

function ActionIcon({ action }: { action: AuditAction }) {
  const iconClass = 'h-4 w-4';
  switch (action) {
    case 'create':
      return <Plus className={cn(iconClass, 'text-green-400')} />;
    case 'update':
      return <Pencil className={cn(iconClass, 'text-cyan-400')} />;
    case 'delete':
      return <Minus className={cn(iconClass, 'text-red-400')} />;
    case 'restore':
      return <RotateCcw className={cn(iconClass, 'text-yellow-400')} />;
    case 'export':
      return <FileOutput className={cn(iconClass, 'text-purple-400')} />;
    case 'import':
      return <Upload className={cn(iconClass, 'text-blue-400')} />;
  }
}

function actionBadgeVariant(action: AuditAction): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'delete':
      return 'destructive';
    case 'create':
    case 'import':
      return 'default';
    default:
      return 'secondary';
  }
}

// ---------------------------------------------------------------------------
// Diff display component
// ---------------------------------------------------------------------------

function DiffDisplay({ diffs }: { diffs: DiffLine[] }) {
  if (diffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic" data-testid="diff-empty">
        No field changes
      </p>
    );
  }

  return (
    <div className="space-y-1" data-testid="diff-display">
      {diffs.map((diff) => (
        <div
          key={diff.field}
          className={cn(
            'flex items-start gap-2 rounded px-2 py-1 text-xs font-mono',
            diff.type === 'added' && 'bg-green-950/40 text-green-300',
            diff.type === 'removed' && 'bg-red-950/40 text-red-300',
            diff.type === 'changed' && 'bg-cyan-950/30 text-cyan-300',
          )}
          data-testid={`diff-line-${diff.field}`}
        >
          <span className="font-semibold min-w-[100px] shrink-0">{diff.field}</span>
          {diff.type === 'added' && <span>+ {formatDiffValue(diff.newValue)}</span>}
          {diff.type === 'removed' && <span>- {formatDiffValue(diff.oldValue)}</span>}
          {diff.type === 'changed' && (
            <span>
              {formatDiffValue(diff.oldValue)} → {formatDiffValue(diff.newValue)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single audit entry row
// ---------------------------------------------------------------------------

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const diffs = useMemo(() => formatAuditDiff(entry.before, entry.after), [entry.before, entry.after]);
  const hasDiffs = diffs.length > 0 || entry.before !== undefined || entry.after !== undefined;

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  let formattedTime: string;
  try {
    formattedTime = format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm:ss');
  } catch {
    formattedTime = entry.timestamp;
  }

  return (
    <div className="border-b border-border/50 last:border-b-0" data-testid={`audit-entry-${entry.id}`}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={toggleExpand}
        disabled={!hasDiffs}
        data-testid={`audit-entry-toggle-${entry.id}`}
        aria-expanded={expanded}
      >
        {hasDiffs ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="h-4 w-4 shrink-0" />
        )}

        <ActionIcon action={entry.action} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{entry.entityLabel ?? entry.entityId}</span>
            <Badge variant={actionBadgeVariant(entry.action)} className="text-xs">
              {actionLabel(entry.action)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {entityTypeLabel(entry.entityType)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formattedTime}</span>
            <span>by {entry.userName}</span>
            {diffs.length > 0 && (
              <span className="text-cyan-400/70">
                ({diffs.length} field{diffs.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && hasDiffs && (
        <div className="px-4 pb-3 pl-14" data-testid={`audit-entry-diff-${entry.id}`}>
          <DiffDisplay diffs={diffs} />
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold">Metadata: </span>
              {Object.entries(entry.metadata).map(([k, v]) => (
                <span key={k} className="mr-3">
                  {k}={formatDiffValue(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function AuditTrailView() {
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const filters: AuditFilters = useMemo(() => {
    const f: AuditFilters = {};
    if (search) {
      f.search = search;
    }
    if (entityTypeFilter !== 'all') {
      f.entityType = entityTypeFilter as AuditEntityType;
    }
    if (actionFilter !== 'all') {
      f.action = actionFilter as AuditAction;
    }
    if (dateStart && dateEnd) {
      f.dateRange = {
        start: new Date(dateStart).toISOString(),
        end: new Date(`${dateEnd}T23:59:59`).toISOString(),
      };
    }
    return f;
  }, [search, entityTypeFilter, actionFilter, dateStart, dateEnd]);

  const filteredEntries = useMemo(() => filterAuditEntries(ENTRIES, filters), [filters]);

  const hasActiveFilters = search || entityTypeFilter !== 'all' || actionFilter !== 'all' || dateStart || dateEnd;

  const clearFilters = useCallback(() => {
    setSearch('');
    setEntityTypeFilter('all');
    setActionFilter('all');
    setDateStart('');
    setDateEnd('');
  }, []);

  const handleExportCSV = useCallback(() => {
    const csv = exportAuditCSV(filteredEntries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries]);

  return (
    <div className="flex flex-col h-full" data-testid="audit-trail-view">
      <Card className="flex flex-col flex-1 overflow-hidden border-border/50">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-400" />
              Audit Trail
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredEntries.length === 0}
              data-testid="audit-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mt-3" data-testid="audit-filters">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                className="pl-9 h-9"
                data-testid="audit-search-input"
              />
            </div>

            {/* Entity type filter */}
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-[180px] h-9" data-testid="audit-entity-type-filter">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {ALL_ENTITY_TYPES.map((et) => (
                  <SelectItem key={et} value={et}>
                    {entityTypeLabel(et)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px] h-9" data-testid="audit-action-filter">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ALL_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                }}
                className="h-9 w-[140px] text-xs"
                data-testid="audit-date-start"
                aria-label="Start date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                }}
                className="h-9 w-[140px] text-xs"
                data-testid="audit-date-end"
                aria-label="End date"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="audit-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Results count */}
          <div className="text-xs text-muted-foreground mt-2" data-testid="audit-result-count">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            {hasActiveFilters && ` (filtered from ${ENTRIES.length})`}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            {filteredEntries.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                data-testid="audit-empty-state"
              >
                <Clock className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No audit entries found</p>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div data-testid="audit-entries-list">
                {filteredEntries.map((entry) => (
                  <AuditEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
