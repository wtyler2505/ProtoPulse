import { memo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  AlertCircle,
  Plus,
  Minus,
  RefreshCw,
  FileInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportPreview } from '@/lib/import-preview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreview | null;
  fileName: string;
  onApply: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DiffRowProps {
  label: string;
  count: number;
  variant: 'added' | 'modified' | 'removed';
  testId: string;
}

function DiffRow({ label, count, variant, testId }: DiffRowProps) {
  if (count === 0) {
    return null;
  }

  const prefix = variant === 'added' ? '+' : variant === 'modified' ? '~' : '-';
  const Icon = variant === 'added' ? Plus : variant === 'modified' ? RefreshCw : Minus;
  const colorClass =
    variant === 'added'
      ? 'text-green-400 bg-green-400/10 border-green-400/30'
      : variant === 'modified'
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
        : 'text-red-400 bg-red-400/10 border-red-400/30';

  return (
    <div
      className="flex items-center justify-between py-1.5"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn('w-3 h-3', colorClass.split(' ')[0])} />
        <span>{label}</span>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-mono tabular-nums px-1.5 py-0',
          colorClass,
        )}
        data-testid={`${testId}-badge`}
      >
        {prefix}{String(count)}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ImportPreviewDialogInner({
  open,
  onOpenChange,
  preview,
  fileName,
  onApply,
  onCancel,
}: ImportPreviewDialogProps) {
  if (!preview) {
    return null;
  }

  const hasChanges =
    preview.addedNodes > 0 ||
    preview.modifiedNodes > 0 ||
    preview.addedEdges > 0 ||
    preview.addedComponents > 0 ||
    preview.addedNets > 0 ||
    preview.addedWires > 0;

  const hasWarnings = preview.warnings.length > 0;
  const hasConflicts = preview.conflicts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="import-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileInput className="w-4 h-4 text-primary" />
            Import Preview
          </DialogTitle>
          <DialogDescription className="text-xs" data-testid="import-preview-filename">
            Review changes from <span className="font-mono text-foreground">{fileName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Diff summary */}
        <div
          className="space-y-0.5 border border-border/50 rounded-md px-3 py-2"
          data-testid="import-preview-diff"
        >
          <DiffRow
            label="Nodes"
            count={preview.addedNodes}
            variant="added"
            testId="import-diff-added-nodes"
          />
          <DiffRow
            label="Nodes (modified)"
            count={preview.modifiedNodes}
            variant="modified"
            testId="import-diff-modified-nodes"
          />
          <DiffRow
            label="Nodes (orphaned)"
            count={preview.removedNodes}
            variant="removed"
            testId="import-diff-removed-nodes"
          />
          <DiffRow
            label="Edges"
            count={preview.addedEdges}
            variant="added"
            testId="import-diff-added-edges"
          />
          <DiffRow
            label="BOM items"
            count={preview.addedComponents}
            variant="added"
            testId="import-diff-added-components"
          />
          <DiffRow
            label="Nets"
            count={preview.addedNets}
            variant="added"
            testId="import-diff-added-nets"
          />
          <DiffRow
            label="Wires"
            count={preview.addedWires}
            variant="added"
            testId="import-diff-added-wires"
          />

          {!hasChanges && (
            <p
              className="text-xs text-muted-foreground py-2 text-center"
              data-testid="import-no-changes"
            >
              No changes detected.
            </p>
          )}
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div
            className="space-y-1 border border-amber-400/30 bg-amber-400/5 rounded-md px-3 py-2"
            data-testid="import-preview-warnings"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Warnings ({String(preview.warnings.length)})
            </div>
            <ul className="space-y-0.5">
              {preview.warnings.map((w, i) => (
                <li
                  key={i}
                  className="text-[10px] text-amber-300/80 leading-tight pl-4"
                  data-testid={`import-warning-${String(i)}`}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Conflicts */}
        {hasConflicts && (
          <div
            className="space-y-1 border border-red-400/30 bg-red-400/5 rounded-md px-3 py-2"
            data-testid="import-preview-conflicts"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <AlertCircle className="w-3 h-3" />
              Conflicts ({String(preview.conflicts.length)})
            </div>
            <ul className="space-y-0.5">
              {preview.conflicts.map((c, i) => (
                <li
                  key={i}
                  className="text-[10px] text-red-300/80 leading-tight pl-4"
                  data-testid={`import-conflict-${String(i)}`}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-testid="import-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={!hasChanges}
            data-testid="import-preview-apply"
          >
            Apply Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ImportPreviewDialog = memo(ImportPreviewDialogInner);
export default ImportPreviewDialog;
