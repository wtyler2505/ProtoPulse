import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { getQueryFn } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Trash2, GitCompareArrows, Clock, Plus, Minus, Pencil, ArrowRight, Layers } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ArchDiffResult, ArchNodeDiffEntry, ArchEdgeDiffEntry, ArchFieldChange } from '@shared/arch-diff';

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface DesignSnapshotSummary {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface DiffResponse {
  snapshot: { id: number; name: string; createdAt: string };
  diff: ArchDiffResult;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignHistoryView() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState<number | null>(null);

  // Fetch snapshots
  const { data: snapshotsResponse, isLoading } = useQuery<{ data: DesignSnapshotSummary[]; total: number }>({
    queryKey: [`/api/projects/${projectId}/snapshots`],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  const snapshots = snapshotsResponse?.data ?? [];

  // Create snapshot mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/snapshots`, payload);
      return res.json() as Promise<DesignSnapshotSummary>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/snapshots`] });
      setCreateDialogOpen(false);
      setSnapshotName('');
      setSnapshotDescription('');
      toast({ title: 'Snapshot saved', description: 'Architecture state has been captured.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Failed to save snapshot', description: err.message });
    },
  });

  // Delete snapshot mutation
  const deleteMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/snapshots/${snapshotId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/snapshots`] });
      if (diffResult) {
        setDiffResult(null);
      }
      toast({ title: 'Snapshot deleted' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete snapshot', description: err.message });
    },
  });

  // Compare snapshot to current
  const handleCompare = useCallback(async (snapshotId: number) => {
    setDiffLoading(snapshotId);
    try {
      const res = await apiRequest('POST', `/api/projects/${projectId}/snapshots/${snapshotId}/diff`);
      const data = await res.json() as DiffResponse;
      setDiffResult(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Diff failed', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setDiffLoading(null);
    }
  }, [projectId, toast]);

  const handleCreate = useCallback(() => {
    if (!snapshotName.trim()) { return; }
    createMutation.mutate({
      name: snapshotName.trim(),
      description: snapshotDescription.trim() || undefined,
    });
  }, [snapshotName, snapshotDescription, createMutation]);

  if (isLoading) {
    return (
      <div data-testid="design-history-loading" className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div data-testid="design-history-view" className="h-full overflow-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary" />
            <h2 data-testid="design-history-title" className="text-lg font-semibold text-foreground">
              Design Version History
            </h2>
            <Badge variant="secondary" data-testid="snapshot-count-badge">
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button
            data-testid="btn-save-snapshot"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            Save Snapshot
          </Button>
        </div>

        {/* Snapshot list */}
        {snapshots.length === 0 ? (
          <Card data-testid="empty-snapshots">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Clock className="w-10 h-10 opacity-50" />
              <p className="text-sm">No snapshots yet. Save one to start tracking changes.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <Card
                key={snapshot.id}
                data-testid={`snapshot-card-${snapshot.id}`}
                className={cn(
                  'transition-colors',
                  diffResult?.snapshot.id === snapshot.id && 'border-primary/50 bg-primary/5',
                )}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate" data-testid={`snapshot-name-${snapshot.id}`}>
                        {snapshot.name}
                      </CardTitle>
                      {snapshot.description && (
                        <CardDescription className="text-xs mt-0.5 line-clamp-2">
                          {snapshot.description}
                        </CardDescription>
                      )}
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`snapshot-date-${snapshot.id}`}>
                        {format(new Date(snapshot.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`btn-compare-${snapshot.id}`}
                        onClick={() => void handleCompare(snapshot.id)}
                        disabled={diffLoading === snapshot.id}
                        className="gap-1.5"
                      >
                        <GitCompareArrows className="w-3.5 h-3.5" />
                        {diffLoading === snapshot.id ? 'Comparing...' : 'Compare to Current'}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`btn-delete-snapshot-${snapshot.id}`}
                            disabled={deleteMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        }
                        title="Delete Snapshot"
                        description={`Are you sure you want to delete the snapshot "${String(snapshot.name)}"? This action cannot be undone.`}
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => deleteMutation.mutate(snapshot.id)}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Diff results */}
        {diffResult && (
          <DiffDisplay result={diffResult} />
        )}

        {/* Create snapshot dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent data-testid="create-snapshot-dialog">
            <DialogHeader>
              <DialogTitle>Save Architecture Snapshot</DialogTitle>
              <DialogDescription>
                Capture the current architecture state for later comparison.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label htmlFor="snapshot-name" className="text-sm font-medium">Name</label>
                <Input
                  id="snapshot-name"
                  data-testid="input-snapshot-name"
                  placeholder="e.g. Pre-refactor baseline"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="snapshot-description" className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  id="snapshot-description"
                  data-testid="input-snapshot-description"
                  placeholder="What changed or why you're saving this..."
                  value={snapshotDescription}
                  onChange={(e) => setSnapshotDescription(e.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                data-testid="btn-cancel-snapshot"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                data-testid="btn-confirm-snapshot"
                onClick={handleCreate}
                disabled={!snapshotName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Saving...' : 'Save Snapshot'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diff display sub-components
// ---------------------------------------------------------------------------

function DiffDisplay({ result }: { result: DiffResponse }) {
  const { diff, snapshot } = result;
  const { summary } = diff;

  if (summary.totalChanges === 0) {
    return (
      <Card data-testid="diff-no-changes">
        <CardContent className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
          <GitCompareArrows className="w-8 h-8 opacity-50" />
          <p className="text-sm font-medium">No differences found</p>
          <p className="text-xs">The current architecture matches snapshot &quot;{snapshot.name}&quot;.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="diff-results">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary" />
          Diff: &quot;{snapshot.name}&quot; vs Current
        </CardTitle>
        <div className="flex items-center gap-3 mt-2">
          {summary.nodesAdded > 0 && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30" data-testid="diff-badge-nodes-added">
              <Plus className="w-3 h-3 mr-1" />{summary.nodesAdded} node{summary.nodesAdded !== 1 ? 's' : ''} added
            </Badge>
          )}
          {summary.nodesRemoved > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-400/30" data-testid="diff-badge-nodes-removed">
              <Minus className="w-3 h-3 mr-1" />{summary.nodesRemoved} node{summary.nodesRemoved !== 1 ? 's' : ''} removed
            </Badge>
          )}
          {summary.nodesModified > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30" data-testid="diff-badge-nodes-modified">
              <Pencil className="w-3 h-3 mr-1" />{summary.nodesModified} node{summary.nodesModified !== 1 ? 's' : ''} modified
            </Badge>
          )}
          {summary.edgesAdded > 0 && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30" data-testid="diff-badge-edges-added">
              <Plus className="w-3 h-3 mr-1" />{summary.edgesAdded} edge{summary.edgesAdded !== 1 ? 's' : ''} added
            </Badge>
          )}
          {summary.edgesRemoved > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-400/30" data-testid="diff-badge-edges-removed">
              <Minus className="w-3 h-3 mr-1" />{summary.edgesRemoved} edge{summary.edgesRemoved !== 1 ? 's' : ''} removed
            </Badge>
          )}
          {summary.edgesModified > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30" data-testid="diff-badge-edges-modified">
              <Pencil className="w-3 h-3 mr-1" />{summary.edgesModified} edge{summary.edgesModified !== 1 ? 's' : ''} modified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[500px]">
          {/* Node changes */}
          {diff.nodes.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Node Changes
              </h4>
              <Table data-testid="diff-table-nodes">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Node ID</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.nodes.map((entry, idx) => (
                    <NodeDiffRow key={`node-${idx}`} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Edge changes */}
          {diff.edges.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Edge Changes
              </h4>
              <Table data-testid="diff-table-edges">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Edge ID</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.edges.map((entry, idx) => (
                    <EdgeDiffRow key={`edge-${idx}`} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function DiffStatusBadge({ type }: { type: 'added' | 'removed' | 'modified' }) {
  const config = {
    added: { label: 'Added', className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    removed: { label: 'Removed', className: 'text-red-400 bg-red-400/10 border-red-400/20' },
    modified: { label: 'Modified', className: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  };
  const { label, className } = config[type];
  return <Badge variant="outline" className={cn('text-[10px]', className)}>{label}</Badge>;
}

function FieldChangeList({ changes }: { changes: ArchFieldChange[] }) {
  return (
    <div className="space-y-0.5">
      {changes.map((change, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{change.field}:</span>
          <span className="text-red-400 line-through">{String(change.oldValue ?? 'null')}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-emerald-400">{String(change.newValue ?? 'null')}</span>
        </div>
      ))}
    </div>
  );
}

function NodeDiffRow({ entry }: { entry: ArchNodeDiffEntry }) {
  const nodeId = entry.nodeId;
  const label = entry.type === 'removed' ? entry.baseline.label : entry.current.label;

  return (
    <TableRow data-testid={`diff-row-node-${nodeId}`}>
      <TableCell><DiffStatusBadge type={entry.type} /></TableCell>
      <TableCell className="font-mono text-xs truncate max-w-[120px]" title={nodeId}>{nodeId.slice(0, 8)}...</TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell>
        {entry.type === 'modified' && <FieldChangeList changes={entry.changes} />}
        {entry.type === 'added' && <span className="text-xs text-muted-foreground">New {entry.current.nodeType} node</span>}
        {entry.type === 'removed' && <span className="text-xs text-muted-foreground">Removed {entry.baseline.nodeType} node</span>}
      </TableCell>
    </TableRow>
  );
}

function EdgeDiffRow({ entry }: { entry: ArchEdgeDiffEntry }) {
  const edgeId = entry.edgeId;
  const label = entry.type === 'removed'
    ? (entry.baseline.label ?? '(unlabeled)')
    : (entry.current.label ?? '(unlabeled)');

  return (
    <TableRow data-testid={`diff-row-edge-${edgeId}`}>
      <TableCell><DiffStatusBadge type={entry.type} /></TableCell>
      <TableCell className="font-mono text-xs truncate max-w-[120px]" title={edgeId}>{edgeId.slice(0, 8)}...</TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell>
        {entry.type === 'modified' && <FieldChangeList changes={entry.changes} />}
        {entry.type === 'added' && (
          <span className="text-xs text-muted-foreground">
            {entry.current.source} &rarr; {entry.current.target}
          </span>
        )}
        {entry.type === 'removed' && (
          <span className="text-xs text-muted-foreground">
            {entry.baseline.source} &rarr; {entry.baseline.target}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
