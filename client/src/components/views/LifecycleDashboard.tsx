import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  ArrowUpDown,
  Activity,
  ShieldCheck,
  AlertCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import type { ComponentLifecycle } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type LifecycleStatus = 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';

const LIFECYCLE_STATUSES: LifecycleStatus[] = ['active', 'nrnd', 'eol', 'obsolete', 'unknown'];

const STATUS_CONFIG: Record<LifecycleStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof ShieldCheck }> = {
  active: { label: 'Active', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', icon: ShieldCheck },
  nrnd: { label: 'NRND', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20', icon: AlertCircle },
  eol: { label: 'EOL', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20', icon: AlertTriangle },
  obsolete: { label: 'Obsolete', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: XCircle },
  unknown: { label: 'Unknown', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20', icon: HelpCircle },
};

type SortField = 'partNumber' | 'manufacturer' | 'lifecycleStatus' | 'updatedAt';
type SortDir = 'asc' | 'desc';

interface LifecycleApiResponse {
  data: ComponentLifecycle[];
  total: number;
}

interface FormState {
  partNumber: string;
  manufacturer: string;
  lifecycleStatus: LifecycleStatus;
  alternatePartNumbers: string;
  dataSource: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  partNumber: '',
  manufacturer: '',
  lifecycleStatus: 'active',
  alternatePartNumbers: '',
  dataSource: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as LifecycleStatus] ?? STATUS_CONFIG.unknown;
  return (
    <Badge
      data-testid={`badge-status-${status}`}
      className={cn('gap-1 font-mono text-[11px]', config.color, config.bgColor, 'border', config.borderColor)}
      variant="outline"
    >
      <config.icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
});

const StatusCard = memo(function StatusCard({
  status,
  count,
  total,
}: {
  status: LifecycleStatus;
  count: number;
  total: number;
}) {
  const config = STATUS_CONFIG[status];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Card
      data-testid={`card-status-${status}`}
      className={cn('border', config.borderColor, 'bg-card/60 backdrop-blur-sm')}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-md', config.bgColor)}>
          <config.icon className={cn('w-5 h-5', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{config.label}</p>
          <p className={cn('text-2xl font-bold tabular-nums', config.color)}>{count}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </CardContent>
    </Card>
  );
});

const RiskBanner = memo(function RiskBanner({
  eolCount,
  obsoleteCount,
}: {
  eolCount: number;
  obsoleteCount: number;
}) {
  if (eolCount === 0 && obsoleteCount === 0) {
    return null;
  }
  const parts: string[] = [];
  if (eolCount > 0) {
    parts.push(`${eolCount} at end-of-life`);
  }
  if (obsoleteCount > 0) {
    parts.push(`${obsoleteCount} obsolete`);
  }
  const total = eolCount + obsoleteCount;
  return (
    <div
      data-testid="risk-alert-banner"
      className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-300"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 text-orange-400" />
      <p className="text-sm">
        <span className="font-semibold">{total} component{total !== 1 ? 's' : ''} require attention:</span>{' '}
        {parts.join(', ')}
      </p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LifecycleDashboard() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Data fetching
  const { data: apiResponse, isLoading } = useQuery<LifecycleApiResponse>({
    queryKey: [`/api/projects/${projectId}/lifecycle`],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const entries = apiResponse?.data ?? [];

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('partNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ComponentLifecycle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const payload = {
        projectId,
        partNumber: data.partNumber,
        manufacturer: data.manufacturer || null,
        lifecycleStatus: data.lifecycleStatus,
        alternatePartNumbers: data.alternatePartNumbers || null,
        dataSource: data.dataSource || null,
        notes: data.notes || null,
      };
      await apiRequest('POST', `/api/projects/${projectId}/lifecycle`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lifecycle`] });
      toast({ title: 'Component Added', description: 'Lifecycle entry created successfully.' });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add component', description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FormState> }) => {
      const payload: Record<string, unknown> = {};
      if (data.partNumber !== undefined) { payload.partNumber = data.partNumber; }
      if (data.manufacturer !== undefined) { payload.manufacturer = data.manufacturer || null; }
      if (data.lifecycleStatus !== undefined) { payload.lifecycleStatus = data.lifecycleStatus; }
      if (data.alternatePartNumbers !== undefined) { payload.alternatePartNumbers = data.alternatePartNumbers || null; }
      if (data.dataSource !== undefined) { payload.dataSource = data.dataSource || null; }
      if (data.notes !== undefined) { payload.notes = data.notes || null; }
      await apiRequest('PATCH', `/api/projects/${projectId}/lifecycle/${id}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lifecycle`] });
      toast({ title: 'Component Updated', description: 'Lifecycle entry updated successfully.' });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update component', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/lifecycle/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lifecycle`] });
      toast({ title: 'Component Deleted', description: 'Lifecycle entry removed.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete component', description: err.message });
    },
  });

  // Computed values
  const statusCounts = useMemo(() => {
    const counts: Record<LifecycleStatus, number> = { active: 0, nrnd: 0, eol: 0, obsolete: 0, unknown: 0 };
    for (const entry of entries) {
      const s = entry.lifecycleStatus as LifecycleStatus;
      if (s in counts) {
        counts[s]++;
      } else {
        counts.unknown++;
      }
    }
    return counts;
  }, [entries]);

  const filteredAndSorted = useMemo(() => {
    let result = entries;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.lifecycleStatus === statusFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.partNumber.toLowerCase().includes(q) ||
          (e.manufacturer?.toLowerCase().includes(q) ?? false),
      );
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const getVal = (entry: ComponentLifecycle): string => {
        switch (sortField) {
          case 'partNumber': return entry.partNumber;
          case 'manufacturer': return entry.manufacturer ?? '';
          case 'lifecycleStatus': return entry.lifecycleStatus;
          case 'updatedAt': return entry.updatedAt ? new Date(entry.updatedAt).toISOString() : '';
        }
      };
      return getVal(a).localeCompare(getVal(b)) * dir;
    });

    return result;
  }, [entries, statusFilter, searchQuery, sortField, sortDir]);

  // Handlers
  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((entry: ComponentLifecycle) => {
    setEditingEntry(entry);
    setForm({
      partNumber: entry.partNumber,
      manufacturer: entry.manufacturer ?? '',
      lifecycleStatus: (entry.lifecycleStatus as LifecycleStatus) || 'unknown',
      alternatePartNumbers: entry.alternatePartNumbers ?? '',
      dataSource: entry.dataSource ?? '',
      notes: entry.notes ?? '',
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingEntry(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.partNumber.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Part number is required.' });
      return;
    }
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }, [form, editingEntry, createMutation, updateMutation, toast]);

  const handleDelete = useCallback(
    (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const exportCsv = useCallback(() => {
    if (entries.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'There are no lifecycle entries to export.' });
      return;
    }
    const headers = ['Part Number', 'Manufacturer', 'Status', 'Alternate Part Numbers', 'Data Source', 'Notes', 'Last Updated'];
    const rows = entries.map((e) => [
      e.partNumber,
      e.manufacturer ?? '',
      (STATUS_CONFIG[e.lifecycleStatus as LifecycleStatus] ?? STATUS_CONFIG.unknown).label,
      e.alternatePartNumbers ?? '',
      e.dataSource ?? '',
      (e.notes ?? '').replace(/"/g, '""'),
      e.updatedAt ? format(new Date(e.updatedAt), 'yyyy-MM-dd HH:mm') : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifecycle-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Exported', description: `Exported ${entries.length} entries.` });
  }, [entries, toast]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const updateFormField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Sort indicator helper
  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) {
        return <ArrowUpDown className="w-3 h-3 opacity-40" />;
      }
      return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    },
    [sortField, sortDir],
  );

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="lifecycle-loading" className="flex items-center justify-center h-full w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          <span className="text-sm text-muted-foreground">Loading lifecycle data...</span>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="lifecycle-dashboard" className="h-full p-3 md:p-6 bg-background/50 flex flex-col items-center overflow-auto">
      <div className="w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-3">
              <Activity className="w-7 h-7 text-primary" />
              Component Lifecycle
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Track lifecycle status and supply chain risk for {entries.length} component{entries.length !== 1 ? 's' : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="button-export-csv"
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={entries.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button
              data-testid="button-add-component"
              size="sm"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Component
            </Button>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div data-testid="status-summary" className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {LIFECYCLE_STATUSES.map((s) => (
            <StatusCard key={s} status={s} count={statusCounts[s]} total={entries.length} />
          ))}
        </div>

        {/* Risk Alert Banner */}
        <RiskBanner eolCount={statusCounts.eol} obsoleteCount={statusCounts.obsolete} />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search part number or manufacturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as LifecycleStatus | 'all')}
          >
            <SelectTrigger data-testid="select-status-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LIFECYCLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Component Table */}
        <div className="border border-border rounded-lg bg-card/40 backdrop-blur-sm overflow-hidden">
          {filteredAndSorted.length === 0 ? (
            <div data-testid="empty-state-lifecycle" className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mb-3 text-emerald-500/20" />
              <p className="text-base font-medium text-foreground">
                {entries.length === 0 ? 'No components tracked' : 'No matching components'}
              </p>
              <p className="text-sm mt-1">
                {entries.length === 0
                  ? 'Add components to begin tracking their lifecycle status.'
                  : 'Adjust your search or filter criteria.'}
              </p>
              {entries.length === 0 && (
                <Button
                  data-testid="button-add-component-empty"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={openCreateDialog}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Component
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  <TableHead>
                    <button
                      data-testid="sort-partNumber"
                      onClick={() => toggleSort('partNumber')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Part Number
                      {renderSortIcon('partNumber')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      data-testid="sort-manufacturer"
                      onClick={() => toggleSort('manufacturer')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Manufacturer
                      {renderSortIcon('manufacturer')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      data-testid="sort-lifecycleStatus"
                      onClick={() => toggleSort('lifecycleStatus')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Status
                      {renderSortIcon('lifecycleStatus')}
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <span className="text-xs font-semibold uppercase tracking-wider">Alternates</span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <span className="text-xs font-semibold uppercase tracking-wider">Data Source</span>
                  </TableHead>
                  <TableHead>
                    <button
                      data-testid="sort-updatedAt"
                      onClick={() => toggleSort('updatedAt')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Last Updated
                      {renderSortIcon('updatedAt')}
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((entry) => (
                  <LifecycleRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedId === entry.id}
                    onToggle={toggleExpanded}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Component' : 'Add Component'}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? 'Update lifecycle tracking details for this component.'
                : 'Add a new component to lifecycle tracking.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partNumber">Part Number *</Label>
              <Input
                id="partNumber"
                data-testid="input-partNumber"
                placeholder="e.g. STM32F407VGT6"
                value={form.partNumber}
                onChange={(e) => updateFormField('partNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                data-testid="input-manufacturer"
                placeholder="e.g. STMicroelectronics"
                value={form.manufacturer}
                onChange={(e) => updateFormField('manufacturer', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lifecycleStatus">Lifecycle Status</Label>
              <Select
                value={form.lifecycleStatus}
                onValueChange={(v) => updateFormField('lifecycleStatus', v as LifecycleStatus)}
              >
                <SelectTrigger id="lifecycleStatus" data-testid="select-lifecycleStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternatePartNumbers">Alternate Part Numbers</Label>
              <Input
                id="alternatePartNumbers"
                data-testid="input-alternatePartNumbers"
                placeholder="Comma-separated, e.g. STM32F405RGT6, STM32F427VGT6"
                value={form.alternatePartNumbers}
                onChange={(e) => updateFormField('alternatePartNumbers', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataSource">Data Source</Label>
              <Input
                id="dataSource"
                data-testid="input-dataSource"
                placeholder="e.g. Octopart, Digi-Key, manufacturer datasheet"
                value={form.dataSource}
                onChange={(e) => updateFormField('dataSource', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                data-testid="input-notes"
                placeholder="Additional notes about this component's lifecycle..."
                value={form.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="button-dialog-cancel"
              variant="outline"
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-dialog-save"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full mr-1.5" />
              )}
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

const LifecycleRow = memo(function LifecycleRow({
  entry,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  entry: ComponentLifecycle;
  isExpanded: boolean;
  onToggle: (id: number) => void;
  onEdit: (entry: ComponentLifecycle) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
}) {
  const alternates = entry.alternatePartNumbers
    ? entry.alternatePartNumbers.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <>
      <TableRow
        data-testid={`row-lifecycle-${entry.id}`}
        className="cursor-pointer"
        onClick={() => onToggle(entry.id)}
      >
        <TableCell className="font-mono text-sm font-medium text-foreground">
          {entry.partNumber}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {entry.manufacturer ?? '-'}
        </TableCell>
        <TableCell>
          <StatusBadge status={entry.lifecycleStatus} />
        </TableCell>
        <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
          {alternates.length > 0 ? (
            <span title={alternates.join(', ')}>
              {alternates.length} alternate{alternates.length !== 1 ? 's' : ''}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
          {entry.dataSource ?? '-'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground tabular-nums">
          {entry.updatedAt ? format(new Date(entry.updatedAt), 'MMM d, yyyy') : '-'}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <button
              data-testid={`button-edit-${entry.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(entry);
              }}
              className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Edit ${entry.partNumber}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              data-testid={`button-delete-${entry.id}`}
              onClick={(e) => onDelete(entry.id, e)}
              className="p-1.5 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Delete ${entry.partNumber}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow data-testid={`row-lifecycle-expanded-${entry.id}`} className="bg-muted/5 hover:bg-muted/5">
          <TableCell colSpan={7} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {alternates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Alternate Part Numbers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {alternates.map((alt) => (
                      <span
                        key={alt}
                        className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary border border-primary/20 rounded-sm"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entry.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}
              {entry.dataSource && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data Source</p>
                  <p className="text-muted-foreground">{entry.dataSource}</p>
                </div>
              )}
              {entry.updatedAt && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Last Updated</p>
                  <p className="text-muted-foreground">{format(new Date(entry.updatedAt), 'PPpp')}</p>
                </div>
              )}
              {!alternates.length && !entry.notes && !entry.dataSource && (
                <p className="text-muted-foreground italic">No additional details available.</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
});
