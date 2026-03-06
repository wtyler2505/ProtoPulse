import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Camera, Trash2, GitCompareArrows, Plus, Minus, Pencil, Loader2, ArrowUpDown, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { BomDiffResult, BomDiffEntry } from '@shared/bom-diff';

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

interface BomSnapshotListItem {
  id: number;
  projectId: number;
  label: string;
  createdAt: string;
}

interface DiffApiResponse {
  snapshot: { id: number; label: string; createdAt: string };
  diff: BomDiffResult;
}

// ---------------------------------------------------------------------------
// BomDiffPanel
// ---------------------------------------------------------------------------

export default function BomDiffPanel() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');

  // Fetch snapshots
  const { data: snapshotsResponse, isLoading: snapshotsLoading } = useQuery<{ data: BomSnapshotListItem[]; total: number }>({
    queryKey: [`/api/projects/${projectId}/bom-snapshots`],
  });

  const snapshots = useMemo(() => snapshotsResponse?.data ?? [], [snapshotsResponse]);

  // Fetch diff when a snapshot is selected
  const { data: diffResponse, isLoading: diffLoading, isFetching: diffFetching } = useQuery<DiffApiResponse>({
    queryKey: [`/api/projects/${projectId}/bom-diff`, selectedSnapshotId],
    queryFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/bom-diff`, {
        snapshotId: Number(selectedSnapshotId),
      });
      return res.json() as Promise<DiffApiResponse>;
    },
    enabled: !!selectedSnapshotId,
  });

  // Create snapshot mutation
  const createSnapshot = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/bom-snapshots`, { label });
      return res.json() as Promise<BomSnapshotListItem>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/bom-snapshots`] });
      setShowCreateDialog(false);
      setNewLabel('');
      toast({ title: 'Snapshot created', description: 'BOM snapshot saved successfully.' });
    },
  });

  // Delete snapshot mutation
  const deleteSnapshot = useMutation({
    mutationFn: async (snapshotId: number) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/bom-snapshots/${snapshotId}`);
    },
    onSuccess: (_data, snapshotId) => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/bom-snapshots`] });
      if (selectedSnapshotId === String(snapshotId)) {
        setSelectedSnapshotId('');
      }
      toast({ title: 'Snapshot deleted' });
    },
  });

  const handleCreateSnapshot = useCallback(() => {
    const trimmed = newLabel.trim();
    if (trimmed) {
      createSnapshot.mutate(trimmed);
    }
  }, [newLabel, createSnapshot]);

  const diff = diffResponse?.diff;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto" data-testid="bom-diff-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2" data-testid="bom-diff-title">
          <GitCompareArrows className="h-5 w-5 text-cyan-400" />
          BOM Comparison
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreateDialog(true)}
          data-testid="create-snapshot-button"
        >
          <Camera className="h-4 w-4 mr-1" />
          Take Snapshot
        </Button>
      </div>

      {/* Snapshot selector */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedSnapshotId}
          onValueChange={setSelectedSnapshotId}
        >
          <SelectTrigger className="w-[300px]" data-testid="snapshot-select">
            <SelectValue placeholder={snapshotsLoading ? 'Loading...' : 'Select a snapshot to compare'} />
          </SelectTrigger>
          <SelectContent>
            {snapshots.map((s) => (
              <SelectItem key={s.id} value={String(s.id)} data-testid={`snapshot-option-${s.id}`}>
                {s.label} — {format(new Date(s.createdAt), 'MMM d, yyyy HH:mm')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedSnapshotId && (
          <ConfirmDialog
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleteSnapshot.isPending}
                data-testid="delete-snapshot-button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
            title="Delete BOM Snapshot"
            description={`Are you sure you want to delete this snapshot? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => deleteSnapshot.mutate(Number(selectedSnapshotId))}
          />
        )}
      </div>

      {/* Diff results */}
      {(diffLoading || diffFetching) && selectedSnapshotId && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center" data-testid="diff-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing diff...
        </div>
      )}

      {diff && !diffFetching && (
        <>
          {/* Summary stats */}
          <DiffSummary summary={diff.summary} />

          {/* Diff table */}
          {diff.entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8" data-testid="diff-no-changes">
              No changes detected between the snapshot and current BOM.
            </div>
          ) : (
            <DiffTable entries={diff.entries} />
          )}
        </>
      )}

      {!selectedSnapshotId && !snapshotsLoading && snapshots.length === 0 && (
        <div className="text-center text-muted-foreground py-8" data-testid="diff-empty-state">
          No snapshots yet. Take a snapshot to start tracking BOM changes.
        </div>
      )}

      {/* Create snapshot dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create BOM Snapshot</DialogTitle>
            <DialogDescription>
              Save a point-in-time copy of your current BOM for future comparison.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder='e.g. "Rev A", "Before power supply change"'
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleCreateSnapshot(); }
              }}
              data-testid="snapshot-label-input"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="cancel-snapshot-button">
              Cancel
            </Button>
            <Button
              onClick={handleCreateSnapshot}
              disabled={!newLabel.trim() || createSnapshot.isPending}
              data-testid="confirm-snapshot-button"
            >
              {createSnapshot.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</>
              ) : (
                'Create Snapshot'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffSummary
// ---------------------------------------------------------------------------

function DiffSummary({ summary }: { summary: BomDiffResult['summary'] }) {
  const costDeltaColor = summary.costDelta > 0
    ? 'text-red-400'
    : summary.costDelta < 0
      ? 'text-green-400'
      : 'text-muted-foreground';

  const costDeltaSign = summary.costDelta > 0 ? '+' : '';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="diff-summary">
      <SummaryCard
        label="Added"
        value={summary.addedCount}
        icon={<Plus className="h-4 w-4" />}
        color="text-green-400"
        testId="summary-added"
      />
      <SummaryCard
        label="Removed"
        value={summary.removedCount}
        icon={<Minus className="h-4 w-4" />}
        color="text-red-400"
        testId="summary-removed"
      />
      <SummaryCard
        label="Modified"
        value={summary.modifiedCount}
        icon={<Pencil className="h-4 w-4" />}
        color="text-yellow-400"
        testId="summary-modified"
      />
      <div
        className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1"
        data-testid="summary-cost-delta"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          Cost Delta
        </div>
        <span className={cn('text-lg font-semibold tabular-nums', costDeltaColor)}>
          {costDeltaSign}${summary.costDelta.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, testId }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1" data-testid={testId}>
      <div className={cn('flex items-center gap-1.5 text-xs', color)}>
        {icon}
        {label}
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffTable
// ---------------------------------------------------------------------------

function DiffTable({ entries }: { entries: BomDiffEntry[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden" data-testid="diff-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[80px]">
              <ArrowUpDown className="h-3.5 w-3.5 inline mr-1" />
              Change
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Part Number</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <DiffRow key={`${entry.type}-${entry.partNumber}`} entry={entry} index={idx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ entry, index }: { entry: BomDiffEntry; index: number }) {
  const bgClass = index % 2 === 0 ? '' : 'bg-muted/20';

  switch (entry.type) {
    case 'added':
      return (
        <tr className={cn('border-b border-border/50', bgClass)} data-testid={`diff-row-added-${entry.partNumber}`}>
          <td className="px-3 py-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
              <Plus className="h-3 w-3 mr-0.5" />Added
            </Badge>
          </td>
          <td className="px-3 py-2 font-mono text-xs">{entry.partNumber}</td>
          <td className="px-3 py-2 text-muted-foreground text-xs">
            {entry.current.description} — Qty: {entry.current.quantity}, ${String(entry.current.unitPrice)}/ea
          </td>
        </tr>
      );

    case 'removed':
      return (
        <tr className={cn('border-b border-border/50', bgClass)} data-testid={`diff-row-removed-${entry.partNumber}`}>
          <td className="px-3 py-2">
            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
              <Minus className="h-3 w-3 mr-0.5" />Removed
            </Badge>
          </td>
          <td className="px-3 py-2 font-mono text-xs">{entry.partNumber}</td>
          <td className="px-3 py-2 text-muted-foreground text-xs">
            {entry.baseline.description} — Was Qty: {entry.baseline.quantity}, ${String(entry.baseline.unitPrice)}/ea
          </td>
        </tr>
      );

    case 'modified':
      return (
        <tr className={cn('border-b border-border/50', bgClass)} data-testid={`diff-row-modified-${entry.partNumber}`}>
          <td className="px-3 py-2">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              <Pencil className="h-3 w-3 mr-0.5" />Modified
            </Badge>
          </td>
          <td className="px-3 py-2 font-mono text-xs">{entry.partNumber}</td>
          <td className="px-3 py-2">
            <div className="flex flex-col gap-0.5">
              {entry.changes.map((change) => (
                <span key={change.field} className="text-xs">
                  <span className="text-muted-foreground">{change.field}:</span>{' '}
                  <span className="text-red-400 line-through">{String(change.oldValue ?? '—')}</span>
                  {' → '}
                  <span className="text-green-400">{String(change.newValue ?? '—')}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      );

    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}
